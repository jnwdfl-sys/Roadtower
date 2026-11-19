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
panel.setAttribute('aria-label','Amateur and GMRS repeaters');
panel.innerHTML=
 '<div class="rt-head"><strong>📡 RADIO REPEATERS</strong><button id="rtHide" type="button">Hide</button></div>'+
 '<div id="rtContent"><div class="rt-buttons rt-service-pick"><button id="rtHam" type="button" aria-pressed="true">HAM • GREEN</button><button id="rtGMRS" type="button" aria-pressed="false">GMRS • PURPLE</button></div>'+
 '<div class="rt-muted" id="rtServiceInfo">Amateur radio repeaters: 2m and 70cm. Ham license required to transmit.</div>'+
 '<div class="rt-buttons rt-joco-shortcuts"><button id="rtFindLibrary" type="button">📍 Library 2m · 145.290</button><button id="rtFindJocoUhf" type="button">★ Johnson Co. 70cm</button></div>'+
 '<label class="rt-band-row" id="rtBandRow">HAM band <select id="rtBand"><option value="both">Both 2m + 70cm</option><option value="2m">2m only</option><option value="70cm">70cm only</option></select></label>'+
 '<div class="rt-muted" id="rtGrowth">Original count: 5,044 amateur repeaters. Updated percentage appears after downloading both bands.</div>'+
 '<div class="rt-muted" id="rtCount">Loading saved repeaters…</div>'+
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
 '<div class="rt-buttons"><button id="rtDownload" type="button">Update USA 2m + 70cm</button><button id="rtGmrsDownload" type="button" hidden>Save GMRS site list offline</button><button id="rtImport" type="button">Import JSON / CSV</button></div>'+
 '<input type="file" accept=".json,.csv,application/json,text/csv,text/plain" id="rtFile" hidden>'+
 '<div class="rt-muted" id="rtFeedback">HAM list uses HearHam data. GMRS uses its own saved site list. Nationwide coverage cannot be guaranteed.</div>'+
 '<div class="rt-muted" id="rtGmrsSources" hidden>GMRS: limited open-data download plus your own JSON/CSV imports. For broader personal coverage, export a GMRS list with tower latitude/longitude from a directory you are authorized to use, then tap Import JSON / CSV. Data remains on your device for offline use. No nationwide completeness claim. Verify owner permission, tones and site status. <a href="https://www.repeaterbook.com/gmrs/index.php/index/0" target="_blank" rel="noopener noreferrer">Browse GMRS directory</a></div>'+
 '<a id="rtSource" href="https://hearham.com/api/repeaters/v1" rel="noopener noreferrer" target="_blank">HearHam JSON download (manual backup)</a>'+
 '<div class="rt-muted">Data: HearHam, user-contributed. ★ KC Wide from the 2026-10-30 published roster or matching network metadata; not a live link indicator. Check radio programming and coverage before use.</div><a href="https://www.kansascityroom-wide.com/repeater-list/" target="_blank" rel="noopener noreferrer">KC Wide official repeater roster</a></div>';
HOST.appendChild(panel);

var nearDock=document.createElement('aside');
nearDock.id='rtNearestDock';nearDock.className='rt-nearest-dock';
nearDock.setAttribute('aria-label','Nearby radio repeaters sorted by distance');
nearDock.innerHTML='<div class="rt-near-head"><strong id="rtNearHeading">NEAREST HAM</strong><div class="rt-near-tools"><button id="rtNearMinus" type="button" aria-label="Smaller repeater list text">A−</button><button id="rtNearPlus" type="button" aria-label="Larger repeater list text">A+</button><button id="rtNearExpand" type="button" aria-label="Expand repeater list">Expand</button><button id="rtNearToggle" type="button">Hide</button></div></div>'+
 '<div id="rtNearOrigin" class="rt-near-origin">FROM MAP CENTER • GPS OFF</div>'+
 '<div id="rtNearRows"><span class="rt-near-empty">Start GPS for nearest-to-farthest mile distances.</span></div>'+
 '<div class="rt-near-foot" id="rtNearSource">Distances from map center until GPS is on</div>';
