import { KafkaConfig, SASLOptions } from 'kafkajs'

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes'
}

function buildSaslFromEnv(): SASLOptions | undefined {
  const enabled = parseBoolean(process.env.KAFKA_SASL_ENABLED)
  if (!enabled) {
    return undefined
  }

  const mechanism = (process.env.KAFKA_SASL_MECHANISM ?? 'plain').toLowerCase()
  const username = process.env.KAFKA_SASL_USERNAME
  const password = process.env.KAFKA_SASL_PASSWORD

  if (!username || !password) {
    throw new Error('KAFKA_SASL_ENABLED=true requires KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD')
  }

  if (mechanism !== 'plain' && mechanism !== 'scram-sha-256' && mechanism !== 'scram-sha-512') {
    throw new Error(
      'Unsupported KAFKA_SASL_MECHANISM. Use one of: plain, scram-sha-256, scram-sha-512'
    )
  }

  return {
    mechanism,
    username,
    password
  } as SASLOptions
}

export function buildKafkaConfigFromEnv(clientId: string): KafkaConfig {
  const brokers = (process.env.KAFKA_BROKERS ?? '94.139.255.96:9094').split(',')
  const connectionTimeout = Number(process.env.KAFKA_CONNECTION_TIMEOUT_MS ?? 10000)
  const requestTimeout = Number(process.env.KAFKA_REQUEST_TIMEOUT_MS ?? 60000)
  const retries = Number(process.env.KAFKA_RETRIES ?? 100000)
  const initialRetryTime = Number(process.env.KAFKA_INITIAL_RETRY_MS ?? 1000)
  const maxRetryTime = Number(process.env.KAFKA_MAX_RETRY_MS ?? 30000)
  const ssl = parseBoolean(process.env.KAFKA_SSL)
  const sasl = buildSaslFromEnv()

  return {
    clientId,
    brokers,
    ssl,
    sasl,
    connectionTimeout,
    requestTimeout,
    retry: {
      retries,
      initialRetryTime,
      maxRetryTime
    }
  }
}

