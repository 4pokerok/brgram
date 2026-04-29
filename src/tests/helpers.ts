import { readFileSync } from 'node:fs'
import path from 'node:path'
import { calculateFare } from '../core/calculateFare.js'
import {
  Carrier,
  PaymentMethod,
  TransportMode,
  ValidationEventType,
  ValidationStatus,
  Zone
} from '../domain/enums.js'
import { FareCalculationRequest } from '../domain/request.js'
import { Dictionaries, TariffConfig } from '../domain/tariff.js'
import { ValidationEvent } from '../domain/validation.js'
import { mcdEntryExitRuleSchema, refPlaceSchema, tariffConfigSchema } from '../schemas/tariff.schema.js'

const rootDir = process.cwd()

const tariffConfig: TariffConfig = tariffConfigSchema.parse(
  JSON.parse(readFileSync(path.resolve(rootDir, 'config/tariffs/moscow-test.json'), 'utf-8')) as unknown
)

const dictionaries: Dictionaries = {
  lines: JSON.parse(readFileSync(path.resolve(rootDir, 'data/lines.json'), 'utf-8')) as Array<
    Record<string, unknown>
  >,
  stations: JSON.parse(
    readFileSync(path.resolve(rootDir, 'data/stations.json'), 'utf-8')
  ) as Array<Record<string, unknown>>,
  transferNodes: JSON.parse(
    readFileSync(path.resolve(rootDir, 'data/transfer-nodes.json'), 'utf-8')
  ) as Array<Record<string, unknown>>,
  mcdEntryExitRules: (JSON.parse(
    readFileSync(path.resolve(rootDir, 'data/mcd-entry-exit-rules.json'), 'utf-8')
  ) as unknown[]).map((item) => mcdEntryExitRuleSchema.parse(item)),
  refPlaces: (JSON.parse(
    readFileSync(path.resolve(rootDir, 'data/ref-place.json'), 'utf-8')
  ) as unknown[]).map((item) => refPlaceSchema.parse(item))
}

export function buildValidation(input: Partial<ValidationEvent> & Pick<ValidationEvent, 'validationId'>): ValidationEvent {
  return {
    validationId: input.validationId,
    eventTime: input.eventTime ?? '2026-04-28T08:00:00+03:00',
    status: input.status ?? ValidationStatus.ACCEPTED,
    eventType: input.eventType ?? ValidationEventType.ENTRY,
    mode: input.mode ?? TransportMode.METRO,
    carrier: input.carrier ?? Carrier.METRO,
    zone: input.zone ?? Zone.MOSCOW,
    lineId: input.lineId,
    stationId: input.stationId,
    paymentTokenHash: input.paymentTokenHash,
    terminalId: input.terminalId,
    cppkValidationType: input.cppkValidationType,
    placeId: input.placeId,
    metadata: input.metadata
  }
}

export function buildRequest(
  validations: ValidationEvent[],
  paymentMethod: PaymentMethod = PaymentMethod.BANK_CARD,
  transportDate = '2026-04-28'
): FareCalculationRequest {
  return {
    requestId: 'req-test-1',
    passengerKey: 'pax-test-1',
    transportDate,
    paymentMethod,
    validations
  }
}

export function runCalculate(
  request: FareCalculationRequest,
  config: TariffConfig = tariffConfig
) {
  return calculateFare(request, config, dictionaries)
}

export function getTariffConfig(): TariffConfig {
  return tariffConfig
}
