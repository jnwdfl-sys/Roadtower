/* ROADTOWER offline travel map packs.
   Stores compact OSM road/place geometries in IndexedDB (not public OSM raster tiles).
   Offline maps are orientation aids, NOT navigation or verified turn-by-turn routes.
   OSM data © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright
*/
(function(){
'use strict';
const bridge=window.RoadtowerRepeaters;
const map=bridge&&bridge.getMap&&bridge.getMap();
if(!map||!window.L)return;
const $=id=>document.getElementById(id);
const card=$('offlineTravelCard');
if(!card)return;
const STORE='roadtower-offline-roads',STORE_VERSION=1;
const MAX_PACKS=25,MAX_ROADS=22000,MAX_POINTS=650000;
const OVERPASS_ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter'
];
let packs=[],mode=localStorage.getItem('roadtower.offlineMaps.mode')||'auto';
if(!['auto','online','offline'].includes(mode))mode='auto';
let useOffline=false,downloadBusy=false,requestFailures=0,forceOffline=false;
let packLayer=L.layerGroup().addTo(map),canvasRenderer=L.canvas({padding:0.5});
let activeKeys='',lastRenderTimeout=0;
const tiles=map.eachLayer?(()=>{let found=null;map.eachLayer(l=>{if(l instanceof L.TileLayer&&!found)found=l});return found})():null;
const beforeUnload=()=>{if(downloadBusy)return 'Map download in progress'};
window.addEventListener('beforeunload',e=>{if(beforeUnload()){e.preventDefault();e.returnValue=''}});
function updateCard(msg){if(msg)$('offlineTravelStatus').textContent=msg}
function distance(a,b){
 const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lng-a.lng)*rad;
 const v=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(STORE,STORE_VERSION);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('packs'))req.result.createObjectStore('packs',{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Offline map storage unavailable'));
 });
}
async function getPacks(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('packs','readonly');
  const req=tx.objectStore('packs').getAll();
  req.onsuccess=()=>resolve(req.result||[]);
  req.onerror=()=>reject(req.error||Error('Unable to read saved offline maps'));
  tx.oncomplete=()=>db.close();
 });
}
async function savePack(pack){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('packs','readwrite');
  tx.objectStore('packs').put(pack);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=()=>reject(tx.error||Error('Unable to save offline map'));
 });
}
async function deletePack(id){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('packs','readwrite');
  tx.objectStore('packs').delete(id);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=()=>reject(tx.error||Error('Unable to delete offline map'));
 });
}
function roadClass(v){
 if(['motorway','motorway_link','trunk','trunk_link'].includes(v))return 'highway';
 if(['primary','primary_link'].includes(v))return 'primary';
 if(['secondary','secondary_link'].includes(v))return 'secondary';
 if(['tertiary','tertiary_link','unclassified'].includes(v))return 'tertiary';
 if(['residential','living_street'].includes(v))return 'local';
 if(['service'].includes(v))return 'service';
 if(['track','path','footway','cycleway','bridleway','pedestrian','steps'].includes(v))return 'trail';
 return null;
}
function normalize(raw,center,radius,name,id){
 if(!raw||!Array.isArray(raw.elements))throw Error('Road download did not return valid OpenStreetMap data.');
 const roads=[],towns=[];
 let points=0;
 for(const e of raw.elements){
  const t=e.tags||{};
  if(e.type==='way'){
   const cls=roadClass(t.highway||'');
   if(!cls||!Array.isArray(e.geometry))continue;
   const c=e.geometry.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180).map(p=>[p.lat,p.lon]);
   if(c.length<2)continue;
   roads.push({k:cls,c:c,n:String(t.name||t.ref||'').slice(0,80)});
   points+=c.length;
   if(roads.length>MAX_ROADS||points>MAX_POINTS)throw Error('Too much road data for this area. Try 5 or 10 miles instead.');
  }else if(e.type==='node'&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&t.place){
   towns.push({a:e.lat,b:e.lon,n:String(t.name||'').slice(0,60),k:String(t.place).slice(0,20)});
  }
 }
 if(!roads.length)throw Error('No roads were returned. Try another area or a smaller radius.');
 return {id:id||('area-'+Date.now()),name:name.slice(0,65),center:center,radius:radius,roads:roads,towns:towns.slice(0,250),
  savedAt:Date.now(),version:1,featureCount:roads.length,pointCount:points,source:'OpenStreetMap via Overpass'};
}
function osmQuery(center,radiusMiles){
 const radius=Math.round(radiusMiles*1609.344);
 const lat=center.lat.toFixed(5),lon=center.lng.toFixed(5);
 // Request road and town geometries; never download OSM public raster tile batches.
 return '[out:json][timeout:55][maxsize:67108864];'+
  '(way["highway"](around:'+radius+','+lat+','+lon+');'+
  'node["place"~"^(city|town|village|hamlet)$"](around:'+radius+','+lat+','+lon+'););out geom;';
}
async function fetchRoads(center,radius){
 if(!navigator.onLine)throw Error('Connect to Wi-Fi or mobile internet before downloading a new area.');
 const query=osmQuery(center,radius);
 let lastError='Overpass service unavailable';
 for(const url of OVERPASS_ENDPOINTS){
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:'data='+encodeURIComponent(query)});
   if(!res.ok)throw Error('Map service returned HTTP '+res.status);
   if(Number(res.headers.get('Content-Length')||0)>75*1024*1024)throw Error('Area is too large for phone storage');
   const text=await res.text();
   if(text.length>75*1024*1024)throw Error('Area is too large for phone storage');
   return JSON.parse(text);
  }catch(e){lastError=e.message}
 }
 throw Error(lastError+'. Try smaller radius or another time.');
}
function styleFor(k){
 switch(k){
  case 'highway':return {color:'#d26f7a',weight:5,opacity:.95};
  case 'primary':return {color:'#e6a359',weight:4,opacity:.95};
  case 'secondary':return {color:'#edc574',weight:3.5,opacity:.95};
  case 'tertiary':return {color:'#c7ad7b',weight:3,opacity:.9};
  case 'local':return {color:'#a9b6aa',weight:2,opacity:.9};
  case 'service':return {color:'#bfcac0',weight:1.5,opacity:.85};
  default:return {color:'#71a891',weight:1.7,opacity:.85,dashArray:'4 5'};
 }
}
function zoomCategory(){return map.getZoom()<10?'major':map.getZoom()<12?'medium':'all'}
function inBounds(pack,b){
 const dlat=pack.radius/69+0.015;
 const dlon=pack.radius/(69*Math.max(.25,Math.cos(pack.center.lat*Math.PI/180)))+0.015;
 return b.intersects(L.latLngBounds([pack.center.lat-dlat,pack.center.lng-dlon],[pack.center.lat+dlat,pack.center.lng+dlon]));
}
function renderSavedRoads(force=false){
 if(!useOffline){if(activeKeys){packLayer.clearLayers();activeKeys=''}return}
 const visible=packs.filter(p=>inBounds(p,map.getBounds())).slice(0,7);
 const zoom=zoomCategory(),key=visible.map(p=>p.id+'@'+p.savedAt).join('|')+'-'+zoom;
 if(!force&&activeKeys===key)return;
 activeKeys=key;
 packLayer.clearLayers();
 const allowed=zoom==='major'?new Set(['highway','primary','secondary']):zoom==='medium'?
  new Set(['highway','primary','secondary','tertiary']):null;
 let drawn=0,lines=0;
 for(const pack of visible){
  for(const road of pack.roads){
   if(allowed&&!allowed.has(road.k))continue;
   const shape=L.polyline(road.c,{...styleFor(road.k),renderer:canvasRenderer,interactive:false}).addTo(packLayer);
   lines+=1;drawn+=road.c.length;
  }
  if(map.getZoom()>=9){
   for(const town of pack.towns){
    if(!town.n)continue;
    const marker=L.circleMarker([town.a,town.b],{radius:2,color:'#21546e',weight:1,
      fillColor:'#21546e',fillOpacity:.85,interactive:false,renderer:canvasRenderer}).addTo(packLayer);
    const text=document.createElement('span');text.textContent=town.n;
    marker.bindTooltip(text,{permanent:true,interactive:false,opacity:.9,
      direction:'top',className:'rt-town-tooltip'});
   }
  }
 }
 if(!visible.length)updateCard('Outside your saved areas. Pan to a downloaded area or save another area while online.');
 else updateCard('OFFLINE ROADS ACTIVE • '+visible.length+' saved area(s) on screen • '+lines.toLocaleString()+
   ' road segments. GPS and repeaters work without data.');
}
function scheduleRender(){if(lastRenderTimeout)clearTimeout(lastRenderTimeout);lastRenderTimeout=setTimeout(()=>{lastRenderTimeout=0;renderSavedRoads()},180)}
function selectedMode(){if(mode==='offline')return true;if(mode==='online')return false;return !navigator.onLine||forceOffline}
function emitState(){
 window.dispatchEvent(new CustomEvent('roadtower:offline-map-status',{detail:{ready:packs.length>0,mode:mode,usingOffline:useOffline,count:packs.length}}));
}
function setMapMode(why){
 const offline=selectedMode();
 if(offline!==useOffline){
  useOffline=offline;
  if(useOffline){
   if(tiles&&map.hasLayer(tiles))map.removeLayer(tiles);
   $('map').classList.add('rt-offline-base');
   map.attributionControl.addAttribution('Offline roads &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
  }else{
   $('map').classList.remove('rt-offline-base');
   if(tiles&&!map.hasLayer(tiles))tiles.addTo(map);
   map.attributionControl.removeAttribution('Offline roads &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
   packLayer.clearLayers();activeKeys='';
  }
 }
 if(useOffline)renderSavedRoads(true);
 const label=useOffline?'OFFLINE ROADS':mode==='auto'?'AUTO ONLINE':'ONLINE MAP';
 $('offlineMode').value=mode;
 $('offlineQuickMode').textContent='Map: '+label;
 $('offlineModeSummary').textContent='Map mode: '+label+' • '+packs.length+' saved area(s).';
 emitState();
 if(why)updateCard(why);
 map.invalidateSize({pan:false});
}
function chooseMode(newMode){
 mode=newMode;forceOffline=false;
 try{localStorage.setItem('roadtower.offlineMaps.mode',mode)}catch(e){}
 setMapMode('Mode selected: '+mode+'. '+(mode==='auto'?'Roadtower switches to downloaded roads when network is unavailable.':''));
}
function packTitle(p){return p.name+' • '+p.radius+' mi radius • '+p.featureCount.toLocaleString()+' roads • '+new Date(p.savedAt).toLocaleDateString()}
function renderList(){
 const list=$('offlineAreaList');list.replaceChildren();
 $('offlinePackCount').textContent=packs.length+' saved '+(packs.length===1?'area':'areas')+' • available without internet';
 if(!packs.length){
  const t=document.createElement('p');t.textContent='No travel maps saved yet. Download your first area while connected.';t.className='hint';list.appendChild(t);return;
 }
 for(const p of packs.slice().sort((a,b)=>b.savedAt-a.savedAt)){
  const row=document.createElement('div');row.className='rt-saved-area';
  const title=document.createElement('strong');title.textContent=packTitle(p);
  const actions=document.createElement('div');actions.className='buttons';
  const view=document.createElement('button');view.textContent='Open offline';view.type='button';
  view.onclick=()=>{chooseMode('offline');map.setView([p.center.lat,p.center.lng],Math.max(11,map.getZoom()));$('map').scrollIntoView({behavior:'smooth'});renderSavedRoads(true)};
  const update=document.createElement('button');update.textContent='Update roads';update.type='button';update.className='secondary';
  update.onclick=()=>downloadArea(p);
  const remove=document.createElement('button');remove.textContent='Delete';remove.type='button';remove.className='secondary';
  remove.onclick=async()=>{
   if(!confirm('Delete the offline map for '+p.name+'?'))return;
   try{await deletePack(p.id);packs=packs.filter(x=>x.id!==p.id);activeKeys='';renderSavedRoads(true);renderList();setMapMode('Offline area removed.');}
   catch(e){updateCard('Unable to delete: '+e.message)}
  };
  actions.append(view,update,remove);row.append(title,actions);list.appendChild(row);
 }
}
async function downloadArea(existing){
 if(downloadBusy)return;
 if(!existing&&packs.length>=MAX_PACKS){updateCard('Limit of '+MAX_PACKS+' saved areas reached. Delete an older area first.');return}
 const radius=existing?existing.radius:Number($('offlineRadius').value);
 let center;
 if(existing)center=existing.center;
 else if($('offlineSource').value==='gps'){
  const c=bridge.getGps&&bridge.getGps();
  if(!c){updateCard('Start Live GPS first, or choose Map center instead.');return}
  center={lat:c.latitude,lng:c.longitude};
 }else{const c=map.getCenter();center={lat:c.lat,lng:c.lng}}
 if(!center||!Number.isFinite(center.lat)||!Number.isFinite(center.lng))return;
 if(![5,10,20].includes(radius))return;
 const name=existing?existing.name:($('offlineName').value.trim()||('Travel area '+center.lat.toFixed(2)+', '+center.lng.toFixed(2)));
 downloadBusy=true;$('offlineDownload').disabled=true;
 updateCard('Downloading roads and town names for '+name+' ('+radius+' mile radius). Keep this page open. This may take time in busy cities.');
 try{
  const raw=await fetchRoads(center,radius);
  const pack=normalize(raw,center,radius,name,existing?existing.id:null);
  await savePack(pack);
  if(existing)packs=packs.filter(x=>x.id!==existing.id);
  packs.push(pack);activeKeys='';renderList();
  updateCard('SAVED OFFLINE: '+packTitle(pack)+'. You can now switch to Offline and test airplane mode.');
  if(useOffline)renderSavedRoads(true);
  emitState();
 }catch(e){updateCard('Download failed: '+e.message+'. Existing saved maps are unchanged.')}
 finally{downloadBusy=false;$('offlineDownload').disabled=false}
}
$('offlineDownload').onclick=()=>downloadArea(null);
$('offlineMode').onchange=e=>chooseMode(e.target.value);
$('offlineQuickMode').onclick=()=>chooseMode(mode==='auto'?'offline':mode==='offline'?'online':'auto');
$('offlineRefreshMode').onclick=()=>{forceOffline=false;requestFailures=0;setMapMode('Map connection rechecked using the phone network status.')};
$('offlineSource').onchange=()=>{
 $('offlineSourceHelp').textContent=$('offlineSource').value==='gps'?
 'Downloads around your phone GPS position (GPS must be active).':
 'Pan the online map to the city or travel stop, then download roads around map center.';
};
map.on('moveend zoomend',scheduleRender);
if(tiles){
 tiles.on('tileerror',()=>{
  if(!useOffline&&mode==='auto'&&++requestFailures>=4){
   forceOffline=true;
   setMapMode('Online map tiles failed to load; switched to saved offline roads. Use Retry Online to check again.');
  }
 });
 tiles.on('tileload',()=>{requestFailures=0});
}
window.addEventListener('online',()=>{forceOffline=false;requestFailures=0;setMapMode('Network available; offline areas remain safely stored on your device.')});
window.addEventListener('offline',()=>setMapMode('No network detected. Showing saved offline roads when available.'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setMapMode()});
window.RoadtowerOfflineMaps={getPackCount:()=>packs.length,getState:()=>({mode:mode,offline:useOffline,count:packs.length}),toggle:()=>$('offlineQuickMode').click()};
(async()=>{
 try{
  packs=await getPacks();
  renderList();
  setMapMode('Offline map storage ready. '+packs.length+' area(s) saved. To download a trip area, choose GPS or Map center.');
 }catch(e){
  updateCard('Offline storage error: '+e.message+'. Chrome storage must be enabled for offline travel maps.');
  setMapMode();
 }
})();
})();