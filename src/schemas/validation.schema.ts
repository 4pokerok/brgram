import { z } from 'zod'
import {
  Carrier,
  CppkValidationType,
  TransportMode,
  ValidationEventType,
  ValidationStatus,
  Zone
} from '../domain/enums.js'

export const validationEventSchema = z.object({
  validationId: z.string().min(1),
  eventTime: z.string().datetime({ offset: true }),
  status: z.nativeEnum(ValidationStatus),
  eventType: z.nativeEnum(ValidationEventType),
  mode: z.nativeEnum(TransportMode),
  carrier: z.nativeEnum(Carrier),
  lineId: z.string().min(1).optional(),
  stationId: z.string().min(1).optional(),
  zone: z.nativeEnum(Zone),
  paymentTokenHash: z.string().min(1).optional(),
  terminalId: z.string().min(1).optional(),
  cppkValidationType: z.nativeEnum(CppkValidationType).optional(),
  placeId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional()
})
