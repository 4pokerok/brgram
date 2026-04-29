import { z } from 'zod'
import { Carrier, PaymentMethod, Zone } from '../domain/enums.js'

const paymentMethodConfigSchema = z.object({
  baseFareKopecks: z.number().int().nonnegative(),
  centralFareKopecks: z.number().int().nonnegative(),
  suburbanFareKopecks: z.number().int().nonnegative(),
  regionSurchargeKopecks: z.number().int().nonnegative()
})

export const tariffConfigSchema = z.object({
  tariffVersion: z.string().min(1),
  currency: z.literal('RUB'),
  transferWindowMinutes: z.number().int().positive(),
  mcdPricingStrategy: z.enum(['base_plus_surcharge', 'suburban_fare']),
  paymentMethods: z.object({
    [PaymentMethod.BANK_CARD]: paymentMethodConfigSchema,
    [PaymentMethod.SBP]: paymentMethodConfigSchema,
    [PaymentMethod.VIRTUAL_TROIKA]: paymentMethodConfigSchema,
    [PaymentMethod.FACE_PAY]: paymentMethodConfigSchema
  }),
  freeTransfers: z.array(
    z.object({
      from: z.nativeEnum(Carrier),
      to: z.nativeEnum(Carrier),
      zone: z.nativeEnum(Zone)
    })
  )
})

export const mcdEntryExitRuleSchema = z.object({
  carrier: z.nativeEnum(Carrier),
  lineId: z.string().optional(),
  stationId: z.string().optional(),
  missingEventType: z.enum(['entry', 'exit']),
  syntheticEventType: z.enum(['entry', 'exit']),
  syntheticZone: z.nativeEnum(Zone),
  syntheticStationId: z.string().min(1),
  reason: z.string().min(1)
})
