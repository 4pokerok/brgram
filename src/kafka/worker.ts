import { ZodError } from 'zod'
import { calculateFare } from '../core/calculateFare.js'
import { FareCalculationRequest } from '../domain/request.js'
import { loadDictionaries } from '../config/loadDictionaries.js'
import { loadTariffConfig } from '../config/loadTariffConfig.js'
import { createConsumer } from './consumer.js'
import { createProducer, sendJson } from './producer.js'
import { TOPICS } from './topics.js'

function buildMessageKey(request: FareCalculationRequest): string {
  return `${request.passengerKey}:${request.transportDate}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function runWorkerOnce(stopRequestedRef: { value: boolean }): Promise<void> {
  const consumer = createConsumer()
  const producer = createProducer()

  await producer.connect()
  await consumer.connect()
  await consumer.subscribe({ topic: TOPICS.PASSENGER_DAY_READY, fromBeginning: false })

  const [tariffConfig, dictionaries] = await Promise.all([loadTariffConfig(), loadDictionaries()])

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString('utf-8')
      const rawKey = message.key?.toString('utf-8') ?? ''

      if (!rawValue) {
        await sendJson(producer, TOPICS.FARE_DLQ, rawKey, {
          error: 'VALIDATION_ERROR',
          reason: 'Message value is empty',
          topic,
          partition,
          offset: message.offset
        })
        return
      }

      let request: FareCalculationRequest

      try {
        request = JSON.parse(rawValue) as FareCalculationRequest
      } catch {
        await sendJson(producer, TOPICS.FARE_DLQ, rawKey, {
          error: 'VALIDATION_ERROR',
          reason: 'Payload is not valid JSON',
          payload: rawValue,
          topic,
          partition,
          offset: message.offset
        })
        return
      }

      const key = buildMessageKey(request)

      try {
        const result = calculateFare(request, tariffConfig, dictionaries)
        await sendJson(producer, TOPICS.FARE_RESULT, key, result)
      } catch (error) {
        if (error instanceof ZodError) {
          await sendJson(producer, TOPICS.FARE_DLQ, key, {
            error: 'VALIDATION_ERROR',
            reason: 'Request payload failed schema validation',
            details: error.issues,
            payload: request
          })
          return
        }

        const messageText = error instanceof Error ? error.message : 'Unknown runtime error'
        await sendJson(producer, TOPICS.FARE_FAILED, key, {
          error: 'RUNTIME_ERROR',
          reason: messageText,
          payload: request
        })
      }
    }
  })

  console.log('fare-worker is running')

  const shutdown = async (signal: string): Promise<void> => {
    if (stopRequestedRef.value) {
      return
    }
    stopRequestedRef.value = true

    console.log(`fare-worker is shutting down (${signal})`)

    try {
      await consumer.stop()
    } catch (error) {
      console.error('failed to stop consumer', error)
    }

    try {
      await consumer.disconnect()
    } catch (error) {
      console.error('failed to disconnect consumer', error)
    }

    try {
      await producer.disconnect()
    } catch (error) {
      console.error('failed to disconnect producer', error)
    }

    process.exit(0)
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  // Keep process in foreground as a long-running worker.
  await new Promise<void>(() => {
    // Intentionally never resolved; shutdown is signal-driven.
  })
}

async function runWorker(): Promise<void> {
  const stopRequestedRef = { value: false }
  const restartDelayMs = Number(process.env.WORKER_RESTART_DELAY_MS ?? 5000)

  while (!stopRequestedRef.value) {
    try {
      await runWorkerOnce(stopRequestedRef)
    } catch (error) {
      if (stopRequestedRef.value) {
        break
      }
      console.error('fare-worker failed to start, retrying...', error)
      await sleep(restartDelayMs)
    }
  }
}

void runWorker()