HOST.appendChild(nearDock);
L.DomEvent.disableClickPropagation(nearDock);
L.DomEvent.disableScrollPropagation(nearDock);
const nearEl=id=>nearDock.querySelector('#'+id);
let nearCollapsed=false,nearExpanded=false;
let nearFont=16;
try{
 const savedFont=Number(localStorage.getItem('rt-near-font-v1'));
 if(Number.isFinite(savedFont)&&savedFont>=14&&savedFont<=26)nearFont=savedFont;
}catch(e){} // If private browsing blocks storage, the list must still work.
nearFont=Math.max(14,Math.min(26,nearFont));
function setNearFont(px){
 nearFont=Math.max(14,Math.min(26,px));
 nearDock.style.setProperty('--rt-near-font',nearFont+'px');
 try{localStorage.setItem('rt-near-font-v1',String(nearFont))}catch(e){}
 nearEl('rtNearMinus').disabled=nearFont<=14;
 nearEl('rtNearPlus').disabled=nearFont>=26;
}
setNearFont(nearFont);
nearEl('rtNearPlus').onclick=()=>setNearFont(nearFont+2);
nearEl('rtNearMinus').onclick=()=>setNearFont(nearFont-2);
nearEl('rtNearExpand').onclick=function(){
 nearExpanded=!nearExpanded;
 nearDock.classList.toggle('rt-nearest-expanded',nearExpanded);
 // Use the right edge as a reading rail; never center a large modal over the road map.
 HOST.classList.toggle('rt-focus-distances',nearExpanded);
 this.textContent=nearExpanded?'Compact':'Expand';
 this.setAttribute('aria-label',nearExpanded?'Return repeater list to compact view':'Expand repeater list');
 this.setAttribute('aria-expanded',String(nearExpanded));
 if(nearExpanded&&nearCollapsed){nearEl('rtNearToggle').click()}
};
nearEl('rtNearToggle').onclick=function(){
 nearCollapsed=!nearCollapsed;
 nearDock.classList.toggle('rt-nearest-collapsed',nearCollapsed);
 this.textContent=nearCollapsed?'Show':'Hide';
};
function renderNearestSide(list,point){
 nearEl('rtNearHeading').textContent=radioService==='gmrs'?'NEAREST GMRS':'NEAREST HAM';
 nearEl('rtNearOrigin').textContent=point.gps?'FROM YOUR GPS • LIVE':'FROM MAP CENTER • GPS OFF';
 nearEl('rtNearSource').textContent=(point.gps?'Straight-line miles from GPS':'Straight-line miles from map center • Start GPS')+' • *site-location approximate';
 const root=nearEl('rtNearRows');
 const previousScroll=nearDock.scrollTop;
 root.replaceChildren();
 if(!list.length){
  const empty=document.createElement('span');empty.className='rt-near-empty';
  empty.textContent='No '+(radioService==='gmrs'?'GMRS':'amateur')+' sites in the selected list.';
  root.appendChild(empty);return
 }
 list.slice(0,nearExpanded?20:7).forEach((item,index)=>{
  const btn=document.createElement('button');btn.type='button';btn.className='rt-near-row';
  const number=document.createElement('span');number.className='rt-near-rank';number.textContent=(index+1)+'.';
  const name=document.createElement('span');name.className='rt-near-name';
  name.textContent=item.x.call+' · '+item.x.mhz.toFixed(3);
  const miles=document.createElement('span');miles.className='rt-near-miles';
  miles.textContent=item.dist.toFixed(1)+(item.x.approx?' mi*':' mi');
  btn.append(number,name,miles);
  btn.onclick=()=>choose(item.x,false);
  root.appendChild(btn);
 });
 nearDock.scrollTop=previousScroll;
}
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
 {id:'jcrac-w0erh-145290',call:'W0ERH',mhz:145.290,lat:38.969826,lon:-94.699526,
  tx:144.690,offset:-0.600,tone:'151.4 Hz',mode:'FM / DMR',
  city:'Johnson County Central Resource Library area, 87th & Antioch',state:'KS',wide:false,
  notes:'Johnson County Radio Amateurs Club operates this 2m repeater NEAR the library. This pin is the PUBLIC LIBRARY BUILDING at 9875 W 87th St, not the verified antenna location. Club says this repeater is NOT linked to KC Wide.',
  source:'JCRAC official site (w0erh.org/about-us/welcome); Johnson County Library building address',officialLocal:true,approx:true,landmark:'Central Resource Library, Overland Park'},
 {id:'jcrac-wb0hac-145210',call:'WB0HAC',mhz:145.210,lat:39.0110,lon:-94.7230,
  tx:144.610,offset:-0.600,tone:'151.4 Hz',mode:'FM / DMR',
  city:'Near 65th St & Quivira Rd, Shawnee',state:'KS',wide:false,
  notes:'Maintained by JCRAC for SRACT. Club describes 65th & Quivira cell tower, not a water tower. Approximate map position, not surveyed coordinates. Not linked to KC Wide.',
  source:'JCRAC official club site',officialLocal:true,approx:true},
 {id:'jcrac-w0erh-442600',call:'W0ERH',mhz:442.600,lat:39.009,lon:-94.725,
  tx:447.600,offset:5.000,tone:'Digital, no CTCSS',mode:'Yaesu System Fusion digital',
  city:'65th Street & Quivira Road area, Shawnee',state:'KS',wide:true,
  notes:'JCRAC locates this Fusion repeater on a cell tower near 65th and Quivira; exact tower coordinates unverified. Linked to Kansas City Room.',
  source:'JCRAC official site',officialLocal:true,approx:true},
 {id:'jcrac-w0erh-443725',call:'W0ERH',mhz:443.725,lat:38.9245,lon:-94.6559,
  tx:448.725,offset:5.000,tone:'Digital, no CTCSS',mode:'Yaesu System Fusion digital',
  city:'College Boulevard & Lamar Avenue area, Overland Park',state:'KS',wide:true,
  notes:'JCRAC locates this repeater near College Blvd and Lamar. Reference location only, not a surveyed antenna location. Yaesu Fusion WIRES-X Kansas City Room link.',
  source:'JCRAC official site',officialLocal:true,approx:true},
 {id:'kcwide-k0hcv-444400',call:'K0HCV',mhz:444.400,lat:38.856,lon:-94.824,
  tx:449.400,offset:5.000,tone:'Digital, no CTCSS',mode:'Yaesu System Fusion digital',
  city:'Olathe South (approximate city pin)',state:'KS',wide:true,
  notes:'Kansas City Room digital site; exact tower location unverified.',
  source:'JCRAC / KC Room listings',officialLocal:true,approx:true}
];
var data=[],gmrsData=[],customRecords=[],selected=null,follow=true,wideOnly=false,bandFilter='both',radioService='ham',directoryState='loading',gmrsState='loading',markers=L.layerGroup().addTo(map);
const BASELINE_AMATEUR=5044;
var completeHamRefresh=false;
const GMRS_OPEN_URL='./gmrs-directory.json';

