export { calculateFare, safeCalculateFare } from './core/calculateFare.js'
export { getTransportDay, isSameTransportDay } from './core/transportDay.js'

export * from './domain/enums.js'
export * from './domain/request.js'
export * from './domain/result.js'
export * from './domain/tariff.js'
export * from './domain/validation.js'

if (process.argv[1]?.endsWith('/src/index.ts')) {
  console.log('moscow-fare-calculator loaded. Start API with npm run dev:api or worker with npm run dev:worker')
}
