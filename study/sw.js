const CACHE="joes-pentecostal-study-v3";
const OLD=["joes-scripture-study-v1","joes-pentecostal-study-v1","joes-pentecostal-study-v2"];
const PAGES=["./","./index.html"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PAGES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(Promise.all(OLD.map(name=>caches.delete(name))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url),base=new URL(self.registration.scope);
 if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});