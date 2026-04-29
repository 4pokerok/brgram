import { isSameTransportDay } from '../core/transportDay.js'
import { ValidationEvent } from '../domain/validation.js'

export function isTransportDayBoundary(prev: ValidationEvent, current: ValidationEvent): boolean {
  return !isSameTransportDay(prev.eventTime, current.eventTime)
}
