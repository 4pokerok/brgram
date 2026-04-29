import { createRequire } from 'node:module'
import kafkaJs from 'kafkajs'

const require = createRequire(import.meta.url)
const snappyModule = require('kafkajs-snappy') as { default?: unknown } | unknown
const snappyCodec =
  typeof snappyModule === 'object' && snappyModule !== null && 'default' in snappyModule
    ? (snappyModule as { default: unknown }).default
    : snappyModule

let initialized = false

export function registerCompressionCodecs(): void {
  if (initialized) {
    return
  }

  const compressionCodecs = (
    kafkaJs as unknown as {
      CompressionCodecs: Record<number, () => unknown>
    }
  ).CompressionCodecs
  const compressionTypes = (
    kafkaJs as unknown as {
      CompressionTypes: { Snappy: number }
    }
  ).CompressionTypes

  compressionCodecs[compressionTypes.Snappy] = snappyCodec as () => unknown
  initialized = true
}
