import { Carrier, ValidationEventType } from '../domain/enums.js'
import { ValidationEvent } from '../domain/validation.js'

export function isMcdCarrier(carrier: Carrier): boolean {
  return carrier === Carrier.CPPK || carrier === Carrier.MTPPK
}

export function isMcdEvent(event: ValidationEvent): boolean {
  return isMcdCarrier(event.carrier)
}

export function isEntryEvent(event: ValidationEvent): boolean {
  return event.eventType === ValidationEventType.ENTRY
}

export function isExitEvent(event: ValidationEvent): boolean {
  return event.eventType === ValidationEventType.EXIT
}

export function isValidMcdPair(prev: ValidationEvent, current: ValidationEvent): boolean {
  if (!isMcdEvent(prev) || !isMcdEvent(current)) {
    return false
  }

  return isEntryEvent(prev) && isExitEvent(current)
}
