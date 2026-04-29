import { Carrier, PaymentMethod, Zone } from './enums.js'

export type TariffConfig = {
  tariffVersion: string
  currency: 'RUB'
  transferWindowMinutes: number
  mcdPricingStrategy: 'base_plus_surcharge' | 'suburban_fare'
  paymentMethods: Record<
    PaymentMethod,
    {
      baseFareKopecks: number
      centralFareKopecks: number
      suburbanFareKopecks: number
      regionSurchargeKopecks: number
    }
  >
  freeTransfers: Array<{
    from: Carrier
    to: Carrier
    zone: Zone
  }>
}

export type TariffPaymentMethodConfig = TariffConfig['paymentMethods'][PaymentMethod]

export type McdEntryExitRule = {
  carrier: Carrier
  lineId?: string
  stationId?: string
  missingEventType: 'entry' | 'exit'
  syntheticEventType: 'entry' | 'exit'
  syntheticZone: Zone
  syntheticStationId: string
  reason: string
}

export type Dictionaries = {
  lines: Array<Record<string, unknown>>
  stations: Array<Record<string, unknown>>
  transferNodes: Array<Record<string, unknown>>
  mcdEntryExitRules: McdEntryExitRule[]
  refPlaces: RefPlace[]
}

export type RefPlace = {
  placeId: string
  carrier: Carrier
  ln_name2?: string
  is_except?: boolean
}
