// js/server-storage-bridge.js
// Server-backed shim for localStorage (keys: 'users', 'appUsers', 'logs').
// UI/ლოგიკას არ ვეხებით: შენი კოდი ისევ localStorage-ს იყენებს.
// ფიქსი: ახლა ვწერთ **ორივე მხარეს** — native localStorage-ში და სერვერზე,
// რომ გვერდის refresh-მდეც არ დაიკარგოს მონაცემი, ხოლო სხვა მოწყობილობებზე დაისინქროს სერვერიდან.

(() => {
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';
  const KEYS = new Set(['users', 'appUsers', 'logs']);

  const cache = { users: [], appUsers: [], appLogs: [] };
  let ready = false;
  let pushing = false;
  let pendingPush = false;

  function safeParse(v, fb) { try { const j = JSON.parse(v); return j ?? fb; } catch { return fb; } }
  function asArray(x) { return Array.isArray(x) ? x : []; }
  async function fetchJSON(url, init) {
    try { const r = await fetch(url, init); if (!r.ok) return null; return await r.json().catch(()=>null); }
    catch { return null; }
  }

  function shape(raw) {
    if (Array.isArray(raw)) return { users: raw, appUsers: [], appLogs: [] };
    const pick = (root,k)=>
      Array.isArray(root?.[k]) ? root[k] :
      Array.isArray(root?.data?.[k]) ? root.data[k] :
      Array.isArray(root?.payload?.[k]) ? root.payload[k] :
      Array.isArray(root?.result?.[k]) ? root.result[k] : [];
    return {
      users:    pick(raw,'users'),
      appUsers: pick(raw,'appUsers'),
      appLogs:  pick(raw,'appLogs'),
    };
  }

  // Prefill cache from real LS (რომ login/admin იმუშაოს მაშინვე)
  try {
    const u0 = safeParse(localStorage.getItem('users'),    []);
    const a0 = safeParse(localStorage.getItem('appUsers'), []);
    const l0 = safeParse(localStorage.getItem('logs'),     []);
    if (Array.isArray(u0)) cache.users    = u0;
    if (Array.isArray(a0)) cache.appUsers = a0;
    if (Array.isArray(l0)) cache.appLogs  = l0;
  } catch {}

  async function pullFromServer() {
        const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET', credentials: 'include' });
    const s = shape(raw || {});
    const u = asArray(s.users);    cache.users    = u;
        const a = asArray(s.appUsers); cache.appUsers = a;
        const l = asArray(s.appLogs);  cache.appLogs  = l;


    // სერვერიდან რაც მოვიდა, ჩავწეროთ ნამდვილ localStorage-შიც,
    // რათა შენი არსებული კოდი/refresh-იც სტაბილური იყოს.
    try { localStorage._orig_setItem?.('users', JSON.stringify(cache.users)); } catch {}
    try { localStorage._orig_setItem?.('appUsers', JSON.stringify(cache.appUsers)); } catch {}
    try { localStorage._orig_setItem?.('logs', JSON.stringify(cache.appLogs)); } catch {}

    ready = true;
    document.dispatchEvent(new CustomEvent('server-storage-ready'));
  }

  // Worker /save-users ელოდება სუფთა users მასივს
  function bodyForSave() {
  return JSON.stringify({
    users:    Array.isArray(cache.users)    ? cache.users    : [],
    appUsers: Array.isArray(cache.appUsers) ? cache.appUsers : [],
    merge: true
  });
}

  async function pushToServerDebounced() {
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    try {
        await fetchJSON(`${WORKER_BASE}/save-users`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: bodyForSave(),
});
    } finally {
      pushing = false;
      if (pendingPush) { pendingPush = false; pushToServerDebounced(); }
    }
  }

  // --- Patch localStorage მხოლოდ ჩვენს გასაღებებზე ---
  const _getItem    = localStorage.getItem.bind(localStorage);
  const _setItem    = localStorage.setItem.bind(localStorage);
  const _removeItem = localStorage.removeItem.bind(localStorage);
  const _clear      = localStorage.clear.bind(localStorage);

  // შევინახოთ რეფერენსი, რომ შიდა set-ებზე recursion არ წავიდეს
  localStorage._orig_setItem = _setItem;
  localStorage._orig_removeItem = _removeItem;
  localStorage._orig_clear = _clear;

  localStorage.getItem = function(key) {
    if (!KEYS.has(key)) return _getItem(key);
    if (!ready) return _getItem(key); // სანამ სერვერი „მზადდება“, აბრუნებს ნატურალურს
    if (key === 'users')    { if (!cache.users.length)    return _getItem('users');    return JSON.stringify(cache.users); }
    if (key === 'appUsers') { if (!cache.appUsers.length) return _getItem('appUsers'); return JSON.stringify(cache.appUsers); }
    if (key === 'logs')     { if (!cache.appLogs.length)  return _getItem('logs');     return JSON.stringify(cache.appLogs); }
    return null;
  };

  localStorage.setItem = function(key, value) {
    if (!KEYS.has(key)) return _setItem(key, value); // უცხო გასაღებებს არ ვეხებით

    // 1) ჩავასხათ ქეშში
    let arr = [];
    try { arr = asArray(safeParse(value, [])); } catch {}
    if (key === 'users')      cache.users    = arr;
    else if (key === 'appUsers') cache.appUsers = arr;
    else if (key === 'logs')    cache.appLogs  = arr;

    // 2) ჩავწეროთ **ნამდვილ localStorage-ში** — რომ refresh-მდეც არ დაიკარგოს
    try { _setItem(key, JSON.stringify(arr)); } catch {}

    // 3) users მასივი → სერვერზე
    if (key === 'users' || key === 'appUsers') pushToServerDebounced();
    // შენიშვნა: თუ გინდა appUsers/logs-ის ცალკე ატანა, Worker-ს უნდა ჰქონდეს შესაბამისი endpoint/ფორმატი.
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);

    if (key === 'users')    cache.users = [];
    if (key === 'appUsers') cache.appUsers = [];
    if (key === 'logs')     cache.appLogs = [];

    try { _removeItem(key); } catch {}
    if (key === 'users' || key === 'appUsers') pushToServerDebounced();
  };

  localStorage.clear = function() {
    // ნატურალურ LS-ს ნუ მოვაშთობთ მთელ ტანზე — შესაძლოა სხვა შენს კოდსაც სჭირდებოდეს.
    // ჩვენს გასაღებებს ვაცარიელებთ და ორივეგან ვწერთ.
    cache.users = []; cache.appUsers = []; cache.appLogs = [];
    try { _setItem('users', '[]'); _setItem('appUsers', '[]'); _setItem('logs', '[]'); } catch {}
    pushToServerDebounced();
  };

