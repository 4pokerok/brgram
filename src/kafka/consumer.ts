import { Consumer, Kafka } from 'kafkajs'
import { registerCompressionCodecs } from './registerCompressionCodecs.js'

export function createConsumer(): Consumer {
  registerCompressionCodecs()

  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'fare-worker'
  const groupId = process.env.KAFKA_GROUP_ID ?? 'fare-worker-group-v1'

  const kafka = new Kafka({
    clientId,
    brokers
  })

  return kafka.consumer({ groupId })
}
