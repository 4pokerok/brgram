import { describe, expect, it } from 'vitest'
import { calculateFare } from '../core/calculateFare.js'
import { getTariffConfig } from './helpers.js'

describe('validation errors', () => {
  it('throws for invalid request payload', () => {
    expect(() =>
      calculateFare(
        {
          requestId: '',
          passengerKey: '',
          transportDate: 'bad-date',
          paymentMethod: 'bank_card',
          validations: []
        } as never,
        getTariffConfig()
      )
    ).toThrowError()
  })
})
