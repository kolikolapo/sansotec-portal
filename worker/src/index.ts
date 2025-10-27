import { compare, hashSync } from 'bcryptjs'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  R2: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: '*',
  credentials: true,
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET','POST','PUT','DELETE','OPTIONS'],
}))

// ჯანმრთელობის შემოწმება
app.get('/api/health', (c) => c.json({ ok: true, service: 'sansotec-api' }))

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>()
    const { username, password } = body || { username: '', password: '' }

    // Admin shortcut
    if (username === 'admin' && password === 'admin') {
      return c.json({ ok: true, role: 'admin' })
    }

    // appusers-ში მოძებნა
    const userRow = await c.env.DB
      .prepare(`SELECT id, username, password_hash, role, customer_id FROM appusers WHERE username = ?`)
      .bind(username)
      .first<{ id:number; username:string; password_hash:string; role:string; customer_id:string | null }>()

    if (!userRow) {
      return c.json({ ok:false, message:'არასწორი მონაცემები' }, 401)
    }

    // bcrypt შედარება (სტატიკური import-ით)
    const ok = await compare(String(password), userRow.password_hash)
    if (!ok) {
      return c.json({ ok:false, message:'არასწორი მონაცემები' }, 401)
    }

    return c.json({
      ok: true,
      role: userRow.role,
      customer_id: userRow.customer_id || null
    })
  } catch {
    return c.json({ ok:false, message:'არასწორი მოთხოვნა' }, 400)
  }
})


app.get('/api/auth/me', (c) => {
  return c.json({ ok: false, role: 'guest' }, 401)
})

/** Customers — List (GET) */
app.get('/api/customers', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, name, ident_code, salon_name, address, phone, contact_person, device, device_sn
         FROM customers
         ORDER BY CAST(id AS INTEGER) ASC`
      )
      .all()

    return c.json({ ok: true, items: results ?? [] })
  } catch (e: any) {
    // რომ აღარ დაბრუნდეს "Internal Server Error" უბრალო ტექსტად
    return c.json({ ok: false, message: e?.message || 'DB error' }, 500)
  }
})

/** Customers — Create */
app.post('/api/customers', async (c) => {
  try {
    const body = await c.req.json().catch(()=>null) as any
    if(!body) return c.json({ ok:false, message:'არასწორი მოთხოვნა' }, 400)

    const {
      id, name, ident_code,
      salon_name='', address='', phone='',
      contact_person='', device='', device_sn='',
      password=''                      // <-- დაემატა
    } = body

    if(!id || !/^\d+$/.test(String(id))) return c.json({ ok:false, message:'ID უნდა იყოს მხოლოდ ციფრები' }, 400)
    if(!name) return c.json({ ok:false, message:'დასახელება სავალდებულოა' }, 400)
    if(!ident_code) return c.json({ ok:false, message:'საიდენტიფიკაციო სავალდებულოა' }, 400)
    if(!password) return c.json({ ok:false, message:'პაროლი სავალდებულოა' }, 400)

    const dupId = await c.env.DB.prepare('SELECT 1 FROM customers WHERE id = ?').bind(id).first()
    if(dupId) return c.json({ ok:false, message:'ასეთი ID უკვე არსებობს' }, 409)

    const dupIdent = await c.env.DB.prepare('SELECT 1 FROM customers WHERE ident_code = ?').bind(ident_code).first()
    if(dupIdent) return c.json({ ok:false, message:'ასეთი საიდენტიფიკაციო უკვე არსებობს' }, 409)

    // 1) ჩაწერე კლიენტი
    await c.env.DB.prepare(
      `INSERT INTO customers (id, name, ident_code, salon_name, address, phone, contact_person, device, device_sn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, name, ident_code, salon_name, address, phone, contact_person, device, device_sn).run()

    // 2) შექმენი appuser (customer)
    const hash = hashSync(String(password), 10)
    await c.env.DB.prepare(
      `INSERT INTO appusers (username, password_hash, role, customer_id)
       VALUES (?, ?, 'customer', ?)`
    ).bind(ident_code, hash, id).run()

    return c.json({ ok:true })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'სერვერის შეცდომა' }, 500)
  }
})



