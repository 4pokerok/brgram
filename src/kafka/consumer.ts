import { Consumer, Kafka } from 'kafkajs'
import { registerCompressionCodecs } from './registerCompressionCodecs.js'
import { buildKafkaConfigFromEnv } from './kafkaClientOptions.js'

export function createConsumer(): Consumer {
  registerCompressionCodecs()

  const clientId = process.env.KAFKA_CLIENT_ID ?? 'fare-worker'
  const groupId = process.env.KAFKA_GROUP_ID ?? 'fare-worker-group-v1'
  const kafka = new Kafka(buildKafkaConfigFromEnv(clientId))

  return kafka.consumer({ groupId })
}
