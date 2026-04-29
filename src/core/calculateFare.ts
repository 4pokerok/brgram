import { ZodError } from 'zod'
import { fareCalculationRequestSchema } from '../schemas/request.schema.js'
import { tariffConfigSchema } from '../schemas/tariff.schema.js'
import { FareCalculationRequest } from '../domain/request.js'
import { FareCalculationResult } from '../domain/result.js'
import { TariffConfig, Dictionaries } from '../domain/tariff.js'
import { ValidationStatus } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'
import { normalizeValidations } from './normalizeValidations.js'
import { completeMcdEntryExitEvents } from '../rules/mcdEntryExitCompletionRule.js'
import { buildTripWindows } from './buildTripWindows.js'
import { priceTripWindow } from './priceTripWindow.js'
import { optimizeTrips } from './optimizeTrips.js'
import { getTransportDay } from './transportDay.js'

function sortByEventTime(validations: FareCalculationRequest['validations']): FareCalculationRequest['validations'] {
  return [...validations].sort((a, b) => a.eventTime.localeCompare(b.eventTime))
}

function deduplicateValidations(
  validations: FareCalculationRequest['validations']
): { validations: FareCalculationRequest['validations']; duplicateIds: string[] } {
  const seen = new Set<string>()
  const deduplicated = []
  const duplicateIds: string[] = []

  for (const validation of validations) {
    if (seen.has(validation.validationId)) {
      duplicateIds.push(validation.validationId)
      continue
    }

    seen.add(validation.validationId)
    deduplicated.push(validation)
  }

  return {
    validations: deduplicated,
    duplicateIds
  }
}

function isLikelyZodError(error: unknown): error is ZodError {
  return error instanceof ZodError
}

export function calculateFare(
  request: FareCalculationRequest,
  tariffConfig: TariffConfig,
  dictionaries?: Partial<Dictionaries>
): FareCalculationResult {
  const parsedRequest = fareCalculationRequestSchema.parse(request)
  const parsedTariff = tariffConfigSchema.parse(tariffConfig)

  const warnings: FareCalculationResult['warnings'] = []

  const accepted = parsedRequest.validations.filter((validation) => {
    if (validation.status === ValidationStatus.DECLINED) {
      warnings.push({
        code: WarningCode.DECLINED_VALIDATION_IGNORED,
        message: 'Declined validation was ignored in fare calculation.',
        validationId: validation.validationId
      })
      return false
    }

    return true
  })

  const deduplicated = deduplicateValidations(accepted)

  for (const duplicateId of deduplicated.duplicateIds) {
    warnings.push({
      code: WarningCode.DUPLICATE_VALIDATION_IGNORED,
      message: 'Duplicate validation was ignored in fare calculation.',
      validationId: duplicateId
    })
  }

  const sorted = sortByEventTime(deduplicated.validations)

  for (const validation of sorted) {
    if (getTransportDay(validation.eventTime) !== parsedRequest.transportDate) {
      warnings.push({
        code: WarningCode.EVENT_OUTSIDE_REQUEST_TRANSPORT_DATE,
        message: 'Validation event belongs to another transport day.',
        validationId: validation.validationId
      })
    }
  }

  const normalized = normalizeValidations(sorted)
  warnings.push(...normalized.warnings)

  const completed = completeMcdEntryExitEvents(
    normalized.validations,
    dictionaries?.mcdEntryExitRules ?? []
  )
  warnings.push(...completed.warnings)

  const windowBuild = buildTripWindows(completed.validations, parsedTariff.transferWindowMinutes)
  warnings.push(...windowBuild.warnings)

  if (windowBuild.windows.length === 0) {
    return {
      requestId: parsedRequest.requestId,
      passengerKey: parsedRequest.passengerKey,
      transportDate: parsedRequest.transportDate,
      tariffVersion: parsedTariff.tariffVersion,
      paymentMethod: parsedRequest.paymentMethod,
      currency: 'RUB',
      totalAmountKopecks: 0,
      trips: [],
      charges: [],
      warnings
    }
  }

  const trips = []
  const charges = []

  for (let i = 0; i < windowBuild.windows.length; i += 1) {
    const window = windowBuild.windows[i]
    const tripId = `trip-${parsedRequest.requestId}-${i + 1}`
    const priced = priceTripWindow(window, parsedRequest.paymentMethod, parsedTariff, tripId)
    trips.push(priced.trip)
    charges.push(...priced.charges)
  }

  const optimized = optimizeTrips({
    trips,
    charges
  })

  const totalAmountKopecks = optimized.charges.reduce((sum, charge) => sum + charge.amountKopecks, 0)

  return {
    requestId: parsedRequest.requestId,
    passengerKey: parsedRequest.passengerKey,
    transportDate: parsedRequest.transportDate,
    tariffVersion: parsedTariff.tariffVersion,
    paymentMethod: parsedRequest.paymentMethod,
    currency: 'RUB',
    totalAmountKopecks,
    trips: optimized.trips,
    charges: optimized.charges,
    warnings
  }
}

export function safeCalculateFare(
  request: FareCalculationRequest,
  tariffConfig: TariffConfig,
  dictionaries?: Partial<Dictionaries>
):
  | {
      ok: true
      result: FareCalculationResult
    }
  | {
      ok: false
      error: unknown
      zodError: boolean
    } {
  try {
    const result = calculateFare(request, tariffConfig, dictionaries)
    return { ok: true, result }
  } catch (error) {
    return {
      ok: false,
      error,
      zodError: isLikelyZodError(error)
    }
  }
}
