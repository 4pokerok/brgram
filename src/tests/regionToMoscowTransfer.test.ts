import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { ChargeReason } from '../domain/reasons.js'

describe('region -> moscow -> metro transfer', () => {
  it('makes metro transfer free after suburban cppk ride', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        eventTime: '2026-04-28T08:00:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW_REGION,
        cppkValidationType: CppkValidationType.ENTRY,
        lineId: 'd1'
      }),
      buildValidation({
        validationId: 'v2',
        eventTime: '2026-04-28T08:40:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.EXIT,
        zone: Zone.MOSCOW,
        cppkValidationType: CppkValidationType.EXIT,
        lineId: 'd1'
      }),
      buildValidation({
        validationId: 'v3',
        eventTime: '2026-04-28T08:55:00+03:00',
        carrier: Carrier.METRO,
        mode: TransportMode.METRO,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW
      })
    ])

    const result = runCalculate(request)

    expect(result.totalAmountKopecks).toBe(11000)
    expect(
      result.charges.some(
        (charge) => charge.reason === ChargeReason.REGION_TO_MOSCOW_FREE_METRO_TRANSFER && charge.amountKopecks === 0
      )
    ).toBe(true)
  })
})
