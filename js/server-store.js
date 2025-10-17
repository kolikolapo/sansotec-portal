<script>
/* server-store.js — Robust helper to read/write users & appUsers via Worker.
   UI/დისაინს არ ეხება. უბრალოდ გაძლევს get*/save* ფუნქციებს.
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

  // ---- Flexible extractors: ვცდილობთ ამოვიღოთ users/appUsers სხვადასხვა ფორმატიდან
  function extractUsersShape(j){
    // 1) პირდაპირი მასივი
    if (Array.isArray(j)) return { users: j, appUsers: [] };

    // 2) სხვადასხვა ჩასმული ობიექტები
    const pick = (root, key) =>
      Array.isArray(root?.[key]) ? root[key] :
      Array.isArray(root?.data?.[key]) ? root.data[key] :
      Array.isArray(root?.payload?.[key]) ? root.payload[key] :
      Array.isArray(root?.result?.[key]) ? root.result[key] :
      Array.isArray(root?.records) && key==='users' ? root.records : // ზოგჯერ records
      Array.isArray(root?.items)   && key==='users' ? root.items   :  // ზოგჯერ items
      Array.isArray(root?.list)    && key==='users' ? root.list    :  // ზოგჯერ list
      [];

    const users    = pick(j, 'users');
    const appUsers = pick(j, 'appUsers');

    return { users, appUsers };
  }

  async function getBoth(){
    const raw = await fetchJSON(`${WORKER_BASE}/get-users`, { method:'GET' });
    const both = extractUsersShape(raw || {});
    // მცირე დიაგნოსტიკა (კონსოლში დაიბეჭდება მხოლოდ დეველოპერულად)
    try{ console.debug('[ServerStore] getBoth:', { users: both.users.length, appUsers: both.appUsers.length }); }catch{}
    return both;
  }

  // თუ სერვერი ინახავს „რისაც მივცემთ“, მაშინ ჯობს ყოველთვის ერთ ობიექტად შევინახოთ.
  // მაგრამ თუ ამჟამად ფაილი ბრტყელი მასივია (ძველი ფორმატი), მაშინ users-ს შევინახავთ ბრტყლად,
  // რათა უკუქომპატიბელური ვიყოთ.
  // რაც არ უნდა აბრუნებდეს GET, users-ს შევინახავთ ბრტყელ მასივად — ესაა ყველაზე
  // უკუქომპატიბელური ფორმატი Cloudflare Worker-ის მაგალითში.
  const body = Array.isArray(users) ? users : [];
  await fetchJSON(`${WORKER_BASE}/save-users`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ users: body }) });
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
