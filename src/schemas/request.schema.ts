import { z } from 'zod'
import { PaymentMethod } from '../domain/enums.js'
import { validationEventSchema } from './validation.schema.js'

export const fareCalculationRequestSchema = z.object({
  requestId: z.string().min(1),
  tariffVersion: z.string().min(1).optional(),
  passengerKey: z.string().min(1),
  transportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  validations: z.array(validationEventSchema)
})
