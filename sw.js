/* ROADTOWER offline app shell.
   Repeater data lives in IndexedDB, independently of service-worker cache.
   OpenStreetMap tiles are intentionally NOT bulk cached for offline use.
*/
const VERSION='roadtower-offline-v6';
const SHELL=['./','./index.html','./roadtower.html','./activity.html','./repeaters.js','./offline-maps.js'];
const LEAFLET=[
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  await Promise.allSettled(SHELL.map(u=>cache.add(u)));
  await Promise.allSettled(LEAFLET.map(async u=>{
   const response=await fetch(u,{mode:'cors'});
   if(response.ok)await cache.put(u,response);
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('roadtower-offline-')&&k!==VERSION).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request, url=new URL(req.url);
 if(req.method!=='GET')return;
 if(url.pathname.includes('/api/repeaters')||url.hostname==='tile.openstreetmap.org'||
     url.hostname.endsWith('.tile.openstreetmap.org'))return;
 const shellRequest=(url.origin===location.origin &&
  (req.mode==='navigate'||SHELL.some(p=>new URL(p,location.href).pathname===url.pathname)));
 const leafletRequest=url.hostname==='unpkg.com'&&url.pathname.startsWith('/leaflet@1.9.4/');
 if(!shellRequest&&!leafletRequest)return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  if(leafletRequest)return await cache.match(req)||fetch(req);
  try{
   const response=await fetch(req);
   if(response.ok)await cache.put(req,response.clone());
   return response;
  }catch(e){
   return await cache.match(req)||await cache.match('./roadtower.html')||
    new Response('ROADTOWER offline cache not ready. Open this page once while online.',{
      status:503,headers:{'Content-Type':'text/plain'}
    });
  }
 })());
});