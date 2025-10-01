// js/data-store.js
(() => {
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';

  let cache = { users: [], appUsers: [], appLogs: [] };
  let pulled = false, pulling = null, lastHash = '';

  async function fetchJSON(url, init){
    try{
      const r = await fetch(url, init);
      if(!r.ok) return null;
      return await r.json().catch(()=>null);
    }catch{ return null; }
  }

  function shape(raw){
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

  async function pull(){
    if (pulling) return pulling;
    pulling = (async ()=>{
      const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method:'GET' });
      const s = shape(raw || {});
      cache.users    = s.users    || [];
      cache.appUsers = s.appUsers || [];
      cache.appLogs  = s.appLogs  || [];
      pulled = true;
    })();
    await pulling; pulling = null;
  }

  function djb2(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return (h>>>0).toString(16); }

  async function push(){
    const bodyObj = {
      users:    cache.users    || [],
      appUsers: cache.appUsers || [],
      appLogs:  cache.appLogs  || [],
    };
    const body = JSON.stringify(bodyObj);
    const hash = djb2(body);
    if (hash === lastHash) return; // იგივე payload-ზე ზედმეტად ნუ ვაგზავნით
    lastHash = hash;

    await fetchJSON(`${WORKER_BASE}/save-users`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body
    });
  }

  window.DataStore = {
    async init(){ await pull(); },

    // Users
    async getUsers(){ if(!pulled) await pull(); return JSON.parse(JSON.stringify(cache.users)); },
    async saveUsers(arr){ cache.users = Array.isArray(arr) ? arr : []; await push(); return true; },
    async upsertUser(u){
      const list = await this.getUsers();
      const i = list.findIndex(x => String(x.id) === String(u.id));
      if (i>=0) list[i] = u; else list.push(u);
      await this.saveUsers(list);
    },
    async removeUserByIndex(i){
      const list = await this.getUsers();
      if(i>=0 && i<list.length) list.splice(i,1);
      await this.saveUsers(list);
    },

    // AppUsers
    async getAppUsers(){ if(!pulled) await pull(); return JSON.parse(JSON.stringify(cache.appUsers)); },
    async saveAppUsers(arr){ cache.appUsers = Array.isArray(arr) ? arr : []; await push(); return true; },

    // Logs
    async getLogs(){ if(!pulled) await pull(); return JSON.parse(JSON.stringify(cache.appLogs)); },
    async saveLogs(arr){ cache.appLogs = Array.isArray(arr) ? arr : []; await push(); return true; },

    // Session — მხოლოდ sessionStorage (localStorage აღარ გვაქვს)
    getCurrentUser(){ try{ return JSON.parse(sessionStorage.getItem('currentUser') || 'null'); } catch { return null; } },
    setCurrentUser(u){ sessionStorage.setItem('currentUser', JSON.stringify(u || null)); },
    clearCurrentUser(){ sessionStorage.removeItem('currentUser'); },
    getSelectedUser(){ return sessionStorage.getItem('selectedUser') || null; },
    setSelectedUser(id){ sessionStorage.setItem('selectedUser', id || ''); },
    clearSelectedUser(){ sessionStorage.removeItem('selectedUser'); },
  };
})();
