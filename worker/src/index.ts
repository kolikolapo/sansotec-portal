import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET','POST','PUT','DELETE','OPTIONS'],
}))

// ჯანმრთელობის შემოწმება
app.get('/api/health', (c) => c.json({ ok: true, service: 'sansotec-api' }))

// ფეიქი ლოგინი: admin/admin => role: admin
app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>()
    const { username, password } = body || { username: '', password: '' }

    if (username === 'admin' && password === 'admin') {
      // დროებით, ქუქის გარეშე — უბრალოდ ვაბრუნებთ როლს
      return c.json({ ok: true, role: 'admin' })
    }
    return c.json({ ok: false, message: 'არასწორი მონაცემები' }, 401)
  } catch {
    return c.json({ ok: false, message: 'არასწორი მოთხოვნა' }, 400)
  }
})

// ფეიქი /me — დროებით უბრალოდ გეტყვით რომ "არავტორიზებული".
// (ქუქი/სესიას დავამატებთ შემდეგ ნაბიჯებში)
app.get('/api/auth/me', (c) => {
  return c.json({ ok: false, role: 'guest' }, 401)
})

export default app
