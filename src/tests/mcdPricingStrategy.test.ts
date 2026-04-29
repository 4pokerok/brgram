import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, getTariffConfig, runCalculate } from './helpers.js'
import { Carrier, CppkValidationType, TransportMode, ValidationEventType, Zone } from '../domain/enums.js'

describe('mcd pricing strategy', () => {
  it('uses suburban fare for moscow->region mcd pair when strategy=suburban_fare', () => {
    const config = structuredClone(getTariffConfig())
    config.mcdPricingStrategy = 'suburban_fare'

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
        eventTime: '2026-04-28T08:40:00+03:00',
        carrier: Carrier.CPPK,
        mode: TransportMode.CPPK,
        eventType: ValidationEventType.EXIT,
        cppkValidationType: CppkValidationType.EXIT,
        lineId: 'd1',
        zone: Zone.MOSCOW_REGION
      })
    ])

    const result = runCalculate(request, config)

    expect(result.totalAmountKopecks).toBe(config.paymentMethods.bank_card.suburbanFareKopecks)
    expect(result.charges.some((charge) => charge.chargeType === 'region_surcharge')).toBe(false)
  })
})
