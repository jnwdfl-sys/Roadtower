// Cloudflare Pages: bounded, cache-friendly community aircraft lookup.
// User GPS is never required here. The client sends a coarse map-center cell.
// Data © adsb.lol contributors (ODbL 1.0). Coverage can be incomplete or delayed.
export async function onRequestGet({request}) {
 const q=new URL(request.url).searchParams;
 let lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 const reply=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
 if(!q.has('lat')||!q.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||
    lat < -85||lat > 85||lon < -180||lon > 180)
  return reply({error:'Valid map center latitude and longitude required'},400);
 // Round to roughly 11km cells for privacy and to share cached responses.
 lat=Math.round(lat*10)/10;lon=Math.round(lon*10)/10;
 const latStr=lat.toFixed(1),lonStr=lon.toFixed(1);
 const key=new Request(new URL('/api/aircraft?lat='+latStr+'&lon='+lonStr,request.url).toString());
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 try{
  if(store){const existing=await store.match(key);if(existing)return existing}
  const upstream=await fetch('https://api.adsb.lol/v2/lat/'+latStr+'/lon/'+lonStr+'/dist/80',{
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(13000)
  });
  if(upstream.status===429)return reply({error:'Aircraft data rate limit reached. Try later.'},503);
  if(!upstream.ok)return reply({error:'Aircraft provider currently unavailable'},502);
  const data=await upstream.json();
  if(!data||!Array.isArray(data.ac))return reply({error:'Aircraft provider returned invalid data'},502);
  const flights=data.ac.filter(x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&
    Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180&&Number(x.seen_pos??0)<=120)
   .slice(0,180).map(x=>({
    hex:String(x.hex||'').slice(0,12),
    call:String(x.flight||x.r||'').trim().slice(0,20),
    type:String(x.t||'').slice(0,12),
    lat:x.lat,lon:x.lon,
    altFt:Number.isFinite(x.alt_baro)?x.alt_baro:(typeof x.alt_baro==='string'?null:null),
    speedKt:Number.isFinite(x.gs)?x.gs:null,
    heading:Number.isFinite(x.track)?x.track:null,
    seenSec:Number.isFinite(x.seen_pos)?x.seen_pos:null
   }));
  const response=reply({source:'adsb.lol',credit:'© adsb.lol contributors (ODbL 1.0)',
   center:{lat,lon},updated:Date.now(),flights},200,'public,max-age=60,s-maxage=60');
  if(store)try{await store.put(key,response.clone())}catch(_){}
  return response;
 }catch(e){return reply({error:'Aircraft tracking temporarily unavailable'},503)}
}
