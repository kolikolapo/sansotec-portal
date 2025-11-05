import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const nav = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!username || !password) {
      setError('გთხოვთ შეიყვანოთ იუზერნეიმი და პაროლი')
      return
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'ავტორიზაციის შეცდომა')
      }

      // შევინახოთ როლი და საჭიროებისას customer_id
      localStorage.setItem('role', data.role || '')
      if (data.customer_id) {
        localStorage.setItem('customer_id', String(data.customer_id))
      }

      // გადაყვანა როლის მიხედვით:
      if (data.role === 'admin') {
      nav('/admin', { replace: true })
    } else if (data.role === 'customer' && data.customer_id) {
      nav(`/customer/${data.customer_id}`, { replace: true })
    } else if (data.role === 'technician') {
      nav('/admin', { replace: true })   // დროებით admin dashboard-ზე
    } else if (data.role === 'viewer') {
      nav('/admin', { replace: true })   // დროებით admin dashboard-ზე
    } else {
      setInfo(`შესვლა: ${data.role}`)
      }
    } catch (err) {
      setError(err.message)
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
          />

          <label>პაროლი</label>
          <input
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />

          {error && <div className="err">{error}</div>}
          {info && <div style={{ color: 'green', fontSize: 12, marginTop: 4 }}>{info}</div>}

          <button type="submit">შესვლა</button>
        </form>
      </div>
    </div>
  )
}

export default App
