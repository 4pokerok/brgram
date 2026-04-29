import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('cppk -> mtppk valid pair', () => {
  it('keeps cross-carrier entry-exit pair valid', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.ENTRY,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        lineId: 'd1'
      }),
      buildValidation({
        validationId: 'v2',
        carrier: Carrier.MTPPK,
        mode: TransportMode.MTPPK,
        cppkValidationType: CppkValidationType.EXIT,
        eventType: ValidationEventType.EXIT,
        zone: Zone.MOSCOW_REGION,
        lineId: 'd2',
        eventTime: '2026-04-28T08:40:00+03:00'
      })
    ])

    const result = runCalculate(request)

    expect(result.totalAmountKopecks).toBe(7000)
    expect(result.trips).toHaveLength(1)
  })
})
