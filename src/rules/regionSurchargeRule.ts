import { Carrier, Zone } from '../domain/enums.js'
import { ValidationEvent } from '../domain/validation.js'
import { isMcdCarrier } from './mcdPairRule.js'

export function isMoscowToRegionWindow(events: ValidationEvent[]): boolean {
  if (events.length === 0) {
    return false
  }

  const hasMoscow = events.some((event) => event.zone === Zone.MOSCOW)
  const hasRegion = events.some((event) => event.zone === Zone.MOSCOW_REGION)

  if (!hasMoscow || !hasRegion) {
    return false
  }

  const firstMcd = events.find((event) => isMcdCarrier(event.carrier))
  const lastMcd = [...events].reverse().find((event) => isMcdCarrier(event.carrier))

  if (!firstMcd || !lastMcd) {
    return false
  }

  return firstMcd.zone === Zone.MOSCOW && lastMcd.zone === Zone.MOSCOW_REGION
}

export function isRegionToMoscowWindow(events: ValidationEvent[]): boolean {
  if (events.length === 0) {
    return false
  }

  const firstMcd = events.find((event) => isMcdCarrier(event.carrier))
  const lastMcd = [...events].reverse().find((event) => isMcdCarrier(event.carrier))

  if (!firstMcd || !lastMcd) {
    return false
  }

  return firstMcd.zone === Zone.MOSCOW_REGION && lastMcd.zone === Zone.MOSCOW
}

export function hasMetroAfterMcdRegionToMoscow(events: ValidationEvent[]): boolean {
  let reachedMcdToMoscow = false

  for (const event of events) {
    if (isMcdCarrier(event.carrier) && event.zone === Zone.MOSCOW) {
      reachedMcdToMoscow = true
      continue
    }

    if (reachedMcdToMoscow && event.carrier === Carrier.METRO && event.zone === Zone.MOSCOW) {
      return true
    }
  }

  return false
}
