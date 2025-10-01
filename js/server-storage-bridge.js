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
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET' });
    const s = shape(raw || {});
    const u = asArray(s.users);    if (u.length) cache.users = u;
    const a = asArray(s.appUsers); if (a.length) cache.appUsers = a;
    const l = asArray(s.appLogs);  if (l.length) cache.appLogs = l;

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
    if (key === 'users') pushToServerDebounced();
    // შენიშვნა: თუ გინდა appUsers/logs-ის ცალკე ატანა, Worker-ს უნდა ჰქონდეს შესაბამისი endpoint/ფორმატი.
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);

    if (key === 'users')    cache.users = [];
    if (key === 'appUsers') cache.appUsers = [];
    if (key === 'logs')     cache.appLogs = [];

    try { _removeItem(key); } catch {}
    if (key === 'users') pushToServerDebounced();
  };

  localStorage.clear = function() {
    // ნატურალურ LS-ს ნუ მოვაშთობთ მთელ ტანზე — შესაძლოა სხვა შენს კოდსაც სჭირდებოდეს.
    // ჩვენს გასაღებებს ვაცარიელებთ და ორივეგან ვწერთ.
    cache.users = []; cache.appUsers = []; cache.appLogs = [];
    try { _setItem('users', '[]'); _setItem('appUsers', '[]'); _setItem('logs', '[]'); } catch {}
    pushToServerDebounced();
  };

  // ბრაუზერის დახურვაზე თუ რამე ბაკლოგი დარჩა — ჩუმად გავუშვათ
  window.addEventListener('beforeunload', () => {
    if (Array.isArray(cache.users)) {
      try {
        navigator.sendBeacon?.(`${WORKER_BASE}/save-users`, bodyForSave());
      } catch {}
    }
  });

  // სტარტზე სერვერიდან წავიღოთ
  pullFromServer();
})();
