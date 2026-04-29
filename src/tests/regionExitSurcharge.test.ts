import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { ChargeReason } from '../domain/reasons.js'

describe('moscow to region surcharge', () => {
  it('adds region surcharge on cppk exit to region', () => {
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
        eventTime: '2026-04-28T08:30:00+03:00',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW
      }),
      buildValidation({
        validationId: 'v3',
        eventTime: '2026-04-28T08:50:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        cppkValidationType: CppkValidationType.ENTRY,
        lineId: 'd1'
      }),
      buildValidation({
        validationId: 'v4',
        eventTime: '2026-04-28T09:10:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.EXIT,
        zone: Zone.MOSCOW_REGION,
        cppkValidationType: CppkValidationType.EXIT,
        lineId: 'd1'
      })
    ])

    const result = runCalculate(request)

    expect(result.totalAmountKopecks).toBe(7000)
    expect(result.charges.some((charge) => charge.reason === ChargeReason.MOSCOW_TO_REGION_EXIT_SURCHARGE)).toBe(
      true
    )
  })
})
