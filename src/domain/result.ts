import { PaymentMethod } from './enums.js'
import { FareCharge } from './charge.js'
import { CalculatedTrip } from './trip.js'

export type CalculationWarning = {
  code: string
  message: string
  validationId?: string
}

export type FareCalculationResult = {
  requestId: string
  passengerKey: string
  transportDate: string
  tariffVersion: string
  paymentMethod: PaymentMethod
  currency: 'RUB'
  totalAmountKopecks: number
  trips: CalculatedTrip[]
  charges: FareCharge[]
  warnings: CalculationWarning[]
}
