import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { Carrier, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'

describe('transport day boundary', () => {
  it('splits window when transport day changes', () => {
    const request = buildRequest(
      [
        buildValidation({
          validationId: 'v1',
          eventTime: '2026-04-29T03:50:00+03:00',
          carrier: Carrier.METRO,
          mode: TransportMode.METRO,
          eventType: ValidationEventType.ENTRY,
          zone: Zone.MOSCOW
        }),
        buildValidation({
          validationId: 'v2',
          eventTime: '2026-04-29T04:10:00+03:00',
          carrier: Carrier.MGT,
          mode: TransportMode.MGT,
          eventType: ValidationEventType.ONBOARD,
          zone: Zone.MOSCOW
        })
      ],
      undefined,
      '2026-04-28'
    )

    const result = runCalculate(request)

    expect(result.trips).toHaveLength(2)
    expect(result.warnings.some((warning) => warning.code === WarningCode.TRANSPORT_DAY_BOUNDARY_SPLIT)).toBe(
      true
    )
  })
})
