import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'

describe('cppk validation types', () => {
  it('handles type 3 and type 6 as carrier synthetic and type 4 as warning', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.ENTRY,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW
      }),
      buildValidation({
        validationId: 'v2',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.FORCED_TRIP_COMPLETION_EXIT,
        eventType: ValidationEventType.EXIT,
        zone: Zone.MOSCOW_REGION,
        eventTime: '2026-04-28T08:30:00+03:00'
      }),
      buildValidation({
        validationId: 'v3',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.SYNTHETIC_ENTRY,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW_REGION,
        eventTime: '2026-04-28T09:10:00+03:00'
      }),
      buildValidation({
        validationId: 'v4',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.EXIT,
        eventType: ValidationEventType.EXIT,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T09:40:00+03:00'
      }),
      buildValidation({
        validationId: 'v5',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        cppkValidationType: CppkValidationType.CPPK_TRAIN_SURCHARGE_7000,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T10:30:00+03:00'
      })
    ])

    const result = runCalculate(request)

    expect(result.warnings.some((warning) => warning.code === WarningCode.UNSUPPORTED_CPPK_TRAIN_SURCHARGE_7000)).toBe(
      true
    )

    const hasCarrierSynthetic = result.trips.some((trip) =>
      trip.validationIds.some((id) => id === 'v2' || id === 'v3')
    )
    expect(hasCarrierSynthetic).toBe(true)
  })
})