/** Customers — Update (PUT /api/customers/:id) */
app.put('/api/customers/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(()=>null) as any
  if(!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი ID' }, 400)
  if(!body) return c.json({ ok:false, message:'არასწორი მოთხოვნა' }, 400)

  const {
    name, ident_code,
    salon_name='', address='', phone='',
    contact_person='', device='', device_sn=''
  } = body

  if(!name) return c.json({ ok:false, message:'დასახელება სავალდებულოა' }, 400)
  if(!ident_code) return c.json({ ok:false, message:'საიდენტიფიკაციო სავალდებულოა' }, 400)

  // შეამოწმე არსებობს თუ არა ჩანაწერი
  const exists = await c.env.DB.prepare('SELECT 1 FROM customers WHERE id = ?').bind(id).first()
  if(!exists) return c.json({ ok:false, message:'ჩანაწერი ვერ მოიძებნა' }, 404)

  // დუბლირება ident_code სხვა ჩანაწერზე
  const dup = await c.env.DB.prepare('SELECT id FROM customers WHERE ident_code = ? AND id <> ?').bind(ident_code, id).first()
  if(dup) return c.json({ ok:false, message:'ასეთი საიდენტიფიკაციო უკვე არსებობს' }, 409)

  await c.env.DB.prepare(
    `UPDATE customers
     SET name=?, ident_code=?, salon_name=?, address=?, phone=?, contact_person=?, device=?, device_sn=?, updated_at = datetime('now')
     WHERE id=?`
  ).bind(name, ident_code, salon_name, address, phone, contact_person, device, device_sn, id).run()

  return c.json({ ok:true })
})

