/* ROADTOWER: offline U.S. 2-meter repeater directory.
   HearHam directory: https://hearham.com/repeaters (free for use in apps).
   Listings are user-contributed, locations approximate, and must be checked before transmitting.
*/
(function(){
'use strict';
var API=window.RoadtowerRepeaters;
var map=API&&API.getMap&&API.getMap();
if(!map||!window.L)return;
var HOST=document.getElementById('map');
var SOURCE='https://hearham.com/api/repeaters/v1';
var panel=document.createElement('aside');
panel.className='rt-repeater-panel';
panel.setAttribute('aria-label','2-meter repeater directory');
panel.innerHTML=
 '<div class="rt-head"><strong>📡 2m Repeaters</strong><button id="rtHide" type="button">Hide</button></div>'+
 '<div id="rtContent"><div class="rt-muted" id="rtCount">Loading saved repeaters…</div>'+
 '<div class="rt-closest" id="rtClosest">Start Live GPS for nearest repeater.</div>'+
 '<div class="rt-details" id="rtDetails">Select a repeater to see radio settings.</div>'+
 '<div class="rt-buttons"><button id="rtAuto" type="button">Follow nearest: ON</button><button id="rtWide" type="button">★ KC Wide: All</button></div>'+
 '<div class="rt-muted">Nearest repeaters • straight-line miles</div><div id="rtNearby"></div>'+
 '<div class="rt-muted">JCRAC club-confirmed local sites (approximate map pins)</div><div id="rtVerifiedLocal" class="rt-local-links"></div>'+
 '<div class="rt-buttons"><button id="rtAddCustom" type="button">+ Add missing repeater</button></div>'+
 '<form id="rtCustomForm" class="rt-custom-form" hidden>'+
 '<label>Callsign or name<input id="rtNewCall" maxlength="70" placeholder="Example W0ABC" required></label>'+
 '<label>Output frequency, MHz<input id="rtNewFreq" type="number" min="144" max="148" step="0.0001" placeholder="145.290" required></label>'+
 '<label>Offset, MHz<input id="rtNewOffset" type="number" min="-5" max="5" step="0.001" value="-0.600"></label>'+
 '<label>Access tone, Hz<input id="rtNewTone" maxlength="40" placeholder="151.4"></label>'+
 '<label>City / tower name<input id="rtNewCity" maxlength="85" placeholder="Town / water tower"></label>'+
 '<label>Latitude<input id="rtNewLat" type="number" min="-90" max="90" step="0.000001" required></label>'+
 '<label>Longitude<input id="rtNewLon" type="number" min="-180" max="180" step="0.000001" required></label>'+
 '<div class="rt-buttons"><button id="rtUseCenter" type="button">Use map center</button><button type="submit">Save repeater offline</button></div>'+
 '<div class="rt-muted">Coordinates must be for the repeater, not necessarily where you are. Pan to a tower, use Map center, and verify the location. Added stations stay stored when the nationwide directory updates.</div>'+
 '</form><div id="rtMyStations"></div>'+
 '<div class="rt-buttons"><button id="rtDownload" type="button">Download USA 2m list</button><button id="rtImport" type="button">Import JSON file</button></div>'+
 '<input type="file" accept=".json,application/json" id="rtFile" hidden>'+
 '<div class="rt-muted" id="rtFeedback">Save the directory once while online, then GPS and distances work offline. Streets need separate offline map data.</div>'+
 '<a id="rtSource" href="https://hearham.com/api/repeaters/v1" rel="noopener noreferrer" target="_blank">HearHam JSON download (manual backup)</a>'+
 '<div class="rt-muted">Data: HearHam, user-contributed. ★ KC Wide from the 2026-10-30 published roster or matching network metadata; not a live link indicator. Check radio programming and coverage before use.</div><a href="https://www.kansascityroom-wide.com/repeater-list/" target="_blank" rel="noopener noreferrer">KC Wide official repeater roster</a></div>';
HOST.appendChild(panel);
var hud=document.createElement('div');
hud.id='rtStatusHUD';
hud.className='rt-status-hud';
hud.setAttribute('role','group');
hud.setAttribute('aria-label','Live connection and offline readiness indicators');
hud.innerHTML=
 '<div id="rtNetStatus" class="rt-status rt-state-neutral">● NETWORK: Checking</div>'+
 '<div id="rtDataStatus" class="rt-status rt-state-neutral">● REPEATERS: Checking</div>'+
 '<div id="rtGpsStatus" class="rt-status rt-state-neutral">● GPS: Not active</div>'+
 '<div id="rtMapStatus" class="rt-status rt-state-warn">● MAP: Online tiles</div>';
HOST.appendChild(hud);
L.DomEvent.disableClickPropagation(panel);
L.DomEvent.disableScrollPropagation(panel);
var el=function(id){return panel.querySelector('#'+id)};
// Club operating details verified against https://www.w0erh.org/about-us/repeaters
// Locations approximate INTERSECTIONS, not surveyed transmitter positions.
var LOCAL_CLUB=[
 {id:'jcrac-w0erh-145290',call:'W0ERH',mhz:145.290,lat:38.9700,lon:-94.6865,
  tx:144.690,offset:-0.600,tone:'151.4 Hz',mode:'FM / DMR',
  city:'Near 87th St & Antioch (Central Resource Library area)',state:'KS',wide:false,
  notes:'Johnson County Radio Amateurs Club. Approximate intersection marker, not confirmed transmitter coordinates. Not linked to KC Wide.',
  source:'JCRAC official club site',officialLocal:true,approx:true},
 {id:'jcrac-wb0hac-145210',call:'WB0HAC',mhz:145.210,lat:39.0110,lon:-94.7230,
  tx:144.610,offset:-0.600,tone:'151.4 Hz',mode:'FM / DMR',
  city:'Near 65th St & Quivira Rd, Shawnee',state:'KS',wide:false,
  notes:'Maintained by JCRAC for SRACT. Club describes 65th & Quivira cell tower, not a water tower. Approximate map position, not surveyed coordinates. Not linked to KC Wide.',
  source:'JCRAC official club site',officialLocal:true,approx:true}
];
var data=[],customRecords=[],selected=null,follow=true,wideOnly=false,directoryState='loading',markers=L.layerGroup().addTo(map);
function getAllStations(){
 var combined=[...customRecords,...LOCAL_CLUB,...data],answer=[],seen=new Map();
 for(var i=0;i<combined.length;i++){
  var x=combined[i],key=x.call.toUpperCase()+'|'+x.mhz.toFixed(4);
  var group=seen.get(key)||[];
  if(group.some(old=>Math.abs(old.lat-x.lat)<.25&&Math.abs(old.lon-x.lon)<.25))continue;
  group.push(x);seen.set(key,group);answer.push(x);
 }
 return answer;
}
function setIndicator(id,kind,message,help){
 var indicator=hud.querySelector('#'+id);
 if(!indicator)return;
 indicator.className='rt-status rt-state-'+kind;
 indicator.textContent='● '+message;
 indicator.title=help;
}
function updateStatuses(){
 var online=navigator.onLine;
 setIndicator('rtNetStatus',online?'good':'bad',
  'NETWORK: '+(online?'ONLINE*':'OFFLINE'),
  online?'Device reports a network connection; actual internet access is not guaranteed.':'Device reports no network connection.');
 var ready=(directoryState==='ready'&&data.length>0)||getAllStations().length>0;
 var directoryText=ready?'SAVED '+getAllStations().length.toLocaleString():(directoryState==='loading'?'CHECKING':directoryState==='error'?'STORAGE ERROR':'NOT SAVED');
 setIndicator('rtDataStatus',ready?'good':directoryState==='loading'?'neutral':'bad',
  'REPEATERS: '+directoryText,
  ready?'Directory saved on this device for offline use.':'Download the directory online before using it offline.');
 var gps=API.getGps&&API.getGps();
 setIndicator('rtGpsStatus',gps?'good':'neutral',
  'GPS: '+(gps?'LIVE':'OFF'),
  gps?'Updating distances as browser GPS reports new positions.':'Tap Start Live GPS to calculate distances from your location.');
 var m=window.RoadtowerOfflineMaps&&window.RoadtowerOfflineMaps.getState&&window.RoadtowerOfflineMaps.getState();
 var count=m?m.count:0;
 var using=m&&m.offline;
 setIndicator('rtMapStatus',using?(count?'good':'bad'):(count?'good':online?'warn':'bad'),
  using?(count?'MAP: OFFLINE ROADS':'MAP: NO SAVED ROADS'):(count?'MAP: '+count+' AREA'+(count===1?'':'S')+' SAVED':online?'MAP: ONLINE TILES':'MAP: NO OFFLINE MAP'),
  count?'Roads saved for '+count+' travel area(s); use Map: Offline Roads when disconnected. Not turn-by-turn directions.':
    'Download offline road areas before traveling. Online OSM street tiles cannot be bulk downloaded.');
}
window.addEventListener('online',updateStatuses);
window.addEventListener('offline',updateStatuses);
window.addEventListener('roadtower:offline-map-status',updateStatuses);
document.addEventListener('visibilitychange',function(){if(!document.hidden)updateStatuses()});
updateStatuses();
var line=L.polyline([],{color:'#ffdf78',weight:2.5,opacity:.95,dashArray:'3 11',interactive:false}).addTo(map);
var middle=null, label=null, lastDraw=0, loading=false;
function number(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:NaN}
function first(r,fields){for(var i=0;i<fields.length;i++){var v=r[fields[i]];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return ''}
function readMHz(v){
 var n=number(v);
 if(!isFinite(n))return NaN;
 if(n>10000000)n/=1000000;
 else if(n>10000)n/=1000;
 return n;
}
function isUS(lat,lon){
 return (lat>=24&&lat<=50&&lon>=-125&&lon<=-66)||
 (lat>=50&&lat<=72&&lon>=-171&&lon<=-129)||
 (lat>=18&&lat<=23&&lon>=-162&&lon<=-154)||
 (lat>=17&&lat<=19&&lon>=-69&&lon<=-64)||
 (lat>=12&&lat<=15&&lon>=144&&lon<=146)||
 (lat>=-15&&lat<=-11&&lon>=-172&&lon<=-168);
}
function normalize(r,index){
 if(!r||typeof r!=='object')return null;
 var lat=number(first(r,['latitude','lat','site_latitude','site_lat'])),
     lon=number(first(r,['longitude','lng','lon','long','site_longitude','site_lon']));
 var mhz=readMHz(first(r,['frequency','output','output_frequency','frequency_mhz','rx_frequency','receive_frequency','rx','freq']));
 if(!isFinite(lat)||!isFinite(lon)||!isUS(lat,lon)||!isFinite(mhz)||mhz<144||mhz>148)return null;
 var country=String(first(r,['country','country_code','countryCode'])).toLowerCase();
 if(country&&!/^(us|usa|u\.s\.a\.|united states|united states of america)$/i.test(country))return null;
 var placeText=String(first(r,['city','nearestcity','nearest_city','location','town','locality'])||'');
 if(!country&&/\b(Canada|Mexico|United Kingdom|Australia|Germany)\b/i.test(placeText))return null;
 var call=String(first(r,['callsign','call_sign','call','repeater_callsign','name'])||'Unlisted').trim().slice(0,70);
 var offset=number(first(r,['offset','shift','frequency_offset','offset_mhz']));
 if(isFinite(offset)&&Math.abs(offset)>10000)offset/=1000000;
 else if(isFinite(offset)&&Math.abs(offset)>50)offset/=1000;
 if(isFinite(offset)&&Math.abs(offset)>5)offset=NaN; // Reject implausible 2m shifts rather than showing unsafe radio settings.
 var tx=readMHz(first(r,['input','input_frequency','tx_frequency','transmit_frequency','tx']));
 if(!isFinite(tx)||tx<130||tx>170)tx=NaN;
 if(!isFinite(tx)&&isFinite(offset))tx=mhz+offset;
 var city=String(first(r,['city','nearestcity','nearest_city','location','town','locality'])||'Unknown area').slice(0,85);
 var state=String(first(r,['state','state_abbr','region','province'])||'').slice(0,35);
 var tone=String(first(r,['encode','ctcss_encode','tx_ctcss','ctcss','tone','pl','uplink_tone'])||'Not listed').slice(0,55);
 var mode=String(first(r,['mode','system','type','repeater_type'])||'Not listed').slice(0,65);
 var notes=String(first(r,['restriction','notes','remarks','description'])||'').slice(0,150);
 var network=String(first(r,['network','linked_to','link','room','system'])||'');
 var kcRoster={
 'KC0KW|145.110':'UP','KC0KW|147.270':'UP','WM0L|147.360':'UP',
 'KC0KW|145.490':'UP','K0HAM|145.410':'DOWN','W0SRC|146.940':'UP',
 'K9GOX|145.310':'UP','K0HAM|146.910':'UP','K0HAM|147.315':'DOWN',
 'KC0KW|147.180':'DOWN','K0NXA|146.685':'UP','WV0S|146.805':'UP',
 'KC0KW|146.955':'UP','KK6BXJ|146.115':'UP'
 };
 var rosterStatus=kcRoster[call.toUpperCase()+'|'+mhz.toFixed(3)]||'';
 var wide=Boolean(rosterStatus)||/kc[\s-]*(wide|room[\s-]*wide)|kansas city wide/i.test(network);
 if(rosterStatus)notes=(notes?notes+' • ':'')+'KC Wide roster 2026-10-30: '+rosterStatus+' (historical; check current status).';
 return {id:call+'|'+mhz.toFixed(4)+'|'+lat.toFixed(4)+'|'+lon.toFixed(4),
 call:call,mhz:mhz,lat:lat,lon:lon,tx:isFinite(tx)?tx:null,
 offset:isFinite(offset)?offset:null,tone:tone,mode:mode,city:city,state:state,notes:notes,wide:wide};
}
function rowsFrom(raw){
 if(Array.isArray(raw))return raw;
 if(raw&&Array.isArray(raw.repeaters))return raw.repeaters;
 if(raw&&Array.isArray(raw.results))return raw.results;
 if(raw&&Array.isArray(raw.data))return raw.data;
 if(raw&&Array.isArray(raw.items))return raw.items;
 throw new Error('Not a recognized repeater JSON list');
}
function normalizeAll(raw){
 var rows=rowsFrom(raw),out=[],seen=new Set();
 for(var i=0;i<rows.length;i++){
  var x=normalize(rows[i],i);
  if(x&&!seen.has(x.id)){seen.add(x.id);out.push(x)}
 }
 if(!out.length)throw new Error('No geolocated USA 2m repeaters found. Check JSON fields.');
 return out;
}
function indexedDBOpen(){
 return new Promise(function(resolve,reject){
  if(!window.indexedDB){reject(new Error('IndexedDB is unavailable'));return}
  var request=indexedDB.open('roadtower-offline-repeaters',1);
  request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('packs'))request.result.createObjectStore('packs')};
  request.onsuccess=function(){resolve(request.result)};
  request.onerror=function(){reject(request.error||new Error('Offline database failed'))};
 });
}
async function readSaved(){
 var db=await indexedDBOpen();
 return new Promise(function(resolve,reject){
  var t=db.transaction('packs','readonly'),req=t.objectStore('packs').get('usa2m');
  req.onsuccess=function(){resolve(req.result||null)};
  req.onerror=function(){reject(req.error)};
  t.oncomplete=function(){db.close()};
 });
}
async function saveSaved(records,origin){
 var db=await indexedDBOpen();
 return new Promise(function(resolve,reject){
  var t=db.transaction('packs','readwrite');
  t.objectStore('packs').put({records:records,origin:origin,savedAt:Date.now()},'usa2m');
  t.oncomplete=function(){db.close();resolve()};
  t.onerror=function(){reject(t.error)};
 });
}
function say(message){el('rtFeedback').textContent=message}
function distance(lat1,lon1,lat2,lon2){
 var r=Math.PI/180,dLat=(lat2-lat1)*r,dLon=(lon2-lon1)*r;
 var h=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function current(){return API.getGps?API.getGps():null}
function anchor(){var p=current();return p?{lat:p.latitude,lon:p.longitude,gps:true}:{lat:map.getCenter().lat,lon:map.getCenter().lng,gps:false}}
function sorted(){
 var point=anchor();
 return getAllStations().filter(function(x){return !wideOnly||x.wide}).map(function(x){
  return {x:x,dist:distance(point.lat,point.lon,x.lat,x.lon)};
 }).sort(function(a,b){return a.dist-b.dist});
}
function coord(x){return [x.lat,x.lon]}
function localMhz(n){return isFinite(n)?Number(n).toFixed(4)+' MHz':'Not listed'}
function showDetails(x){
 var d=el('rtDetails');d.replaceChildren();
 if(!x){d.textContent='Select a repeater for frequency, offset, TX tone and location.';return}
 function lineText(label,value){var p=document.createElement('div');var b=document.createElement('strong');b.textContent=label+' ';p.appendChild(b);p.appendChild(document.createTextNode(String(value)));d.appendChild(p)}
 lineText('Callsign:',x.call+(x.wide?' ★ KC Wide':''));
 lineText('Output (RX):',localMhz(x.mhz));
 lineText('Input (TX):',x.tx!==null?localMhz(x.tx):'Not listed');
 lineText('Offset:',x.offset!==null?(x.offset>0?'+':'')+x.offset.toFixed(3)+' MHz':'Not listed');
 lineText('TX tone:',x.tone);
 lineText('Mode:',x.mode);
 lineText('Location:',x.city+(x.state?', '+x.state:'')+' (approx.)');
 if(x.source)lineText('Source:',x.source);
 if(x.approx)lineText('Pin accuracy:','Approximate area — not exact transmitter location');
 if(x.notes)lineText('Notes:',x.notes);
 var p=document.createElement('div');p.className='rt-muted';p.textContent='Verify repeater settings before transmitting.';d.appendChild(p);
}
function choose(x,move){
 selected=x;follow=false;el('rtAuto').textContent='Follow nearest: OFF';
 showDetails(x);
 if(move)map.setView(coord(x),Math.max(map.getZoom(),11));
 drawLine();
 redraw();
}
function drawLine(){
 if(!current()||!selected){line.setLatLngs([]);if(middle){map.removeLayer(middle);middle=null}return}
 var p=current();
 line.setLatLngs([[p.latitude,p.longitude],coord(selected)]);
 if(middle)map.removeLayer(middle);
 var d=distance(p.latitude,p.longitude,selected.lat,selected.lon);
 middle=L.marker([(p.latitude+selected.lat)/2,(p.longitude+selected.lon)/2],{
  interactive:false,icon:L.divIcon({className:'rt-mile-icon',html:'<span>'+d.toFixed(1)+' mi</span>',iconSize:[75,22],iconAnchor:[38,11]})
 }).addTo(map);
}
function redraw(){
 if(!getAllStations().length){markers.clearLayers();line.setLatLngs([]);return}
 var list=sorted(),p=anchor(),nearest=list[0];
 el('rtCount').textContent=getAllStations().length.toLocaleString()+' visible-directory repeaters ('+data.length.toLocaleString()+' national records + club and saved local sites, duplicates merged)'+(p.gps?' • GPS active':' • map-center distances');
 if(follow){selected=nearest?nearest.x:null;showDetails(selected)}
 var closest=el('rtClosest');closest.replaceChildren();
 if(nearest){
  var main=document.createElement('strong');main.textContent=nearest.x.call+'  '+nearest.x.mhz.toFixed(4)+' MHz'+(nearest.x.wide?' ★':'');
  closest.appendChild(main);
  var d=document.createElement('div');d.className='rt-distance';d.textContent=nearest.dist.toFixed(1)+' miles '+(p.gps?'from you':'from map center');closest.appendChild(d);
 }else closest.textContent='No repeaters in this filter.';
 var near=el('rtNearby');near.replaceChildren();
 list.slice(0,5).forEach(function(item){
  var b=document.createElement('button');b.type='button';
  b.textContent=(item.x.wide?'★ ':'')+item.x.call+' · '+item.x.mhz.toFixed(3)+' · '+item.dist.toFixed(1)+' mi';
  b.onclick=function(){choose(item.x,true)};
  near.appendChild(b);
 });
 if(selected&&(!wideOnly||selected.wide))drawLine();
 else {line.setLatLngs([]);if(middle){map.removeLayer(middle);middle=null}}
 drawMarkers(list,p);
}
function drawMarkers(list,p){
 markers.clearLayers();
 var bounds=map.getBounds().pad(.15);
 var visible=list.filter(function(it){return bounds.contains(coord(it.x))}).slice(0,90);
 var labels=0;
 visible.forEach(function(it){
  var x=it.x;
  var mark=L.circleMarker(coord(x),{
   radius:x.officialLocal?9:x.wide?8:6,color:x.wide?'#f5d36c':'#ecfff4',weight:2,
   fillColor:x.officialLocal?'#35c979':x.wide?'#e9c54a':'#35c979',fillOpacity:.95,bubblingMouseEvents:false
  }).addTo(markers);
  if(labels<15){
   var safeTooltip=document.createElement('span');
   safeTooltip.textContent=(x.officialLocal?'✓ ':x.wide?'★ ':'')+x.call+' '+x.mhz.toFixed(3)+' • '+it.dist.toFixed(1)+'mi';
   mark.bindTooltip(safeTooltip,{
    permanent:true,direction:'right',offset:[7,0],className:'rt-repeater-tooltip'
   });
   labels++;
  }
  mark.on('click',function(){choose(x,false)});
 });
}
async function install(raw,source){
 var normalized=normalizeAll(raw);
 await saveSaved(normalized,source);
 data=normalized;directoryState='ready';selected=null;follow=true;el('rtAuto').textContent='Follow nearest: ON';updateStatuses();
 say('Saved '+normalized.length.toLocaleString()+' USA 2m repeaters for offline use. Source: '+source+'. Maps still need separate downloads.');
 redraw();
}
el('rtHide').onclick=function(){
 var hidden=panel.classList.toggle('rt-hidden');
 el('rtHide').textContent=hidden?'Show':'Hide';
};
el('rtAuto').onclick=function(){
 follow=!follow;el('rtAuto').textContent='Follow nearest: '+(follow?'ON':'OFF');
 redraw();
};
el('rtWide').onclick=function(){
 wideOnly=!wideOnly;el('rtWide').textContent=wideOnly?'★ KC Wide: ONLY':'★ KC Wide: All';
 selected=null;follow=true;redraw();
};
el('rtImport').onclick=function(){el('rtFile').click()};
el('rtFile').onchange=async function(){
 var file=this.files&&this.files[0];if(!file)return;
 say('Reading file '+file.name+'…');
 try{
  if(file.size>35*1024*1024)throw new Error('File exceeds the 35 MB import limit');
  var raw=JSON.parse(await file.text());
  await install(raw,'Imported HearHam/compatible JSON');
 }catch(e){say('Import failed: '+e.message)}
 this.value='';
};
el('rtDownload').onclick=async function(){
 if(loading)return;loading=true;el('rtDownload').disabled=true;
 say('Downloading the HearHam worldwide directory; filtering it to US 2m repeaters. This may use around 10 MB of data.');
 try{
  var res;
  try{
   res=await fetch(SOURCE,{mode:'cors',cache:'no-store'});
   if(!res.ok)throw new Error('HTTP '+res.status);
  }catch(e){
   res=await fetch('./api/repeaters',{cache:'no-store'});
   if(!res.ok)throw new Error('Relay HTTP '+res.status);
  }
  var raw=await res.json();
  await install(raw,'HearHam');
 }catch(e){
  say('Download blocked or unavailable ('+e.message+'). Use the HearHam JSON link below to save the file, then tap Import JSON file while online.');
 }finally{loading=false;el('rtDownload').disabled=false}
};
map.on('moveend zoomend',function(){if(getAllStations().length)redraw()});
API.onGps=function(){updateStatuses();if(getAllStations().length)redraw()};
(async function(){
 try{
  var saved=await readSaved();
  if(saved&&Array.isArray(saved.records)&&saved.records.length){
   data=saved.records;directoryState='ready';updateStatuses();
   say('Offline directory ready • '+new Date(saved.savedAt).toLocaleDateString()+' • '+saved.origin);
   redraw();
  }else{directoryState='empty';updateStatuses();redraw();say('The club-confirmed local stations are included. Tap Download USA 2m list while online to add nationwide listings.')}
 }catch(e){directoryState='error';updateStatuses();el('rtCount').textContent='Offline storage unavailable';say('This browser cannot access offline repeater storage: '+e.message)}
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(function(){});
})();