const GMRS_STARTER_ROWS=[["WRNW944",462.65,39.0267,-94.6569,"123.0 Hz","Mission, KS","KS","N9TPB public GMRS listings","https://n9tpb.com/uls/call/WRNW944","Published as open; city-center map reference, not an antenna position.",false],["WSHC585",462.6,38.96611,-94.73389,"136.5 Hz","Lenexa, KS","KS","N9TPB public GMRS listings","https://n9tpb.com/uls/call/WSHC585","Published as open; city-center map reference, not an antenna position.",false],["KAF4575",462.7,39.0417,-94.7202,"110.9 Hz","Shawnee, KS","KS","N9TPB public GMRS listings","https://n9tpb.com/uls/call/KAF4575","Published as open; city-center map reference, not an antenna position.",false],["WRZE330",462.575,40.9987,-74.3471,"Not published","Butler, NJ","NJ","SSRF-Lite Butler GMRS (Apache-2.0)","https://github.com/Chicago-Offline/ssrf-lite/blob/main/ssrf/systems/US/NJ/Morris/Butler/gmrs/butler_gmrs_repeater.yml","Open listing; tone unpublished; city reference point.",false],["KAA8142",462.675,42.0432,-87.8477,"141.3 Hz","Park Ridge, IL","IL","SSRF-Lite NSEA GMRS (Apache-2.0)","https://github.com/Chicago-Offline/ssrf-lite/blob/main/ssrf/systems/US/IL/Cook/_Countywide/gmrs/nsea_gmrs_repeaters.yml","NSEA 675; permission required; hospital-area reference.",true],["KAE2050",462.65,42.1073,-87.8495,"107.2 Hz","Northbrook, IL","IL","SSRF-Lite NSEA GMRS (Apache-2.0)","https://github.com/Chicago-Offline/ssrf-lite/blob/main/ssrf/systems/US/IL/Cook/_Countywide/gmrs/nsea_gmrs_repeaters.yml","NSEA 650; permission required; golf-course-area reference.",true],["WRAF954",462.575,27.9518,-82.4572,"141.3 Hz","Downtown Tampa, FL","FL","SSRF-Lite Florida Simulcast Group (Apache-2.0)","https://github.com/Chicago-Offline/ssrf-lite/blob/main/ssrf/systems/US/FL/_Regional/florida_simulcast_group.yml","Tampa city-area reference; owner permission and operation unconfirmed.",false]];
const GMRS_STARTER=GMRS_STARTER_ROWS.map((r,i)=>({
 id:'gmrs-starter-'+i+'|'+r[0]+'|'+r[1].toFixed(3),
 service:'gmrs',call:r[0],mhz:r[1],lat:r[2],lon:r[3],tx:r[1]+5,offset:5,
 tone:r[4],mode:'FM',city:r[5],state:r[6],source:r[7],sourceUrl:r[8],
 notes:r[9]+' Verify current operation and permission before transmitting.',
 wide:false,approx:true,restricted:Boolean(r[10]),starter:true
}));
function hamBand(mhz){return mhz>=144&&mhz<=148?'2m':mhz>=420&&mhz<=450?'70cm':null}
function gmrsOutput(mhz){return [462.55,462.575,462.600,462.625,462.650,462.675,462.700,462.725].some(f=>Math.abs(f-mhz)<.0003)}

