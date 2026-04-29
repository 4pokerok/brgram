import { Consumer } from 'kafkajs'
import { createConsumer } from '../kafka/consumer.js'
import { TOPICS } from '../kafka/topics.js'

type UnknownRecord = Record<string, unknown>

export type ValidationFeedItem = {
  validationId: string
  eventTime: string
  passengerKey: string
  carrier: string
  mode: string
  eventType: string
  status: string
  zone: string
  transportDate?: string
  topic: string
  partition: number
  offset: string
}

type FeedState = {
  connected: boolean
  lastError?: string
  lastMessageAt?: string
}

const FEED_MAX_ITEMS = Number(process.env.API_VALIDATION_FEED_MAX_ITEMS ?? 500)
const FEED_GROUP_ID = process.env.API_VALIDATION_FEED_GROUP_ID ?? `fare-api-feed-v1`

const feedItems: ValidationFeedItem[] = []
const feedState: FeedState = { connected: false }
let feedConsumer: Consumer | null = null
let feedStarted = false

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return value as UnknownRecord
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parseValidationEvent(
  payload: unknown,
  metadata: { topic: string; partition: number; offset: string },
  inheritedPassengerKey?: string,
  inheritedTransportDate?: string
): ValidationFeedItem | null {
  const record = asRecord(payload)
  if (!record) {
    return null
  }

  const eventTime = asString(record.eventTime)
  const validationId = asString(record.validationId)
  const passengerKey = asString(record.passengerKey, inheritedPassengerKey ?? '')

  if (!validationId || !eventTime || !passengerKey) {
    return null
  }

  return {
    validationId,
    eventTime,
    passengerKey,
    carrier: asString(record.carrier, 'unknown'),
    mode: asString(record.mode, 'unknown'),
    eventType: asString(record.eventType, 'unknown'),
    status: asString(record.status, 'unknown'),
    zone: asString(record.zone, 'unknown'),
    transportDate: asString(record.transportDate, inheritedTransportDate ?? ''),
    topic: metadata.topic,
    partition: metadata.partition,
    offset: metadata.offset
  }
}

function parseFeedItems(
  raw: string,
  metadata: { topic: string; partition: number; offset: string; key?: string }
): ValidationFeedItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const root = asRecord(parsed)
  if (!root) {
    return []
  }

  const keyPassenger = metadata.key?.split(':')[0] ?? ''
  const inheritedPassengerKey = asString(root.passengerKey, keyPassenger)
  const inheritedTransportDate = asString(root.transportDate)
  const validations = root.validations

  if (Array.isArray(validations)) {
    return validations
      .map((item) =>
        parseValidationEvent(item, metadata, inheritedPassengerKey, inheritedTransportDate)
      )
      .filter((item): item is ValidationFeedItem => Boolean(item))
  }

  const single = parseValidationEvent(parsed, metadata, inheritedPassengerKey, inheritedTransportDate)
  return single ? [single] : []
}

function pushFeedItems(items: ValidationFeedItem[]): void {
  if (items.length === 0) {
    return
  }

  feedItems.unshift(...items.reverse())
  if (feedItems.length > FEED_MAX_ITEMS) {
    feedItems.length = FEED_MAX_ITEMS
  }
  feedState.lastMessageAt = new Date().toISOString()
}

export async function startValidationFeed(): Promise<void> {
  if (feedStarted) {
    return
  }
  feedStarted = true

  const previousGroupId = process.env.KAFKA_GROUP_ID
  process.env.KAFKA_GROUP_ID = FEED_GROUP_ID

  try {
    feedConsumer = createConsumer()
    await feedConsumer.connect()
    await feedConsumer.subscribe({ topic: TOPICS.PASSENGER_DAY_READY, fromBeginning: false })
    feedState.connected = true
    feedState.lastError = undefined
    await feedConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const raw = message.value?.toString()
        if (!raw) {
          return
        }
        const parsedItems = parseFeedItems(raw, {
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString()
        })
        pushFeedItems(parsedItems)
      }
    })
  } catch (error) {
    feedState.connected = false
    feedState.lastError = error instanceof Error ? error.message : 'Kafka feed failed'
    feedStarted = false
    if (feedConsumer) {
      try {
        await feedConsumer.disconnect()
      } catch {
        // no-op
      }
    }
    feedConsumer = null
  } finally {
    if (previousGroupId === undefined) {
      delete process.env.KAFKA_GROUP_ID
    } else {
      process.env.KAFKA_GROUP_ID = previousGroupId
    }
  }
}

export function getValidationFeed(
  filters: {
    passengerKey?: string
    transportDate?: string
    carrier?: string
    limit?: number
  } = {}
): { items: ValidationFeedItem[]; state: FeedState } {
  const normalizedPassengerKey = (filters.passengerKey ?? '').trim()
  const normalizedTransportDate = (filters.transportDate ?? '').trim()
  const normalizedCarrier = (filters.carrier ?? '').trim().toLowerCase()
  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 50
  const safeLimit = Math.max(1, Math.min(200, requestedLimit))

  const filtered = feedItems.filter((item) => {
    if (normalizedPassengerKey && item.passengerKey !== normalizedPassengerKey) {
      return false
    }
    if (normalizedTransportDate && item.transportDate !== normalizedTransportDate) {
      return false
    }
    if (normalizedCarrier && item.carrier.toLowerCase() !== normalizedCarrier) {
      return false
    }
    return true
  })

  return {
    items: filtered.slice(0, safeLimit),
    state: { ...feedState }
  }
}
