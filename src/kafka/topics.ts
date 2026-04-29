const DEFAULT_TOPICS = {
  PASSENGER_DAY_READY: 'fare.passenger-day.ready.v1',
  FARE_RESULT: 'fare.calculation.result.v1',
  FARE_FAILED: 'fare.calculation.failed.v1',
  FARE_DLQ: 'fare.calculation.dlq.v1'
} as const

export const TOPICS = {
  PASSENGER_DAY_READY: process.env.KAFKA_TOPIC_INPUT ?? DEFAULT_TOPICS.PASSENGER_DAY_READY,
  FARE_RESULT: process.env.KAFKA_TOPIC_RESULT ?? DEFAULT_TOPICS.FARE_RESULT,
  FARE_FAILED: process.env.KAFKA_TOPIC_FAILED ?? DEFAULT_TOPICS.FARE_FAILED,
  FARE_DLQ: process.env.KAFKA_TOPIC_DLQ ?? DEFAULT_TOPICS.FARE_DLQ
} as const
