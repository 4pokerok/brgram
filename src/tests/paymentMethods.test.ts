import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { PaymentMethod } from '../domain/enums.js'

describe('payment method pricing', () => {
  it('uses virtual troika base fare', () => {
    const request = buildRequest(
      [
        buildValidation({
          validationId: 'v1'
        })
      ],
      PaymentMethod.VIRTUAL_TROIKA
    )

    const result = runCalculate(request)
    expect(result.totalAmountKopecks).toBe(7500)
  })

  it('uses face pay base fare', () => {
    const request = buildRequest(
      [
        buildValidation({
          validationId: 'v1'
        })
      ],
      PaymentMethod.FACE_PAY
    )

    const result = runCalculate(request)
    expect(result.totalAmountKopecks).toBe(7100)
  })
})