function getAllStations(){
 var combined=radioService==='gmrs'?[...customRecords.filter(x=>x.service==='gmrs'),...gmrsData,...GMRS_STARTER]:[...customRecords.filter(x=>x.service!=='gmrs'),...LOCAL_CLUB,...data],answer=[],seen=new Map();
 for(var i=0;i<combined.length;i++){
  var x=combined[i],key=x.call.toUpperCase()+'|'+x.mhz.toFixed(4);
  var group=seen.get(key)||[];
  if(group.some(old=>Math.abs(old.lat-x.lat)<.015&&Math.abs(old.lon-x.lon)<.015))continue;
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
 var available=getAllStations().length;
 var state=radioService==='gmrs'?gmrsState:directoryState;
 var ready=available>0;
 var prefix=radioService==='gmrs'?'GMRS':'HAM';
 var directoryText=ready?'SAVED '+available.toLocaleString():
  state==='loading'?'CHECKING':state==='error'?'STORAGE ERROR':'NOT SAVED';
 setIndicator('rtDataStatus',ready?'good':state==='loading'?'neutral':'bad',
  prefix+': '+directoryText,
  ready?'Saved '+prefix+' repeater listings available offline.':'Save this radio-service directory while online, then use GPS offline.');
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
 if(!isFinite(lat)||!isFinite(lon)||!isUS(lat,lon)||!isFinite(mhz)||!hamBand(mhz))return null;
 var country=String(first(r,['country','country_code','countryCode'])).toLowerCase();
 if(country&&!/^(us|usa|u\.s\.a\.|united states|united states of america)$/i.test(country))return null;
 var placeText=String(first(r,['city','nearestcity','nearest_city','location','town','locality'])||'');
 if(!country&&/\b(Canada|Mexico|United Kingdom|Australia|Germany)\b/i.test(placeText))return null;
 var call=String(first(r,['callsign','call_sign','call','repeater_callsign','name'])||'Unlisted').trim().slice(0,70);
 var offset=number(first(r,['offset','shift','frequency_offset','offset_mhz']));
 if(isFinite(offset)&&Math.abs(offset)>10000)offset/=1000000;
 else if(isFinite(offset)&&Math.abs(offset)>50)offset/=1000;
 if(isFinite(offset)&&Math.abs(offset)>12)offset=NaN; // Reject implausible ham offsets, allow 70cm +5 MHz.
 var tx=readMHz(first(r,['input','input_frequency','tx_frequency','transmit_frequency','tx']));
 if(!isFinite(tx)||!hamBand(tx))tx=NaN;
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
 return {service:'ham',id:call+'|'+mhz.toFixed(4)+'|'+lat.toFixed(4)+'|'+lon.toFixed(4),
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
 if(!out.length)throw new Error('No geolocated USA 2m/70cm repeaters found. Check JSON fields.');
 return out;
}
function gmrsNormalize(r){
 if(!r||typeof r!=='object'||(r.service&&String(r.service).toLowerCase()!=='gmrs'))return null;
 var lat=number(first(r,['lat','latitude','site_latitude','Lat','Latitude','LAT'])),lon=number(first(r,['lon','lng','longitude','site_longitude','Long','Lon','Longitude','LONG']));
 var output=readMHz(first(r,['rx_mhz','output_mhz','output_frequency','frequency','output','rx','Frequency','Output','Output Frequency','Output Freq','RX Frequency']));
 var input=readMHz(first(r,['tx_mhz','input_mhz','input_frequency','input','tx','Input Freq','Input Frequency','Input','TX Frequency']));
 if(!isFinite(input)&&gmrsOutput(output))input=output+5;
 if(!isFinite(lat)||!isFinite(lon)||!isUS(lat,lon)||!gmrsOutput(output)||!isFinite(input)||Math.abs(input-output-5)>.002)return null;
 var call=String(first(r,['callsign','call','name','channel_name','Callsign','Call','Name','Landmark'])||'GMRS').trim().slice(0,70);
 var city=String(first(r,['city','location','name','Nearest City','City','Location','Landmark'])||'Location not listed').slice(0,85);
 var tone=first(r,['ctcss','tone','encode','tx_ctcss','PL','Tone','Encode','Uplink Tone']),dcs=first(r,['dcs','dcs_code','DCS']);
 var access=tone&&String(tone)!=='0'?String(tone)+' Hz':dcs?'DCS '+dcs:'Not listed';
 return {id:'gmrs|'+call+'|'+output.toFixed(4)+'|'+lat.toFixed(4)+'|'+lon.toFixed(4),
  service:'gmrs',call:call,mhz:output,tx:input,offset:5,tone:access,
  lat:lat,lon:lon,city:city,state:String(r.state||r.State||'').slice(0,35),
  mode:String(r.mode||'FM').slice(0,45),wide:false,
  source:String(r.source||r._roadtowerSource||'GMRS user-supplied directory').slice(0,140),
  sourceUrl:String(r.sourceUrl||'').slice(0,400),
  approx:r.approximate!==false,
  restricted:Boolean(r.restricted),
  notes:String(r.notes||'Owner access rules and site status unverified. Check before transmitting.').slice(0,400)};
}
function normalizeGmrs(raw){
 var rows=rowsFrom(raw),out=[],seen=new Set();
 for(var i=0;i<rows.length;i++){
  var x=gmrsNormalize(rows[i]);
  if(x&&!seen.has(x.id)){out.push(x);seen.add(x.id)}
 }
 return out;
}

function parseRepeaterCSV(input){
 // Quoted commas, quoted line breaks and escaped double quotes are supported.
 var rows=[],row=[],field='',quoted=false;
 input=String(input||'').replace(/^\uFEFF/,'');
 for(var i=0;i<input.length;i++){
  var ch=input[i];
  if(ch==='"'){
   if(quoted&&input[i+1]==='"'){field+='"';i++}
   else quoted=!quoted;
  }else if(ch===','&&!quoted){row.push(field);field=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.some(v=>String(v).trim()))rows.push(row);
   row=[];
  }else field+=ch;
 }
 if(quoted)throw Error('CSV contains an unclosed quoted field');
 row.push(field);if(row.some(v=>String(v).trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV needs a header and at least one repeater');
 var headers=rows.shift().map(h=>h.trim());
 return rows.map(values=>{
  var obj={};
  headers.forEach((h,i)=>{if(h)obj[h]=String(values[i]||'').trim()});
  obj._roadtowerSource='Personal GMRS CSV import';
  return obj;
 });
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
async function readKey(key){
 var db=await indexedDBOpen();
 return new Promise(function(resolve,reject){
  var t=db.transaction('packs','readonly'),req=t.objectStore('packs').get(key);
  req.onsuccess=function(){resolve(req.result||null)};
  req.onerror=function(){reject(req.error)};
  t.oncomplete=function(){db.close()};
 });
}
async function saveKey(key,records,origin){
 var db=await indexedDBOpen();
 return new Promise(function(resolve,reject){
  var t=db.transaction('packs','readwrite');
  t.objectStore('packs').put({records:records,origin:origin,savedAt:Date.now()},key);
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
 return getAllStations().filter(function(x){return (radioService==='gmrs'||!wideOnly||x.wide)&&(radioService==='gmrs'||bandFilter==='both'||hamBand(x.mhz)===bandFilter)}).map(function(x){
  return {x:x,dist:distance(point.lat,point.lon,x.lat,x.lon)};
 }).sort(function(a,b){return a.dist-b.dist});
}
function coord(x){return [x.lat,x.lon]}
function localMhz(n){return isFinite(n)?Number(n).toFixed(4)+' MHz':'Not listed'}
function updateGrowth(){
 var original=BASELINE_AMATEUR,now=data.length;
 var diff=now-original,percent=diff/original*100;
 var two=data.filter(x=>hamBand(x.mhz)==='2m').length;
 var seventy=data.filter(x=>hamBand(x.mhz)==='70cm').length;
 el('rtGrowth').textContent=completeHamRefresh&&data.length?
  'Original 2m directory: '+original.toLocaleString()+' → downloaded 2m+70cm: '+now.toLocaleString()+
  ' ('+(diff>0?'+':'')+diff.toLocaleString()+'; '+(percent>0?'+':'')+percent.toFixed(1)+'%). '+
  two.toLocaleString()+' on 2m; '+seventy.toLocaleString()+' on 70cm. Counts are listings, not verified operating stations.':
  'Original 2m list: '+original.toLocaleString()+'. Refresh the 2m+70cm directory for a new total and percentage.';
}
function serviceUI(){
 panel.classList.toggle('rt-gmrs-mode',radioService==='gmrs');
 el('rtHam').setAttribute('aria-pressed',String(radioService==='ham'));
 el('rtGMRS').setAttribute('aria-pressed',String(radioService==='gmrs'));
 el('rtBandRow').hidden=radioService==='gmrs';
 el('rtWide').hidden=radioService==='gmrs';
 el('rtDownload').hidden=radioService==='gmrs';
 el('rtGmrsDownload').hidden=radioService!=='gmrs';
 el('rtGrowth').hidden=radioService==='gmrs';
 el('rtGmrsSources').hidden=radioService!=='gmrs';
 el('rtVerifiedLocal').hidden=radioService==='gmrs';
 el('rtNewFreq').min=radioService==='gmrs'?'462.55':'144';
 el('rtNewFreq').max=radioService==='gmrs'?'462.725':'450';
 el('rtNewFreq').placeholder=radioService==='gmrs'?'462.675':'145.290';
 el('rtNewOffset').value=radioService==='gmrs'?'5.000':'-0.600';
 el('rtServiceInfo').textContent=radioService==='gmrs'?
  'GMRS repeater sites • 462 MHz receive / +5 MHz input. Purple markers. FCC GMRS license required to transmit.':
  'Amateur repeater sites • 2m and 70cm. Green markers, gold stars for Kansas City Wide. Amateur license required to transmit.';
 updateGrowth();
}
function switchService(name){
 radioService=name;selected=null;follow=true;
 el('rtAuto').textContent='Follow nearest: ON';
 serviceUI();renderPersonal();redraw();updateStatuses();
}
function showDetails(x){
 var d=el('rtDetails');d.replaceChildren();
 if(!x){d.textContent='Select a repeater for frequency, offset, TX tone and location.';return}
 function lineText(label,value){var p=document.createElement('div');var b=document.createElement('strong');b.textContent=label+' ';p.appendChild(b);p.appendChild(document.createTextNode(String(value)));d.appendChild(p)}
 lineText('Callsign:',x.call+(x.wide?' ★ KC Wide':''));
 lineText('Service:',radioService==='gmrs'?'GMRS • separate 462/467 MHz service':'Ham • '+hamBand(x.mhz));
 lineText('Output (RX):',localMhz(x.mhz));
 lineText('Input (TX):',x.tx!==null?localMhz(x.tx):'Not listed');
 lineText('Offset:',x.offset!==null?(x.offset>0?'+':'')+x.offset.toFixed(3)+' MHz':'Not listed');
 lineText('TX tone:',x.tone);
 lineText('Mode:',x.mode);
 lineText('Location:',x.city+(x.state?', '+x.state:'')+' (approx.)');
 var nearPoint=anchor();
 lineText('Straight-line distance:',distance(nearPoint.lat,nearPoint.lon,x.lat,x.lon).toFixed(1)+' miles '+(nearPoint.gps?'from GPS':'from map center'));
 if(radioService==='gmrs')lineText('Access:', x.restricted?'GMRS license AND repeater-owner permission REQUIRED.':'GMRS license required; verify repeater-owner access rules.');
 if(x.source)lineText('Source:',x.source);
 if(x.approx)lineText('Pin accuracy:','APPROXIMATE reference area, NOT a surveyed repeater antenna. Mileage is approximate.');
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
 line.setStyle({color:radioService==='gmrs'?'#c56bea':'#35c979'});
 if(middle)map.removeLayer(middle);
 var d=distance(p.latitude,p.longitude,selected.lat,selected.lon);
 middle=L.marker([(p.latitude+selected.lat)/2,(p.longitude+selected.lon)/2],{
  interactive:false,icon:L.divIcon({className:radioService==='gmrs'?'rt-mile-icon rt-mile-gmrs':'rt-mile-icon rt-mile-ham',html:'<span>'+d.toFixed(1)+' mi</span>',iconSize:[75,22],iconAnchor:[38,11]})
 }).addTo(map);
}
function redraw(){
 if(!getAllStations().length){
  renderNearestSide([],anchor());
  markers.clearLayers();line.setLatLngs([]);
  el('rtCount').textContent=radioService==='gmrs'?'No saved GMRS repeater sites yet. Use Download open GMRS sites or add a local station.':
    'No amateur repeater sites saved yet.';
  el('rtClosest').textContent='No repeater sites in this service.';
  el('rtNearby').replaceChildren();
  showDetails(null);return
 }
 var list=sorted(),p=anchor(),nearest=list[0];
 renderNearestSide(list,p);
 el('rtCount').textContent=radioService==='gmrs'?
   getAllStations().length.toLocaleString()+' GMRS reference sites ('+GMRS_STARTER.length+' starter + '+gmrsData.length.toLocaleString()+' downloaded + personal; duplicates merged)'+(p.gps?' • GPS active':' • map-center distances'):
   getAllStations().length.toLocaleString()+' amateur repeaters ('+data.length.toLocaleString()+' national records + verified local stations)'+(p.gps?' • GPS active':' • map-center distances');
 if(follow){selected=nearest?nearest.x:null;showDetails(selected)}
 var closest=el('rtClosest');closest.replaceChildren();
 if(nearest){
  var main=document.createElement('strong');main.textContent=nearest.x.call+'  '+nearest.x.mhz.toFixed(4)+' MHz'+(nearest.x.wide?' ★':'');
  closest.appendChild(main);
  var d=document.createElement('div');d.className='rt-distance';d.textContent=nearest.dist.toFixed(1)+' miles '+(p.gps?'from you':'from map center');closest.appendChild(d);
 }else closest.textContent='No repeaters in this filter.';
 var near=el('rtNearby');near.replaceChildren();
 list.slice(0,10).forEach(function(item,index){
  var b=document.createElement('button');b.type='button';
  b.textContent=(index+1)+'. '+(item.x.wide?'★ ':'')+item.x.call+' · '+item.x.mhz.toFixed(3)+' · '+item.dist.toFixed(1)+' mi';
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
 // Always put club-confirmed nearby locations ahead of bulk directory markers.
 // The user should not lose the library reference marker among thousands of results.
 var visible=list.filter(function(it){return bounds.contains(coord(it.x))})
   .sort(function(a,b){return Number(Boolean(b.x.officialLocal))-Number(Boolean(a.x.officialLocal))||a.dist-b.dist})
   .slice(0,90);
 var labels=0;
 visible.forEach(function(it){
  var x=it.x;
  // Same ordinary ham-repeater dot for W0ERH 145.290 near the library:
  // keep the library site identification and radio details in the data,
  // but do not give this station a special building icon or a larger pin.
  var mark=L.circleMarker(coord(x),{
   radius:radioService==='gmrs'?9:x.landmark?6:x.officialLocal?9:x.wide?8:6,
   color:radioService==='gmrs'?'#ffe4fc':x.wide?'#f5d36c':'#ecfff4',weight:2,
   fillColor:radioService==='gmrs'?'#b340cf':x.wide?'#e9c54a':'#35c979',
   fillOpacity:.95,bubblingMouseEvents:false
  }).addTo(markers);
  if(labels<15||x.officialLocal){
   var safeTooltip=document.createElement('span');
   safeTooltip.textContent=(x.landmark?'LIBRARY · ':radioService==='gmrs'?'GMRS ':x.wide?'★ ':x.officialLocal?'✓ ':'')+x.call+' '+x.mhz.toFixed(3)+' • '+it.dist.toFixed(1)+'mi';
   mark.bindTooltip(safeTooltip,{
    // Normal tooltip on tap/hover, exactly like other amateur repeaters.
    permanent:false,direction:'right',offset:[7,0],className:'rt-repeater-tooltip'
   });
   labels++;
  }
  mark.on('click',function(){choose(x,false)});
 });
}
async function install(raw,source){
 var normalized=normalizeAll(raw);
 await saveSaved(normalized,source);
 data=normalized;completeHamRefresh=source.includes('2m+70cm');directoryState='ready';selected=null;follow=true;el('rtAuto').textContent='Follow nearest: ON';updateStatuses();updateGrowth();
 say('Saved '+normalized.length.toLocaleString()+' USA 2m + 70cm repeaters for offline use. Source: '+source+'. Maps still need separate downloads.');
 redraw();
}
el('rtHam').onclick=function(){switchService('ham')};
el('rtGMRS').onclick=function(){switchService('gmrs')};
el('rtBand').onchange=function(){bandFilter=this.value;selected=null;follow=true;redraw()};
serviceUI();
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
function renderPersonal(){
 var root=el('rtMyStations');root.replaceChildren();
 var mine=customRecords.filter(x=>x.service===radioService);
 if(!mine.length)return;
 var small=document.createElement('div');small.className='rt-muted';
 small.textContent='Personal saved '+(radioService==='gmrs'?'GMRS':'amateur')+' repeaters: '+mine.length;
 root.appendChild(small);
 mine.forEach(x=>{
  var holder=document.createElement('div');holder.className='rt-buttons';
  var open=document.createElement('button');open.type='button';
  open.textContent=x.call+' '+x.mhz.toFixed(4);
  open.onclick=()=>choose(x,true);
  var del=document.createElement('button');del.type='button';del.textContent='Remove';
  del.onclick=async()=>{
   if(!confirm('Remove saved repeater '+x.call+'?'))return;
   var updated=customRecords.filter(r=>r.id!==x.id);
   try{
    await saveKey('custom-radio-v1',updated,'User-entered local repeaters');
    customRecords=updated;renderPersonal();redraw();updateStatuses();
   }catch(e){say('Unable to remove personal station: '+e.message)}
  };
  holder.append(open,del);root.appendChild(holder);
 });
}
function locateClubRepeater(id){
 var x=LOCAL_CLUB.find(a=>a.id===id);
 if(!x){say('Club repeater not found');return}
 if(radioService!=='ham')switchService('ham');
 wideOnly=false;el('rtWide').textContent='★ KC Wide: All';
 bandFilter=hamBand(x.mhz);el('rtBand').value=bandFilter;
 selected=null;follow=false;
 choose(x,true);
 map.setView([x.lat,x.lon],14,{animate:false});
 redraw();
 showDetails(x);
 say('Centered on '+x.call+' '+x.mhz.toFixed(3)+' MHz. '+(x.landmark?'Pin is the library building; the tower is reported nearby.':'Pin indicates the published area, not a verified tower coordinate.')+' Select Both bands to see all nearby ham repeaters.');
}
el('rtFindLibrary').onclick=function(){locateClubRepeater('jcrac-w0erh-145290')};
el('rtFindJocoUhf').onclick=function(){locateClubRepeater('jcrac-w0erh-443725')};
function renderVerifiedLocal(){
 var root=el('rtVerifiedLocal');root.replaceChildren();
 LOCAL_CLUB.forEach(x=>{
  var item=document.createElement('button');item.type='button';
  item.textContent='✓ '+x.call+' • '+x.mhz.toFixed(3)+' MHz • '+x.city.split('(')[0].trim();
  item.onclick=()=>locateClubRepeater(x.id);
  root.appendChild(item);
 });
}
el('rtAddCustom').onclick=function(){
 var form=el('rtCustomForm');
 form.hidden=!form.hidden;
 this.textContent=form.hidden?'+ Add missing repeater':'Hide add form';
};
el('rtUseCenter').onclick=function(){
 var c=map.getCenter();
 el('rtNewLat').value=c.lat.toFixed(6);el('rtNewLon').value=c.lng.toFixed(6);
 say('Map center chosen as estimated tower position. Double-check the pin before saving.');
};
el('rtCustomForm').onsubmit=async function(event){
 event.preventDefault();
 var mhz=number(el('rtNewFreq').value),lat=number(el('rtNewLat').value),lon=number(el('rtNewLon').value);
 var call=el('rtNewCall').value.trim(),off=number(el('rtNewOffset').value);
 if(!call||!isUS(lat,lon)||!(radioService==='gmrs'?gmrsOutput(mhz):!!hamBand(mhz))){
  say('Check callsign, United States tower coordinates and the selected radio band.');return;
 }
 if(radioService==='gmrs')off=5;
 else if(!isFinite(off)||Math.abs(off)>12)off=NaN;
 var rec={service:radioService,id:'custom|'+radioService+'|'+Date.now()+'|'+call,
  call:call.slice(0,70),mhz:mhz,lat:lat,lon:lon,tx:isFinite(off)?mhz+off:null,
  offset:isFinite(off)?off:null,tone:el('rtNewTone').value.trim()||'Not listed',
  city:el('rtNewCity').value.trim()||'User-added tower',state:'',mode:'Not specified',
  wide:false,source:'User-entered / not independently verified',approx:false,
  notes:'Personal entry: verify location, tone and access before transmitting.'};
 var updated=[...customRecords,rec];
 try{
  await saveKey('custom-radio-v1',updated,'User-added repeaters');
  customRecords=updated;this.hidden=true;el('rtAddCustom').textContent='+ Add missing repeater';
  renderPersonal();selected=rec;follow=false;redraw();choose(rec,true);updateStatuses();
  say('Saved '+rec.call+' for offline use. This personal entry is not part of the published nationwide directory.');
 }catch(e){say('Could not save locally: '+e.message)}
};
renderVerifiedLocal();renderPersonal();
el('rtGmrsDownload').onclick=async function(){
 if(loading)return;
 loading=true;this.disabled=true;
 say('Loading Roadtower curated GMRS directory: selected published U.S. sites with approximate reference locations; not complete nationwide coverage.');
 try{
  var response;
  try{
   response=await fetch(GMRS_OPEN_URL,{cache:'no-store',mode:'cors'});
   if(!response.ok)throw Error('Data server HTTP '+response.status);
  }catch(e){
   response=await fetch('./api/gmrs-repeaters',{cache:'no-store'});
   if(!response.ok)throw Error('Relay HTTP '+response.status);
  }
  var raw=await response.json();
  var parsed=normalizeGmrs(raw);
  if(!parsed.length)throw Error('No usable GMRS repeater records in the curated directory; previous saved sites were kept');
  // Open-source refresh adds to the saved GMRS list; never erase personal imports.
  var merged=[...gmrsData,...parsed],seen=new Set();
  merged=merged.filter(x=>{
   var key=x.call.toUpperCase()+'|'+x.mhz.toFixed(4)+'|'+x.lat.toFixed(2)+'|'+x.lon.toFixed(2);
   if(seen.has(key))return false;seen.add(key);return true;
  });
  await saveKey('gmrs-v1',merged,'Roadtower curated GMRS 2026-11-18 + personal imports');
  gmrsData=merged;gmrsState='ready';selected=null;follow=true;
  say('Saved '+parsed.length+' curated GMRS site references; '+merged.length+' total saved offline. Map pins approximate; personal imports preserved.');
  redraw();updateStatuses();
 }catch(e){say('GMRS download failed: '+e.message+'. Existing saved sites are unchanged.')}
 finally{loading=false;this.disabled=false}
};
el('rtFile').onchange=async function(){
 var file=this.files&&this.files[0];if(!file)return;
 say('Reading file '+file.name+'…');
 try{
  if(file.size>35*1024*1024)throw new Error('File exceeds the 35 MB import limit');
  var contents=await file.text();
  var csv=/\.csv$/i.test(file.name)||/^\s*(?:callsign|call|frequency|output|lat|latitude|name)\s*,/i.test(contents);
  var raw=csv?parseRepeaterCSV(contents):JSON.parse(contents);
  if(radioService==='gmrs'){
    var parsed=normalizeGmrs(raw);
    if(!parsed.length)throw Error('No usable GMRS repeater sites with latitude/longitude, 462-MHz output and +5-MHz input');
    // Merge updates with previously saved stations rather than replacing them.
    // Same callsign/output and nearby tower position are considered duplicates.
    var merged=[...parsed,...gmrsData],seen=new Set();
    merged=merged.filter(x=>{
      var key=x.call.toUpperCase()+'|'+x.mhz.toFixed(4)+'|'+x.lat.toFixed(2)+'|'+x.lon.toFixed(2);
      if(seen.has(key))return false;seen.add(key);return true;
    });
    await saveKey('gmrs-v1',merged,'Personal GMRS directory import');
    gmrsData=merged;gmrsState='ready';redraw();updateStatuses();
    say('Imported '+parsed.length+' geolocated GMRS sites; '+merged.length+' saved total for offline use.');
  }else await install(raw,'Imported HearHam/compatible JSON');
 }catch(e){say('Import failed: '+e.message)}
 this.value='';
};
el('rtDownload').onclick=async function(){
 if(loading)return;loading=true;el('rtDownload').disabled=true;
 say('Downloading worldwide HearHam listings and filtering USA 2m + 70cm amateur repeaters. Existing offline data stays saved until update succeeds.');
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
  await install(raw,'HearHam 2m+70cm');
 }catch(e){
  say('Download blocked or unavailable ('+e.message+'). Use the HearHam JSON link below to save the file, then tap Import JSON file while online.');
 }finally{loading=false;el('rtDownload').disabled=false}
};
map.on('moveend zoomend',function(){if(getAllStations().length)redraw()});
API.onGps=function(){updateStatuses();if(getAllStations().length)redraw()};
(async function(){
 try{
  var c=await readKey('custom-radio-v1');
  if(c&&Array.isArray(c.records))customRecords=c.records.filter(x=>x&&x.id&&x.call&&Number.isFinite(x.mhz)&&isUS(x.lat,x.lon));
  renderPersonal();renderVerifiedLocal();
  var g=await readKey('gmrs-v1');
  if(g&&Array.isArray(g.records)){gmrsData=g.records;gmrsState='ready'}
  else gmrsState='empty';
 }catch(e){gmrsState='error'}
 try{
  var saved=await readSaved();
  if(saved&&Array.isArray(saved.records)&&saved.records.length){
   data=saved.records;completeHamRefresh=String(saved.origin||'').includes('2m+70cm');directoryState='ready';updateStatuses();updateGrowth();
   say('Offline directory ready • '+new Date(saved.savedAt).toLocaleDateString()+' • '+saved.origin);
   redraw();
  }else{directoryState='empty';updateStatuses();redraw();say('The club-confirmed local stations are included. Tap Download USA 2m list while online to add nationwide listings.')}
 }catch(e){directoryState='error';updateStatuses();el('rtCount').textContent='Offline storage unavailable';say('This browser cannot access offline repeater storage: '+e.message)}
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(function(){});
})();