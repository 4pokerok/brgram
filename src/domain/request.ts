import { PaymentMethod } from './enums.js'
import { ValidationEvent } from './validation.js'

export type FareCalculationRequest = {
  requestId: string
  tariffVersion?: string
  passengerKey: string
  transportDate: string
  paymentMethod: PaymentMethod
  validations: ValidationEvent[]
}
