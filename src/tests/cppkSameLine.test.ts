import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'

describe('cppk same line duplicated entry', () => {
  it('does not crash and returns auto-completion warnings', () => {
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
        lineId: 'd1',
        zone: Zone.MOSCOW
      })
    ])

    const result = runCalculate(request)

    expect(result.trips.length).toBeGreaterThanOrEqual(1)
    expect(result.totalAmountKopecks).toBeGreaterThan(0)
    expect(result.warnings.some((warning) => warning.code === WarningCode.MCD_PAIR_AUTO_COMPLETED)).toBe(true)
  })
})
