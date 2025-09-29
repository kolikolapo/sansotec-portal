(() => {
  // --- CONFIG ---
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';
  const LS_KEY = 'users';
  const POLL_MS = 0; // set to 60000 later if periodic pull needed

  // --- helpers ---
  const api = {
    async getUsers() {
      try {
        const r = await fetch(`${WORKER_BASE}/get-users`, { method: 'GET' });
        if (!r.ok) return [];
        const j = await r.json().catch(() => ({}));
        return Array.isArray(j?.users) ? j.users : [];
      } catch {
        return [];
      }
    },
    async saveUsers(users) {
      try {
        await fetch(`${WORKER_BASE}/save-users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(users ?? []),
        });
      } catch { /* keep silent; offline safe */ }
    },
  };

  const ls = {
    read() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    },
    write(arr) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr ?? [])); } catch {}
    },
  };

  function hashJson(x) {
    try {
      const s = JSON.stringify(x ?? []);
      let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
      return (h >>> 0).toString(16);
    } catch { return '0'; }
  }

  function mergeUnique(a = [], b = []) {
    const out = [], seen = new Set();
    const keyOf = (o) => (o && typeof o === 'object')
      ? ('id' in o ? `id:${o.id}` :
         'uuid' in o ? `uuid:${o.uuid}` :
         'email' in o ? `email:${o.email}` :
         `h:${hashJson(o)}`)
      : `h:${hashJson(o)}`;
    for (const x of [...a, ...b]) {
      const k = keyOf(x);
      if (!seen.has(k)) { seen.add(k); out.push(x); }
    }
    return out;
  }

  const META_KEY = 'users_sync_meta';
  function saveMeta(hash) {
    try { localStorage.setItem(META_KEY, JSON.stringify({ lastSync: Date.now(), hash })); } catch {}
  }

  async function initialSync() {
    const local = ls.read();
    const remote = await api.getUsers();
    const hLocal  = hashJson(local);
    const hRemote = hashJson(remote);

    if (remote.length && !local.length) { ls.write(remote); saveMeta(hRemote); return; }
    if (local.length && !remote.length) { await api.saveUsers(local); saveMeta(hLocal); return; }

    const merged = mergeUnique(local, remote);
    const hMerged = hashJson(merged);
    if (hMerged !== hLocal || hMerged !== hRemote) {
      ls.write(merged);
      await api.saveUsers(merged);
      saveMeta(hMerged);
      return;
    }
    saveMeta(hLocal);
  }

  async function pushNow() {
    const local = ls.read();
    await api.saveUsers(local);
    saveMeta(hashJson(local));
  }

  function maybeStartPolling() {
    if (!POLL_MS) return;
    setInterval(async () => {
      try {
        const remote = await api.getUsers();
        const local  = ls.read();
        const merged = mergeUnique(local, remote);
        if (hashJson(merged) !== hashJson(local)) {
          ls.write(merged);
          saveMeta(hashJson(merged));
        }
      } catch {}
    }, POLL_MS);
  }

  // public API
  window.SansoSync = {
    init() { initialSync().finally(maybeStartPolling); },
    push: pushNow,
    readLocal: () => ls.read(),
    writeLocal: (arr) => ls.write(arr),
  };
})();
