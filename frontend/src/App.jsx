import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setInfo('')

    const u = username.trim()
    const p = password.trim()
    if (!u || !p) {
      setError('გთხოვთ შეიყვანოთ იუზერნეიმი და პაროლი')
      return
    }

    // უსაფრთხოდ ავაგოთ API base (უკანასკნელი '/’ მოვაშოროთ თუ არის)
    const base = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
    if (!base) {
      setError('API მისამართი არ არის გაწერილი (VITE_API_BASE)')
      return
    }

    try {
      setBusy(true)
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      })

      // შესაძლოა API-მ საერთოდ არ დააბრუნოს სწორი JSON (ქსელური/CORS შეცდომები)
      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }

      if (!res.ok || !data || data.ok !== true) {
        const msg =
          (data && data.message) ||
          `ავტორიზაციის შეცდომა (${res.status})`
        throw new Error(msg)
      }

      // შევინახოთ როლი და საჭიროებისას customer_id
      localStorage.setItem('role', data.role || '')
      if (data.customer_id) {
        localStorage.setItem('customer_id', String(data.customer_id))
      }

      // გადაყვანა როლის მიხედვით
      if (data.role === 'admin') {
        nav('/admin', { replace: true })
      } else if (data.role === 'customer' && data.customer_id) {
        nav(`/customer/${data.customer_id}`, { replace: true })
      } else if (data.role === 'technician') {
        // დროებით admin dashboard-ზე გადავიყვანოთ
        nav('/admin', { replace: true })
      } else if (data.role === 'viewer') {
        // დროებით admin dashboard-ზე გადავიყვანოთ
        nav('/admin', { replace: true })
      } else {
        // უცნობი როლი — ინფოს ვაჩვენებთ
        setInfo(`შესვლა: ${data.role || 'უცნობი როლი'}`)
      }
    } catch (err) {
      setError(err.message || 'ვერ მოხერხდა ავტორიზაცია')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="title">Sanso Technical Department</div>
        <div className="subtitle">შესვლა</div>

        <form onSubmit={onSubmit} className="form">
          <label>იუზერნეიმი</label>
          <input
            placeholder="მაგ: admin ან კლიენტის ident_code"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            disabled={busy}
          />

          <label>პაროლი</label>
          <input
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            disabled={busy}
          />

          {error && <div className="err">{error}</div>}
          {info && <div style={{ color: 'green', fontSize: 12, marginTop: 4 }}>{info}</div>}

          <button type="submit" disabled={busy}>
            {busy ? 'იტვირთება…' : 'შესვლა'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
