import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './admin.css'

const API = import.meta.env.VITE_API_BASE

export default function Admin(){
  const nav = useNavigate()
  const [list, setList] = useState([])
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isEdit, setIsEdit] = useState(false)

  const [form, setForm] = useState({
    id: '',
    name: '',
    ident_code: '',
    salon_name: '',
    address: '',
    phone: '',
    contact_person: '',
    device: '',
    device_sn: '',
    password: '',
  })

  useEffect(()=>{
    const role = localStorage.getItem('role')
    if(role !== 'admin'){
      nav('/login', { replace: true })
    }
  }, [nav])

  async function loadCustomers(){
    try{
      const res = await fetch(`${API}/api/customers`)
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'ჩატვირთვის შეცდომა')
      setList(j.items || [])
    }catch(err){
      alert(err.message)
    }
  }
  useEffect(()=>{ loadCustomers() }, [])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(x =>
      (String(x.id) || '').toLowerCase().includes(q) ||
      (x.name || '').toLowerCase().includes(q)
    )
  }, [list, query])

  function openCreateModal(){
    setIsEdit(false)
    setForm({
      id: '',
      name: '',
      ident_code: '',
      salon_name: '',
      address: '',
      phone: '',
      contact_person: '',
      device: '',
      device_sn: '',
      password: '',
    })
    setShowModal(true)
  }

  function startEdit(c){
    setIsEdit(true)
    setForm({
      id: c.id,
      name: c.name || '',
      ident_code: c.ident_code || '',
      salon_name: c.salon_name || '',
      address: c.address || '',
      phone: c.phone || '',
      contact_person: c.contact_person || '',
      device: c.device || '',
      device_sn: c.device_sn || '',
    })
    setShowModal(true)
  }

  async function createCustomer(e){
    e.preventDefault()
    if(!form.id || !/^\d+$/.test(form.id)){ alert('ID უნდა იყოს მხოლოდ ციფრები'); return }
    if(!form.name){ alert('დასახელება სავალდებულოა'); return }
    if(!form.ident_code){ alert('საიდენტიფიკაციო სავალდებულოა'); return }

    try{
      const res = await fetch(`${API}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form }) 
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'შენახვის შეცდომა')

      setShowModal(false)
      await loadCustomers()
    }catch(err){
      alert(err.message)
    }
  }

  async function updateCustomer(e){
    e.preventDefault()
    if(!form.id || !/^\d+$/.test(form.id)){ alert('არასწორი ID'); return }
    if(!form.name){ alert('დასახელება სავალდებულოა'); return }
    if(!form.ident_code){ alert('საიდენტიფიკაციო სავალდებულოა'); return }

    try{
      const res = await fetch(`${API}/api/customers/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: form.name,
          ident_code: form.ident_code,
          salon_name: form.salon_name,
          address: form.address,
          phone: form.phone,
          contact_person: form.contact_person,
          device: form.device,
          device_sn: form.device_sn
        })
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'განახლების შეცდომა')

      setShowModal(false)
      setIsEdit(false)
      await loadCustomers()
    }catch(err){
      alert(err.message)
    }
  }

  async function deleteCustomer(id, name){
    if(!confirm(`წავშალოთ კლიენტი: ${name} (ID: ${id})?`)) return
    try{
      const res = await fetch(`${API}/api/customers/${id}`, { method:'DELETE' })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'წაშლის შეცდომა')
      await loadCustomers()
    }catch(err){
      alert(err.message)
    }
  }

  function onLogout(){
    localStorage.removeItem('role')
    nav('/login', { replace: true })
  }

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <div className="brand">
          <img src="/logo.png" alt="Sanso" style={{ height: 28, marginRight: 10, verticalAlign: 'middle' }}/>
          <span>Sanso Technical Department</span>
        </div>
        <div className="spacer" />
        <button className="logout" onClick={onLogout}>გასვლა</button>
      </header>

      <div className="admin-body">
        <aside className="side">
          <div className="side-title">მენიუ</div>
          <ul>
            <li className="active">მთავარი</li>
            <li>სტატისტიკა</li>
            <li>პარამეტრები</li>
            <li>Audit log</li>
            <li onClick={onLogout}>გასვლა</li>
          </ul>
        </aside>

      <main className="content">
        <h1>კლიენტები</h1>

        <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
          <button className="logout" onClick={openCreateModal}>კლიენტის დამატება</button>
          <input
            placeholder="ძიება (ID ან დასახელება)"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            style={{border:'1px solid #444', background:'#1f1f1f', color:'#fff', borderRadius:10, padding:'8px 10px', minWidth:280}}
          />
        </div>

        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>დასახელება</Th>
                <Th>საიდენტიფიკაციო</Th>
                <Th>სალონი/კლინიკა</Th>
                <Th>მისამართი</Th>
                <Th>ტელეფონი</Th>
                <Th>საკონტაქტო პირი</Th>
                <Th>აპარატი</Th>
                <Th>სერიული №</Th>
                <Th>ქმედება</Th>
              </tr>
            </thead>
