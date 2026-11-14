// Network-first: always grabs the newest upload, falls back to saved copy offline
const C='station-board-v4';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.json','icon.png','icon-192.png','apple-touch-icon.png','dispatch.html'])))});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(e.request.url.startsWith('https://cdn.jsdelivr.net/'))return;
e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
