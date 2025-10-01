// js/server-storage-bridge.js
// Server-backed shim for localStorage (keys: 'users', 'appUsers', 'logs').
// - UI/ლოგიკას არ ვეხებით: შენი კოდი ისევ localStorage-ს კითხულობს/წერს.
// - ამ გასაღებებისთვის რეალურად ვმართავთ შიდა ქეშს და სერვერს.
// - სანამ სერვერი მზადდება ან როცა სერვერზე ცარიელია, ვუბრუნებთ რეალურ localStorage-ს,
//   რომ login (admin/admin) და ძველი ნაკადი იმუშავოს.

(() => {
  // --- CONFIG ---
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';
  const KEYS = new Set(['users', 'appUsers', 'logs']);

  // --- INTERNAL STATE ---
  const cache = { users: [], appUsers: [], appLogs: [] };
  let ready = false;
  let pushing = false;
  let pendingPush = false;

  // --- HELPERS ---
  function safeParse(v, fallback) { try { const j = JSON.parse(v); return j ?? fallback; } catch { return fallback; } }
  function asArray(x) { return Array.isArray(x) ? x : []; }
  async function fetchJSON(url, init) {
    try { const r = await fetch(url, init); if (!r.ok) return null; return await r.json().catch(()=>null); }
    catch { return null; }
  }

  // სერვერის პასუხის ფორმატის აბსტრაქცია (იღებს array-საც და ობიექტსაც)
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

  // Prefill cache from real LS (login-ის სწრაფი მუშაობისთვის)
  try {
    const u0 = safeParse(localStorage.getItem('users'),    []);
    const a0 = safeParse(localStorage.getItem('appUsers'), []);
    const l0 = safeParse(localStorage.getItem('logs'),     []);
    if (Array.isArray(u0)) cache.users    = u0;
    if (Array.isArray(a0)) cache.appUsers = a0;
    if (Array.isArray(l0)) cache.appLogs  = l0;
  } catch {}

  // ერთხელ სერვერიდან წამოღება
  async function pullFromServer() {
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET' });
    const s = shape(raw || {});
    // თუ სერვერმა რაღაც მოიტანა, ქეში შევავსოთ; თუ ცარიელია, დავტოვოთ მიმდინარე ქეში (შეიძლება LS-იდანაა)
    const u = asArray(s.users);    if (u.length) cache.users = u;
    const a = asArray(s.appUsers); if (a.length) cache.appUsers = a;
    const l = asArray(s.appLogs);  if (l.length) cache.appLogs = l;

    ready = true;
    document.dispatchEvent(new CustomEvent('server-storage-ready'));
  }

  // Worker /save-users ელოდება სუფთა users მასივს
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

  // --- Override localStorage methods მხოლოდ ჩვენს გასაღებებზე ---
  const _getItem    = localStorage.getItem.bind(localStorage);
  const _setItem    = localStorage.setItem.bind(localStorage);
  const _removeItem = localStorage.removeItem.bind(localStorage);
  const _clear      = localStorage.clear.bind(localStorage);

  function isEmptyArrJson(s) {
    if (typeof s !== 'string') return true;
    try { const j = JSON.parse(s); return !(Array.isArray(j) && j.length); } catch { return true; }
  }

  localStorage.getItem = function(key) {
    if (!KEYS.has(key)) return _getItem(key);

    // fallback სანამ სერვერი მზადდება
    if (!ready) return _getItem(key);

    // ready-ის მერე: თუ ქეში ცარიელია, დავუბრუნოთ ნატურალური LS, რომ ძველი ნაკადი არ გაწყდეს
    if (key === 'users')    { if (!cache.users.length)    return _getItem('users');    return JSON.stringify(cache.users); }
    if (key === 'appUsers') { if (!cache.appUsers.length) return _getItem('appUsers'); return JSON.stringify(cache.appUsers); }
    if (key === 'logs')     { if (!cache.appLogs.length)  return _getItem('logs');     return JSON.stringify(cache.appLogs); }

    return null;
  };

  localStorage.setItem = function(key, value) {
    if (!KEYS.has(key)) return _setItem(key, value); // სხვა გასაღებებს არ ვეხებით

    try {
      const arr = asArray(safeParse(value, []));
      if (key === 'users')       cache.users    = arr;
      else if (key === 'appUsers') cache.appUsers = arr;
      else if (key === 'logs')     cache.appLogs  = arr;

      // არ ვწერთ ნამდვილ localStorage-ში ამ გასაღებებისთვის; მხოლოდ სერვერზე
      // შენახვა ეხლა მხოლოდ users-ზეა გათვლილი (Worker შესაბამისია)
      if (key === 'users') pushToServerDebounced();
    } catch { /* ignore */ }
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);
    if (key === 'users')    cache.users = [];
    if (key === 'appUsers') cache.appUsers = [];
    if (key === 'logs')     cache.appLogs = [];
    // სერვერზე მხოლოდ users იწერება
    if (key === 'users') pushToServerDebounced();
  };

  localStorage.clear = function() {
    // ნატურალურ LS-ს არ ვწავშლით მთლიანად; მხოლოდ ჩვენს ქეშს ვაცარიელებთ
    cache.users = [];
    cache.appUsers = [];
    cache.appLogs = [];
    pushToServerDebounced(); // მხოლოდ users მიდის სერვერზე
  };

  // სტარტზე ჩავქაჩოთ სერვერიდან
  pullFromServer();
})();
