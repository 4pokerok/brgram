import { Kafka, Producer } from 'kafkajs'
import { registerCompressionCodecs } from './registerCompressionCodecs.js'
import { buildKafkaConfigFromEnv } from './kafkaClientOptions.js'

export function createProducer(): Producer {
  registerCompressionCodecs()

  const clientId = process.env.KAFKA_CLIENT_ID ?? 'fare-worker'
  const kafka = new Kafka(buildKafkaConfigFromEnv(clientId))

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
