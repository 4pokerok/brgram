import { CalculationWarning } from '../domain/result.js'

export function warning(code: string, message: string, validationId?: string): CalculationWarning {
  return {
    code,
    message,
    validationId
  }
}
