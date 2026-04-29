import { ValidationEventType, Zone } from '../domain/enums.js'
import { ChargeReason } from '../domain/reasons.js'
import { CalculationWarning } from '../domain/result.js'
import { McdEntryExitRule } from '../domain/tariff.js'
import { ValidationEvent } from '../domain/validation.js'
import { WarningCode } from '../domain/warningCodes.js'
import { isEntryEvent, isExitEvent, isMcdEvent } from './mcdPairRule.js'

type CompletionResult = {
  validations: ValidationEvent[]
  warnings: CalculationWarning[]
}

function createWarning(code: string, message: string, validationId: string): CalculationWarning {
  return { code, message, validationId }
}

function buildSyntheticId(sourceValidationId: string, missingEventType: 'entry' | 'exit', index: number): string {
  return `synthetic-${sourceValidationId}-${missingEventType}-${index}`
}

function resolveSyntheticZone(source: ValidationEvent, fallback?: Zone): Zone {
  if (fallback) {
    return fallback
  }

  if (source.zone === Zone.MOSCOW) {
    return Zone.MOSCOW_REGION
  }

  if (source.zone === Zone.MOSCOW_REGION) {
    return Zone.MOSCOW
  }

  return Zone.MOSCOW
}

function findReferenceRule(
  source: ValidationEvent,
  missingEventType: 'entry' | 'exit',
  rules: McdEntryExitRule[]
): McdEntryExitRule | undefined {
  return rules.find((rule) => {
    if (rule.carrier !== source.carrier) {
      return false
    }

    if (rule.missingEventType !== missingEventType) {
      return false
    }

    if (rule.lineId && source.lineId && rule.lineId !== source.lineId) {
      return false
    }

    if (rule.stationId && source.stationId && rule.stationId !== source.stationId) {
      return false
    }

    return true
  })
}

function createSyntheticEvent(
  source: ValidationEvent,
  missingEventType: 'entry' | 'exit',
  rules: McdEntryExitRule[],
  syntheticIndex: number,
  eventTime: string
): ValidationEvent {
  const referenceRule = findReferenceRule(source, missingEventType, rules)

  const nextMetadata: Record<string, unknown> = {
    ...(source.metadata ?? {}),
    synthetic: true,
    syntheticSource: 'fare-core',
    syntheticReason: ChargeReason.MCD_PAIR_AUTO_COMPLETED_BY_FARE_CORE,
    breakTransferChain: true
  }

  if (referenceRule) {
    nextMetadata.syntheticRuleReason = referenceRule.reason
  }

  return {
    ...source,
    validationId: buildSyntheticId(source.validationId, missingEventType, syntheticIndex),
    eventType:
      missingEventType === 'entry' ? ValidationEventType.ENTRY : ValidationEventType.EXIT,
    eventTime,
    stationId:
      referenceRule?.syntheticStationId ??
      `test_${source.carrier}_${resolveSyntheticZone(source).toLowerCase()}_${missingEventType}`,
    zone: resolveSyntheticZone(source, referenceRule?.syntheticZone),
    metadata: nextMetadata
  }
}

function addPairCompletionWarnings(warnings: CalculationWarning[], validationId: string): void {
  warnings.push(
    createWarning(
      WarningCode.MCD_PAIR_AUTO_COMPLETED,
      'MCD/CPPK/MTPPK entry-exit pair was missing and was auto-completed by fare-core.',
      validationId
    )
  )

  warnings.push(
    createWarning(
      WarningCode.MCD_PAIR_BROKE_TRANSFER_CHAIN,
      'MCD/CPPK/MTPPK missing pair broke the free transfer chain.',
      validationId
    )
  )
}

export function completeMcdEntryExitEvents(
  validations: ValidationEvent[],
  mcdEntryExitRules: McdEntryExitRule[]
): CompletionResult {
  const completed: ValidationEvent[] = []
  const warnings: CalculationWarning[] = []

  let openEntry: ValidationEvent | null = null
  let syntheticCounter = 0

  const closeOpenEntry = (nextEventTime: string): void => {
    if (!openEntry) {
      return
    }

    syntheticCounter += 1
    const syntheticExit = createSyntheticEvent(
      openEntry,
      'exit',
      mcdEntryExitRules,
      syntheticCounter,
      nextEventTime
    )

    completed.push(syntheticExit)
    addPairCompletionWarnings(warnings, openEntry.validationId)
    openEntry = null
  }

  for (const event of validations) {
    if (!isMcdEvent(event)) {
      closeOpenEntry(event.eventTime)
      completed.push(event)
      continue
    }

    if (openEntry) {
      if (isExitEvent(event)) {
        completed.push(event)
        openEntry = null
        continue
      }

      if (isEntryEvent(event)) {
        if (openEntry.lineId && event.lineId && openEntry.lineId !== event.lineId) {
          completed.push(event)
          openEntry = event
          continue
        }

        closeOpenEntry(event.eventTime)
        completed.push(event)
        openEntry = event
        continue
      }

      closeOpenEntry(event.eventTime)
      completed.push(event)
      continue
    }

    if (isEntryEvent(event)) {
      completed.push(event)
      openEntry = event
      continue
    }

    if (isExitEvent(event)) {
      syntheticCounter += 1
      const syntheticEntry = createSyntheticEvent(
        event,
        'entry',
        mcdEntryExitRules,
        syntheticCounter,
        event.eventTime
      )
      completed.push(syntheticEntry)
      completed.push(event)
      addPairCompletionWarnings(warnings, event.validationId)
      continue
    }

    completed.push(event)
  }

  if (openEntry) {
    closeOpenEntry(openEntry.eventTime)
  }

  return {
    validations: completed,
    warnings
  }
}
