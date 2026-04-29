import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('metro -> mck transfer', () => {
  it('charges base fare once for bank card', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        eventTime: '2026-04-28T08:00:00+03:00',
        carrier: Carrier.METRO,
        mode: TransportMode.METRO,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        placeId: 'metro-belorusskaya'
      }),
      buildValidation({
        validationId: 'v2',
        eventTime: '2026-04-28T08:20:00+03:00',
        carrier: Carrier.MCK,
        mode: TransportMode.MCK,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        placeId: 'mck-luzhniki'
      })
    ])

    const result = runCalculate(request)

    expect(result.trips).toHaveLength(1)
    expect(result.totalAmountKopecks).toBe(8300)
    expect(result.charges[1]?.amountKopecks).toBe(0)
  })
})
