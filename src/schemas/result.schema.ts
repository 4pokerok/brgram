import { z } from 'zod'
import { PaymentMethod } from '../domain/enums.js'

const fareTypeSchema = z.enum([
  'single_ride',
  'transfer_window',
  'transfer_window_with_region_surcharge',
  'region_to_moscow_with_free_metro_transfer',
  'mcd_pair',
  'mcd_auto_completed_pair',
  'unknown'
])

const chargeTypeSchema = z.enum([
  'base_fare',
  'free_transfer',
  'region_surcharge',
  'mcd_entry_included',
  'mcd_exit_completion',
  'mcd_entry_completion',
  'adjustment'
])

export const fareCalculationResultSchema = z.object({
  requestId: z.string().min(1),
  passengerKey: z.string().min(1),
  transportDate: z.string().min(1),
  tariffVersion: z.string().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  currency: z.literal('RUB'),
  totalAmountKopecks: z.number().int(),
  trips: z.array(
    z.object({
      tripId: z.string().min(1),
      windowStart: z.string().datetime({ offset: true }),
      windowEnd: z.string().datetime({ offset: true }),
      firstValidationId: z.string().min(1),
      lastValidationId: z.string().min(1),
      validationIds: z.array(z.string().min(1)),
      modes: z.array(z.string().min(1)),
      carriers: z.array(z.string().min(1)),
      zones: z.array(z.string().min(1)),
      amountKopecks: z.number().int(),
      fareType: fareTypeSchema
    })
  ),
  charges: z.array(
    z.object({
      chargeId: z.string().min(1),
      tripId: z.string().min(1),
      validationId: z.string().min(1),
      amountKopecks: z.number().int(),
      chargeType: chargeTypeSchema,
      reason: z.string().min(1)
    })
  ),
  warnings: z.array(
    z.object({
      code: z.string().min(1),
      message: z.string().min(1),
      validationId: z.string().min(1).optional()
    })
  )
})