<tbody>
  {filtered.length === 0 ? (
    <tr><Td colSpan={10} align="center">ჩანაწერი არ არის</Td></tr>
  ) : (
    filtered.map((c) => (
      <tr
        key={c.id}
        onClick={() => nav(`/customer/${c.id}`)}
        style={{ cursor: 'pointer' }}
        className="row-clickable"
      >
        <Td>{c.id}</Td>
        <Td>{c.name}</Td>
        <Td>{c.ident_code}</Td>
        <Td>{c.salon_name}</Td>
        <Td>{c.address}</Td>
        <Td>{c.phone}</Td>
        <Td>{c.contact_person}</Td>
        <Td>{c.device}</Td>
        <Td>{c.device_sn}</Td>
        <Td style={{ display: 'flex', gap: 6 }}>
          <button
            className="logout"
            onClick={(e) => { e.stopPropagation(); startEdit(c) }}
          >
            რედაქტირება
          </button>
          <button
            className="logout"
            onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id, c.name) }}
          >
            წაშლა
          </button>
        </Td>
      </tr>
    ))
  )}
</tbody>

          </table>
        </div>
      </main>
      </div>

      {/* დამატების/რედაქტირების მოდალი */}
      {showModal && (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <h3 style={{marginTop:0}}>{isEdit ? 'კლიენტის რედაქტირება' : 'კლიენტის დამატება'}</h3>
            <form onSubmit={isEdit ? updateCustomer : createCustomer} style={{display:'grid', gap:8, maxHeight:'70vh', overflow:'auto'}}>
              <Row label="ID (მხოლოდ ციფრები)">
                <input
                  value={form.id}
                  onChange={e=>setForm({...form, id:e.target.value})}
                  disabled={isEdit}
                />
              </Row>
              <Row label="დასახელება">
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </Row>
              <Row label="საიდენტიფიკაციო კოდი (კლიენტის username)">
                <input value={form.ident_code} onChange={e=>setForm({...form, ident_code:e.target.value})} />
              </Row>
              <Row label="სალონის/კლინიკის დასახელება">
                <input value={form.salon_name} onChange={e=>setForm({...form, salon_name:e.target.value})} />
              </Row>
              <Row label="მისამართი">
                <input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
              </Row>
              <Row label="ტელეფონი">
                <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
              </Row>
              <Row label="საკონტაქტო პირი">
                <input value={form.contact_person} onChange={e=>setForm({...form, contact_person:e.target.value})} />
              </Row>
              <Row label="აპარატი">
                <input value={form.device} onChange={e=>setForm({...form, device:e.target.value})} />
              </Row>
              <Row label="აპარატის სერიული ნომერი">
                <input value={form.device_sn} onChange={e=>setForm({...form, device_sn:e.target.value})} />
              </Row>
              <Row label="პაროლი (კლიენტის შესასვლელად)">
                <input
                  type="password"
                  value={form.password}
                  onChange={e=>setForm({...form, password:e.target.value})}
                />
              </Row>


              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button className="logout" type="submit">{isEdit ? 'შენახვა' : 'დამატება'}</button>
                <button className="logout" type="button" onClick={()=>{ setShowModal(false); setIsEdit(false) }}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({children}) {
  return <th style={{textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #444'}}>{children}</th>
}
function Td({children, colSpan, align}){
  return <td colSpan={colSpan} style={{padding:'8px 10px', borderBottom:'1px solid #333', textAlign: align || 'left'}}>{children}</td>
}
function Row({label, children}){
  return (
    <label style={{display:'grid', gap:4}}>
      <span style={{fontSize:12, color:'#bbb'}}>{label}</span>
      {children}
    </label>
  )
}

const modalBackdrop = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', padding:'16px'
}
const modalCard = {
  background:'#fff', color:'#000', borderRadius:'12px', padding:'16px', width:'100%', maxWidth:'560px', boxShadow:'0 10px 25px rgba(0,0,0,0.25)'
}
