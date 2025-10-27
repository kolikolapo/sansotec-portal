import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE

export default function AppUsers(){
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // მხოლოდ admin-ს შევუშვათ
  useEffect(()=>{
    const role = localStorage.getItem('role')
    if (role !== 'admin') {
      nav('/login', { replace: true })
    }
  }, [nav])

  async function loadUsers(){
    try{
      setLoading(true)
      setError('')
      const res = await fetch(`${API}/api/appusers`)
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'ჩატვირთვის შეცდომა')
      setItems(j.items || [])
    }catch(e){
      setError(e.message)
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ loadUsers() }, [])

  return (
    <div style={{minHeight:'100vh', background:'#282828', color:'#fff', fontFamily:'Myriad Pro, system-ui'}}>
      <header style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#1f1f1f', borderBottom:'1px solid #333'}}>
        <img src="/logo.png" alt="Sanso" style={{ height: 28 }}/>
        <div style={{fontWeight:800}}>Sanso Technical Department — პარამეტრები / Users</div>
        <div style={{flex:1}} />
        <a href="/admin" style={{color:'#fff', textDecoration:'none'}}>← უკან ადმინის მთავარზე</a>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'240px 1fr'}}>
        <aside style={{background:'#1f1f1f', borderRight:'1px solid #333', padding:16}}>
          <div style={{fontSize:12, color:'#bbb', marginBottom:8}}>მენიუ</div>
          <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:6}}>
            <li style={{background:'#2a2a2a', padding:'10px 12px', borderRadius:10}}>
              <a href="/admin" style={{color:'#fff', textDecoration:'none'}}>მთავარი</a>
            </li>
            <li style={{background:'#000', padding:'10px 12px', borderRadius:10}}>
              პარამეტრები → Users
            </li>
          </ul>
        </aside>

        <main style={{padding:20}}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <h1 style={{margin:0}}>საიტის მომხმარებლები</h1>
            <span style={{opacity:.8}}>სულ: {items.length}</span>
            {/* დამატება/რედაქტირება მოგვიანებით დავამატებთ */}
          </div>

          {error && <div style={{marginTop:10, color:'#ff7b7b'}}>{error}</div>}
          {loading ? (
            <div style={{marginTop:12}}>იტვირთება...</div>
          ) : (
            <div style={{marginTop:12, overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Username</Th>
                    <Th>Role</Th>
                    <Th>Customer ID</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><Td colSpan={5} align="center">ჩანაწერი არ არის</Td></tr>
                  ) : items.map(u=>(
                    <tr key={u.id}>
                      <Td>{u.id}</Td>
                      <Td>{u.username}</Td>
                      <Td>{u.role}</Td>
                      <Td>{u.customer_id ?? '-'}</Td>
                      <Td>{u.created_at || '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Th({children}) {
  return <th style={{textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #444'}}>{children}</th>
}
function Td({children, colSpan, align}){
  return <td colSpan={colSpan} style={{padding:'8px 10px', borderBottom:'1px solid #333', textAlign: align || 'left'}}>{children}</td>
}
