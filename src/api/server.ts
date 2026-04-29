import express from 'express'
import { createRoutes } from './routes.js'

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(createRoutes())

const port = Number(process.env.PORT ?? 3000)

app.listen(port, () => {
  console.log(`fare-api listening on http://localhost:${port}`)
})
