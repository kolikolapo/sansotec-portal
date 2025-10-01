// js/server-storage-bridge.js
// Server-backed shim for localStorage (only for keys: 'users', 'appUsers', 'logs').
// UI/ლოგიკას არ ვეხებით: შენი არსებული კოდი ისევ localStorage-ს კითხულობს/წერს,
// მაგრამ ამ კონკრეტული გასაღებები რეალურად სერვერზე ინახება/იკითხება.
// - არ ვწერთ ნამდვილი localStorage-ში ამ გასაღებებისთვის (სხვა გასაღებებს არ ვეხებით).
// - getItem() სანამ სერვერი "მზადდება", უბრუნებს ნამდვილი localStorage-ს,
//   რომ login და დანარჩენი ნაკადი დაუყოვნებლივ იმუშაოს.
// - ჩატვირთვის შემდეგ ქეში ივსება სერვერიდან, setItem/removeItem → POST /save-users.

(() => {
  // --- CONFIG ---
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';
  const KEYS = new Set(['users', 'appUsers', 'logs']);

  // --- INTERNAL STATE ---
  const cache = {
    users:   [],
    appUsers:[],
    appLogs: []
  };
  let ready = false;
  let pushing = false;
  let pendingPush = false;

  // --- HELPERS ---
  function safeParse(v, fallback) {
    try { const j = JSON.parse(v); return j ?? fallback; } catch { return fallback; }
  }
  function asArray(x) { return Array.isArray(x) ? x : []; }

  async function fetchJSON(url, init) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) return null;
      return await r.json().catch(()=>null);
    } catch { return null; }
  }

  // სერვერის პასუხის "ფორმის" შენიღბვა (იღებს array-საც და ობიექტსაც)
  function shape(raw) {
    if (Array.isArray(raw)) {
      return { users: raw, appUsers: [], appLogs: [] };
    }
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

  // --- PREFILL FROM REAL localStorage (login-ის სწრაფი მუშაობისთვის) ---
  try {
    const u0 = safeParse(localStorage.getItem('users'),    []);
    const a0 = safeParse(localStorage.getItem('appUsers'), []);
    const l0 = safeParse(localStorage.getItem('logs'),     []);
    if (Array.isArray(u0)) cache.users    = u0;
    if (Array.isArray(a0)) cache.appUsers = a0;
    if (Array.isArray(l0)) cache.appLogs  = l0;
  } catch {}

  // --- PULL FROM SERVER ONCE ---
  async function pullFromServer() {
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET' });
    const s = shape(raw || {});
    cache.users    = asArray(s.users);
    cache.appUsers = asArray(s.appUsers);
    cache.appLogs  = asArray(s.appLogs);
    ready = true;
    document.dispatchEvent(new CustomEvent('server-storage-ready'));
  }

  // Worker /save-users ხშირად ელოდება users.json-ში სუფთა მასივს.
  function bodyForSave() {
    return JSON.stringify(Array.isArray(cache.users) ? cache.users : []);
  }

  async function pushToServerDebounced() {
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    try {
      await fetchJSON(`${WORKER_BASE}/save-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyForSave(),
      });
    } finally {
      pushing = false;
      if (pendingPush) { pendingPush = false; pushToServerDebounced(); }
    }
  }

  // --- PATCH localStorage METHODS (ONLY FOR OUR KEYS) ---
  const _getItem    = localStorage.getItem.bind(localStorage);
  const _setItem    = localStorage.setItem.bind(localStorage);
  const _removeItem = localStorage.removeItem.bind(localStorage);
  const _clear      = localStorage.clear.bind(localStorage);

  localStorage.getItem = function(key) {
    if (!KEYS.has(key)) return _getItem(key);
    // სანამ სერვერიდან წამოიღებს, დააბრუნე ნატურალური localStorage — რომ login/ჭაჭანი იმუშავოს
    if (!ready) return _getItem(key);
    if (key === 'users')     return JSON.stringify(cache.users);
    if (key === 'appUsers')  return JSON.stringify(cache.appUsers);
    if (key === 'logs')      return JSON.stringify(cache.appLogs);
    return null;
  };

  localStorage.setItem = function(key, value) {
    if (!KEYS.has(key)) return _setItem(key, value); // სხვა გასაღებებს არ ვეხებით
    try {
      const arr = asArray(safeParse(value, []));
      if (key === 'users')     cache.users = arr;
      else if (key === 'appUsers') cache.appUsers = arr;
      else if (key === 'logs') cache.appLogs = arr;
      // არ ვწერთ ნამდვილ localStorage-ში — სერვერზე ვინახავთ
      pushToServerDebounced();
    } catch {
      // ჩუმად იგნორი
    }
    // native setItem არაფერი არ აბრუნებს
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);
    if (key === 'users')     cache.users = [];
    if (key === 'appUsers')  cache.appUsers = [];
    if (key === 'logs')      cache.appLogs = [];
    pushToServerDebounced();
  };

  localStorage.clear = function() {
    // მთლიან ნატურალურ LS-ს არ ვშლით, მხოლოდ ჩვენს cache-ს ვაცხრილავთ და სერვერზე ვინახავთ
    cache.users = [];
    cache.appUsers = [];
    cache.appLogs = [];
    pushToServerDebounced();
  };

  // --- start ---
  pullFromServer(); // 1-ჯერ, ჩუმად
})();
