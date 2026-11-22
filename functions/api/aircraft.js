// Cloudflare Pages: bounded, cache-friendly community aircraft lookup.
// ROADTOWER is a free, personal/non-commercial app. Requests use a coarse map
// center (0.1 degrees); exact device GPS is never required or sent.
// adsb.fi: personal/non-commercial use, attribution/link required.
// adsb.lol: ODbL 1.0, rate-limited; never treat 429 as an empty sky.
export async function onRequestGet({request}) {
 const u=new URL(request.url),q=u.searchParams;
 const reply=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}
 });
 let lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 if(!q.has('lat')||!q.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||
   lat < -85||lat > 85||lon < -180||lon > 180)
  return reply({error:'Valid map-center latitude and longitude required',code:'BAD_CENTER'},400);
 lat=Math.round(lat*10)/10;lon=Math.round(lon*10)/10;
 const latStr=lat.toFixed(1),lonStr=lon.toFixed(1);
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 // Share requests for the same map cell; avoid pounding public provider APIs.
 const key=new Request(new URL('/api/aircraft?lat='+latStr+'&lon='+lonStr,u.origin).toString());
 try{
  if(store){const cached=await store.match(key);if(cached)return cached}
 }catch(_){}
 const sources=[
  {id:'adsb.fi',url:'https://opendata.adsb.fi/api/v3/lat/'+latStr+'/lon/'+lonStr+'/dist/80'},
  {id:'adsb.lol',url:'https://api.adsb.lol/v2/lat/'+latStr+'/lon/'+lonStr+'/dist/80'}
 ];
 const failures=[];
 for(const source of sources){
  try{
   const response=await fetch(source.url,{headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(10000)});
   if(!response.ok){
    failures.push(source.id+' HTTP '+response.status);
    // An upstream rate limit is respected; never rapidly retry that provider.
    continue;
   }
   const data=await response.json();
   const raw=data&&Array.isArray(data.ac)?data.ac:null;
   if(!raw){failures.push(source.id+' invalid response');continue}
   const flights=raw.filter(x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&
      Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180&&Number(x.seen_pos??x.seen??0)<=120)
    .slice(0,180).map(x=>({
     hex:String(x.hex||'').slice(0,12),
     call:String(x.flight||x.r||'').trim().slice(0,20),
     type:String(x.t||'').slice(0,12),
     lat:x.lat,lon:x.lon,
     altFt:Number.isFinite(x.alt_baro)?x.alt_baro:
      (Number.isFinite(x.alt_geom)?x.alt_geom:null),
     speedKt:Number.isFinite(x.gs)?x.gs:null,
     heading:Number.isFinite(x.track)?x.track:null,
     seenSec:Number.isFinite(x.seen_pos)?x.seen_pos:
      (Number.isFinite(x.seen)?x.seen:null)
    }));
   const responseTime=Number(data.now);
   const updated=Number.isFinite(responseTime)&&responseTime>Date.now()-600000&&
    responseTime<Date.now()+60000?responseTime:Date.now();
   const result=reply({source:source.id,
     credit:source.id==='adsb.fi'?'Aircraft data © adsb.fi (personal/non-commercial)':
      'Aircraft data © adsb.lol contributors (ODbL 1.0)',
     center:{lat,lon},updated,flights
    },200,'public,max-age=60,s-maxage=60');
   if(store)try{await store.put(key,result.clone())}catch(_){}
   return result;
  }catch(e){
   failures.push(source.id+' unreachable');
  }
 }
 // Do not claim a successfully connected live feed if providers are blocked.
 // Clients see concise diagnostics to distinguish missing APIs from zero planes.
 const throttled=failures.some(x=>x.includes('429'));
 const output=reply({
  code:throttled?'UPSTREAM_RATE_LIMIT':'UPSTREAM_UNAVAILABLE',
  error:throttled?'Aircraft providers rate-limited or unavailable; retry later.':
   'Aircraft providers could not be reached from the website server.',
  diagnostics:failures.slice(0,2)
 },503,'public,max-age=180,s-maxage=180');
 // Cache temporary upstream failure briefly to honor provider restrictions
 // and avoid many viewers repeatedly retrying a blocked shared server IP.
 if(store)try{await store.put(key,output.clone())}catch(_){}
 return output;
}
