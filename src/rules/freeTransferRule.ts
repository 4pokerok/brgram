import { ChargeReason } from '../domain/reasons.js'
import { TariffConfig } from '../domain/tariff.js'
import { ValidationEvent } from '../domain/validation.js'
import { Carrier, Zone } from '../domain/enums.js'

export function isFreeTransferAllowed(
  prev: ValidationEvent,
  current: ValidationEvent,
  tariffConfig: TariffConfig
): boolean {
  if (prev.zone !== Zone.MOSCOW || current.zone !== Zone.MOSCOW) {
    return false
  }

  return tariffConfig.freeTransfers.some(
    (rule) => rule.from === prev.carrier && rule.to === current.carrier && rule.zone === Zone.MOSCOW
  )
}

export function getFreeTransferReason(from: Carrier, to: Carrier): string {
  if (from === Carrier.METRO && to === Carrier.MGT) {
    return ChargeReason.METRO_TO_MGT_FREE_TRANSFER
  }
  if (from === Carrier.MGT && to === Carrier.METRO) {
    return ChargeReason.MGT_TO_METRO_FREE_TRANSFER
  }
  if (from === Carrier.METRO && to === Carrier.MCK) {
    return ChargeReason.METRO_TO_MCK_FREE_TRANSFER
  }
  if (from === Carrier.MCK && to === Carrier.METRO) {
    return ChargeReason.MCK_TO_METRO_FREE_TRANSFER
  }
  return ChargeReason.FREE_TRANSFER_WITHIN_90_MINUTES
}
