/* Roadtower independent live map overlays.
   These optional ONLINE layers default ON every launch. They do not replace
   the HAM/GMRS group or the user's high-priority visual SOS GPS marker.
   Aircraft: © adsb.lol contributors (ODbL 1.0), 3-minute snapshots.
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
 '<button type="button" id="rtLayersRefresh">↻ Update</button></div>'+
 '<div class="rt-live-nearest"><strong>✈ Aircraft near map</strong>'+
 '<div id="rtAircraftList" class="rt-live-air-list">Waiting for aircraft reports…</div></div>'+
 '<div class="rt-live-credit">Aircraft © adsb.lol contributors (ODbL) · Radar © RainViewer<br>'+
 'Aircraft data are delayed reports; positions can be missing. Radar shows recent rain, not a forecast.'+
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
let aircraftOn=true,radarOn=true,airRecords=[],airLastFetch=0,airLastCenter=null;
let airBusy=false,radarBusy=false,radarFrames=[],radarHost='',radarLayer=null;
let radarFrameTime=0,radarLastFetch=0,animation=null,animationIndex=0;
const RADAR_OPACITY=.30, AIR_INTERVAL=180000, RADAR_INTERVAL=300000;
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
 if(radarLayer){map.removeLayer(radarLayer);radarLayer=null}
 const url=radarHost+frame.path+'/256/{z}/{x}/{y}/2/1_1.png';
 radarLayer=L.tileLayer(url,{
  pane:'rtRadarPane',opacity:currentOpacity,tileSize:256,
  maxNativeZoom:7,maxZoom:19,minZoom:0,
  updateWhenZooming:false,keepBuffer:1,
  attribution:'Weather radar © RainViewer',
  className:'rt-radar-tile-layer'
 }).addTo(map);
 radarFrameTime=frame.time;
 const observed=new Date(frame.time*1000);
 radarStatus.textContent='Radar ON · observed '+observed.toLocaleTimeString([],{
  hour:'numeric',minute:'2-digit'})+' · recent precipitation (not a forecast)';
}
function stopAnimation(){
 if(animation!==null){clearInterval(animation);animation=null}
 el('rtRadarAnimate').textContent='▶ Play past radar';
}
function setRadar(on){
 radarOn=on;updateToggle(toggleRadar,on,'RADAR');
 if(!on){stopAnimation();if(radarLayer){map.removeLayer(radarLayer);radarLayer=null}
  radarStatus.textContent='Radar OFF';return}
 if(radarFrames.length)radarTile(radarFrames[radarFrames.length-1]);
 else loadRadar(true);
}
async function loadRadar(force=false){
 if(!radarOn||radarBusy||document.hidden)return;
 if(!navigator.onLine){radarStatus.textContent='Radar waiting for internet';return}
 if(!force&&Date.now()-radarLastFetch<RADAR_INTERVAL)return;
 radarBusy=true;radarLastFetch=Date.now();
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
  radarFrames=frames;radarHost=data.host;
  if(!animation)radarTile(frames[frames.length-1]);
 }catch(e){
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
 box.appendChild(row('Source','adsb.lol • reported aircraft, not live onboard GPS'));
 return box;
}
function renderAircraft(){
 airGroup.clearLayers();listRoot.replaceChildren();
 if(!aircraftOn){airStatus.textContent='Aircraft OFF';return}
 const c=map.getCenter();
 const sorted=airRecords.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
  .map(x=>({x,dist:miles(c.lat,c.lng,x.lat,x.lon)}))
  .sort((a,b)=>a.dist-b.dist);
 for(const item of sorted.slice(0,110)){
  const m=L.marker([item.x.lat,item.x.lon],{
   icon:aircraftIcon(item.x),zIndexOffset:250,
   title:'Aircraft '+(item.x.call||item.x.hex||'unknown')});
  m.bindPopup(aircraftPopup(item.x),{maxWidth:310});
  m.addTo(airGroup);
 }
 if(!sorted.length){listRoot.textContent='No aircraft positions reported nearby.';return}
 for(const it of sorted.slice(0,7)){
  const b=document.createElement('button');b.type='button';
  b.className='rt-aircraft-nearby';
  b.textContent='✈ '+(it.x.call||it.x.hex||'Aircraft')+' · '+it.dist.toFixed(1)+' mi'+
   (it.x.altFt!==null?' · '+Math.round(it.x.altFt).toLocaleString()+' ft':'');
  b.onclick=()=>{
   map.panTo([it.x.lat,it.x.lon],{animate:false});
   const layers=airGroup.getLayers();
   const marker=layers.find(m=>m.getLatLng&&
    Math.abs(m.getLatLng().lat-it.x.lat)<.00001&&Math.abs(m.getLatLng().lng-it.x.lon)<.00001);
   if(marker)marker.openPopup();
  };
  listRoot.appendChild(b);
 }
}
function setAircraft(on){
 aircraftOn=on;updateToggle(toggleAir,on,'AIRCRAFT');
 if(!on){airGroup.clearLayers();listRoot.textContent='Aircraft layer OFF';airStatus.textContent='Aircraft OFF';return}
 renderAircraft();
 if(!airRecords.length)loadAircraft(true);
}
async function loadAircraft(force=false){
 if(!aircraftOn||airBusy||document.hidden)return;
 if(!navigator.onLine){airStatus.textContent='Aircraft waiting for internet';return}
 const c=viewCenter(),now=Date.now();
 if(!force&&now-airLastFetch<AIR_INTERVAL)return;
 // Prevent accidental hammering the provider via tapping Refresh or panning.
 if(now-airLastFetch<45000)return;
 airLastFetch=now;airLastCenter=c;airBusy=true;
 airStatus.textContent='Aircraft ON · updating reports…';
 try{
  const resp=await fetch('./api/aircraft?lat='+c.lat.toFixed(1)+'&lon='+c.lon.toFixed(1),{
   cache:'no-store'
  });
  if(!resp.ok)throw Error('Aircraft feed '+resp.status);
  const data=await resp.json();
  if(!Array.isArray(data.flights))throw Error('Invalid aircraft data');
  if(!Number.isFinite(data.updated)||now-data.updated>900000)throw Error('Stale aircraft snapshot');
  airRecords=data.flights.filter(x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon))
   .map(x=>({call:String(x.call||'').slice(0,20),hex:String(x.hex||'').slice(0,12),
    type:String(x.type||'').slice(0,12),lat:x.lat,lon:x.lon,
    altFt:safeNumber(x.altFt),speedKt:safeNumber(x.speedKt),
    heading:safeNumber(x.heading),seenSec:safeNumber(x.seenSec)}));
  renderAircraft();
  airStatus.textContent='Aircraft ON · '+airRecords.length+' reported · '+new Date(data.updated)
   .toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+
   ' · refresh ~3 min';
 }catch(e){
  // Never keep old aircraft dots under a false LIVE label.
  if(now-airLastFetch>=900000||!airRecords.length){airRecords=[];renderAircraft()}
  airStatus.textContent='Aircraft data unavailable · '+e.message;
 }finally{airBusy=false}
}
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
 if(!aircraftOn)return;
 renderAircraft();
 const c=viewCenter();
 if(airLastCenter&&miles(c.lat,c.lon,airLastCenter.lat,airLastCenter.lon)>30&&
  Date.now()-airLastFetch>=120000){loadAircraft(true)}
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopAnimation();
 else{loadAircraft();loadRadar()}
});
window.addEventListener('online',()=>{loadAircraft(true);loadRadar(true)});
window.setInterval(()=>{
 if(document.hidden)return;
 if(aircraftOn)loadAircraft();
 if(radarOn)loadRadar();
},60000);
window.RoadtowerLiveLayers={
 getState:()=>({aircraft:aircraftOn,radar:radarOn,planes:airRecords.length,radarFrameTime}),
 setAircraft,setRadar
};
// Both layers turn ON on each fresh launch. No saved OFF preference suppresses
// them on the next startup; the user can disable them during this session.
updateToggle(toggleAir,true,'AIRCRAFT');updateToggle(toggleRadar,true,'RADAR');
loadRadar(true);
loadAircraft(true);
})();
