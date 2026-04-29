import { FareCharge } from '../domain/charge.js'
import { Carrier, PaymentMethod, ValidationEventType, Zone } from '../domain/enums.js'
import { ChargeReason } from '../domain/reasons.js'
import { TariffConfig } from '../domain/tariff.js'
import { CalculatedTrip, FareType } from '../domain/trip.js'
import { ValidationEvent } from '../domain/validation.js'
import { getPaymentMethodConfig } from '../rules/paymentMethodRule.js'
import {
  hasMetroAfterMcdRegionToMoscow,
  isMoscowToRegionWindow,
  isRegionToMoscowWindow
} from '../rules/regionSurchargeRule.js'
import { getFreeTransferReason, isFreeTransferAllowed } from '../rules/freeTransferRule.js'
import { isMcdEvent, isValidMcdPair } from '../rules/mcdPairRule.js'

type PriceTripWindowResult = {
  trip: CalculatedTrip
  charges: FareCharge[]
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function chooseFirstChargeAmount(
  firstEvent: ValidationEvent,
  window: ValidationEvent[],
  tariffConfig: TariffConfig,
  paymentMethod: PaymentMethod
): number {
  const paymentConfig = getPaymentMethodConfig(tariffConfig, paymentMethod)
  const hasMcd = window.some((event) => isMcdEvent(event))
  const mcdOnlyWindow = window.every((event) => isMcdEvent(event))
  const moscowToRegionWindow = isMoscowToRegionWindow(window)

  if (!hasMcd || !isMcdEvent(firstEvent)) {
    return paymentConfig.baseFareKopecks
  }

  if (isRegionToMoscowWindow(window)) {
    return paymentConfig.suburbanFareKopecks
  }

  if (window.every((event) => isMcdEvent(event) && event.zone === Zone.MOSCOW)) {
    return paymentConfig.centralFareKopecks
  }

  if (
    tariffConfig.mcdPricingStrategy === 'suburban_fare' &&
    mcdOnlyWindow &&
    moscowToRegionWindow
  ) {
    return paymentConfig.suburbanFareKopecks
  }

  return paymentConfig.baseFareKopecks
}

function resolveFareType(
  window: ValidationEvent[],
  hasRegionSurcharge: boolean,
  regionToMoscowWithMetro: boolean
): FareType {
  const hasMcd = window.some((event) => isMcdEvent(event))
  const hasAutoCompletedByFareCore = window.some(
    (event) => event.metadata?.synthetic === true && event.metadata?.syntheticSource === 'fare-core'
  )

  if (regionToMoscowWithMetro) {
    return 'region_to_moscow_with_free_metro_transfer'
  }

  if (hasAutoCompletedByFareCore) {
    return 'mcd_auto_completed_pair'
  }

  if (hasMcd && hasRegionSurcharge) {
    return 'transfer_window_with_region_surcharge'
  }

  if (hasMcd) {
    return 'mcd_pair'
  }

  if (window.length > 1) {
    return 'transfer_window'
  }

  return 'single_ride'
}

export function priceTripWindow(
  window: ValidationEvent[],
  paymentMethod: PaymentMethod,
  tariffConfig: TariffConfig,
  tripId: string
): PriceTripWindowResult {
  if (window.length === 0) {
    throw new Error('Cannot price empty trip window.')
  }

  const paymentConfig = getPaymentMethodConfig(tariffConfig, paymentMethod)

  const charges: FareCharge[] = []
  let chargeSeq = 0
  let hasRegionSurcharge = false
  const moscowToRegionWindow = isMoscowToRegionWindow(window)
  const shouldApplyRegionSurcharge =
    moscowToRegionWindow && tariffConfig.mcdPricingStrategy === 'base_plus_surcharge'
  const regionToMoscowWindow = isRegionToMoscowWindow(window)
  const regionToMoscowWithMetro =
    regionToMoscowWindow && hasMetroAfterMcdRegionToMoscow(window)

  const addCharge = (
    validationId: string,
    amountKopecks: number,
    chargeType: FareCharge['chargeType'],
    reason: string
  ): void => {
    chargeSeq += 1
    charges.push({
      chargeId: `${tripId}-charge-${chargeSeq}`,
      tripId,
      validationId,
      amountKopecks,
      chargeType,
      reason
    })
  }

  const firstEvent = window[0]
  addCharge(
    firstEvent.validationId,
    chooseFirstChargeAmount(firstEvent, window, tariffConfig, paymentMethod),
    'base_fare',
    ChargeReason.BASE_FARE
  )

  for (let i = 1; i < window.length; i += 1) {
    const prev = window[i - 1]
    const current = window[i]

    if (current.metadata?.synthetic === true && current.metadata?.syntheticSource === 'fare-core') {
      addCharge(
        current.validationId,
        0,
        current.eventType === ValidationEventType.ENTRY ? 'mcd_entry_completion' : 'mcd_exit_completion',
        current.eventType === ValidationEventType.ENTRY
          ? ChargeReason.MCD_ENTRY_COMPLETION
          : ChargeReason.MCD_EXIT_COMPLETION
      )
      continue
    }

    if (isMcdEvent(prev) && isMcdEvent(current) && isValidMcdPair(prev, current)) {
      if (
        shouldApplyRegionSurcharge &&
        current.zone === Zone.MOSCOW_REGION &&
        !hasRegionSurcharge
      ) {
        addCharge(
          current.validationId,
          paymentConfig.regionSurchargeKopecks,
          'region_surcharge',
          ChargeReason.MOSCOW_TO_REGION_EXIT_SURCHARGE
        )
        hasRegionSurcharge = true
      } else {
        addCharge(current.validationId, 0, 'mcd_exit_completion', ChargeReason.MCD_EXIT_COMPLETION)
      }
      continue
    }

    if (
      regionToMoscowWithMetro &&
      current.carrier === Carrier.METRO &&
      current.zone === Zone.MOSCOW
    ) {
      addCharge(
        current.validationId,
        0,
        'free_transfer',
        ChargeReason.REGION_TO_MOSCOW_FREE_METRO_TRANSFER
      )
      continue
    }

    if (isFreeTransferAllowed(prev, current, tariffConfig)) {
      addCharge(
        current.validationId,
        0,
        'free_transfer',
        getFreeTransferReason(prev.carrier, current.carrier)
      )
      continue
    }

    if (
      isMcdEvent(current) &&
      current.eventType === ValidationEventType.ENTRY &&
      current.zone === Zone.MOSCOW
    ) {
      addCharge(
        current.validationId,
        0,
        'mcd_entry_included',
        ChargeReason.MCD_ENTRY_INCLUDED_IN_WINDOW
      )
      continue
    }

    if (current.carrier === Carrier.MGT) {
      const mgtCount = window.slice(0, i).filter((event) => event.carrier === Carrier.MGT).length
      if (mgtCount >= 1) {
        addCharge(
          current.validationId,
          0,
          'free_transfer',
          ChargeReason.FREE_TRANSFER_WITHIN_90_MINUTES
        )
        continue
      }
    }

    if (
      shouldApplyRegionSurcharge &&
      isMcdEvent(current) &&
      current.zone === Zone.MOSCOW_REGION &&
      !hasRegionSurcharge
    ) {
      addCharge(
        current.validationId,
        paymentConfig.regionSurchargeKopecks,
        'region_surcharge',
        ChargeReason.MOSCOW_TO_REGION_EXIT_SURCHARGE
      )
      hasRegionSurcharge = true
      continue
    }

    addCharge(current.validationId, paymentConfig.baseFareKopecks, 'base_fare', ChargeReason.BASE_FARE)
  }

  const amountKopecks = charges.reduce((acc, charge) => acc + charge.amountKopecks, 0)

  const trip: CalculatedTrip = {
    tripId,
    windowStart: window[0].eventTime,
    windowEnd: window[window.length - 1].eventTime,
    firstValidationId: window[0].validationId,
    lastValidationId: window[window.length - 1].validationId,
    validationIds: window.map((event) => event.validationId),
    modes: uniq(window.map((event) => event.mode)),
    carriers: uniq(window.map((event) => event.carrier)),
    zones: uniq(window.map((event) => event.zone)),
    amountKopecks,
    fareType: resolveFareType(window, hasRegionSurcharge, regionToMoscowWithMetro)
  }

  return {
    trip,
    charges
  }
}
