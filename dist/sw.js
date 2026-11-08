// App shell: cached on install, network-first for pages. Map tiles, fonts and sprites:
// served from cache when present and refreshed in the background (bounded cache).
const CACHE='aeris-4ae332ba4fec',TILES='aeris-tiles-v1',MAX_TILES=1500;
const FILES=['./','index.html','app.js','style.css','airports.json','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
const TILE_HOSTS=['tiles.openfreemap.org','server.arcgisonline.com','s3.amazonaws.com'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aeris-')&&k!==CACHE&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function trim(){const c=await caches.open(TILES);const keys=await c.keys();for(const k of keys.slice(0,Math.max(0,keys.length-MAX_TILES)))await c.delete(k);}
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET')return;
 if(TILE_HOSTS.includes(u.host)&&!u.pathname.includes('/api/')){
  event.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(req);const net=fetch(req).then(r=>{if(r.ok){c.put(req,r.clone());if(Math.random()<.02)trim();}return r;}).catch(()=>hit);return hit||net;}));return;}
 if(u.origin!==self.location.origin||u.pathname.includes('/api/'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match(new URL('index.html',self.registration.scope))));return;}
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
