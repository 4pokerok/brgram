import { FareCalculationRequest } from '../domain/request.js'

export function isSamePassengerRequest(request: FareCalculationRequest): boolean {
  return request.passengerKey.trim().length > 0
}
