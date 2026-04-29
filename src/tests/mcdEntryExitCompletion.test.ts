import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'

describe('mcd pair auto completion', () => {
  it('auto-completes missing cppk pair and breaks transfer chain', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        carrier: Carrier.METRO,
        mode: TransportMode.METRO,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW
      }),
      buildValidation({
        validationId: 'v2',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.ENTRY,
        zone: Zone.MOSCOW,
        cppkValidationType: CppkValidationType.ENTRY,
        lineId: 'd1',
        eventTime: '2026-04-28T08:20:00+03:00'
      }),
      buildValidation({
        validationId: 'v3',
        carrier: Carrier.MGT,
        mode: TransportMode.MGT,
        eventType: ValidationEventType.ONBOARD,
        zone: Zone.MOSCOW,
        eventTime: '2026-04-28T08:40:00+03:00'
      })
    ])

    const result = runCalculate(request)

    expect(result.trips.length).toBeGreaterThanOrEqual(2)
    expect(result.warnings.some((warning) => warning.code === WarningCode.MCD_PAIR_AUTO_COMPLETED)).toBe(true)
    expect(result.warnings.some((warning) => warning.code === WarningCode.MCD_PAIR_BROKE_TRANSFER_CHAIN)).toBe(
      true
    )
  })
})
