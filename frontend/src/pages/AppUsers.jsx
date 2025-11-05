import { useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell.jsx'

const API = import.meta.env.VITE_API_BASE

export default function AppUsers() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'viewer',
    customer_id: ''
  })

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',    // OPTIONAL on edit
    role: 'viewer',
    customer_id: ''
  })

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/appusers`)
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.message || 'ჩატვირთვის შეცდომა')
      setList(j.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ loadUsers() }, [])

  // CREATE
  function openCreate() {
    setForm({ username:'', password:'', role:'viewer', customer_id:'' })
    setShowModal(true)
  }
  function closeCreate() {
    setShowModal(false)
  }
  async function onCreate(e) {
    e.preventDefault()
    setError('')
    if (!form.username) { setError('შეიყვანე username'); return }
    if (!form.password) { setError('შეიყვანე პაროლი'); return }
    if (form.role === 'customer' && !/^\d+$/.test(String(form.customer_id || ''))) {
      setError('customer_id უნდა იყოს მხოლოდ ციფრები'); return
    }
    try{
      const res = await fetch(`${API}/api/appusers`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          role: form.role,
          customer_id: form.role==='customer' ? Number(form.customer_id) : null
        })
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'შენახვის შეცდომა')
      setShowModal(false)
      await loadUsers()
    }catch(e){ setError(e.message) }
  }

  // EDIT
  function openEdit(u){
    setEditId(u.id)
    setEditForm({
      username: u.username,
      password: '',
      role: u.role,
      customer_id: u.customer_id ?? ''
    })
    setEditOpen(true)
  }
  function closeEdit(){
    setEditOpen(false)
    setEditId('')
  }
  async function onEdit(e){
    e.preventDefault()
    setError('')
    if (!editId) return
    if (!editForm.username){ setError('შეიყვანე username'); return }
    if (editForm.role === 'customer' && !/^\d+$/.test(String(editForm.customer_id || ''))) {
      setError('customer_id უნდა იყოს მხოლოდ ციფრები'); return
    }
    try{
      const res = await fetch(`${API}/api/appusers/${editId}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          username: editForm.username,
          password: editForm.password || undefined,   // ცარიელი? არ შეიცვლოს
          role: editForm.role,
          customer_id: editForm.role==='customer' ? Number(editForm.customer_id) : null
        })
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'განახლების შეცდომა')
      closeEdit()
      await loadUsers()
    }catch(e){ setError(e.message) }
  }

  // DELETE
  async function onDelete(id, username){
    if(!confirm(`წავშალოთ მომხმარებელი "${username}" ?`)) return
    try{
      const res = await fetch(`${API}/api/appusers/${id}`, { method:'DELETE' })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'წაშლის შეცდომა')
      await loadUsers()
    }catch(e){ setError(e.message) }
  }

  return (
    <AdminShell active="users">
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <h1 style={{margin:0}}>მომხმარებლები</h1>
        <div style={{flex:1}}/>
        <button className="logout" onClick={openCreate}>მომხმარებლის დამატება</button>
      </div>

      {error && <div style={{marginTop:8, color:'#ff6b6b'}}>{error}</div>}
      {loading && <div style={{marginTop:8, opacity:.8}}>იტვირთება...</div>}

      <div style={{marginTop:12, overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Username</Th>
              <Th>Role</Th>
              <Th>Customer ID</Th>
              <Th>შექმნილია</Th>
              <Th>ქმედება</Th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><Td colSpan={6} align="center">ჩანაწერი არ არის</Td></tr>
            ) : list.map(u=>(
              <tr key={u.id}>
                <Td>{u.id}</Td>
                <Td>{u.username}</Td>
                <Td>{u.role}</Td>
                <Td>{u.customer_id ?? '-'}</Td>
                <Td>{(u.created_at || '').replace('T',' ').replace('Z','')}</Td>
                <Td>
                  <div style={{display:'flex', gap:6}}>
                    <button className="logout" onClick={()=>openEdit(u)}>რედაქტირება</button>
                    <button className="logout" onClick={()=>onDelete(u.id, u.username)}>წაშლა</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div style={backdrop}>
          <div style={card}>
            <h3 style={{marginTop:0}}>მომხმარებლის დამატება</h3>
            <form onSubmit={onCreate} style={{display:'grid', gap:10}}>
              <Row label="Username">
                <input
                  value={form.username}
                  onChange={e=>setForm({...form, username:e.target.value})}
                />
              </Row>
              <Row label="პაროლი">
                <input
                  type="password"
                  value={form.password}
                  onChange={e=>setForm({...form, password:e.target.value})}
                />
              </Row>
              <Row label="როლი">
                <select
                  value={form.role}
                  onChange={e=>setForm({...form, role:e.target.value})}
                >
                  <option value="admin">admin</option>
                  <option value="customer">customer</option>
                  <option value="technician">technician</option>
                  <option value="viewer">viewer</option>
                </select>
              </Row>
              {form.role === 'customer' && (
                <Row label="Customer ID (მხოლოდ ციფრები)">
                  <input
                    value={form.customer_id}
                    onChange={e=>setForm({...form, customer_id:e.target.value})}
                  />
                </Row>
              )}

              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button className="logout" type="submit">შენახვა</button>
                <button className="logout" type="button" onClick={()=>setShowModal(false)}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editOpen && (
        <div style={backdrop}>
          <div style={card}>
            <h3 style={{marginTop:0}}>მომხმარებლის რედაქტირება</h3>
            <form onSubmit={onEdit} style={{display:'grid', gap:10}}>
              <Row label="Username">
                <input
                  value={editForm.username}
                  onChange={e=>setEditForm({...editForm, username:e.target.value})}
                />
              </Row>
              <Row label="ახალი პაროლი (არასავალდებულო)">
                <input
                  type="password"
                  value={editForm.password}
                  onChange={e=>setEditForm({...editForm, password:e.target.value})}
                  placeholder="თუ არ შეცვლი, დატოვე ცარიელი"
                />
              </Row>
              <Row label="როლი">
                <select
                  value={editForm.role}
                  onChange={e=>setEditForm({...editForm, role:e.target.value})}
                >
                  <option value="admin">admin</option>
                  <option value="customer">customer</option>
                  <option value="technician">technician</option>
                  <option value="viewer">viewer</option>
                </select>
              </Row>
              {editForm.role === 'customer' && (
                <Row label="Customer ID (მხოლოდ ციფრები)">
                  <input
                    value={editForm.customer_id}
                    onChange={e=>setEditForm({...editForm, customer_id:e.target.value})}
                  />
                </Row>
              )}

              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button className="logout" type="submit">შენახვა</button>
                <button className="logout" type="button" onClick={closeEdit}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
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
      <span style={{fontSize:12, color:'#555'}}>{label}</span>
      {children}
    </label>
  )
}

const backdrop = {
  position:'fixed', inset:0,
  background:'rgba(0,0,0,0.5)',
  display:'grid', placeItems:'center', padding:'16px',
  zIndex: 9999
}
const card = {
  background:'#fff', color:'#000',
  borderRadius:'12px', padding:'16px',
  width:'100%', maxWidth:'520px',
  boxShadow:'0 10px 25px rgba(0,0,0,0.25)'
}
