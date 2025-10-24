import { useState } from 'react'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('გთხოვთ შეიყვანოთ იუზერნეიმი და პაროლი')
      return
    }
    alert(`(საწყის ვერსიაში) შეყვანილია:\nიუზერნეიმი: ${username}\ნპაროლი: ${'*'.repeat(password.length)}`)
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="title">Sanso Technical Department</div>
        <div className="subtitle">შესვლა</div>

        <form onSubmit={onSubmit} className="form">
          <label>იუზერნეიმი</label>
          <input
            placeholder="მაგ: admin"
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

          <button type="submit">შესვლა</button>
        </form>
      </div>
    </div>
  )
}

export default App
