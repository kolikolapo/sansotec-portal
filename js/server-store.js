<script>
/* server-store.js — მცირე ჰელპერი R2/Worker-თან
   არ ცვლის UI-ს, უბრალოდ გაძლევს get*/save* ფუნქციებს.
*/
(function(){
  const WORKER_BASE = 'https://restless-lab-c6ef.n-gogolashvili.workers.dev';

  async function fetchJSON(url, init){
    try{
      const r = await fetch(url, init);
      if(!r.ok) return null;
      return await r.json().catch(()=>null);
    }catch{ return null; }
  }

  async function getBoth(){
    const j = await fetchJSON(`${WORKER_BASE}/get-users`, { method:'GET' });
    if(Array.isArray(j)){
      // ძველი ფორმატი: უბრალოდ users მასივი
      return { users: j, appUsers: [] };
    }
    return {
      users: Array.isArray(j?.users) ? j.users : [],
      appUsers: Array.isArray(j?.appUsers) ? j.appUsers : []
    };
  }

  async function saveBoth({users=[], appUsers=[]}){
    await fetchJSON(`${WORKER_BASE}/save-users`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ users, appUsers })
    });
  }

  async function getUsers(){
    const { users } = await getBoth();
    return users;
  }

  async function saveUsers(users){
    const both = await getBoth();
    await saveBoth({ users: Array.isArray(users)?users:[], appUsers: both.appUsers });
  }

  async function getAppUsers(){
    const { appUsers } = await getBoth();
    return appUsers;
  }

  async function saveAppUsers(appUsers){
    const both = await getBoth();
    await saveBoth({ users: both.users, appUsers: Array.isArray(appUsers)?appUsers:[] });
  }

  window.ServerStore = { getUsers, saveUsers, getAppUsers, saveAppUsers, getBoth, saveBoth };
})();
</script>
