// Cloudflare Pages: recent RainViewer precipitation radar frame metadata.
// Free RainViewer API offers past radar observations only; not future nowcast.
// Attribution: RainViewer / underlying meteorological radar contributors.
export async function onRequestGet({request}) {
 const reply=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 const key=new Request(new URL('/api/radar',request.url).toString());
 try{
  if(store){const cached=await store.match(key);if(cached)return cached}
  const up=await fetch('https://api.rainviewer.com/public/weather-maps.json',{
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)
  });
  if(!up.ok)return reply({error:'Weather radar feed unavailable'},502);
  const data=await up.json();
  if(!data||!data.radar||!Array.isArray(data.radar.past)||
     data.host!=='https://tilecache.rainviewer.com')
   return reply({error:'Unexpected weather radar feed format'},502);
  const frames=data.radar.past.filter(x=>x&&Number.isSafeInteger(x.time)&&
   /^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(x.path||''))
   .slice(-8).map(x=>({time:x.time,path:x.path}));
  if(!frames.length)return reply({error:'No recent radar frames available'},503);
  const response=reply({
   source:'RainViewer',host:data.host,frames,generated:data.generated||null,
   note:'Observed precipitation radar. Free API has no future nowcast; tiles limited to zoom 7.'
  },200,'public,max-age=120,s-maxage=120');
  if(store)try{await store.put(key,response.clone())}catch(_){}
  return response;
 }catch(e){return reply({error:'Weather radar temporarily unavailable'},503)}
}
