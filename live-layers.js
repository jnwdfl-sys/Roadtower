/* Roadtower independent live map overlays.
   These optional ONLINE layers default ON every launch. They do not replace
   the HAM/GMRS group or the user's high-priority visual SOS GPS marker.
   Aircraft: public ADS-B data; automatic nearby snapshots.
   Radar: RainViewer observed-precipitation frames, NOT future forecasts.
*/
(function(){
'use strict';
const api=window.RoadtowerRepeaters, map=api&&api.getMap&&api.getMap();
const host=document.getElementById('map');
if(!map||!host||!window.L)return;

const panel=document.createElement('aside');
panel.className='rt-live-panel';
panel.setAttribute('aria-label','Live aircraft and weather radar layers');
panel.innerHTML=
 '<strong class="rt-live-title">✈ Aircraft + 🌦 Weather Radar</strong>'+
 '<div class="rt-live-switches">'+
 '<button id="rtAirToggle" type="button" aria-pressed="true">✈ AIRCRAFT: ON</button>'+
 '<button id="rtRadarToggle" type="button" aria-pressed="true">🌦 RADAR: ON</button></div>'+
 '<div id="rtAirStatus" class="rt-live-status" role="status">Aircraft: connecting…</div>'+
 '<div id="rtRadarStatus" class="rt-live-status" role="status">Radar: connecting…</div>'+
 '<div class="rt-live-options">'+
 '<label for="rtRadarOpacity">Radar strength <output id="rtRadarOpacityValue">30%</output></label>'+
 '<input type="range" id="rtRadarOpacity" min="15" max="65" value="30" step="5">'+
 '<button type="button" id="rtRadarAnimate">▶ Play past radar</button>'+
 '<button type="button" id="rtAutoToggle" aria-pressed="true">⟳ AUTO: ON</button>'+ 
 '<button type="button" id="rtLayersRefresh">↻ Update now</button></div>'+
 '<div class="rt-live-nearest"><strong>✈ Aircraft near map</strong>'+
 '<div id="rtAircraftList" class="rt-live-air-list">Waiting for aircraft reports…</div></div>'+
 '<div class="rt-live-credit">Aircraft: <a href="https://adsb.fi/" target="_blank" rel="noopener noreferrer">adsb.fi</a> (personal/non-commercial), <a href="https://www.adsb.lol/" target="_blank" rel="noopener noreferrer">adsb.lol</a> (ODbL), or <a href="https://opensky-network.org/" target="_blank" rel="noopener noreferrer">OpenSky</a> · Radar © RainViewer<br>'+
 'Aircraft auto-refreshes about every minute when open (provider reporting may lag). Radar checks about every 2 minutes; new radar frames normally arrive about every 10 minutes. Neither is an instant tracking feed or a forecast.'+
 '<br>Uses internet and sends an approximate MAP CENTER (rounded to 0.1°) to the aircraft service. GPS itself stays on your phone.</div>';
host.appendChild(panel);
if(L.DomEvent){
 L.DomEvent.disableClickPropagation(panel);
 L.DomEvent.disableScrollPropagation(panel);
}
const el=id=>panel.querySelector('#'+id);
const toggleAir=el('rtAirToggle'),toggleRadar=el('rtRadarToggle');
const radarStatus=el('rtRadarStatus'),airStatus=el('rtAirStatus'),listRoot=el('rtAircraftList');
const airGroup=L.layerGroup().addTo(map);
let aircraftOn=true,radarOn=true,airRecords=[],airLastFetch=0,airLastSuccess=0,airLastCenter=null;
let airBusy=false,radarBusy=false,radarFrames=[],radarHost='',radarLayer=null;
const airMarkers=new Map();
let airCurrentSource='',airLastError='';
let autoEnabled=true,radarFramePath='';
let radarFrameTime=0,radarLastFetch=0,animation=null,animationIndex=0;
const RADAR_OPACITY=.30, AIR_INTERVAL=60000, RADAR_INTERVAL=120000;
let currentOpacity=RADAR_OPACITY;
const radarPane=map.getPane('rtRadarPane')||map.createPane('rtRadarPane');
radarPane.style.zIndex='325';
radarPane.style.pointerEvents='none';
const safeNumber=v=>Number.isFinite(v)?v:null;
const miles=(a,b,c,d)=>{
 const r=Math.PI/180;
 const x=(c-a)*r,y=(d-b)*r;
 return 3958.76*2*Math.asin(Math.sqrt(Math.sin(x/2)**2+
    Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2));
};
function row(label,value){
 const e=document.createElement('div');
 const b=document.createElement('b');b.textContent=label+': ';
 e.appendChild(b);e.appendChild(document.createTextNode(String(value)));return e;
}
function updateToggle(button,on,word){
 button.textContent=(word==='AIRCRAFT'?'✈ ':'🌦 ')+word+': '+(on?'ON':'OFF');
 button.setAttribute('aria-pressed',String(on));
}
function viewCenter(){
 const c=map.getCenter();
 // Never send precise phone GPS to the provider: bucket the public map center.
 return {lat:Math.round(c.lat*10)/10,lon:Math.round(c.lng*10)/10};
}
function radarTile(frame){
 if(!radarOn||!frame||!radarHost)return;
 const changed=!radarLayer||radarFramePath!==frame.path;
 if(changed){
  if(radarLayer){map.removeLayer(radarLayer);radarLayer=null}
  const url=radarHost+frame.path+'/256/{z}/{x}/{y}/2/1_1.png';
  radarLayer=L.tileLayer(url,{
   pane:'rtRadarPane',opacity:currentOpacity,tileSize:256,
   maxNativeZoom:7,maxZoom:19,minZoom:0,
   updateWhenZooming:false,keepBuffer:1,
   attribution:'Weather radar © RainViewer',
   className:'rt-radar-tile-layer'
  }).addTo(map);
  let radarTileErrors=0;
  radarLayer.on('tileerror',()=>{
   if(!radarOn||++radarTileErrors<4)return;
   radarStatus.textContent='Radar imagery unavailable from provider. Roads and GPS still work.';
  });
 }
 radarFramePath=frame.path;
 radarFrameTime=frame.time;
 const observed=new Date(frame.time*1000);
 const ageMinutes=Math.max(0,Math.floor((Date.now()-frame.time*1000)/60000));
 radarStatus.textContent='Radar ON · frame '+observed.toLocaleTimeString([],{
  hour:'numeric',minute:'2-digit'})+' ('+ageMinutes+' min old) · '+
  (animation!==null?'playing past frames':'auto checks ~2 min')+
  (ageMinutes>30?' · delayed radar frame':'');
}
function stopAnimation(){
 if(animation!==null){clearInterval(animation);animation=null}
 el('rtRadarAnimate').textContent='▶ Play past radar';
}
function setRadar(on){
 radarOn=on;updateToggle(toggleRadar,on,'RADAR');
 if(!on){stopAnimation();if(radarLayer){map.removeLayer(radarLayer);radarLayer=null}
  radarFramePath='';radarStatus.textContent='Radar OFF';return}
 if(radarFrames.length)radarTile(radarFrames[radarFrames.length-1]);
 loadRadar(true);
}
async function loadRadar(force=false){
 if(!radarOn||radarBusy||document.hidden)return;
 if(!navigator.onLine){radarStatus.textContent='Radar waiting for internet';return}
 const now=Date.now();
 if(!force&&now-radarLastFetch<RADAR_INTERVAL)return;
 if(now-radarLastFetch<60000)return;
 radarBusy=true;radarLastFetch=now;
 radarStatus.textContent='Radar ON · checking latest image…';
 try{
  const resp=await fetch('./api/radar',{cache:'no-store'});
  if(!resp.ok)throw Error('Radar feed '+resp.status);
  const data=await resp.json();
  if(data.host!=='https://tilecache.rainviewer.com'||!Array.isArray(data.frames))
   throw Error('Unexpected radar metadata');
  const frames=data.frames.filter(f=>Number.isSafeInteger(f.time)&&
   /^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(f.path||''));
  if(!frames.length)throw Error('No radar frames');
  if(!radarOn)return;
  radarFrames=frames;radarHost=data.host;
  if(!animation)radarTile(frames[frames.length-1]);
 }catch(e){
  if(!radarOn)return;
  if(!radarFrames.length)radarStatus.textContent='Radar unavailable · '+e.message;
  else radarStatus.textContent='Radar update unavailable · last image '+new Date(radarFrameTime*1000).toLocaleTimeString();
 }finally{radarBusy=false}
}
function aircraftIcon(record){
 const heading=record.heading===null?0:(record.heading%360+360)%360;
 return L.divIcon({className:'rt-aircraft-icon',
  html:'<span class="rt-aircraft-symbol" style="transform:rotate('+heading.toFixed(1)+'deg)">✈</span>',
  iconSize:[32,32],iconAnchor:[16,16]});
}
function aircraftPopup(item){
 const box=document.createElement('div');box.className='rt-aircraft-popup';
 const heading=document.createElement('strong');
 heading.textContent='✈ '+(item.call||item.hex||'Aircraft');box.appendChild(heading);
 box.appendChild(row('Aircraft type',item.type||'Not reported'));
 box.appendChild(row('Altitude',item.altFt===null?'Not reported':Math.round(item.altFt).toLocaleString()+' ft'));
 box.appendChild(row('Speed',item.speedKt===null?'Not reported':Math.round(item.speedKt*1.150779)+' mph'));
 box.appendChild(row('Direction',item.heading===null?'Not reported':Math.round(item.heading)+'°'));
 box.appendChild(row('Last position',item.seenSec===null?'Not reported':Math.round(item.seenSec)+' sec before snapshot'));
 box.appendChild(row('Source',airCurrentSource+' • reported aircraft, not real-time onboard GPS'));
 return box;
}
function renderAircraft(){
 listRoot.replaceChildren();
 // A stale OFF status must not survive re-enabling the aircraft layer.
 if(aircraftOn&&airStatus.textContent==='Aircraft OFF')
  airStatus.textContent='Aircraft ON · waiting for position reports…';
 if(!aircraftOn){airGroup.clearLayers();airMarkers.clear();
  airStatus.textContent='Aircraft OFF';return}
 const c=map.getCenter();
 const sorted=airRecords.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
  .map((x,i)=>({x,key:x.hex||('unknown:'+x.call+':'+i),
   dist:miles(c.lat,c.lng,x.lat,x.lon)}))
  .sort((a,b)=>a.dist-b.dist);
 const visible=sorted.slice(0,110);
 const keys=new Set();
 for(const it of visible){
  const x=it.x,key=it.key;
  keys.add(key);
  let marker=airMarkers.get(key);
  if(!marker){
   marker=L.marker([x.lat,x.lon],{
    icon:aircraftIcon(x),zIndexOffset:250,
    title:'Aircraft '+(x.call||x.hex||'unknown')}).addTo(airGroup);
   airMarkers.set(key,marker);
  }else{
   marker.setLatLng([x.lat,x.lon]);
   marker.setIcon(aircraftIcon(x));
  }
  marker.bindPopup(aircraftPopup(x),{maxWidth:310});
 }
 for(const [key,marker] of airMarkers){
  if(!keys.has(key)){airGroup.removeLayer(marker);airMarkers.delete(key)}
 }
 if(!sorted.length){listRoot.textContent='No aircraft positions reported nearby.';return}
 for(const it of sorted.slice(0,7)){
  const b=document.createElement('button');b.type='button';
  b.className='rt-aircraft-nearby';
  b.textContent='✈ '+(it.x.call||it.x.hex||'Aircraft')+' · '+it.dist.toFixed(1)+' mi'+
   (it.x.altFt!==null?' · '+Math.round(it.x.altFt).toLocaleString()+' ft':'');
  b.onclick=()=>{
   map.panTo([it.x.lat,it.x.lon],{animate:false});
   const marker=airMarkers.get(it.key);
   if(marker)marker.openPopup();
  };
  listRoot.appendChild(b);
 }
}
function setAircraft(on){
 aircraftOn=Boolean(on);updateToggle(toggleAir,aircraftOn,'AIRCRAFT');
 if(!aircraftOn){
  airGroup.clearLayers();airMarkers.clear();
  listRoot.textContent='Aircraft layer OFF';airStatus.textContent='Aircraft OFF';return;
 }
 airStatus.textContent=airBusy?'Aircraft ON · waiting for current request…':
  'Aircraft ON · checking live feed…';
 renderAircraft();
 loadAircraft(true);
}
async function loadAircraft(force=false){
 if(!aircraftOn||document.hidden)return;
 if(airBusy){
  if(airStatus.textContent==='Aircraft OFF')
   airStatus.textContent='Aircraft ON · feed request in progress…';
  return;
 }
 if(!navigator.onLine){airStatus.textContent='Aircraft ON · waiting for internet';return}
 const c=viewCenter(),now=Date.now();
 if(!force&&now-airLastFetch<AIR_INTERVAL)return;
 const minimumSpacing=force?12000:45000;
 if(now-airLastFetch<minimumSpacing){
  if(force)airStatus.textContent='Aircraft ON · retry available in '+
   Math.ceil((minimumSpacing-(now-airLastFetch))/1000)+' seconds';
  return;
 }
 airLastFetch=now;airLastCenter=c;airBusy=true;
 airStatus.textContent='Aircraft ON · updating reports…';
 try{
  const resp=await fetch('./api/aircraft?lat='+c.lat.toFixed(1)+'&lon='+c.lon.toFixed(1),{
   cache:'no-store'
  });
  if(!resp.ok){
   let detail='';
   try{
    const errorBody=await resp.json();
    detail=String(errorBody.error||'');
    if(Array.isArray(errorBody.diagnostics))
     detail+=' ['+errorBody.diagnostics.slice(0,2).join('; ')+']';
   }catch(_){}
   if(resp.status===404)throw Error('Aircraft API missing (404). Cloudflare Pages Functions may not be deployed.');
   throw Error(detail||'Website aircraft API returned HTTP '+resp.status);
  }
  const contentType=resp.headers.get('content-type')||'';
  if(!contentType.includes('json'))throw Error('Aircraft API returned a web page, not aircraft data. Check Pages Functions deployment.');
  const data=await resp.json();
  if(!Array.isArray(data.flights))throw Error('Invalid aircraft data');
  if(!Number.isFinite(data.updated)||now-data.updated>900000)throw Error('Stale aircraft snapshot');
  if(!aircraftOn)return;
  airLastSuccess=Date.now();airLastError='';airCurrentSource=data.source||'unknown';
  airRecords=data.flights.filter(x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon))
   .map(x=>({call:String(x.call||'').slice(0,20),hex:String(x.hex||'').slice(0,12),
    type:String(x.type||'').slice(0,12),lat:x.lat,lon:x.lon,
    altFt:safeNumber(x.altFt),speedKt:safeNumber(x.speedKt),
    heading:safeNumber(x.heading),seenSec:safeNumber(x.seenSec)}));
  renderAircraft();
  airStatus.textContent='Aircraft ON · '+airRecords.length+' reported via '+airCurrentSource+' · checked '+new Date(data.updated)
   .toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})+
   ' · next check ~1 min';
 }catch(e){
  // Never keep old aircraft dots under a false LIVE label.
  if(!aircraftOn)return;
  if(now-airLastSuccess>=360000||!airRecords.length){airRecords=[];renderAircraft()}
  airLastError=String(e.message||e);
  airStatus.textContent='Aircraft ON · feed unavailable: '+airLastError+' · Retrying automatically.';
 }finally{airBusy=false}
}
const autoButton=el('rtAutoToggle');
function setAuto(on){
 autoEnabled=Boolean(on);
 autoButton.textContent=autoEnabled?'⟳ AUTO: ON':'⏸ AUTO: OFF';
 autoButton.setAttribute('aria-pressed',String(autoEnabled));
 if(autoEnabled){loadAircraft();loadRadar()}
}
autoButton.addEventListener('click',()=>setAuto(!autoEnabled));
toggleAir.addEventListener('click',()=>setAircraft(!aircraftOn));
toggleRadar.addEventListener('click',()=>setRadar(!radarOn));
el('rtRadarOpacity').addEventListener('input',e=>{
 currentOpacity=Number(e.target.value)/100;
 el('rtRadarOpacityValue').textContent=Math.round(currentOpacity*100)+'%';
 if(radarLayer)radarLayer.setOpacity(currentOpacity);
});
el('rtRadarAnimate').addEventListener('click',()=>{
 if(animation!==null){stopAnimation();if(radarFrames.length)radarTile(radarFrames[radarFrames.length-1]);return}
 if(!radarOn||radarFrames.length<2)return;
 animationIndex=Math.max(0,radarFrames.length-6);
 el('rtRadarAnimate').textContent='⏸ Pause radar';
 animation=setInterval(()=>{
  if(document.hidden||!radarOn){stopAnimation();return}
  radarTile(radarFrames[animationIndex]);
  animationIndex=animationIndex+1>=radarFrames.length?Math.max(0,radarFrames.length-6):animationIndex+1;
 },1700);
});
el('rtLayersRefresh').addEventListener('click',()=>{
 loadAircraft(true);loadRadar(true);
});
let lastPanning=0;
map.on('moveend',()=>{
 if(!aircraftOn||!autoEnabled)return;
 renderAircraft();
 const c=viewCenter();
 if(airLastCenter&&miles(c.lat,c.lon,airLastCenter.lat,airLastCenter.lon)>30&&
  Date.now()-airLastFetch>=AIR_INTERVAL){loadAircraft(true)}
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopAnimation();
 else if(autoEnabled){loadAircraft();loadRadar()}
});
window.addEventListener('online',()=>{if(autoEnabled){loadAircraft(true);loadRadar(true)}});
window.addEventListener('pageshow',()=>{if(autoEnabled&&!document.hidden){loadAircraft();loadRadar()}});
window.setInterval(()=>{
 if(document.hidden||!autoEnabled)return;
 if(aircraftOn)loadAircraft();
 if(radarOn)loadRadar();
},15000);
window.RoadtowerLiveLayers={
 getState:()=>({aircraft:aircraftOn,radar:radarOn,autoRefresh:autoEnabled,
  aircraftCheckIntervalMs:AIR_INTERVAL,radarCheckIntervalMs:RADAR_INTERVAL,
  planes:airRecords.length,airLastSuccess,airLastError,airCurrentSource,radarFrameTime}),
 setAircraft,setRadar,setAuto
};
// Both layers turn ON on each fresh launch. No saved OFF preference suppresses
// them on the next startup; the user can disable them during this session.
updateToggle(toggleAir,true,'AIRCRAFT');updateToggle(toggleRadar,true,'RADAR');setAuto(true);
loadRadar(true);
loadAircraft(true);
})();
