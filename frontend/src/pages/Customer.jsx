import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE

const PURPOSES = [
  { value:'cleaning', label:'წმენდა' },
  { value:'diagnostics', label:'დიაგნოსტიკა' },
  { value:'head_repair', label:'თავაკის შეკეთება' },
  { value:'device_repair', label:'აპარატის შეკეთება' },
  { value:'filters', label:'ფილტრები' },
  { value:'other', label:'სხვა' },
]
const TECHS = ['ნიკო','ვახო','ნიკო/ვახო']

// YYYY-MM-DD -> DD.MM.YYYY
function isoToDDMMYYYY(iso){
  if(!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}.${m}.${y}`
}
// DD.MM.YYYY -> YYYY-MM-DD (თუ სადმე დაგვჭირდება)
function ddmmyyyyToISO(ddmmyyyy){
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ddmmyyyy || '')
  if(!m) return ''
  const [,dd,mm,yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

async function compressImageIfNeeded(file, maxW = 1600, maxH = 1600, quality = 0.85) {
  const type = (file?.type || '').toLowerCase()
  if (!type.startsWith('image/')) return file

  const dataUrl = await new Promise((resolve, reject)=>{
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject)=>{
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  const { width, height } = img
  const ratio = Math.min(maxW / width, maxH / height, 1)
  const newW = Math.round(width * ratio)
  const newH = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = newW
  canvas.height = newH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, newW, newH)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) return file
  const newName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg' })
}

export default function Customer(){
  const nav = useNavigate()
  const { id } = useParams()

  const [item, setItem] = useState(null)
  const [records, setRecords] = useState([])

  const role = localStorage.getItem('role')
  const myCustomerId = localStorage.getItem('customer_id')

  // ფაილების სრული სია თითო სერვისზე: { [serviceId]: Array<file> }
  const [filesByService, setFilesByService] = useState({})

  // ფილტრები
  const [filterTech, setFilterTech] = useState('')
  const [filterPurpose, setFilterPurpose] = useState('')

  // დამატების მოდალი (ჩანაწერის + PDF + ფოტოები)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    date_iso: '',
    purpose: 'cleaning',
    price_gel: '',
    technician: ''
  })
  const [pdfFile, setPdfFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
  const [addingBusy, setAddingBusy] = useState(false)

  // რედაქტირება
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editForm, setEditForm] = useState({
    date_iso: '',
    purpose: 'cleaning',
    price_gel: '',
    technician: ''
  })
  const [editBusy, setEditBusy] = useState(false)

  // ფოტო-გალერეა
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerItems, setViewerItems] = useState([]) // urls
  const [viewerIndex, setViewerIndex] = useState(0)

  // დაშვება
  useEffect(()=>{
    if (role === 'customer') {
      if (!myCustomerId || myCustomerId !== id) nav('/login', { replace: true })
    } else if (role !== 'admin') {
      nav('/login', { replace: true })
    }
  }, [role, myCustomerId, id, nav])

  // კლიენტი
  useEffect(()=>{
    async function loadCustomer(){
      const res = await fetch(`${API}/api/customers/${id}`)
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'ჩატვირთვის შეცდომა')
      setItem(j.item)
    }
    loadCustomer().catch(e=>alert(e.message))
  }, [id])

  // სერვისები
  async function loadServices(){
    const res = await fetch(`${API}/api/customers/${id}/services`)
    const j = await res.json()
    if(!res.ok || !j.ok) throw new Error(j.message || 'ჩატვირთვის შეცდომა')
    setRecords(j.items || [])
  }
  useEffect(()=>{ loadServices().catch(e=>alert(e.message)) }, [id])

  // თითო სერვისის ფაილები (pdf + images)
  useEffect(()=>{
    async function loadAllFiles(){
      const map = {}
      for (const r of records) {
        try{
          const res = await fetch(`${API}/api/customers/${r.customer_id}/services/${r.id}/files`)
          const j = await res.json()
          if(res.ok && j.ok) map[r.id] = j.items || []
        }catch{ /* ignore */ }
      }
      setFilesByService(map)
    }
    if (records.length) loadAllFiles()
    else setFilesByService({})
  }, [records, API])

  const filteredRecords = useMemo(()=>{
    return records.filter(r=>{
      const passTech = !filterTech || (r.technician || '') === filterTech
      const passPurpose = !filterPurpose || r.purpose === filterPurpose
      return passTech && passPurpose
    })
  }, [records, filterTech, filterPurpose])

  function onLogout(){
    localStorage.clear()
    nav('/login', { replace: true })
  }
  const canAdd = role === 'admin'

  /* ───── Create with files ───── */
  async function onCreate(e){
    e.preventDefault()
    if(!form.date_iso){ alert('აირჩიე თარიღი'); return }

    try{
      setAddingBusy(true)
      const ddmmyyyy = isoToDDMMYYYY(form.date_iso)

      // 1) სერვისის შექმნა
      const res = await fetch(`${API}/api/customers/${id}/services`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          date_ddmmyyyy: ddmmyyyy,
          purpose: form.purpose,
          price_gel: Number(form.price_gel || 0),
          technician: form.technician
        })
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'შენახვის შეცდომა')

      const newServiceId = j.id

      // 2) PDF (თუ არის)
      if (pdfFile) {
        const fd = new FormData()
        fd.append('file', pdfFile)
        const r2 = await fetch(`${API}/api/customers/${id}/services/${newServiceId}/files`, {
          method:'POST',
          body: fd
        })
        const j2 = await r2.json()
        if(!r2.ok || !j2.ok) throw new Error(j2.message || 'PDF ატვირთვის შეცდომა')
      }

      // 3) ფოტოები
      if (imageFiles && imageFiles.length > 0) {
        for (const f of imageFiles) {
          const ready = await compressImageIfNeeded(f)
          const fd = new FormData()
          fd.append('file', ready)
          const r3 = await fetch(`${API}/api/customers/${id}/services/${newServiceId}/files`, {
            method:'POST',
            body: fd
          })
          const j3 = await r3.json()
          if(!r3.ok || !j3.ok) throw new Error(j3.message || 'ფოტოს ატვირთვის შეცდომა')
        }
      }

      setShowAdd(false)
      setForm({ date_iso:'', purpose:'cleaning', price_gel:'', technician:'' })
      setPdfFile(null)
      setImageFiles([])
      await loadServices()
    }catch(err){ alert(err.message) }
    finally{ setAddingBusy(false) }
  }

  /* ───── Edit ───── */
  function openEdit(r){
    setEditId(r.id)
    setEditForm({
      date_iso: r.date_iso,
      purpose: r.purpose,
      price_gel: r.price_gel ?? '',
      technician: r.technician || ''
    })
    setEditOpen(true)
  }
  async function onEditSave(e){
    e.preventDefault()
    if(!editId) return
    if(!editForm.date_iso){ alert('აირჩიე თარიღი'); return }

    try{
      setEditBusy(true)
      const ddmmyyyy = isoToDDMMYYYY(editForm.date_iso)
      const res = await fetch(`${API}/api/customers/${id}/services/${editId}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          date_ddmmyyyy: ddmmyyyy,
          purpose: editForm.purpose,
          price_gel: Number(editForm.price_gel || 0),
          technician: editForm.technician
        })
      })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'განახლების შეცდომა')
      setEditOpen(false)
      setEditId('')
      await loadServices()
    }catch(e){ alert(e.message) }
    finally{ setEditBusy(false) }
  }

  /* ───── Delete ───── */
  async function onDelete(recId){
    if(!confirm('წავშალოთ ჩანაწერი?')) return
    try{
      const res = await fetch(`${API}/api/customers/${id}/services/${recId}`, { method:'DELETE' })
      const j = await res.json()
      if(!res.ok || !j.ok) throw new Error(j.message || 'წაშლის შეცდომა')
      await loadServices()
    }catch(e){ alert(e.message) }
  }

  // კალენდრის ველებზე კლიკით დაუყოვნებლივ გახსნა (Chrome)
  const addDateRef = useRef(null)
  const editDateRef = useRef(null)
  function openPickerIfSupported(ref){
    try{
      if(ref?.current && typeof ref.current.showPicker === 'function'){
        ref.current.showPicker()
      }
    }catch{/* ignore */}
  }

  if(!item) return <div style={{color:'#fff', padding:20}}>იტვირთება...</div>

  return (
    <div style={{minHeight:'100vh', background:'#282828', color:'#fff', fontFamily:'Myriad Pro, system-ui'}}>
      <header style={hdr}>
        <img src="/logo.png" alt="Sanso" style={{ height: 28 }}/>
        <div style={{fontWeight:800}}>Sanso Technical Department — კლიენტის გვერდი</div>
        <div style={{flex:1}} />
        <button onClick={onLogout} style={btn}>გასვლა</button>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'240px 1fr'}}>
        <aside style={side}>
          <div style={{fontSize:12, color:'#bbb', marginBottom:8}}>მენიუ</div>
          <ul style={sideList}>
            <li style={sideItemActive}>ჩემი გვერდი</li>
            <li style={sideItem}>პროფილის რედაქტირება (მოგვიანებით)</li>
            <li style={sideItem} onClick={onLogout}>გასვლა</li>
          </ul>
        </aside>

        <main style={{padding:20}}>
          <h1 style={{marginTop:0}}>კლიენტის მონაცემები</h1>
          <div style={gridCard}>
            <Row label="ID">{item.id}</Row>
            <Row label="დასახელება">{item.name}</Row>
            <Row label="საიდენტიფიკაციო (username)"><Badge>{item.ident_code}</Badge></Row>
            <Row label="სალონი/კლინიკა">{item.salon_name}</Row>
            <Row label="მისამართი">{item.address}</Row>
            <Row label="ტელეფონი">{item.phone}</Row>
            <Row label="საკონტაქტო პირი">{item.contact_person}</Row>
            <Row label="აპარატი">{item.device}</Row>
            <Row label="სერიული №"><Badge>{item.device_sn}</Badge></Row>
          </div>

          <hr style={hr}/>

          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <h2 style={{margin:0}}>ტექნიკური სერვისის ჩანაწერები</h2>
            <span style={{opacity:.8}}>სულ: {filteredRecords.length}</span>
            {canAdd && (
              <button onClick={()=>setShowAdd(true)} style={{marginLeft:'auto', ...btn}}>ჩანაწერის დამატება</button>
            )}
          </div>

          <div style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
            <select style={sel} value={filterPurpose} onChange={e=>setFilterPurpose(e.target.value)}>
              <option value="">დანიშნულება — ყველა</option>
              {PURPOSES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select style={sel} value={filterTech} onChange={e=>setFilterTech(e.target.value)}>
              <option value="">ტექნიკოსი — ყველა</option>
              {TECHS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            {(filterPurpose || filterTech) && (
              <button style={btn} onClick={()=>{ setFilterPurpose(''); setFilterTech('') }}>ფილტრის გასუფთავება</button>
            )}
          </div>

          <div style={{marginTop:12, overflowX:'auto'}}>
            <table style={tbl}>
              <thead>
                <tr>
                  <Th>თარიღი</Th>
                  <Th>დანიშნულება</Th>
                  <Th>ფასი (GEL)</Th>
                  <Th>ტექნიკოსი</Th>
                  <Th>ფაილი (PDF)</Th>
                  <Th>ფოტოები</Th>
                  <Th>ქმედება</Th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr><Td colSpan={7} align="center">ჩანაწერი არ არის</Td></tr>
                ) : filteredRecords.map(r=>{
                  const files = filesByService[r.id] || []
                  const pdf = files.find(f=>f.kind==='pdf')
                  const photos = files.filter(f=>f.kind==='image')
                  return (
                    <tr key={r.id} style={row}>
                      <Td>{isoToDDMMYYYY(r.date_iso)}</Td>
                      <Td>{PURPOSES.find(p=>p.value===r.purpose)?.label || r.purpose}</Td>
                      <Td>{(r.price_gel ?? 0).toString()}</Td>
                      <Td>{r.technician || '-'}</Td>

                      {/* PDF Column */}
                      <Td>
                        {pdf ? (
                          <a
                            href={`${API}/api/files/${pdf.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={pdf.filename}
                            style={pdfLink}
                          >
                            📄 PDF
                          </a>
                        ) : '—'}
                      </Td>

                      {/* Photos Column */}
                      <Td>
                        {photos.length === 0 ? '—' : (
                          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                            {photos.map((p, idx)=>(
                              <img
                                key={p.id}
                                src={`${API}/api/files/${p.id}`}
                                alt={p.filename}
                                title="გახსნა"
                                style={thumb}
                                onClick={()=>{
                                  setViewerItems(photos.map(x=>`${API}/api/files/${x.id}`))
                                  setViewerIndex(idx)
                                  setViewerOpen(true)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </Td>

                      <Td>
                        {role === 'admin' && (
                          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                            <button style={btn} onClick={()=>openEdit(r)}>რედაქტირება</button>
                            <button style={btn} onClick={()=>onDelete(r.id)}>წაშლა</button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* დამატება */}
      {showAdd && (
        <div style={backdrop}>
          <div style={card}>
            <h3 style={{marginTop:0}}>სერვისის ჩანაწერის დამატება</h3>
            <form onSubmit={onCreate} style={{display:'grid', gap:10}}>
              <Row label="თარიღი (დააკლიკე ველს)">
                <input
                  ref={addDateRef}
                  type="date"
                  value={form.date_iso}
                  onClick={()=>openPickerIfSupported(addDateRef)}
                  onFocus={()=>openPickerIfSupported(addDateRef)}
                  onChange={e=>setForm({...form, date_iso:e.target.value})}
                  style={inp}
                />
              </Row>
              <Row label="დანიშნულება">
                <select style={sel} value={form.purpose} onChange={e=>setForm({...form, purpose:e.target.value})}>
                  {PURPOSES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Row>
              <Row label="ფასი (GEL)">
                <input style={inp} type="number" step="0.01" value={form.price_gel} onChange={e=>setForm({...form, price_gel:e.target.value})}/>
              </Row>
              <Row label="ტექნიკოსი">
                <select style={sel} value={form.technician} onChange={e=>setForm({...form, technician:e.target.value})}>
                  <option value="">—</option>
                  {TECHS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </Row>

              <hr/>

              <Row label="დოკუმენტი (PDF — ঐচ্ছიკი)">
                <input type="file" accept=".pdf" onChange={e=>setPdfFile(e.target.files?.[0] || null)} />
              </Row>
              <Row label="ფოტოები (რამდენიმე — ঐচ্ছიკი)">
                <input type="file" accept="image/*" multiple onChange={e=>setImageFiles(Array.from(e.target.files || []))}/>
                <small style={{color:'#666'}}>ფოტოები ატვირთვამდე ავტომატურად დაპატარავდება.</small>
              </Row>

              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button style={btn} type="submit" disabled={addingBusy}>{addingBusy ? 'იტვირთება…' : 'დამატება'}</button>
                <button style={btn} type="button" onClick={()=>{
                  setShowAdd(false)
                  setForm({ date_iso:'', purpose:'cleaning', price_gel:'', technician:'' })
                  setPdfFile(null)
                  setImageFiles([])
                }}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* რედაქტირება */}
      {editOpen && (
        <div style={backdrop}>
          <div style={card}>
            <h3 style={{marginTop:0}}>სერვისის რედაქტირება</h3>
            <form onSubmit={onEditSave} style={{display:'grid', gap:10}}>
              <Row label="თარიღი (დააკლიკე ველს)">
                <input
                  ref={editDateRef}
                  type="date"
                  value={editForm.date_iso}
                  onClick={()=>openPickerIfSupported(editDateRef)}
                  onFocus={()=>openPickerIfSupported(editDateRef)}
                  onChange={e=>setEditForm({...editForm, date_iso:e.target.value})}
                  style={inp}
                />
              </Row>
              <Row label="დანიშნულება">
                <select style={sel} value={editForm.purpose} onChange={e=>setEditForm({...editForm, purpose:e.target.value})}>
                  {PURPOSES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Row>
              <Row label="ფასი (GEL)">
                <input style={inp} type="number" step="0.01" value={editForm.price_gel} onChange={e=>setEditForm({...editForm, price_gel:e.target.value})}/>
              </Row>
              <Row label="ტექნიკოსი">
                <select style={sel} value={editForm.technician} onChange={e=>setEditForm({...editForm, technician:e.target.value})}>
                  <option value="">—</option>
                  {TECHS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </Row>
              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button style={btn} type="submit" disabled={editBusy}>{editBusy ? 'იტვირთება…' : 'შენახვა'}</button>
                <button style={btn} type="button" onClick={()=>setEditOpen(false)}>დახურვა</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ფოტო-გალერეა */}
      {viewerOpen && (
        <div style={viewerWrap}>
          <div style={viewerBox}>
            <img
              src={viewerItems[viewerIndex]}
              alt=""
              style={{maxWidth:'80vw', maxHeight:'70vh', borderRadius:12}}
            />
            <div style={{display:'flex', gap:10, marginTop:10, justifyContent:'center'}}>
              <button style={btn} onClick={()=>{
                setViewerIndex((viewerIndex - 1 + viewerItems.length) % viewerItems.length)
              }}>⬅ წინ</button>
              <button style={btn} onClick={()=>{
                setViewerIndex((viewerIndex + 1) % viewerItems.length)
              }}>➡ უკან</button>
              <button style={btn} onClick={()=>setViewerOpen(false)}>დახურვა</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------- UI helpers ------------------- */
function Row({label, children}){
  return (
    <label style={{display:'grid', gap:4}}>
      <span style={{fontSize:12, color:'#bbb'}}>{label}</span>
      {children}
    </label>
  )
}
function Badge({children}){
  return <span style={{background:'#1f1f1f', border:'1px solid #333', padding:'2px 8px', borderRadius:999}}>{children}</span>
}
function Th({children}) {
  return <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid #444', fontWeight:700, fontSize:13, color:'#ddd'}}>{children}</th>
}
function Td({children, colSpan, align}){
  return <td colSpan={colSpan} style={{padding:'10px 12px', borderBottom:'1px solid #333', textAlign: align || 'left', verticalAlign:'top'}}>{children}</td>
}

/* ------------------- styles ------------------- */
const hdr = {display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#1f1f1f', borderBottom:'1px solid #333'}
const side = {background:'#1f1f1f', borderRight:'1px solid #333', padding:16}
const sideList = {listStyle:'none', padding:0, margin:0, display:'grid', gap:6}
const sideItem = {background:'#2a2a2a', padding:'10px 12px', borderRadius:10, cursor:'pointer'}
const sideItemActive = {...sideItem, background:'#000'}
const gridCard = {display:'grid', gap:8, background:'#1f1f1f', border:'1px solid #333', borderRadius:12, padding:12}
const hr = {border:'none', borderTop:'1px solid #333', margin:'16px 0'}
const btn = { background:'#000', color:'#fff', border:0, borderRadius:10, padding:'8px 12px', cursor:'pointer' }
const inp = {border:'1px solid #444', background:'#1f1f1f', color:'#fff', borderRadius:10, padding:'8px 10px', minWidth:220}
const sel = inp
const tbl = {width:'100%', borderCollapse:'collapse', background:'#1b1b1b', border:'1px solid #333', borderRadius:12, overflow:'hidden'}
const row = { transition:'background 0.2s ease' }
const pdfLink = { textDecoration:'none', color:'#fff', background:'#000', padding:'6px 10px', borderRadius:8 }
const thumb = { width:40, height:40, objectFit:'cover', borderRadius:6, border:'1px solid #444', cursor:'pointer' }

const backdrop = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', padding:'16px', zIndex:50 }
const card = { background:'#fff', color:'#000', borderRadius:'12px', padding:'16px', width:'100%', maxWidth:'560px', boxShadow:'0 10px 25px rgba(0,0,0,0.25)' }

const viewerWrap = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'grid', placeItems:'center', padding:16, zIndex:60 }
const viewerBox = { background:'#111', color:'#fff', padding:12, borderRadius:12, textAlign:'center', border:'1px solid #333' }
