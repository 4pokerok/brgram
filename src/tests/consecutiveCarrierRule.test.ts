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
})
