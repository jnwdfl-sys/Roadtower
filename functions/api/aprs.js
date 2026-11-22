// ROADTOWER read-only APRS callsign position proxy.
// Sources: OpenAPRS anonymous public GraphQL and APRS World public REST.
// No APRS-IS login, transmission, passcode, or made-up position reports.
export async function onRequestGet({request}) {
 const url=new URL(request.url),raw=String(url.searchParams.get('call')||'').trim().toUpperCase();
 const respond=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
 if(!/^[A-Z0-9]{3,10}(?:-(?:1[0-5]|[0-9]))?$/.test(raw))
  return respond({error:'Enter a valid-looking amateur call sign; optional SSID 0–15.',code:'BAD_CALLSIGN'},400);
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 const key=new Request(new URL('/api/aprs?call='+raw,url.origin).toString());
 if(store)try{const cached=await store.match(key);if(cached)return cached}catch(_){}
 const errors=[];
 function parsePosition(candidate,source) {
  if(!candidate||typeof candidate!=='object')return null;
  const p=candidate.position&&typeof candidate.position==='object'?candidate.position:candidate;
  const lat=Number(p.latitude??p.lat),lon=Number(p.longitude??p.lng??p.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  const stamp=p.lastHeardAt??p.last_heard_at??p.received_at??p.receivedAt??
   p.timestamp??p.lasttime??p.time??p.updated_at??p.createdAt;
  let t=typeof stamp==='string'?Date.parse(stamp):Number(stamp);
  if(Number.isFinite(t)&&t>0&&t<1e11)t*=1000;
  const validTime=Number.isFinite(t)&&t>Date.now()-365*86400000&&t<Date.now()+600000;
  const reportedAt=validTime?Math.round(t):null;
  const name=String(p.callsign||p.call||p.name||candidate.callsign||raw).toUpperCase();
  return {callsign:name.slice(0,16),latitude:lat,longitude:lon,
   reportedAt,comment:String(p.comment||p.status||'').slice(0,200),
   source};
 }
 async function publish(position,source){
  const response=respond({source,call:raw,checkedAt:Date.now(),position},200,
   'public,max-age=120,s-maxage=120');
  if(store)try{await store.put(key,response.clone())}catch(_){}
  return response;
 }
 try{
  const query='query($call:String!){station(callsign:$call){callsign latitude longitude lastHeardAt comment}}';
  const resp=await fetch('https://openaprs.ai/api/graphql',{
   method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({query,variables:{call:raw}}),
   signal:AbortSignal.timeout(9000)
  });
  if(!resp.ok)throw Error('OpenAPRS HTTP '+resp.status);
  const data=await resp.json();
  if(Array.isArray(data.errors)&&data.errors.length)throw Error('OpenAPRS query unavailable');
  if(!data||!data.data||!Object.hasOwn(data.data,'station'))
   throw Error('OpenAPRS unexpected response');
  const p=parsePosition(data.data.station,'OpenAPRS');
  if(p)return await publish(p,'OpenAPRS');
  errors.push('OpenAPRS: station not available');
 }catch(e){errors.push('OpenAPRS: '+String(e.message||'request failed').slice(0,90))}
 try{
  const resp=await fetch('https://api.aprs.world/api/positions/'+encodeURIComponent(raw),{
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)
  });
  if(!resp.ok)throw Error('APRS World HTTP '+resp.status);
  const data=await resp.json();
  let item=Array.isArray(data)?data[0]:data?.position??data?.data??data?.station??data;
  if(Array.isArray(item))item=item[0];
  if(item&&Array.isArray(item.positions))item=item.positions[0]||item;
  const p=parsePosition(item,'APRS World');
  if(p)return await publish(p,'APRS World');
  errors.push('APRS World: no supported position returned');
 }catch(e){errors.push('APRS World: '+String(e.message||'request failed').slice(0,90))}
 // A successful empty lookup cannot be mistaken for a current position.
 const out=respond({code:'NO_VERIFIED_POSITION',call:raw,
  error:'No public APRS position available. Check APRS.fi to confirm activity.',
  diagnostics:errors,checkedAt:Date.now()},404,'public,max-age=120,s-maxage=120');
 if(store)try{await store.put(key,out.clone())}catch(_){}
 return out;
}
