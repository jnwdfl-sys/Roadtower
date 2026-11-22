/* ROADTOWER Storms Ahead and Live Feed Health.
   Alerts from official NWS at GPS + two directional samples; not a road route.
   Checks only while this page is visible/online. Do not drive using this display. */
(function(){
'use strict';
const rt=window.RoadtowerRepeaters;
const map=rt&&rt.getMap&&rt.getMap();
const host=document.getElementById('map');
if(!map||!host||!window.L)return;
const MI=3958.7613, CHECK_EVERY=300000, MOVED_MILES=3;
let stormOn=true,stormBusy=false,stormLastCheck=0,stormLastSuccess=0,stormLastError='';
let stormAlerts=[],lastSamples=[],lastPlan=null,lastGps=null,lastGpsAt=0,derivedHeading=null;
let lastWarningSignature='',distance=25,direction='auto',sampleLayer=null,stormLevel='idle';
try{
 const d=Number(localStorage.getItem('roadtower.storm.distance.v1'));
 if([10,25,50,100].includes(d))distance=d;
 const h=localStorage.getItem('roadtower.storm.direction.v1');
 if(['auto','0','90','180','270'].includes(h))direction=h;
}catch(_){}

const css=document.createElement('style');
css.textContent=[
 '#map .rt-storm-panel,#map .rt-health-panel{position:absolute;z-index:1470;width:min(312px,78%);max-height:52%;overflow:auto;overscroll-behavior:contain;background:rgba(8,33,47,.97);border:2px solid #d69d3e;border-radius:13px;color:#ecfaff;padding:10px;box-shadow:0 5px 20px #0009;font:600 12px/1.45 system-ui,Arial}',
 '#map .rt-storm-panel{left:12px;top:28%}',
 '#map .rt-health-panel{right:12px;top:35%;border-color:#58b5d6}',
 '#map .rt-storm-title,#map .rt-health-title{display:block;color:#f9e6bf;font:900 16px system-ui,Arial;margin:2px 0 8px}',
 '#map .rt-health-title{color:#b2ebff}',
 '#map .rt-storm-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:8px 0}',
 '#map .rt-storm-panel button,#map .rt-health-panel button{border:1px solid #88bdcc;background:#25586c;color:#fff;border-radius:8px;font:800 12px system-ui,Arial;padding:9px;cursor:pointer;min-height:35px}',
 '#map .rt-storm-panel button[aria-pressed="true"]{background:#af791b;border-color:#f4ca79;color:#fff}',
 '#map .rt-storm-panel label{display:block;flex:1 1 105px;font-size:11px;color:#d9e5f0}',
 '#map .rt-storm-panel select{display:block;width:100%;background:#13364d;color:#fff;padding:9px;border:1px solid #80b2c8;border-radius:7px;font:700 12px system-ui,Arial;margin-top:4px}',
 '#map .rt-storm-state{margin:8px 0;padding:8px;background:#123648;border-left:4px solid #89c7d9;border-radius:5px;white-space:normal}',
 '#map .rt-storm-panel[data-level="danger"] .rt-storm-state{border-left-color:#ff4c58;background:#49242a}',
 '#map .rt-storm-panel[data-level="warning"] .rt-storm-state{border-left-color:#ffb144;background:#47351c}',
 '#map .rt-storm-alerts{display:flex;flex-direction:column;gap:5px;margin:7px 0}',
 '#map .rt-storm-alert{border:1px solid #8d783e;background:#28373b;border-radius:8px;padding:8px}',
 '#map .rt-storm-alert[data-level="danger"]{border-color:#fc6472;background:#49252b}',
 '#map .rt-storm-alert strong{display:block;font-size:13px}',
 '#map .rt-storm-alert small{display:block;font-size:11px;font-weight:500;color:#cbdbe3;margin-top:3px}',
 '#map .rt-storm-alert a{color:#a8ddff;font-weight:750}',
 '#map .rt-storm-help{font:500 11px/1.5 system-ui,Arial;color:#bfdae6;margin:7px 0}',
 '#map .rt-health-grid{display:flex;flex-direction:column;gap:6px}',
 '#map .rt-health-item{display:flex;align-items:flex-start;gap:8px;padding:7px;background:#143345;border-radius:8px}',
 '#map .rt-health-item strong{display:block;font-size:12px;color:#fff}',
 '#map .rt-health-item small{display:block;overflow-wrap:anywhere;font-size:11px;font-weight:500;color:#bcd5e4}',
 '#map .rt-health-light{flex:0 0 11px;width:11px;height:11px;border-radius:50%;background:#899aa6;box-shadow:0 0 4px #273f4f;margin-top:3px}',
 '#map .rt-health-item[data-state="good"] .rt-health-light{background:#51e6a3;box-shadow:0 0 6px #32c67c}',
 '#map .rt-health-item[data-state="warn"] .rt-health-light{background:#ffd363;box-shadow:0 0 5px #d5a43c}',
 '#map .rt-health-item[data-state="bad"] .rt-health-light{background:#ff596a;box-shadow:0 0 6px #d9384e}',
 '#map .rt-health-item[data-state="off"] .rt-health-light{background:#a4aeba}',
 '#map #rtLayoutTray .rt-dot-storm{--rt-dot:#ffae43}',
 '#map #rtLayoutTray .rt-dot-health{--rt-dot:#50c1e6}',
 '#map #rtLayoutTray .rt-dot-storm[data-level="danger"]{--rt-dot:#ff394f;box-shadow:0 0 8px #fd435f}',
 '#map #rtLayoutTray .rt-dot-storm[data-level="warning"]{--rt-dot:#ffa32e}',
 '#map .rt-storm-banner{position:absolute;z-index:1488;left:50%;transform:translateX(-50%);bottom:55px;max-width:min(360px,75%);border:2px solid #ff707c;border-radius:10px;background:rgba(77,19,28,.94);color:#fff;padding:8px 10px;font:850 12px/1.35 system-ui,Arial;cursor:pointer;box-shadow:0 4px 18px #000a}',
 '#map .rt-storm-banner[hidden]{display:none!important}',
 '@media(max-width:490px){#map .rt-storm-panel,#map .rt-health-panel{width:min(255px,67%);padding:7px;max-height:55%}#map .rt-storm-title,#map .rt-health-title{font-size:14px}}'
].join('\n');
document.head.appendChild(css);

const storm=document.createElement('section');
storm.className='rt-storm-panel';storm.id='rtStormPanel';
storm.dataset.level='idle';
storm.setAttribute('aria-label','Storms Ahead official weather warnings');
storm.innerHTML=
 '<strong class="rt-storm-title">⛈ STORMS AHEAD</strong>'+
 '<div class="rt-storm-controls"><button id="rtStormToggle" type="button" aria-pressed="true">AUTO: ON</button>'+
 '<button id="rtStormCheck" type="button">↻ Check now</button></div>'+
 '<div class="rt-storm-controls"><label for="rtStormMiles">Look-ahead distance'+
 '<select id="rtStormMiles"><option value="10">10 miles</option><option value="25">25 miles</option><option value="50">50 miles</option><option value="100">100 miles</option></select></label>'+
 '<label for="rtStormDirection">Direction'+
 '<select id="rtStormDirection"><option value="auto">GPS travel heading</option><option value="0">North</option><option value="90">East</option><option value="180">South</option><option value="270">West</option></select></label></div>'+
 '<div id="rtStormStatus" class="rt-storm-state" role="status">Waiting for GPS and official alerts…</div>'+
 '<div id="rtStormAlerts" class="rt-storm-alerts"></div>'+
 '<p class="rt-storm-help">Samples your location and up to two points straight ahead. Not a navigation route or storm-motion forecast. A clear sample does NOT guarantee safe roads. Requires internet and GPS; official alert issuance may be delayed.</p>'+
 '<a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer" style="color:#b2e5ff">National Weather Service</a>';
host.appendChild(storm);

const health=document.createElement('section');
health.className='rt-health-panel';health.id='rtHealthPanel';
health.setAttribute('aria-label','Live weather, aircraft and GPS connection health');
health.innerHTML=
 '<strong class="rt-health-title">📶 LIVE FEED HEALTH</strong>'+
 '<div class="rt-health-grid" id="rtHealthGrid">'+
 '<div id="rtHealthGps" class="rt-health-item" data-state="off"><i class="rt-health-light"></i><span><strong>GPS</strong><small>Awaiting GPS</small></span></div>'+
 '<div id="rtHealthAircraft" class="rt-health-item" data-state="off"><i class="rt-health-light"></i><span><strong>Aircraft</strong><small>Awaiting first report</small></span></div>'+
 '<div id="rtHealthRadar" class="rt-health-item" data-state="off"><i class="rt-health-light"></i><span><strong>Weather radar</strong><small>Awaiting image</small></span></div>'+
 '<div id="rtHealthStorm" class="rt-health-item" data-state="off"><i class="rt-health-light"></i><span><strong>NWS Storms Ahead</strong><small>Awaiting check</small></span></div>'+
 '<div id="rtHealthInternet" class="rt-health-item" data-state="off"><i class="rt-health-light"></i><span><strong>Internet</strong><small>Checking browser connection</small></span></div></div>'+
 '<div class="rt-storm-controls"><button id="rtHealthRefresh" type="button">↻ Check feeds</button><button id="rtHealthLive" type="button">Open live layers</button></div>'+
 '<p class="rt-storm-help">Green = recently verified; amber = delayed or waiting; red = failed/stale; gray = switched off. Browser online does not guarantee outside data services are reachable.</p>';
host.appendChild(health);

if(L.DomEvent){for(const p of [storm,health]){L.DomEvent.disableClickPropagation(p);L.DomEvent.disableScrollPropagation(p)}}
const banner=document.createElement('button');
banner.type='button';banner.className='rt-storm-banner';banner.hidden=true;
banner.setAttribute('aria-label','Open active severe weather warnings ahead');
host.appendChild(banner);
const $=id=>document.getElementById(id);
const btn=$('rtStormToggle'),check=$('rtStormCheck'),status=$('rtStormStatus');
const alertsRoot=$('rtStormAlerts'),milesSelect=$('rtStormMiles'),directionSelect=$('rtStormDirection');
milesSelect.value=String(distance);directionSelect.value=direction;
function valid(g){return !!(g&&Number.isFinite(g.latitude)&&Number.isFinite(g.longitude)&&
 Math.abs(g.latitude)<=90&&Math.abs(g.longitude)<=180)}
function deg(n){return (n%360+360)%360}
function haversine(a,b){
 const r=Math.PI/180,x=(b.latitude-a.latitude)*r,y=(b.longitude-a.longitude)*r;
 const h=Math.sin(x/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(y/2)**2;
 return MI*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function bearing(a,b){
 const r=Math.PI/180,y=Math.sin((b.longitude-a.longitude)*r)*Math.cos(b.latitude*r);
 const x=Math.cos(a.latitude*r)*Math.sin(b.latitude*r)-
  Math.sin(a.latitude*r)*Math.cos(b.latitude*r)*Math.cos((b.longitude-a.longitude)*r);
 return deg(Math.atan2(y,x)/r);
}
function destination(lat,lon,heading,miles){
 const r=Math.PI/180,d=miles/MI,p=lat*r,l=lon*r,br=heading*r;
 const p2=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(br));
 const l2=l+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2));
 return {latitude:p2/r,longitude:((l2/r+540)%360)-180};
}
function headingOf(g){
 if(direction!=='auto')return {value:Number(direction),basis:'selected'};
 if(Number.isFinite(g.heading)&&g.heading>=0&&
  (!Number.isFinite(g.speed)||g.speed>=.6))return {value:deg(g.heading),basis:'GPS'};
 if(derivedHeading!==null)return {value:derivedHeading,basis:'recent GPS travel'};
 return {value:null,basis:'none'};
}
function fmt(ts){return ts?new Date(ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'never'}
function setLight(id,state,label,detail){
 const root=$(id);if(!root)return;
 root.dataset.state=state;
 const strong=root.querySelector('strong'),small=root.querySelector('small');
 strong.textContent=label;small.textContent=detail;
}
function ageMin(ts){return ts?Math.max(0,Math.floor((Date.now()-ts)/60000)):null}
function healthRefresh(){
 const live=window.RoadtowerLiveLayers&&window.RoadtowerLiveLayers.getState();
 const gps=rt.getGps&&rt.getGps(),now=Date.now();
 const gpsAge=lastGpsAt?now-lastGpsAt:Infinity;
 setLight('rtHealthGps',!valid(gps)?'bad':gpsAge<=60000?'good':gpsAge<=180000?'warn':'bad',
  'GPS',!valid(gps)?'Not connected / permission needed':gpsAge<=60000?'Live fix • '+Math.round(gps.accuracy||0)+' m accuracy':
  'Last GPS update '+Math.round(gpsAge/1000)+' sec ago');
 if(!navigator.onLine)setLight('rtHealthInternet','bad','Internet','Browser reports offline');
 else setLight('rtHealthInternet','warn','Internet','Browser online • individual feeds checked below');
 if(!live){
  setLight('rtHealthAircraft','warn','Aircraft','Live layer not initialized');
  setLight('rtHealthRadar','warn','Weather radar','Live layer not initialized');
 }else{
  const paused=!live.autoRefresh;
  const airAge=ageMin(live.airLastSuccess);
  const airState=!live.aircraft?'off':!navigator.onLine?'bad':live.airLastError?'bad':airAge===null?'warn':airAge<3?'good':airAge<6?'warn':'bad';
  setLight('rtHealthAircraft',airState,'Aircraft',
   !live.aircraft?'Switched OFF':paused?'Automatic checks paused'+(airAge!==null?' • last success '+airAge+'m ago':''):
   live.airLastError?'Feed error • '+String(live.airLastError).slice(0,95):
   airAge===null?'Awaiting first aircraft response':(live.planes||0)+' planes • '+(live.airCurrentSource||'unknown feed')+' • '+airAge+'m since reply');
  const radarAge=ageMin((live.radarFrameTime||0)*1000);
  const radarCheckAge=ageMin(live.radarLastSuccess);
  const radarState=!live.radar?'off':!navigator.onLine?'bad':live.radarLastError?'bad':radarAge===null?'warn':radarAge<25&&radarCheckAge!==null&&radarCheckAge<=5?'good':radarAge<45?'warn':'bad';
  setLight('rtHealthRadar',radarState,'Weather radar',
   !live.radar?'Switched OFF':paused?'Automatic checks paused'+(radarAge!==null?' • frame '+radarAge+'m old':''):
   live.radarLastError?'Update failed • '+String(live.radarLastError).slice(0,95):
   radarAge===null?'Waiting for radar frame':'Frame '+radarAge+'m old'+(radarCheckAge===null?' • fetch unverified':' • checked '+radarCheckAge+'m ago'));
 }
 const stormAge=ageMin(stormLastSuccess);
 const stormState=!stormOn?'off':!navigator.onLine?'bad':stormLastError?'bad':stormAge===null?'warn':stormAge<8?'good':stormAge<15?'warn':'bad';
 setLight('rtHealthStorm',stormState,'NWS Storms Ahead',
  !stormOn?'Switched OFF':stormLastError?'Alert checks failed • '+stormLastError.slice(0,95):
  stormAge===null?'Awaiting first official NWS check':stormAge+'m since check • '+stormAlerts.length+' distinct alerts');
}
function severity(a){
 const ev=String(a.event||'').toLowerCase();
 if(ev.includes('tornado warning')||ev.includes('flash flood emergency')||
  a.severity==='Extreme')return 4;
 if(ev.includes('severe thunderstorm warning')||ev.includes('flash flood warning')||
  a.severity==='Severe')return 3;
 if(ev.includes('warning'))return 2;
 if(ev.includes('watch')||a.severity==='Moderate')return 1;
 return 0;
}
function displayAlerts(){
 alertsRoot.replaceChildren();
 stormAlerts.forEach(a=>{
  const block=document.createElement('article');
  block.className='rt-storm-alert';block.dataset.level=severity(a)>=3?'danger':'warning';
  const name=document.createElement('strong');name.textContent='⚠ '+a.event;
  const info=document.createElement('small');
  info.textContent=a.locations.join(' • ')+' · '+(a.severity||'Unknown')+' · '+(a.areaDesc||'NWS service area');
  const headline=document.createElement('small');headline.textContent=a.headline||'Official weather warning';
  block.append(name,info,headline);
  if(a.link&&/^https:\/\/(?:api|www)\.weather\.gov\//.test(a.link)){
   const link=document.createElement('a');link.href=a.link;link.target='_blank';
   link.rel='noopener noreferrer';link.textContent='Read official warning';block.appendChild(link);
  }
  alertsRoot.appendChild(block);
 });
}
function drawSamples(){
 if(sampleLayer){map.removeLayer(sampleLayer);sampleLayer=null}
 if(!stormOn||!lastSamples.length)return;
 sampleLayer=L.layerGroup().addTo(map);
 const sites=lastSamples;
 if(sites.length>1)L.polyline(sites.map(x=>[x.point.latitude,x.point.longitude]),{
  color:'#f6b942',weight:2,opacity:.82,dashArray:'5 7',interactive:false
 }).addTo(sampleLayer);
 sites.forEach((x,i)=>{
  const danger=x.ok&&x.alerts.some(a=>severity(a)>=3);
  const found=x.ok&&x.alerts.length>0;
  L.circleMarker([x.point.latitude,x.point.longitude],{
   radius:i===0?5:6,color:'#ffffff',weight:1.5,
   fillColor:!x.ok?'#9ba4b4':danger?'#e84255':found?'#ecaf37':'#43b68d',
   fillOpacity:.88
  }).bindPopup(x.label+' • '+(!x.ok?'NWS data unavailable':x.alerts.length+
   ' active NWS alert(s) • sampled point only')).addTo(sampleLayer);
 });
}
function setLevel(n){
 stormLevel=n>=3?'danger':n>=1?'warning':'good';
 storm.dataset.level=stormLevel;
 const dot=host.querySelector('#rtLayoutTray .rt-dot-storm');
 if(dot)dot.dataset.level=stormLevel;
 const severe=stormAlerts.filter(a=>severity(a)>=3);
 if(severe.length){
  const sig=severe.map(x=>x.id).join('|');
  if(sig!==lastWarningSignature)banner.hidden=false;
  banner.textContent='⚠ WEATHER WARNING: '+severe[0].event+' • Tap to review';
 }else{banner.hidden=true;lastWarningSignature=''}
}
function toggle(on){
 stormOn=Boolean(on);
 btn.textContent=stormOn?'AUTO: ON':'AUTO: OFF';btn.setAttribute('aria-pressed',String(stormOn));
 check.disabled=!stormOn;
 if(!stormOn){
  if(sampleLayer){map.removeLayer(sampleLayer);sampleLayer=null}
  banner.hidden=true;status.textContent='Automatic Storms Ahead checks OFF.';storm.dataset.level='idle';
 }else{
  status.textContent='Automatic NWS warning checks ON.';drawSamples();runStorm(true);
 }
 healthRefresh();
}
function receiveGps(g){
 if(!valid(g)){lastGps=null;lastGpsAt=0;derivedHeading=null;healthRefresh();return}
 const now=Date.now();
 if(valid(lastGps)){
  const traveled=haversine(lastGps,g);
  if(traveled>.04&&traveled<5)derivedHeading=bearing(lastGps,g);
 }
 lastGps={latitude:g.latitude,longitude:g.longitude,
  heading:g.heading,speed:g.speed,accuracy:g.accuracy};
 lastGpsAt=now;
 if(stormOn&&!stormBusy&&navigator.onLine&&
  (now-stormLastCheck>CHECK_EVERY||
   (lastPlan&&haversine(lastPlan.origin,g)>=MOVED_MILES&&now-stormLastCheck>90000)))runStorm(false);
}
async function runStorm(force=false){
 if(!stormOn||stormBusy||document.hidden)return;
 if(!navigator.onLine){stormLastError='Offline';status.textContent='Storms Ahead waiting for internet.';healthRefresh();return}
 const g=rt.getGps&&rt.getGps();
 if(!valid(g)){status.textContent='Waiting for live GPS. Start GPS and allow location access.';healthRefresh();return}
 const now=Date.now();
 if(now-stormLastCheck<(force?45000:CHECK_EVERY))return;
 stormBusy=true;stormLastCheck=now;check.disabled=true;
 const h=headingOf(g),samples=[{point:{latitude:g.latitude,longitude:g.longitude},label:'Current location'}];
 if(h.value!==null){
  for(const d of [distance/2,distance])
   samples.push({point:destination(g.latitude,g.longitude,h.value,d),label:d+' miles ahead'});
 }
 const origin={latitude:g.latitude,longitude:g.longitude};
 lastPlan={origin,direction:h.value,distance};
 status.textContent='Checking official NWS alerts at '+samples.length+' location(s)…';
 try{
  const results=await Promise.all(samples.map(async x=>{
   try{
    const p=x.point;
    const url='./api/alerts?lat='+p.latitude.toFixed(3)+'&lon='+p.longitude.toFixed(3);
    const resp=await fetch(url,{cache:'no-store'});
    if(!resp.ok)throw Error('NWS alert service HTTP '+resp.status);
    const data=await resp.json();
    if(!Array.isArray(data.alerts))throw Error('Unexpected NWS alert response');
    return {...x,ok:true,alerts:data.alerts,checkedAt:data.checkedAt};
   }catch(e){return {...x,ok:false,alerts:[],error:String(e.message||e)}}
  }));
  if(!stormOn)return;
  lastSamples=results;
  const succeeded=results.filter(x=>x.ok),failed=results.filter(x=>!x.ok);
  if(!succeeded.length)throw Error(failed[0]?.error||'No NWS reply');
  const byId=new Map();
  for(const sample of succeeded){
   for(const a of sample.alerts){
    const id=String(a.id||a.event+'|'+a.headline);
    if(!byId.has(id))byId.set(id,{...a,locations:[sample.label]});
    else byId.get(id).locations.push(sample.label);
   }
  }
  stormAlerts=[...byId.values()].sort((a,b)=>severity(b)-severity(a)).slice(0,12);
  stormLastSuccess=Date.now();
  stormLastError=failed.length?'Partial coverage: '+failed.length+' of '+results.length+' checks failed':'';
  const count=stormAlerts.length,highest=Math.max(0,...stormAlerts.map(severity));
  setLevel(highest);
  displayAlerts();drawSamples();
  const when=fmt(stormLastSuccess);
  const directionText=h.value===null?'Travel heading unavailable: checked current location ONLY. Choose a compass direction to check ahead.':
   Math.round(h.value)+'° '+h.basis+' • '+distance+' miles ahead (straight-line samples, not route)';
  status.textContent='NWS checked '+when+' · '+directionText+' · '+
   (count?count+' active alert(s) at sampled points.':'No active alerts at checked points. This does NOT mean the route is safe.')+
   (failed.length?' WARNING: '+failed.length+' sample check(s) failed.':'');
 }catch(e){
  stormLastError=String(e.message||e);
  status.textContent='NWS feed unavailable: '+stormLastError+'. Do NOT interpret this as clear weather.';
  storm.dataset.level='idle';
  banner.hidden=true;
 }finally{stormBusy=false;check.disabled=!stormOn;healthRefresh()}
}
btn.addEventListener('click',()=>toggle(!stormOn));
check.addEventListener('click',()=>runStorm(true));
milesSelect.addEventListener('change',()=>{
 distance=Number(milesSelect.value);
 try{localStorage.setItem('roadtower.storm.distance.v1',String(distance))}catch(_){}
 stormLastCheck=0;if(stormOn)runStorm(true);
});
directionSelect.addEventListener('change',()=>{
 direction=directionSelect.value;derivedHeading=null;
 try{localStorage.setItem('roadtower.storm.direction.v1',direction)}catch(_){}
 stormLastCheck=0;if(stormOn)runStorm(true);
});
banner.addEventListener('click',()=>{
 lastWarningSignature=stormAlerts.filter(a=>severity(a)>=3).map(a=>a.id).join('|');
 banner.hidden=true;
 if(window.RoadtowerPanelLayout)window.RoadtowerPanelLayout.open('storm');
 else storm.scrollIntoView({block:'nearest'});
});
$('rtHealthRefresh').addEventListener('click',()=>{
 if(stormOn)runStorm(true);
 const live=window.RoadtowerLiveLayers;
 if(live&&typeof live.refresh==='function')live.refresh();
 healthRefresh();
});
$('rtHealthLive').addEventListener('click',()=>{
 if(window.RoadtowerPanelLayout)window.RoadtowerPanelLayout.open('layers');
});
const previous=rt.onGps;
rt.onGps=function(g){if(typeof previous==='function')previous(g);receiveGps(g)};
window.addEventListener('online',()=>{if(stormOn)runStorm(true);healthRefresh()});
window.addEventListener('offline',healthRefresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(stormOn)runStorm(false);healthRefresh()}});
setInterval(()=>{
 if(document.hidden)return;
 if(stormOn&&!stormBusy)runStorm(false);
 healthRefresh();
},15000);
window.RoadtowerStorms={
 getState:()=>({enabled:stormOn,lastCheckedAt:stormLastSuccess,error:stormLastError,
  alerts:stormAlerts.length,direction,distance}),
 check:()=>runStorm(true),setOn:toggle
};
const initial=rt.getGps&&rt.getGps();
if(valid(initial))receiveGps(initial);
healthRefresh();
runStorm(true);
})();
