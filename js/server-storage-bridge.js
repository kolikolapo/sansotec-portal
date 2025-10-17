// js/server-storage-bridge.js
// Server-backed shim for localStorage (keys: 'users', 'appUsers', 'logs').
// UI/ლოგიკას არ ვეხებით: შენი კოდი ისევ localStorage-ს იყენებს.
// ფიქსი: ახლა ვწერთ **ორივე მხარეს** — native localStorage-ში და სერვერზე,
// რომ გვერდის refresh-მდეც არ დაიკარგოს მონაცემი, ხოლო სხვა მოწყობილობებზე დაისინქროს სერვერიდან.

(() => {
  (() => {
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';

  // გვაინტერესებს ოთხი გასაღები:
  // customers  -> კომპანიის კლიენტები (ძველი "users")
  // users      -> (ლეგასი ალიასი customers-ზე) — არ ვკარგავთ თავსებადობას
  // appUsers   -> აპის მომხმარებლები (ავტორიზაცია/როლები)
  // logs       -> ლოგები
  const KEYS = new Set(['customers', 'users', 'appUsers', 'logs']);

  // შიდა ქეში
  const cache = { customers: [], appUsers: [], logs: [] };
  let ready = false;
  let pushing = false;
  let pendingPush = false;

  function safeParse(v, fb) { try { const j = JSON.parse(v); return j ?? fb; } catch { return fb; } }
  function asArray(x) { return Array.isArray(x) ? x : []; }
  async function fetchJSON(url, init) {
    try { const r = await fetch(url, init); if (!r.ok) return null; return await r.json().catch(()=>null); }
    catch { return null; }
  }

  // სერვერის პასუხი მოვიყვანოთ ერთ სტრუქტურად
  // სერვერი აბრუნებს: { customers:[...], appUsers:[...], users:[(ალიასი customers-ზე)] }
  function shape(raw) {
    const pickArr = (o,k) => Array.isArray(o?.[k]) ? o[k] : [];
    const customers = pickArr(raw,'customers').length
      ? pickArr(raw,'customers')
      : pickArr(raw,'users'); // ლეგასი
    const appUsers  = pickArr(raw,'appUsers');
    const logs      = pickArr(raw,'appLogs'); // თუ ოდესმე გექნება
    return { customers: asArray(customers), appUsers: asArray(appUsers), logs: asArray(logs) };
  }

  // სტარტზე ჩავიკითხოთ ნატურალური localStorage — რომ UI იმუშავოს სერვერის ჩატვირთვამდე
  try {
    const c0 = safeParse(localStorage.getItem('customers'), []);
    const u0 = safeParse(localStorage.getItem('users'),     []); // ლეგასი
    const a0 = safeParse(localStorage.getItem('appUsers'),  []);
    const l0 = safeParse(localStorage.getItem('logs'),      []);
    // customers პრიორიტეტულია; თუ ცარიელია და users აქვს რამე, ავიღოთ users
    cache.customers = Array.isArray(c0) && c0.length ? c0 : (Array.isArray(u0) ? u0 : []);
    cache.appUsers  = Array.isArray(a0) ? a0 : [];
    cache.logs      = Array.isArray(l0) ? l0 : [];
  } catch {}

  // სერვერიდან წამოღება
  async function pullFromServer() {
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method: 'GET', credentials: 'include' });
    const s = shape(raw || {});
    cache.customers = asArray(s.customers);
    cache.appUsers  = asArray(s.appUsers);
    cache.logs      = asArray(s.logs);

    // რასაც სერვერი გვაძლევს, ჩავწეროთ ნატურალურ LS-შიც,
    // და თან "users" ლეგასი გასაღებზეც, რომ ძველი გვერდები არ გატყდეს.
    try {
      localStorage._orig_setItem?.('customers', JSON.stringify(cache.customers));
      localStorage._orig_setItem?.('users',     JSON.stringify(cache.customers)); // ლეგასი ალიასი
      localStorage._orig_setItem?.('appUsers',  JSON.stringify(cache.appUsers));
      localStorage._orig_setItem?.('logs',      JSON.stringify(cache.logs));
    } catch {}

    ready = true;
    document.dispatchEvent(new CustomEvent('server-storage-ready'));
  }

  // სერვერზე ჩაწერის სხეული
  function bodyForSave() {
    return JSON.stringify({
      customers: Array.isArray(cache.customers) ? cache.customers : [],
      appUsers:  Array.isArray(cache.appUsers)  ? cache.appUsers  : [],
      // ცარიელის სრულად წაშლით ჩანაცვლება *არ* გვინდა აქ ავტომატურად,
      // ამიტომ allowEmpty არ ვუგზავნით (თუ დაგჭირდება — ცალკე ფუნქციით)
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

  // დავპაჩოთ localStorage მხოლოდ ჩვენს გასაღებებზე
  const _getItem    = localStorage.getItem.bind(localStorage);
  const _setItem    = localStorage.setItem.bind(localStorage);
  const _removeItem = localStorage.removeItem.bind(localStorage);
  const _clear      = localStorage.clear.bind(localStorage);

  // ორიგინალებზე რეფერენსი
  localStorage._orig_setItem    = _setItem;
  localStorage._orig_removeItem = _removeItem;
  localStorage._orig_clear      = _clear;

  localStorage.getItem = function(key) {
    if (!KEYS.has(key)) return _getItem(key);
    if (!ready) return _getItem(key); // სანამ სერვერი „მზადდება“, აბრუნებს ნატურალურს

    if (key === 'customers' || key === 'users') {
      // ორივეზე ერთი და იგივე ცნობა — customers
      if (!cache.customers.length) return _getItem(key);
      return JSON.stringify(cache.customers);
    }
    if (key === 'appUsers') {
      if (!cache.appUsers.length) return _getItem('appUsers');
      return JSON.stringify(cache.appUsers);
    }
    if (key === 'logs') {
      if (!cache.logs.length) return _getItem('logs');
      return JSON.stringify(cache.logs);
    }
    return null;
  };

  localStorage.setItem = function(key, value) {
    if (!KEYS.has(key)) return _setItem(key, value);

    let arr = [];
    try { arr = asArray(safeParse(value, [])); } catch {}

    if (key === 'customers' || key === 'users') {
      // users (ლეგასი) = customers
      cache.customers = arr;
      try {
        _setItem('customers', JSON.stringify(arr));
        _setItem('users',     JSON.stringify(arr)); // ლეგასი სინქი
      } catch {}
      pushToServerDebounced();
      return;
    }

    if (key === 'appUsers') {
      cache.appUsers = arr;
      try { _setItem('appUsers', JSON.stringify(arr)); } catch {}
      pushToServerDebounced();
      return;
    }

    if (key === 'logs') {
      cache.logs = arr;
      try { _setItem('logs', JSON.stringify(arr)); } catch {}
      return;
    }
  };

  localStorage.removeItem = function(key) {
    if (!KEYS.has(key)) return _removeItem(key);

    if (key === 'customers' || key === 'users') {
      cache.customers = [];
      try { _removeItem('customers'); _removeItem('users'); } catch {}
      // ცარიელის пушი აქ არ ვაკეთოთ ავტომატურად, რომ შემთხვევით არ გადაეწეროს სერვერზე []
      return;
    }
    if (key === 'appUsers') {
      cache.appUsers = [];
      try { _removeItem('appUsers'); } catch {}
      return;
    }
    if (key === 'logs') {
      cache.logs = [];
      try { _removeItem('logs'); } catch {}
      return;
    }
  };

  localStorage.clear = function() {
    // მთელ LS-ს არ ვასუფთავებთ — მხოლოდ ჩვენს გასაღებებს.
    cache.customers = []; cache.appUsers = []; cache.logs = [];
    try {
      _setItem('customers', '[]');
      _setItem('users',     '[]'); // ლეგასი
      _setItem('appUsers',  '[]');
      _setItem('logs',      '[]');
    } catch {}
    // აქაც — სერვერზე ცარიელის ავტომატურ გაგზავნას არ ვაკეთებთ.
  };

  // გვერდის დახურვისას — თუ customers/appUsers არ არის ცარიელი, ერთი „beacon“ push
  window.addEventListener('beforeunload', () => {
    try {
      const hasData = (Array.isArray(cache.customers) && cache.customers.length) ||
                      (Array.isArray(cache.appUsers)  && cache.appUsers.length);
      if (hasData && navigator.sendBeacon) {
        navigator.sendBeacon(`${WORKER_BASE}/save-users`, bodyForSave());
      }
    } catch {}
  });

  // სტარტზე ჩამოტვირთვა სერვერიდან
  pullFromServer();

  // მცირე ინტერვალით დაპოლვა (თანაბარი ხილვადობა სხვაგან ცვლილებებისას)
  setInterval(() => pullFromServer(), 5000);
})();


// === END: SIMPLE IMAGE/PDF UPLOAD (with image->WEBP compress) ===


