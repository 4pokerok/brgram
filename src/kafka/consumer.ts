import { Consumer, Kafka } from 'kafkajs'
import { registerCompressionCodecs } from './registerCompressionCodecs.js'

export function createConsumer(): Consumer {
  registerCompressionCodecs()

  const brokers = (process.env.KAFKA_BROKERS ?? '94.139.255.96:9094').split(',')
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'fare-worker'
  const groupId = process.env.KAFKA_GROUP_ID ?? 'fare-worker-group-v1'
  const connectionTimeout = Number(process.env.KAFKA_CONNECTION_TIMEOUT_MS ?? 10000)
  const requestTimeout = Number(process.env.KAFKA_REQUEST_TIMEOUT_MS ?? 60000)
  const retries = Number(process.env.KAFKA_RETRIES ?? 100000)
  const initialRetryTime = Number(process.env.KAFKA_INITIAL_RETRY_MS ?? 1000)
  const maxRetryTime = Number(process.env.KAFKA_MAX_RETRY_MS ?? 30000)

  const kafka = new Kafka({
    clientId,
    brokers,
    connectionTimeout,
    requestTimeout,
    retry: {
      retries,
      initialRetryTime,
      maxRetryTime
    }
  })

  return kafka.consumer({ groupId })
}
