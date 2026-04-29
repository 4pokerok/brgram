export type FareCharge = {
  chargeId: string
  tripId: string
  validationId: string
  amountKopecks: number
  chargeType:
    | 'base_fare'
    | 'free_transfer'
    | 'region_surcharge'
    | 'mcd_entry_included'
    | 'mcd_exit_completion'
    | 'mcd_entry_completion'
    | 'adjustment'
  reason: string
}
