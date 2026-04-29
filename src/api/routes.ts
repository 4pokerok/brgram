import { Router } from 'express'
import { ZodError } from 'zod'
import { calculateFare } from '../core/calculateFare.js'
import { loadDictionaries } from '../config/loadDictionaries.js'
import { loadTariffConfig } from '../config/loadTariffConfig.js'
import { FareCalculationRequest } from '../domain/request.js'

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

  return router
}
