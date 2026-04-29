import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Dictionaries } from '../domain/tariff.js'
import { mcdEntryExitRuleSchema } from '../schemas/tariff.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../../')

async function readJson<T>(relativePath: string): Promise<T> {
  const absolutePath = path.resolve(rootDir, relativePath)
  const raw = await readFile(absolutePath, 'utf-8')
  return JSON.parse(raw) as T
}

export async function loadDictionaries(): Promise<Dictionaries> {
  const [lines, stations, transferNodes, rawMcdEntryExitRules] = await Promise.all([
    readJson<Array<Record<string, unknown>>>('data/lines.json'),
    readJson<Array<Record<string, unknown>>>('data/stations.json'),
    readJson<Array<Record<string, unknown>>>('data/transfer-nodes.json'),
    readJson<Array<Record<string, unknown>>>('data/mcd-entry-exit-rules.json')
  ])

  const mcdEntryExitRules = rawMcdEntryExitRules.map((rule) => mcdEntryExitRuleSchema.parse(rule))

  return {
    lines,
    stations,
    transferNodes,
    mcdEntryExitRules
  }
}
