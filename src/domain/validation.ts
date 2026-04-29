import {
  Carrier,
  CppkValidationType,
  TransportMode,
  ValidationEventType,
  ValidationStatus,
  Zone
} from './enums.js'

export type ValidationEvent = {
  validationId: string
  eventTime: string
  status: ValidationStatus
  eventType: ValidationEventType
  mode: TransportMode
  carrier: Carrier
  lineId?: string
  stationId?: string
  zone: Zone
  paymentTokenHash?: string
  terminalId?: string
  cppkValidationType?: CppkValidationType
  placeId?: string
  metadata?: Record<string, unknown>
}
