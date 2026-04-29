import { Carrier, ValidationEventType, Zone } from '../domain/enums.js'
import { RefPlace } from '../domain/tariff.js'
import { ValidationEvent } from '../domain/validation.js'
import { isSameTransportDay } from '../core/transportDay.js'
import { isEntryEvent, isMcdCarrier, isMcdEvent, isValidMcdPair } from './mcdPairRule.js'

export function isMoscowMetroPlace(event: ValidationEvent): boolean {
  if (event.mode === 'metro' || event.carrier === Carrier.METRO) {
    return true
  }
  return (event.placeId ?? '').toLowerCase().includes('metro')
}

export function isMckPlace(event: ValidationEvent): boolean {
  if (event.mode === 'mck' || event.carrier === Carrier.MCK) {
    return true
  }
  return (event.placeId ?? '').toLowerCase().includes('mck')
}

function countMgtEventsInWindow(events: ValidationEvent[]): number {
  return events.filter((event) => event.carrier === Carrier.MGT).length
}

function resolveRefPlace(event: ValidationEvent, refPlaces: RefPlace[]): RefPlace | undefined {
  const key = event.placeId ?? event.stationId
  if (!key) {
    return undefined
  }

  return refPlaces.find((place) => place.placeId === key)
}

function isDuplicateException(
  prev: ValidationEvent,
  current: ValidationEvent,
  refPlaces: RefPlace[]
): boolean {
  const prevPlace = resolveRefPlace(prev, refPlaces)
  const currentPlace = resolveRefPlace(current, refPlaces)
  return prevPlace?.is_except === true && currentPlace?.is_except === true
}

function resolveMcdLineName(event: ValidationEvent, refPlaces: RefPlace[]): string | undefined {
  if (!isMcdEvent(event)) {
    return undefined
  }

  const fromPlace = resolveRefPlace(event, refPlaces)?.ln_name2
  if (fromPlace) {
    return fromPlace
  }

  return event.lineId
}

function countMcdLineTransfers(events: ValidationEvent[], refPlaces: RefPlace[]): number {
  let transfers = 0
  let prevLine: string | undefined

  for (const event of events) {
    const line = resolveMcdLineName(event, refPlaces)
    if (!line) {
      continue
    }
    if (prevLine && line !== prevLine) {
      transfers += 1
    }
    prevLine = line
  }

  return transfers
}

export function isDuplicatedLinkBreak(
  prev: ValidationEvent,
  current: ValidationEvent,
  context?: {
    currentWindowEvents: ValidationEvent[]
    refPlaces?: RefPlace[]
  }
): boolean {
  const refPlaces = context?.refPlaces ?? []

  if (prev.carrier === Carrier.METRO && current.carrier === Carrier.METRO) {
    return !isDuplicateException(prev, current, refPlaces)
  }
  if (prev.carrier === Carrier.MCK && current.carrier === Carrier.MCK) {
    return !isDuplicateException(prev, current, refPlaces)
  }

  if (prev.carrier === Carrier.MGT && current.carrier === Carrier.MGT) {
    if (isDuplicateException(prev, current, refPlaces)) {
      return false
    }
    const mgtCount = countMgtEventsInWindow(context?.currentWindowEvents ?? [])
    return mgtCount >= 2
  }

  if (
    isMcdEvent(prev) &&
    isMcdEvent(current) &&
    resolveMcdLineName(prev, refPlaces) === resolveMcdLineName(current, refPlaces)
  ) {
    if (isDuplicateException(prev, current, refPlaces)) {
      return false
    }
    return !isValidMcdPair(prev, current)
  }

  return false
}

export function canMergeConsecutiveEvents(
  prev: ValidationEvent,
  current: ValidationEvent,
  context?: {
    currentWindowEvents: ValidationEvent[]
    refPlaces?: RefPlace[]
  }
): boolean {
  const refPlaces = context?.refPlaces ?? []

  if (!isSameTransportDay(prev.eventTime, current.eventTime)) {
    return false
  }

  if (prev.metadata?.breakTransferChain === true) {
    return false
  }

  if (isMcdCarrier(prev.carrier) && !isMcdCarrier(current.carrier)) {
    return prev.eventType === ValidationEventType.EXIT
  }

  if (isMcdEvent(prev) && isMcdEvent(current)) {
    if (isValidMcdPair(prev, current)) {
      return true
    }

    const prevLine = resolveMcdLineName(prev, refPlaces)
    const currentLine = resolveMcdLineName(current, refPlaces)
    const transferCount = countMcdLineTransfers(context?.currentWindowEvents ?? [], refPlaces)

    if (prevLine && currentLine && prevLine !== currentLine) {
      if (transferCount >= 1) {
        return false
      }
      return true
    }

    if (isDuplicateException(prev, current, refPlaces)) {
      return true
    }

    return false
  }

  if (prev.carrier === current.carrier) {
    if (prev.carrier === Carrier.METRO || prev.carrier === Carrier.MCK) {
      return isDuplicateException(prev, current, refPlaces)
    }

    if (prev.carrier === Carrier.MGT) {
      if (isDuplicateException(prev, current, refPlaces)) {
        return true
      }
      const mgtCount = countMgtEventsInWindow(context?.currentWindowEvents ?? [])
      return mgtCount < 2
    }
  }

  if (isMoscowMetroPlace(prev) && isMckPlace(current)) {
    return true
  }

  if (isMckPlace(prev) && isMoscowMetroPlace(current)) {
    return true
  }

  if (prev.carrier === Carrier.METRO && current.carrier === Carrier.MGT) {
    return prev.zone === Zone.MOSCOW && current.zone === Zone.MOSCOW
  }

  if (prev.carrier === Carrier.MGT && current.carrier === Carrier.METRO) {
    return prev.zone === Zone.MOSCOW && current.zone === Zone.MOSCOW
  }

  if (isMcdCarrier(current.carrier) && isEntryEvent(current)) {
    return true
  }

  return true
}
