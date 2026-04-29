import { describe, expect, it } from 'vitest'
import { buildValidation } from './helpers.js'
import { Carrier, TransportMode } from '../domain/enums.js'
import { isMckPlace, isMoscowMetroPlace } from '../rules/consecutiveCarrierRule.js'

describe('placeId helpers', () => {
  it('detects metro and mck places by placeId hints', () => {
    const metroLike = buildValidation({
      validationId: 'v1',
      mode: TransportMode.MGT,
      carrier: Carrier.MGT,
      placeId: 'metro-kuzminki'
    })

    const mckLike = buildValidation({
      validationId: 'v2',
      mode: TransportMode.MGT,
      carrier: Carrier.MGT,
      placeId: 'mck-rostokino'
    })

    expect(isMoscowMetroPlace(metroLike)).toBe(true)
    expect(isMckPlace(mckLike)).toBe(true)
  })
})
