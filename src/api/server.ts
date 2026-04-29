import express from 'express'
import { createRoutes } from './routes.js'
import { startValidationFeed } from './validationFeed.js'

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(createRoutes())

const port = Number(process.env.PORT ?? 3000)

app.listen(port, () => {
  console.log(`fare-api listening on http://localhost:${port}`)
})

void startValidationFeed()
  .then(() => {
    console.log('validation feed is running')
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(`validation feed failed to start: ${message}`)
  })
