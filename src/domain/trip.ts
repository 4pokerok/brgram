import { Carrier, TransportMode, Zone } from './enums.js'

export type FareType =
  | 'single_ride'
  | 'transfer_window'
  | 'transfer_window_with_region_surcharge'
  | 'region_to_moscow_with_free_metro_transfer'
  | 'mcd_pair'
  | 'mcd_auto_completed_pair'
  | 'unknown'

export type CalculatedTrip = {
  tripId: string
  windowStart: string
  windowEnd: string
  firstValidationId: string
  lastValidationId: string
  validationIds: string[]
  modes: TransportMode[]
  carriers: Carrier[]
  zones: Zone[]
  amountKopecks: number
  fareType: FareType
}
