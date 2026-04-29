import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('transfer window expiry', () => {
  it('creates a new trip when interval is more than 90 minutes', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        eventTime: '2026-04-28T08:00:00+03:00',
        carrier: Carrier.METRO,
        mode: TransportMode.METRO,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW
      }),
      buildValidation({
        validationId: 'v2',
        eventTime: '2026-04-28T09:31:00+03:00',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW
      })
    ])

    const result = runCalculate(request)

    expect(result.trips).toHaveLength(2)
    expect(result.totalAmountKopecks).toBe(16600)
  })
})
