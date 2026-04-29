import { Router } from 'express'
import { ZodError } from 'zod'
import { calculateFare } from '../core/calculateFare.js'
import { loadDictionaries } from '../config/loadDictionaries.js'
import { loadTariffConfig } from '../config/loadTariffConfig.js'
import { FareCalculationRequest } from '../domain/request.js'
import { getValidationFeed } from './validationFeed.js'

export function createRoutes(): Router {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  router.post('/api/v1/fare/calculate', async (req, res) => {
    try {
      const request = req.body as FareCalculationRequest
      const [tariffConfig, dictionaries] = await Promise.all([loadTariffConfig(), loadDictionaries()])
      const result = calculateFare(request, tariffConfig, dictionaries)
      res.status(200).json(result)
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: error.issues
        })
        return
      }

      const message = error instanceof Error ? error.message : 'Unknown server error'
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message
      })
    }
  })

  router.get('/api/v1/kafka/validations', (req, res) => {
    const passengerKey = typeof req.query.passengerKey === 'string' ? req.query.passengerKey : undefined
    const transportDate =
      typeof req.query.transportDate === 'string' ? req.query.transportDate : undefined
    const carrier = typeof req.query.carrier === 'string' ? req.query.carrier : undefined
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined

    const { items, state } = getValidationFeed({
      passengerKey,
      transportDate,
      carrier,
      limit: Number.isFinite(limitRaw) ? limitRaw : 50
    })

    res.status(200).json({
      sourceTopic: process.env.KAFKA_TOPIC_INPUT ?? 'validations',
      connected: state.connected,
      lastError: state.lastError,
      lastMessageAt: state.lastMessageAt,
      count: items.length,
      items
    })
  })

  return router
}
