// ROADTOWER APRS read-only public callsign lookup.
// APRS World documented REST lookup; OpenAPRS public GraphQL fallback.
// Requires internet; never transmits, beacons or fabricates a position.
export async function onRequestGet({request}) {
 const url=new URL(request.url);
 const call=String(url.searchParams.get('call')||'').trim().toUpperCase();
 const reply=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
 if(!/^[A-Z0-9]{3,10}(?:-(?:1[0-5]|[0-9]))?$/.test(call))
  return reply({code:'BAD_CALLSIGN',error:'Enter a call sign with optional -0 through -15 SSID.'},400);
 const cache=typeof caches!=='undefined'&&caches.default?caches.default:null;
 const key=new Request(new URL('/api/aprs?call='+call,url.origin).toString());
 if(cache)try{const cached=await cache.match(key);if(cached)return cached}catch(_){}
 const reasons=[];
 const stamp=v=>{
  if(v===null||v===undefined||v==='')return null;
  let n=typeof v==='string'&&isNaN(Number(v))?Date.parse(v):Number(v);
  if(Number.isFinite(n)&&n>0&&n<1e11)n*=1000;
  return Number.isFinite(n)&&n>0&&n<Date.now()+600000?Math.round(n):null;
 };
 const normalize=(v,source)=>{
  if(!v||typeof v!=='object')return null;
  const x=v.position&&typeof v.position==='object'?{...v,...v.position}:v;
  const la=Number(x.latitude??x.lat),lo=Number(x.longitude??x.lon??x.lng);
  if(!Number.isFinite(la)||!Number.isFinite(lo)||Math.abs(la)>90||Math.abs(lo)>180)
   return null;
  const reportedAt=stamp(x.lastHeardAt??x.last_heard_at??x.lastheard??
   x.timestamp??x.received_at??x.receivedAt??x.lasttime??x.time??x.updated_at??
   x.created_at??x.createdAt);
  return {
   callsign:String(x.callsign||x.call||x.name||call).slice(0,16).toUpperCase(),
   latitude:la,longitude:lo,reportedAt,
   comment:String(x.comment||x.status||'').slice(0,180),
   source
  };
 };
 async function send(position,source){
  const result=reply({call,position,source,checkedAt:Date.now()},200,
   'public,max-age=90,s-maxage=90');
  if(cache)try{await cache.put(key,result.clone())}catch(_){}
  return result;
 }
 try{
  const resp=await fetch('https://api.aprs.world/api/positions/'+encodeURIComponent(call),{
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const data=await resp.json();
  let candidates=[];
  if(Array.isArray(data))candidates=data;
  else if(data&&typeof data==='object'){
   for(const k of ['positions','data','results','records']){
    if(Array.isArray(data[k]))candidates.push(...data[k]);
    else if(data[k]&&typeof data[k]==='object')candidates.push(data[k]);
   }
   candidates.push(data.position,data.station,data.latest,data);
  }
  const parsed=candidates.map(x=>normalize(x,'APRS World')).filter(Boolean);
  if(parsed.length){
   parsed.sort((a,b)=>(b.reportedAt||0)-(a.reportedAt||0));
   return await send(parsed[0],'APRS World');
  }
  reasons.push('APRS World had no parseable position');
 }catch(e){reasons.push('APRS World '+String(e.message||'unavailable').slice(0,70))}
 try{
  const query='query($call:String!){station(callsign:$call){callsign latitude longitude lastHeardAt comment}}';
  const resp=await fetch('https://openaprs.ai/api/graphql',{
   method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify({query,variables:{call}}),signal:AbortSignal.timeout(9000)});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const data=await resp.json();
  if(Array.isArray(data.errors)&&data.errors.length)throw Error('GraphQL request unavailable');
  const position=normalize(data?.data?.station,'OpenAPRS');
  if(position)return await send(position,'OpenAPRS');
  reasons.push('OpenAPRS station position not found');
 }catch(e){reasons.push('OpenAPRS '+String(e.message||'unavailable').slice(0,70))}
 // A lookup failure must not show "live" or invent a marker.
 const result=reply({call,code:'NO_VERIFIED_POSITION',
  error:'No public APRS position confirmed for this call sign.',
  diagnostics:reasons,checkedAt:Date.now()},404,'public,max-age=90,s-maxage=90');
 if(cache)try{await cache.put(key,result.clone())}catch(_){}
 return result;
}
