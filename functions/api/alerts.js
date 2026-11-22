// ROADTOWER Storms Ahead: official NWS active-alert proxy for sampled points.
// The browser sends sample coordinates rounded to 3 decimals (~100m).
// Checks NWS alerts at each point; it is not a calculated road route.
// Cache requests briefly to reduce load on api.weather.gov.
export async function onRequestGet({request}) {
 const input=new URL(request.url),q=input.searchParams;
 const output=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}
 });
 if(!q.has('lat')||!q.has('lon'))return output({error:'Point coordinates required'},400);
 const lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<18||lat>72||lon< -180||lon> -65)
  return output({error:'Point outside the supported U.S. weather alert area'},400);
 const la=lat.toFixed(3),lo=lon.toFixed(3);
 const store=typeof caches!=='undefined'&&caches.default?caches.default:null;
 const key=new Request(new URL('/api/alerts?lat='+la+'&lon='+lo,input.origin).toString());
 if(store)try{const cached=await store.match(key);if(cached)return cached}catch(_){}
 try{
  const up=await fetch('https://api.weather.gov/alerts/active?point='+la+','+lo,{
   headers:{
    'Accept':'application/geo+json',
    'User-Agent':'ROADTOWER (https://roadtower.pages.dev/; personal weather safety map)'
   },signal:AbortSignal.timeout(12000)
  });
  if(!up.ok)throw Error('NWS HTTP '+up.status);
  const data=await up.json();
  if(!data||!Array.isArray(data.features))throw Error('Unexpected NWS alert format');
  const clean=[];
  for(const f of data.features.slice(0,30)){
   const p=f&&f.properties;
   if(!p||p.status&&p.status!=='Actual')continue;
   const event=String(p.event||'Weather alert').slice(0,100);
   const id=String(f.id||p['@id']||p.id||'').slice(0,300);
   const url=/^https:\/\/(?:api|www)\.weather\.gov\//.test(id)?id:'';
   clean.push({
    id:id||String(p.event||'')+'|'+String(p.effective||''),
    event,headline:String(p.headline||event).slice(0,240),
    severity:String(p.severity||'Unknown').slice(0,30),
    urgency:String(p.urgency||'Unknown').slice(0,30),
    certainty:String(p.certainty||'Unknown').slice(0,30),
    expires:String(p.expires||p.ends||'').slice(0,40),
    areaDesc:String(p.areaDesc||'').slice(0,160),
    link:url
   });
  }
  const response=output({source:'National Weather Service',point:{lat:Number(la),lon:Number(lo)},
   checkedAt:Date.now(),alerts:clean},200,'public,max-age=120,s-maxage=120');
  if(store)try{await store.put(key,response.clone())}catch(_){}
  return response;
 }catch(e){
  return output({error:'Official NWS alerts unavailable',detail:String(e.message||'network issue').slice(0,90),
   code:'NWS_UNAVAILABLE'},503,'no-store');
 }
}
