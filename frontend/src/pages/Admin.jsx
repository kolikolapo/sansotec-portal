import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './admin.css'

const LS_KEY = 'customers'

export default function Admin(){
  const nav = useNavigate()
  const [list, setList] = useState([])
  const [query, setQuery] = useState('') // ძიება ID/დასახელებით
  const [showModal, setShowModal] = useState(false)
  const [isEdit, setIsEdit] = useState(false)       // ახალი: რედაქტირებისთვის

  // დამატების ფორმა
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
    password: '', // ცხრილში არ ჩანს
  })

  // რედაქტირების ფორმა
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    ident_code: '',
    salon_name: '',
    address: '',
    phone: '',
    contact_person: '',
    device: '',
    device_sn: '',
  })

  // მარტივი დაცვა: admin role
  useEffect(()=>{
    const role = localStorage.getItem('role')
    if(role !== 'admin'){
      nav('/login', { replace: true })
    }
  }, [nav])

  // ჩატვირთვა localStorage-დან
  useEffect(()=>{
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setList(arr)
      } catch {}
    } else {
      const sample = [
        {
          id: '1001',
          name: 'სანახავი მაგალითი',
          ident_code: 'CUST-001',
          salon_name: 'სალონი ალფა',
          address: 'თბილისი, ჭxxxx ქ.',
          phone: '555 00 00 00',
          contact_person: 'ნიკა',
          device: 'აპარატი X',
          device_sn: 'SN-12345',
          _created_at: Date.now(),
        }
      ]
      setList(sample)
      localStorage.setItem(LS_KEY, JSON.stringify(sample))
    }
  }, [])

  // ძიება: ID ან დასახელება
  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(x =>
      (x.id || '').toLowerCase().includes(q) ||
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
    setEditForm({
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

  function saveCustomer(e){
    e.preventDefault()
    if(!form.id || !/^\d+$/.test(form.id)){
      alert('ID უნდა იყოს მხოლოდ ციფრები'); return
    }
    if(!form.name){ alert('დასახელება სავალდებულოა'); return }
    if(!form.ident_code){ alert('საიდენტიფიკაციო კოდი სავალდებულოა'); return }
    if(!form.password){ alert('პაროლი სავალდებულოა'); return }

    if(list.some(x => x.id === form.id)){
      alert('ასეთი ID უკვე არსებობს'); return
    }
    if(list.some(x => x.ident_code === form.ident_code)){
      alert('ასეთი საიდენტიფიკაციო კოდი უკვე არსებობს'); return
    }

    const toSave = {
      id: form.id,
      name: form.name,
      ident_code: form.ident_code,
      salon_name: form.salon_name,
      address: form.address,
      phone: form.phone,
      contact_person: form.contact_person,
      device: form.device,
      device_sn: form.device_sn,
      _customer_password_plain: form.password, // დროებით მხოლოდ localStorage-ში
      _created_at: Date.now(),
    }
    const next = [...list, toSave]
    setList(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    setShowModal(false)
  }

  function updateCustomer(e){
    e.preventDefault()
    // ვალიდაცია
    if(!editForm.id || !/^\d+$/.test(editForm.id)){
      alert('ID უნდა იყოს მხოლოდ ციფრები'); return
    }
    if(!editForm.name){ alert('დასახელება სავალდებულოა'); return }
    if(!editForm.ident_code){ alert('საიდენტიფიკაციო კოდი სავალდებულოა'); return }

    // იპოვე ძველი ჩანაწერი
    const idx = list.findIndex(x => x.id === editForm.id)
    if(idx === -1){
      alert('ჩანაწერი ვერ მოიძებნა'); return
    }

    // სანქცია: ident_code დუბლირება სხვა ჩანაწერთან
    const dup = list.find(x => x.ident_code === editForm.ident_code && x.id !== editForm.id)
    if(dup){
      alert('ასეთი საიდენტიფიკაციო უკვე არსებობს სხვა ჩანაწერზე'); return
    }

    const updated = { ...list[idx], ...editForm, _updated_at: Date.now() }
    const next = [...list]
    next[idx] = updated

    setList(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    setShowModal(false)
    setIsEdit(false)
  }

  function deleteCustomer(c){
    if(!confirm(`წავშალოთ კლიენტი: ${c.name} (ID: ${c.id})?`)) return
    const next = list.filter(x => x.id !== c.id)
    setList(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
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
                ) : filtered.map((c)=>(
                  <tr key={c.id}>
                    <Td>{c.id}</Td>
                    <Td>{c.name}</Td>
                    <Td>{c.ident_code}</Td>
                    <Td>{c.salon_name}</Td>
                    <Td>{c.address}</Td>
                    <Td>{c.phone}</Td>
                    <Td>{c.contact_person}</Td>
                    <Td>{c.device}</Td>
                    <Td>{c.device_sn}</Td>
                    <Td style={{display:'flex', gap:6}}>
                      <button className="logout" onClick={()=>startEdit(c)}>რედაქტირება</button>
                      <button className="logout" onClick={()=>deleteCustomer(c)}>წაშლა</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* დამატების/რედაქტირების მოდალი */}
      {showModal && (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <h3 style={{marginTop:0}}>
              {isEdit ? 'კლიენტის რედაქტირება' : 'კლიენტის დამატება'}
            </h3>

            <form onSubmit={isEdit ? updateCustomer : saveCustomer} style={{display:'grid', gap:8, maxHeight:'70vh', overflow:'auto'}}>
              <Row label="ID (მხოლოდ ციფრები)">
                <input
                  value={isEdit ? editForm.id : form.id}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, id:e.target.value})
                    : setForm({...form, id:e.target.value})
                  }
                  disabled={isEdit} /* რედაქტირებისას ID არ შევცვალოთ */
                />
              </Row>
              <Row label="დასახელება">
                <input
                  value={isEdit ? editForm.name : form.name}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, name:e.target.value})
                    : setForm({...form, name:e.target.value})
                  }
                />
              </Row>
              <Row label="საიდენტიფიკაციო კოდი (კლიენტის username)">
                <input
                  value={isEdit ? editForm.ident_code : form.ident_code}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, ident_code:e.target.value})
                    : setForm({...form, ident_code:e.target.value})
                  }
                />
              </Row>
              <Row label="სალონის/კლინიკის დასახელება">
                <input
                  value={isEdit ? editForm.salon_name : form.salon_name}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, salon_name:e.target.value})
                    : setForm({...form, salon_name:e.target.value})
                  }
                />
              </Row>
              <Row label="მისამართი">
                <input
                  value={isEdit ? editForm.address : form.address}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, address:e.target.value})
                    : setForm({...form, address:e.target.value})
                  }
                />
              </Row>
              <Row label="ტელეფონი">
                <input
                  value={isEdit ? editForm.phone : form.phone}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, phone:e.target.value})
                    : setForm({...form, phone:e.target.value})
                  }
                />
              </Row>
              <Row label="საკონტაქტო პირი">
                <input
                  value={isEdit ? editForm.contact_person : form.contact_person}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, contact_person:e.target.value})
                    : setForm({...form, contact_person:e.target.value})
                  }
                />
              </Row>
              <Row label="აპარატი">
                <input
                  value={isEdit ? editForm.device : form.device}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, device:e.target.value})
                    : setForm({...form, device:e.target.value})
                  }
                />
              </Row>
              <Row label="აპარატის სერიული ნომერი">
                <input
                  value={isEdit ? editForm.device_sn : form.device_sn}
                  onChange={e=> isEdit
                    ? setEditForm({...editForm, device_sn:e.target.value})
                    : setForm({...form, device_sn:e.target.value})
                  }
                />
              </Row>

              {/* პაროლი მხოლოდ დამატებისასაა საჭირო; რედაქტირებაზე არ ვაჩვენებთ */}
              {!isEdit && (
                <Row label="პაროლი (კლიენტის შესასვლელად)">
                  <input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
                </Row>
              )}

              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button className="logout" type="submit">{isEdit ? 'შენახვა' : 'დამატება'}</button>
                <button className="logout" type="button" onClick={()=>{
                  setShowModal(false); setIsEdit(false)
                }}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// პატარა ვიზუალური ჰელპერები
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
