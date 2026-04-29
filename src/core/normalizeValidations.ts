import {
  Carrier,
  CppkValidationType,
  ValidationEventType,
  ValidationStatus
} from '../domain/enums.js'
import { ChargeReason } from '../domain/reasons.js'
import { CalculationWarning } from '../domain/result.js'
import { ValidationEvent } from '../domain/validation.js'
import { WarningCode } from '../domain/warningCodes.js'

type NormalizeResult = {
  validations: ValidationEvent[]
  warnings: CalculationWarning[]
}

function withCarrierSyntheticMetadata(event: ValidationEvent): ValidationEvent {
  return {
    ...event,
    metadata: {
      ...(event.metadata ?? {}),
      synthetic: true,
      syntheticSource: 'carrier',
      syntheticReason: ChargeReason.MCD_PAIR_AUTO_COMPLETED_BY_CARRIER
    }
  }
}

function isMcdCarrier(carrier: Carrier): boolean {
  return carrier === Carrier.CPPK || carrier === Carrier.MTPPK
}

export function normalizeValidations(validations: ValidationEvent[]): NormalizeResult {
  const normalized: ValidationEvent[] = []
  const warnings: CalculationWarning[] = []

  for (const validation of validations) {
    if (validation.status !== ValidationStatus.ACCEPTED) {
      continue
    }

    if (!isMcdCarrier(validation.carrier)) {
      if (validation.cppkValidationType !== undefined) {
        warnings.push({
          code: WarningCode.CPPK_VALIDATION_TYPE_IGNORED_FOR_NON_CPPK_CARRIER,
          message: 'CPPK validation type is ignored for non-CPPK/MTPPK carrier.',
          validationId: validation.validationId
        })
      }

      normalized.push({ ...validation })
      continue
    }

    if (validation.cppkValidationType === undefined) {
      normalized.push({ ...validation })
      continue
    }

    switch (validation.cppkValidationType) {
      case CppkValidationType.ENTRY:
        normalized.push({ ...validation, eventType: ValidationEventType.ENTRY })
        break
      case CppkValidationType.EXIT:
        normalized.push({ ...validation, eventType: ValidationEventType.EXIT })
        break
      case CppkValidationType.DP_NORMAL_EXIT_COMPLETION:
        warnings.push({
          code: WarningCode.DP_VALIDATION_TYPE_FILTERED_OR_UNSUPPORTED,
          message:
            'CPPK validation type 2 was received. Event is filtered as DP/unsupported for automatic pricing.',
          validationId: validation.validationId
        })
        break
      case CppkValidationType.FORCED_TRIP_COMPLETION_EXIT:
        normalized.push(withCarrierSyntheticMetadata({ ...validation, eventType: ValidationEventType.EXIT }))
        break
      case CppkValidationType.CPPK_TRAIN_SURCHARGE_7000:
        warnings.push({
          code: WarningCode.UNSUPPORTED_CPPK_TRAIN_SURCHARGE_7000,
          message:
            'CPPK validation type 4 was received. Manual tariff handling is required.',
          validationId: validation.validationId
        })
        break
      case CppkValidationType.FAR_SUBURBAN_AUTO_COMPLETION:
        normalized.push(withCarrierSyntheticMetadata({ ...validation, eventType: ValidationEventType.EXIT }))
        break
      case CppkValidationType.SYNTHETIC_ENTRY:
        normalized.push(withCarrierSyntheticMetadata({ ...validation, eventType: ValidationEventType.ENTRY }))
        break
      default:
        warnings.push({
          code: WarningCode.DP_VALIDATION_TYPE_FILTERED_OR_UNSUPPORTED,
          message: 'Unsupported CPPK validation type was filtered from fare calculation.',
          validationId: validation.validationId
        })
    }
  }

  return {
    validations: normalized,
    warnings
  }
}