// ბრაუზერის დახურვაზე: ცარიელს არ ვაგზავნით, რომ სერვერი არ გადაეწეროს []
window.addEventListener('beforeunload', () => {
  if (Array.isArray(cache.users) && cache.users.length > 0) {
    try {
      navigator.sendBeacon?.(`${WORKER_BASE}/save-users`, bodyForSave());
    } catch {}
  }
});

  // სტარტზე სერვერიდან წავიღოთ
  pullFromServer();
})();

// === START: SIMPLE IMAGE/PDF UPLOAD (with image->WEBP compress) ===
const WORKER_UPLOAD_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';

// პატარა ჰელპერები
function splitNameExt(name='file'){ const i=name.lastIndexOf('.'); return i===-1?{base:name,ext:''}:{base:name.slice(0,i),ext:name.slice(i+1)}; }
function loadImageFromFile(file){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(file); const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(u); res(img);};
    img.onerror=e=>{URL.revokeObjectURL(u); rej(e);};
    img.src=u;
  });
}

// ფოტო → WEBP შეკუმშვა (მაქს 1600px, კარგი ხარისხი)
async function compressToWebP(file, maxDim=1600, quality=0.82){
  const img=await loadImageFromFile(file);
  let {width,height}=img;
  if(width>height){ if(width>maxDim){ height=Math.round(height*(maxDim/width)); width=maxDim; } }
  else { if(height>maxDim){ width=Math.round(width*(maxDim/height)); height=maxDim; } }
  const c=document.createElement('canvas'); c.width=width; c.height=height;
  c.getContext('2d').drawImage(img,0,0,width,height);
  const blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob failed')),'image/webp',quality));
  const {base}=splitNameExt(file.name||'photo');
  return new File([blob], `${base}.webp`, {type:'image/webp'});
}

