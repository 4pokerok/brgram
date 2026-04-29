import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('cppk line change', () => {
  it('keeps different cppk lines in one window with central/base fare total', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        eventTime: '2026-04-28T08:00:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.ENTRY,
        cppkValidationType: CppkValidationType.ENTRY,
        lineId: 'd1',
        zone: Zone.MOSCOW
      }),
      buildValidation({
        validationId: 'v2',
        eventTime: '2026-04-28T08:20:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.ENTRY,
        cppkValidationType: CppkValidationType.ENTRY,
        lineId: 'd2',
        zone: Zone.MOSCOW
      })
    ])

    const result = runCalculate(request)

    expect(result.trips).toHaveLength(1)
    expect(result.totalAmountKopecks).toBe(5000)
  })
})
