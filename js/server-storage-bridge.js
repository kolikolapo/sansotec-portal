// js/server-storage-bridge.js
// Bridge: localStorage <-> Server (R2 via Worker) WITHOUT touching UI/logic.
// Manages ONLY selected keys: 'users', 'appUsers', 'logs'.
// We DO NOT write through to real localStorage for these keys (server-only).

(() => {
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';
  const KEYS = new Set(['users', 'appUsers', 'logs']);

  // Internal in-memory cache (the only "source of truth" on the client)
  const cache = { users: [], appUsers: [], appLogs: [] }; // server 'logs' maps to 'appLogs' internally
  let ready = false;
  let pushing = false;
  let pendingPush = false;

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

  async function pullFromServer() {
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET' });
    const s = shape(raw || {});
    cache.users    = asArray(s.users);
    cache.appUsers = asArray(s.appUsers);
    cache.appLogs  = asArray(s.appLogs);
    ready = true;
    document.dispatchEvent(new CustomEvent('server-storage-ready'));
  }

  function bodyForSave() {
    return JSON.stringify({
      users:    cache.users,
      appUsers: cache.appUsers,
      appLogs:  cache.appLogs,
    });
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

  // ---- Patch localStorage methods only for our keys ----
  const _getItem    = localStorage.getItem.bind(localStorage);
  const _setItem    = localStorage.setItem.bind(localStorage);
  const _removeItem = localStorage.removeItem.bind(localStorage);
  const _clear      = localStorage.clear.bind(localStorage);

  localStorage.getItem = function(key) {
    if (!KEYS.has(key)) return _getItem(key);
    if (!ready) return null; // until pulled
    if (key === 'users')     return JSON.stringify(cache.users);
    if (key === 'appUsers')  return JSON.stringify(cache.appUsers);
    if (key === 'logs')      return JSON.stringify(cache.appLogs);
    return null;
  };

  localStorage.setItem = function(key, value) {
    if (!KEYS.has(key)) return _setItem(key, value);
    try {
      const arr = asArray(safeParse(value, []));
      if (key === 'users')     cache.users = arr;
      else if (key === 'appUsers') cache.appUsers = arr;
      else if (key === 'logs') cache.appLogs = arr;
      // We DO NOT write-through to real localStorage (server-only)
      pushToServerDebounced();
    } catch {
      // ignore parsing errors
    }
    // return nothing like native
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);
    if (key === 'users') cache.users = [];
    if (key === 'appUsers') cache.appUsers = [];
    if (key === 'logs') cache.appLogs = [];
    pushToServerDebounced();
  };

  localStorage.clear = function() {
    // Clear only our keys in cache; keep other keys intact
    cache.users = [];
    cache.appUsers = [];
    cache.appLogs = [];
    pushToServerDebounced();
    // DO NOT call native _clear to avoid nuking unrelated keys used by your UI
  };

  // First pull; if fails, your app still works with native localStorage for other keys.
  pullFromServer();
})();
