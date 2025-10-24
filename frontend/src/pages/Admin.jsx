import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './admin.css'

export default function Admin(){
  const nav = useNavigate()

  // მარტივი დაცვა: თუ როლი არაა admin, დაბრუნდეს login-ზე
  useEffect(()=>{
    const role = localStorage.getItem('role')
    if(role !== 'admin'){
      nav('/login', { replace: true })
    }
  }, [nav])

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <div className="brand">Sanso Technical Department</div>
        <div className="spacer" />
        <button className="logout" onClick={()=>{
          localStorage.removeItem('role')
          nav('/login', { replace: true })
        }}>გასვლა</button>
      </header>

      <div className="admin-body">
        <aside className="side">
          <div className="side-title">მენიუ</div>
          <ul>
            <li className="active">მთავარი</li>
            <li>სტატისტიკა</li>
            <li>პარამეტრები</li>
            <li>Audit log</li>
            <li onClick={()=>{
              localStorage.removeItem('role')
              nav('/login', { replace: true })
            }}>გასვლა</li>
          </ul>
        </aside>

        <main className="content">
          <h1>ადმინის მთავარი გვერდი</h1>
          <p>აქ მალე დავამატებთ კლიენტების სიას, ძიებას და „კლიენტის დამატება“ ფანჯარას.</p>
        </main>
      </div>
    </div>
  )
}
