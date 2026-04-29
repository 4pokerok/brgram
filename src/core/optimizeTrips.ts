import { FareCharge } from '../domain/charge.js'
import { CalculatedTrip } from '../domain/trip.js'

export type OptimizeTripsInput = {
  trips: CalculatedTrip[]
  charges: FareCharge[]
}

export function optimizeTrips(input: OptimizeTripsInput): OptimizeTripsInput {
  return input
}
