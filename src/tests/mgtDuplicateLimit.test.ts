import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('mgt duplicate limit', () => {
  it('splits on third mgt validation', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T08:00:00+03:00'
      }),
      buildValidation({
        validationId: 'v2',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T08:30:00+03:00'
      }),
      buildValidation({
        validationId: 'v3',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T08:50:00+03:00'
      })
    ])

    const result = runCalculate(request)

    expect(result.trips).toHaveLength(2)
    expect(result.totalAmountKopecks).toBe(10000)
  })
})
