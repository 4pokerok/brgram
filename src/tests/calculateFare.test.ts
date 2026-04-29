import { describe, expect, it } from 'vitest'
import { buildRequest, buildValidation, runCalculate } from './helpers.js'
import { ValidationStatus } from '../domain/enums.js'
import { WarningCode } from '../domain/warningCodes.js'

describe('calculateFare', () => {
  it('returns zero totals for empty validations', () => {
    const request = buildRequest([])
    const result = runCalculate(request)

    expect(result.totalAmountKopecks).toBe(0)
    expect(result.trips).toEqual([])
    expect(result.charges).toEqual([])
  })

  it('ignores declined validations and returns warning', () => {
    const request = buildRequest([
      buildValidation({
        validationId: 'v1',
        status: ValidationStatus.DECLINED
      })
    ])

    const result = runCalculate(request)

    expect(result.totalAmountKopecks).toBe(0)
    expect(result.warnings.some((warning) => warning.code === WarningCode.DECLINED_VALIDATION_IGNORED)).toBe(
      true
    )
  })
})