// გადაწყვიტე როგორ ატვირთო: ფოტოები ვკუმშოთ, PDF 그대로
async function prepareForUpload(file){
  const type=(file?.type||'').toLowerCase();
  if(type.startsWith('image/')){
    const webp=await compressToWebP(file);
    return { outFile:webp, filename:webp.name };
  }
  if(type==='application/pdf'){
    return { outFile:file, filename:file.name||'document.pdf' };
  }
  throw new Error('დაშვებულია მხოლოდ ფოტო და PDF.');
}

// ატვირთვა არსებული /upload endpoint-ით (FormData)
async function uploadFile(file){
  const {outFile,filename}=await prepareForUpload(file);
  const fd = new FormData();
  fd.append('file', outFile, filename);
  const r = await fetch(`${WORKER_UPLOAD_BASE}/upload`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('upload failed');
  const j = await r.json();
  if (!j?.ok || !j?.publicUrl) throw new Error('bad upload response');
  return j.publicUrl; // ეს URL შეინახე მონაცემებში
}

// რამდენიმე ფაილის ატვირთვა რიგრიგობით
async function uploadMany(files){
  const urls=[];
  for(const f of files){
    try{ urls.push(await uploadFile(f)); }
    catch(e){ console.warn('upload failed for', f?.name, e); }
  }
  return urls;
}

// გლობალზე დავაგდოთ
// === Auth client (login/me/logout) ===
const API_BASE = "https://restless-lab-c6ef.n-gogolashvili.workers.dev";

window.ServerAuth = {
  async login(username, password) {
    const r = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",            // ქუქი მოვიდეს/წაიკითხოს
      body: JSON.stringify({ username, password })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error || `Login failed: ${r.status}`);
    }
    return r.json(); // { ok:true, user:{ username, role } }
  },

  async me() {
    const r = await fetch(`${API_BASE}/me`, {
      credentials: "include"             // ქუქი გავუგზავნოთ
    });
    if (!r.ok) return { authenticated: false };
    return r.json(); // { authenticated, user? }
  },

  async logout() {
    const r = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include"
    });
    return r.ok;
  }
};

window.ServerStore = window.ServerStore || {};
window.ServerStore.uploadFile = uploadFile;
window.ServerStore.uploadMany = uploadMany;
// === DELETE FILES (R2-დან) ===
// იღებს ერთ ან რამდენიმე key-ს (არა URL). მაგალითად: "2025-10-10/abcd-file.webp"
async function deleteFiles(keys){
  const r = await fetch('https://restless-lab-c6ef.n-gogolashvili.workers.dev/delete-file', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ keys })
  });
  const j = await r.json().catch(()=>null);
  if(!r.ok || !j?.ok) throw new Error('delete failed');
  return j;
}
window.ServerStore.deleteFiles = deleteFiles;

// --- expose getUsers/saveUsers so user.html can force-sync ---
window.ServerStore.getUsers = async function () {
  const r = await fetch(`${WORKER_UPLOAD_BASE}/get-users`, { method: 'GET' });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.users) ? j.users : [];
};

window.ServerStore.getAppUsers = async function () {
  const r = await fetch(`${WORKER_UPLOAD_BASE}/get-users`, { method: 'GET' });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.appUsers) ? j.appUsers : [];
};

window.ServerStore.saveUsers = async function (usersArray) {
  const r = await fetch(`${WORKER_UPLOAD_BASE}/save-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: Array.isArray(usersArray) ? usersArray : [],
      merge: true
    })
  });
  return r.ok;
};

window.ServerStore.saveAppUsers = async function (appUsersArray) {
  const r = await fetch(`${WORKER_UPLOAD_BASE}/save-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appUsers: Array.isArray(appUsersArray) ? appUsersArray : [],
      merge: true
    })
  });
  return r.ok;
};


// === END: SIMPLE IMAGE/PDF UPLOAD (with image->WEBP compress) ===


