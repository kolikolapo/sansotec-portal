import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET','POST','PUT','DELETE','OPTIONS'],
}))

app.get('/api/health', (c) => c.json({ ok: true, service: 'sansotec-api' }))

export default app
