import { Kafka, Producer } from 'kafkajs'
import { registerCompressionCodecs } from './registerCompressionCodecs.js'

export function createProducer(): Producer {
  registerCompressionCodecs()

  const brokers = (process.env.KAFKA_BROKERS ?? '94.139.255.96:9094').split(',')
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'fare-worker'

  const kafka = new Kafka({
    clientId,
    brokers
  })

  return kafka.producer()
}

export async function sendJson(
  producer: Producer,
  topic: string,
  key: string,
  payload: unknown
): Promise<void> {
  await producer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify(payload)
      }
    ]
  })
}