/** Customers — Delete (DELETE /api/customers/:id) */
app.delete('/api/customers/:id', async (c) => {
  const id = c.req.param('id')
  if(!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი ID' }, 400)

  const exists = await c.env.DB.prepare('SELECT 1 FROM customers WHERE id = ?').bind(id).first()
  if(!exists) return c.json({ ok:false, message:'ჩანაწერი ვერ მოიძებნა' }, 404)

  await c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run()
  return c.json({ ok:true })
})
// ერთი კლიენტის მოპოვება
app.get('/api/customers/:id', async (c) => {
  const id = c.req.param('id')
  if(!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი ID' }, 400)

  const row = await c.env.DB.prepare(
    `SELECT id, name, ident_code, salon_name, address, phone, contact_person, device, device_sn
     FROM customers WHERE id = ?`
  ).bind(id).first()

  if(!row) return c.json({ ok:false, message:'ჩანაწერი ვერ მოიძებნა' }, 404)

  return c.json({ ok:true, item: row })
})

// დამხმარე: თარიღი "DD.MM.YYYY" -> "YYYY-MM-DD"
function toISO(d: string): string {
  // ველოდებით "DD.MM.YYYY"
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d.trim())
  if (!m) return ''
  const [_, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

// სერვისების ჩამოტვირთვა კონკრეტული კლიენტისთვის
app.get('/api/customers/:id/services', async (c) => {
  try {
    const id = c.req.param('id')
    if(!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი ID' }, 400)

    const { results } = await c.env.DB.prepare(
      `SELECT id, customer_id, date_iso, purpose, price_gel, technician
       FROM service_records
       WHERE customer_id = ?
       ORDER BY date_iso DESC, created_at DESC`
    ).bind(id).all()

    return c.json({ ok:true, items: results ?? [] })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'DB error' }, 500)
  }
})

// სერვისის დამატება
app.post('/api/customers/:id/services', async (c) => {
  try {
    const id = c.req.param('id')
    if(!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი ID' }, 400)

    const body = await c.req.json().catch(()=>null) as any
    if(!body) return c.json({ ok:false, message:'არასწორი მოთხოვნა' }, 400)

    const {
      date_ddmmyyyy = '',
      purpose = '',
      price_gel = 0,
      technician = ''
    } = body

    const iso = toISO(String(date_ddmmyyyy))
    if (!iso) return c.json({ ok:false, message:'თარიღის ფორმატი უნდა იყოს DD.MM.YYYY' }, 400)

    const allowedPurposes = ['cleaning','diagnostics','head_repair','device_repair','filters','other']
    if (!allowedPurposes.includes(String(purpose))) {
      return c.json({ ok:false, message:'არასწორი დანიშნულება' }, 400)
    }

    const uuid = crypto.randomUUID()

    await c.env.DB.prepare(
      `INSERT INTO service_records (id, customer_id, date_iso, purpose, price_gel, technician)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uuid, id, iso, String(purpose), Number(price_gel || 0), String(technician || '')).run()

    return c.json({ ok:true, id: uuid })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'DB error' }, 500)
  }
})

// სერვისის რედაქტირება
app.put('/api/customers/:id/services/:sid', async (c) => {
  try {
    const id = c.req.param('id')
    const sid = c.req.param('sid')
    if (!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი customer ID' }, 400)
    if (!sid) return c.json({ ok:false, message:'არასწორი service ID' }, 400)

    const body = await c.req.json().catch(()=>null) as any
    if(!body) return c.json({ ok:false, message:'არასწორი მოთხოვნა' }, 400)

    const {
      date_ddmmyyyy = '',
      purpose = '',
      price_gel = 0,
      technician = ''
    } = body

    const iso = toISO(String(date_ddmmyyyy))
    if (!iso) return c.json({ ok:false, message:'თარიღის ფორმატი უნდა იყოს DD.MM.YYYY' }, 400)

    const allowedPurposes = ['cleaning','diagnostics','head_repair','device_repair','filters','other']
    if (!allowedPurposes.includes(String(purpose))) {
      return c.json({ ok:false, message:'არასწორი დანიშნულება' }, 400)
    }

    // არსებობს?
    const ex = await c.env.DB.prepare(
      `SELECT id FROM service_records WHERE id=? AND customer_id=?`
    ).bind(sid, id).first()
    if(!ex) return c.json({ ok:false, message:'ჩანაწერი ვერ მოიძებნა' }, 404)

    await c.env.DB.prepare(
      `UPDATE service_records
       SET date_iso=?, purpose=?, price_gel=?, technician=?, updated_at=datetime('now')
       WHERE id=? AND customer_id=?`
    ).bind(iso, String(purpose), Number(price_gel || 0), String(technician || ''), sid, id).run()

    return c.json({ ok:true })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'DB error' }, 500)
  }
})

// სერვისის წაშლა
app.delete('/api/customers/:id/services/:sid', async (c) => {
  try {
    const id = c.req.param('id')
    const sid = c.req.param('sid')
    if (!/^\d+$/.test(String(id))) return c.json({ ok:false, message:'არასწორი customer ID' }, 400)
    if (!sid) return c.json({ ok:false, message:'არასწორი service ID' }, 400)

    const ex = await c.env.DB.prepare(
      `SELECT id FROM service_records WHERE id=? AND customer_id=?`
    ).bind(sid, id).first()
    if(!ex) return c.json({ ok:false, message:'ჩანაწერი ვერ მოიძებნა' }, 404)

    await c.env.DB.prepare(`DELETE FROM service_records WHERE id=? AND customer_id=?`).bind(sid, id).run()
    return c.json({ ok:true })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'DB error' }, 500)
  }
})

// ─────────────────────────────────────────────────────────────
// Helpers for files
function getExt(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}
function contentTypeByExt(ext: string): string {
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}
function inferKind(ext: string): 'pdf' | 'image' {
  return ext === 'pdf' ? 'pdf' : 'image'
}

// ─────────────────────────────────────────────────────────────
// ფაილების სია კონკრეტული service-ისთვის
app.get('/api/customers/:cid/services/:sid/files', async (c) => {
  try {
    const cid = c.req.param('cid')
    const sid = c.req.param('sid')
    if (!/^\d+$/.test(String(cid))) return c.json({ ok:false, message:'არასწორი customer ID' }, 400)
    if (!sid) return c.json({ ok:false, message:'არასწორი service ID' }, 400)

    const { results } = await c.env.DB.prepare(
      `SELECT id, service_id, kind, filename, r2_key, size_bytes, created_at
       FROM service_files WHERE service_id = ?
       ORDER BY created_at DESC`
    ).bind(sid).all()

    return c.json({ ok:true, items: results || [] })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'DB error' }, 500)
  }
})

// ფაილის ატვირთვა (multipart/form-data, field name: "file")
app.post('/api/customers/:cid/services/:sid/files', async (c) => {
  try {
    const cid = c.req.param('cid')
    const sid = c.req.param('sid')
    if (!/^\d+$/.test(String(cid))) return c.json({ ok:false, message:'არასწორი customer ID' }, 400)
    if (!sid) return c.json({ ok:false, message:'არასწორი service ID' }, 400)

    // ვამოწმებთ, რომ service არსებობს
    const ex = await c.env.DB.prepare(
      `SELECT id FROM service_records WHERE id = ?`
    ).bind(sid).first()
    if (!ex) return c.json({ ok:false, message:'service ჩანაწერი ვერ მოიძებნა' }, 404)

    const formData = await c.req.formData().catch(()=>null)
    if (!formData) return c.json({ ok:false, message:'multipart/form-data მოითხოვება' }, 400)

    const file = formData.get('file') as File | null
    if (!file) return c.json({ ok:false, message:'ფაილი არ არის მოცემული (field: "file")' }, 400)

    // დასაშვები ტიპები: pdf, jpg/jpeg, png, webp
    const originalName = (file as any).name || 'upload.bin'
    const ext = getExt(originalName)
    const allowed = ['pdf','jpg','jpeg','png','webp']
    if (!allowed.includes(ext)) {
      return c.json({ ok:false, message:'ფაილის ტიპი დაუშვებელია (მხოლოდ PDF/JPG/PNG/WebP)' }, 400)
    }
    const kind = inferKind(ext)
    const ct = contentTypeByExt(ext)

    const fid = crypto.randomUUID()
    const r2Key = `services/${sid}/${fid}.${ext}`

    // ავტვირთოთ R2-ში
    const arrayBuffer = await file.arrayBuffer()
    await c.env.R2.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: ct,
        cacheControl: 'public, max-age=31536000'
      }
    })

    // შევინახოთ DB-ში
    await c.env.DB.prepare(
      `INSERT INTO service_files (id, service_id, kind, filename, r2_key, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(fid, sid, kind, originalName, r2Key, arrayBuffer.byteLength).run()

    return c.json({ ok:true, id: fid })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'Upload error' }, 500)
  }
})

// ფაილის ჩამოტვირთვა/ჩვენება (ახალ ტაბში გახსნისთვის ვუბრუნებთ თვითონ ფაილს)
app.get('/api/files/:fid', async (c) => {
  try {
    const fid = c.req.param('fid')
    if (!fid) return c.json({ ok:false, message:'არასწორი file ID' }, 400)

    const row = await c.env.DB.prepare(
      `SELECT r2_key, filename FROM service_files WHERE id = ?`
    ).bind(fid).first<{ r2_key: string, filename: string }>()
    if (!row) return c.json({ ok:false, message:'ფაილი ვერ მოიძებნა' }, 404)

    const obj = await c.env.R2.get(row.r2_key)
    if (!obj) return c.json({ ok:false, message:'ფაილი R2-ზე ვერ მოიძებნა' }, 404)

    // content-type მოვახდინოთ გაფართოების მიხედვით
    const ext = getExt(row.filename)
    const ct = contentTypeByExt(ext)

    return new Response(obj.body, {
      headers: {
        'Content-Type': ct,
        'Content-Disposition': 'inline; filename="' + row.filename.replace(/"/g, '') + '"',
        'Cache-Control': 'private, max-age=0'
      }
    })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'Read error' }, 500)
  }
})

// ფაილის წაშლა (R2 + DB)
app.delete('/api/files/:fid', async (c) => {
  try {
    const fid = c.req.param('fid')
    if (!fid) return c.json({ ok:false, message:'არასწორი file ID' }, 400)

    const row = await c.env.DB.prepare(
      `SELECT r2_key FROM service_files WHERE id = ?`
    ).bind(fid).first<{ r2_key: string }>()
    if (!row) return c.json({ ok:false, message:'ფაილი ვერ მოიძებნა' }, 404)

    await c.env.R2.delete(row.r2_key)
    await c.env.DB.prepare(`DELETE FROM service_files WHERE id = ?`).bind(fid).run()

    return c.json({ ok:true })
  } catch (e:any) {
    return c.json({ ok:false, message: e?.message || 'Delete error' }, 500)
  }
})



export default app
