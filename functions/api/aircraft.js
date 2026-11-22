// ROADTOWER Cloudflare Pages aircraft proxy.
// Maps public, rounded 0.1-degree map-center cells; no exact GPS is sent.
// Primary: adsb.fi (personal, non-commercial). Backup: adsb.lol (ODbL).
// Additional fallback: OpenSky Network (anonymous, rate-limited).
// All sources can be delayed, blocked or rate-limited. Never invent aircraft.
export async function onRequestGet({request}) {
 const url=new URL(request.url),q=url.searchParams;
 const reply=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
 const value=(v)=>Number.isFinite(v)?v:null;
 let lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 if(!q.has('lat')||!q.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||
  lat < -85||lat > 85||lon < -180||lon > 180)
  return reply({error:'Invalid map center',code:'BAD_CENTER'},400);
 lat=Math.round(lat*10)/10;lon=Math.round(lon*10)/10;
 const latStr=lat.toFixed(1),lonStr=lon.toFixed(1);
 const origin=url.origin;
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 const key=new Request(new URL('/api/aircraft?lat='+latStr+'&lon='+lonStr,origin).toString());
 if(store)try{const hit=await store.match(key);if(hit)return hit}catch(_){}
 const failures=[];
 const adsb=[
  {id:'adsb.fi',url:'https://opendata.adsb.fi/api/v3/lat/'+latStr+'/lon/'+lonStr+'/dist/80'},
  {id:'adsb.lol',url:'https://api.adsb.lol/v2/point/'+latStr+'/'+lonStr+'/80'}
 ];
 async function upstreamJson(address){
  const resp=await fetch(address,{headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(9500)});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  return await resp.json();
 }
 async function publish(source,flights,upstreamTime){
  const now=Date.now();
  // Only display an upstream timestamp when plausibly current.
  const updated=Number.isFinite(upstreamTime)&&
   upstreamTime<=now+60000&&upstreamTime>=now-600000?upstreamTime:now;
  const credit=source==='adsb.fi'?'adsb.fi (personal/non-commercial)':
   source==='adsb.lol'?'adsb.lol contributors (ODbL 1.0)':
   'OpenSky Network (opensky-network.org)';
  const result=reply({source,credit,center:{lat,lon},updated,
   flights:flights.slice(0,180)},200,'public,max-age=60,s-maxage=60');
  if(store)try{await store.put(key,result.clone())}catch(_){}
  return result;
 }
 for(const source of adsb){
  try{
   const data=await upstreamJson(source.url);
   if(!data||!Array.isArray(data.ac))throw Error('Invalid JSON shape');
   const now=Date.now();
   const flights=data.ac.filter(x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&
     Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180&&Number(x.seen_pos??x.seen??0)<=120)
    .map(x=>({
     hex:String(x.hex||'').slice(0,12),
     call:String(x.flight||x.r||'').trim().slice(0,20),
     type:String(x.t||'').slice(0,12),
     lat:x.lat,lon:x.lon,
     altFt:value(Number.isFinite(x.alt_baro)?x.alt_baro:x.alt_geom),
     speedKt:value(x.gs),heading:value(x.track),
     seenSec:value(Number.isFinite(x.seen_pos)?x.seen_pos:x.seen)
    }));
   // ADS-B API "now" is epoch milliseconds. No 1970/seconds confusion.
   const providerTime=Number(data.now);
   return await publish(source.id,flights,providerTime);
  }catch(e){failures.push(source.id+': '+String(e.message||'unavailable').slice(0,55))}
 }
 // Third source: only used when BOTH ADS-B sources fail. Bounding box
 // remains below 25 sq-degrees (OpenSky's low-credit tier).
 try{
  const latRadius=1.10;
  const lonRadius=Math.min(1.7,1.10/Math.max(.55,Math.cos(lat*Math.PI/180)));
  const box='lamin='+Math.max(-90,lat-latRadius).toFixed(2)+
   '&lomin='+Math.max(-180,lon-lonRadius).toFixed(2)+
   '&lamax='+Math.min(90,lat+latRadius).toFixed(2)+
   '&lomax='+Math.min(180,lon+lonRadius).toFixed(2);
  const data=await upstreamJson('https://opensky-network.org/api/states/all?'+box);
  if(!data||!Array.isArray(data.states))throw Error('No state vectors');
  const now=Date.now()/1000;
  const flights=data.states.filter(x=>Array.isArray(x)&&
   Number.isFinite(x[5])&&Number.isFinite(x[6])&&
   Number.isFinite(x[4])&&now-x[4]>=0&&now-x[4]<=180)
   .map(x=>({
    hex:String(x[0]||'').slice(0,12),
    call:String(x[1]||'').trim().slice(0,20),
    type:'',lat:x[6],lon:x[5],
    altFt:Number.isFinite(x[7])?Math.round(x[7]*3.28084):null,
    speedKt:Number.isFinite(x[9])?x[9]*1.943844:null,
    heading:value(x[10]),seenSec:Math.round(now-x[4])
   }));
  const upstreamTime=Number.isFinite(data.time)?data.time*1000:Date.now();
  return await publish('OpenSky',flights,upstreamTime);
 }catch(e){failures.push('OpenSky: '+String(e.message||'unavailable').slice(0,55))}
 const throttled=failures.some(x=>x.includes('429'));
 const output=reply({
  code:throttled?'UPSTREAM_RATE_LIMIT':'UPSTREAM_UNAVAILABLE',
  error:throttled?'Aircraft sources blocked or rate-limited.':
   'Aircraft sources unavailable from this hosting network.',
  diagnostics:failures
 },503,'public,max-age=60,s-maxage=60');
 if(store)try{await store.put(key,output.clone())}catch(_){}
 return output;
}
