// frontend/src/components/AdminShell.jsx
import { useNavigate } from 'react-router-dom'

export default function AdminShell({ children, active = 'home' }) {
  const nav = useNavigate()

  function onLogout(){
    localStorage.removeItem('role')
    localStorage.removeItem('customer_id')
    nav('/login', { replace: true })
  }

  return (
    <div className="admin-wrap">
      {/* Header */}
      <header className="admin-header">
        <div className="brand" onClick={()=>nav('/admin')} style={{cursor:'pointer'}}>
          <img src="/logo.png" alt="Sanso" style={{ height: 28, marginRight: 10, verticalAlign: 'middle' }}/>
          <span>Sanso Technical Department</span>
        </div>
        <div className="spacer" />
        <button className="logout" onClick={onLogout}>გასვლა</button>
      </header>

      <div className="admin-body">
        {/* Aside (მენიუ) */}
        <aside className="side">
          <div className="side-title">მენიუ</div>
          <ul>
            <li className={active==='home' ? 'active' : ''} onClick={()=>nav('/admin')}>მთავარი</li>
            <li className={active==='stats' ? 'active' : ''} onClick={()=>nav('/stats')}>სტატისტიკა</li>
            <li className={active==='settings' ? 'active' : ''} onClick={()=>nav('/settings')}>პარამეტრები</li>
            <li className={active==='users' ? 'active' : ''} onClick={()=>nav('/settings/users')}>მომხმარებლები</li>
            <li onClick={onLogout}>გასვლა</li>
          </ul>
        </aside>

        {/* Main */}
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
