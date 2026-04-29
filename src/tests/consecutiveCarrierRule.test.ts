import { describe, expect, it } from 'vitest'
import { canMergeConsecutiveEvents } from '../rules/consecutiveCarrierRule.js'
import { buildValidation } from './helpers.js'
import { Carrier, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('canMergeConsecutiveEvents', () => {
  it('allows metro -> mgt inside moscow', () => {
    const prev = buildValidation({
      validationId: 'v1',
      carrier: Carrier.METRO,
      mode: TransportMode.METRO,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW
    })
    const current = buildValidation({
      validationId: 'v2',
      carrier: Carrier.MGT,
      mode: TransportMode.MGT,
      eventType: ValidationEventType.ONBOARD,
      zone: Zone.MOSCOW,
      eventTime: '2026-04-28T08:10:00+03:00'
    })

    expect(canMergeConsecutiveEvents(prev, current, { currentWindowEvents: [prev] })).toBe(true)
  })

  it('disallows metro -> metro duplicate in one window', () => {
    const prev = buildValidation({
      validationId: 'v1',
      carrier: Carrier.METRO,
      mode: TransportMode.METRO,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW
    })
    const current = buildValidation({
      validationId: 'v2',
      carrier: Carrier.METRO,
      mode: TransportMode.METRO,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      eventTime: '2026-04-28T08:05:00+03:00'
    })

    expect(canMergeConsecutiveEvents(prev, current, { currentWindowEvents: [prev] })).toBe(false)
  })

  it('allows duplicate metro link when both places are marked as exceptions', () => {
    const prev = buildValidation({
      validationId: 'v1',
      carrier: Carrier.METRO,
      mode: TransportMode.METRO,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      placeId: 'kuntsevskaya'
    })
    const current = buildValidation({
      validationId: 'v2',
      carrier: Carrier.METRO,
      mode: TransportMode.METRO,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      placeId: 'slavyansky_bulvar',
      eventTime: '2026-04-28T08:05:00+03:00'
    })

    const refPlaces = [
      { placeId: 'kuntsevskaya', carrier: Carrier.METRO, is_except: true },
      { placeId: 'slavyansky_bulvar', carrier: Carrier.METRO, is_except: true }
    ]

    expect(canMergeConsecutiveEvents(prev, current, { currentWindowEvents: [prev], refPlaces })).toBe(true)
  })

  it('allows only one MCD line transfer by ln_name2', () => {
    const d1Entry = buildValidation({
      validationId: 'v1',
      carrier: Carrier.CPPK,
      mode: TransportMode.CPPK,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      placeId: 'belorusskaya'
    })
    const d2Entry = buildValidation({
      validationId: 'v2',
      carrier: Carrier.MTPPK,
      mode: TransportMode.MTPPK,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      placeId: 'podolsk',
      eventTime: '2026-04-28T08:15:00+03:00'
    })
    const d1Again = buildValidation({
      validationId: 'v3',
      carrier: Carrier.CPPK,
      mode: TransportMode.CPPK,
      eventType: ValidationEventType.ENTRY,
      zone: Zone.MOSCOW,
      placeId: 'odintsovo',
      eventTime: '2026-04-28T08:25:00+03:00'
    })

    const refPlaces = [
      { placeId: 'belorusskaya', carrier: Carrier.CPPK, ln_name2: 'MCD-1' },
      { placeId: 'podolsk', carrier: Carrier.MTPPK, ln_name2: 'MCD-2' },
      { placeId: 'odintsovo', carrier: Carrier.CPPK, ln_name2: 'MCD-1' }
    ]

    expect(
      canMergeConsecutiveEvents(d1Entry, d2Entry, {
        currentWindowEvents: [d1Entry],
        refPlaces
      })
    ).toBe(true)
    expect(
      canMergeConsecutiveEvents(d2Entry, d1Again, {
        currentWindowEvents: [d1Entry, d2Entry],
        refPlaces
      })
    ).toBe(false)
  })
})
