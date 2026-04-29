import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TariffConfig } from '../domain/tariff.js'
import { tariffConfigSchema } from '../schemas/tariff.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../../')

export async function loadTariffConfig(customPath?: string): Promise<TariffConfig> {
  const filePath = customPath ?? process.env.TARIFF_CONFIG_PATH ?? 'config/tariffs/moscow-test.json'
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath)

  const raw = await readFile(absolutePath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown

  return tariffConfigSchema.parse(parsed)
}
