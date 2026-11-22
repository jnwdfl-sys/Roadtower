/* ROADTOWER read-only APRS call sign tracker. No radio transmission.
   Only shows APRS positions returned by a verified public provider response.
   A saved call sign stays in this browser's localStorage on this device. */
(function(){
'use strict';
const rt=window.RoadtowerRepeaters,map=rt&&rt.getMap&&rt.getMap();
const host=document.getElementById('map');
if(!map||!host||!window.L)return;
const KEY='roadtower.aprs.trackedCall.v1';
const INTERVAL=120000;
const valid=c=>/^[A-Z0-9]{3,10}(?:-(?:1[0-5]|[0-9]))?$/.test(c);
let selected='',enabled=false,checkedAt=0,lastSuccess=0,busy=false;
let position=null,marker=null,queryId=0,latestError='';
try{
 const value=String(localStorage.getItem(KEY)||'').toUpperCase().trim();
 if(valid(value)){selected=value;enabled=true}
}catch(_){}
const css=document.createElement('style');
css.textContent=[
 '#map .rt-aprs-panel{position:absolute;left:12px;top:42%;z-index:1465;width:min(310px,77%);max-height:54%;overflow:auto;overscroll-behavior:contain;padding:11px;border:2px solid #b392fa;border-radius:13px;color:#f1faff;background:rgba(10,25,44,.97);box-shadow:0 5px 18px #0019;font:650 12px/1.5 system-ui,Arial}',
 '#map .rt-aprs-title{display:block;color:#e1cfff;font:900 17px/1.3 system-ui,Arial;margin-bottom:8px}',
 '#map .rt-aprs-panel label{display:block;margin:8px 0 5px;font-size:12px;color:#d7e5ff}',
 '#map .rt-aprs-panel input{display:block;width:100%;min-height:43px;padding:10px;border-radius:9px;background:#102e48;border:1px solid #a9a4db;color:#fff;font:800 15px system-ui,Arial}',
 '#map .rt-aprs-actions{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}',
 '#map .rt-aprs-actions button,#map .rt-aprs-actions a{display:inline-flex;align-items:center;justify-content:center;flex:1 1 118px;text-align:center;padding:9px;border:1px solid #b7a2f0;border-radius:9px;background:#493780;color:#fff;min-height:38px;font:800 12px system-ui,Arial;text-decoration:none;cursor:pointer}',
 '#map .rt-aprs-actions button[aria-pressed="false"]{background:#344858;border-color:#8194a4}',
 '#map .rt-aprs-status{background:#1d3449;border-left:3px solid #ae8ef3;padding:8px;overflow-wrap:anywhere;margin:8px 0}',
 '#map .rt-aprs-note{font:500 11px/1.5 system-ui,Arial;color:#bbd1e4;margin:8px 0}',
 '#map .rt-aprs-icon{background:none!important;border:none!important}',
 '#map .rt-aprs-icon span{display:grid;place-items:center;width:25px;height:25px;border:2px solid #fff;border-radius:50%;background:#8745e9;color:white;font:900 14px system-ui,Arial;box-shadow:0 0 2px 2px #341760,0 0 8px 2px #b990ff}',
 '#map .rt-aprs-icon.rt-aprs-old span{background:#5d5b65;box-shadow:0 0 5px #999}',
 '#map #rtLayoutTray .rt-dot-aprs{--rt-dot:#ba9bff}',
 '@media(max-width:470px){#map .rt-aprs-panel{width:min(245px,67%);padding:8px}.rt-aprs-title{font-size:15px}}'
].join('\n');
document.head.appendChild(css);
const panel=document.createElement('section');
panel.id='rtAprsPanel';panel.className='rt-aprs-panel';
panel.setAttribute('aria-label','Public APRS station tracking by call sign');
panel.innerHTML=
 '<strong class="rt-aprs-title">📡 APRS CALL SIGN TRACKER</strong>'+
 '<label for="rtAprsCall">Call sign to track (optional SSID, e.g. W1AW-9)</label>'+
 '<input id="rtAprsCall" type="text" maxlength="15" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter call sign">'+
 '<div class="rt-aprs-actions"><button id="rtAprsSave" type="button">Save & track</button>'+
 '<button id="rtAprsToggle" type="button" aria-pressed="false">AUTO: OFF</button>'+
 '<button id="rtAprsRefresh" type="button">↻ Check now</button></div>'+
 '<div class="rt-aprs-actions"><button id="rtAprsShow" type="button">Show on map</button>'+
 '<a id="rtAprsWorld" href="https://aprs.world/" target="_blank" rel="noopener noreferrer">APRS World</a>'+
 '<a id="rtAprsFi" href="https://aprs.fi/" target="_blank" rel="noopener noreferrer">APRS.fi</a></div>'+
 '<div id="rtAprsStatus" class="rt-aprs-status" role="status">Enter a call sign to find public APRS reports.</div>'+
 '<p class="rt-aprs-note">Read-only: no beacon or phone GPS transmission. Public positions appear only if the station reports to APRS-IS and the feed is available. Reports may be missing, inaccurate, or old; watch the age before relying on them.</p>';
host.appendChild(panel);
if(L.DomEvent){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel)}
const input=panel.querySelector('#rtAprsCall');
const save=panel.querySelector('#rtAprsSave');
const toggle=panel.querySelector('#rtAprsToggle'),check=panel.querySelector('#rtAprsRefresh');
const show=panel.querySelector('#rtAprsShow'),status=panel.querySelector('#rtAprsStatus');
const linkWorld=panel.querySelector('#rtAprsWorld'),linkFi=panel.querySelector('#rtAprsFi');
input.value=selected;
function ageText(ts){
 if(!ts)return 'report time unknown';
 const sec=Math.max(0,Math.floor((Date.now()-ts)/1000));
 if(sec<60)return sec+' sec old';
 if(sec<3600)return Math.floor(sec/60)+' min old';
 if(sec<86400)return Math.floor(sec/3600)+' hr old';
 return Math.floor(sec/86400)+' days old';
}
function isRecent(p){return !!(p&&p.reportedAt&&Date.now()-p.reportedAt<=1800000)}
function removeMarker(){if(marker){map.removeLayer(marker);marker=null}}
function linkUpdate(){
 linkWorld.href=selected?'https://aprs.world/station/'+encodeURIComponent(selected):'https://aprs.world/';
 linkFi.href=selected?'https://aprs.fi/#!call='+encodeURIComponent(selected):'https://aprs.fi/';
}
function render(){
 toggle.textContent=enabled?'AUTO: ON':'AUTO: OFF';
 toggle.setAttribute('aria-pressed',String(enabled));
 linkUpdate();
 if(!position){removeMarker();return}
 const recent=isRecent(position);
 const icon=L.divIcon({className:'rt-aprs-icon'+(recent?'':' rt-aprs-old'),
  html:'<span aria-hidden="true">📡</span>',iconSize:[25,25],iconAnchor:[12,12]});
 if(!marker)marker=L.marker([position.latitude,position.longitude],{
  icon,title:'APRS '+position.callsign}).addTo(map);
 else{marker.setLatLng([position.latitude,position.longitude]);marker.setIcon(icon)}
 const popup=document.createElement('div');
 const title=document.createElement('strong');
 title.textContent='APRS '+(position.callsign||selected);popup.appendChild(title);
 const detail=document.createElement('p');
 detail.textContent='Public position • '+ageText(position.reportedAt)+
  ' • source: '+position.source+' • '+position.latitude.toFixed(5)+', '+position.longitude.toFixed(5)+
  (position.comment?' • '+position.comment:'');
 popup.appendChild(detail);
 marker.bindPopup(popup,{maxWidth:280});
}
function message(s){status.textContent=s}
function setOn(value){
 enabled=Boolean(value)&&valid(selected);
 render();
 if(enabled){message('APRS tracking ON for '+selected+' • checking public reports…');load(true)}
 else message(selected?'APRS auto updates OFF. Saved call sign: '+selected:'Enter a call sign to start.');
}
async function load(force=false){
 if(!enabled||!valid(selected)||busy||document.hidden)return;
 if(!navigator.onLine){latestError='Offline';message('APRS tracking waiting for internet.');return}
 const now=Date.now();
 if(!force&&now-checkedAt<INTERVAL)return;
 if(now-checkedAt<15000){message('APRS check available shortly • last check '+new Date(checkedAt).toLocaleTimeString());return}
 const name=selected,requestId=++queryId;
 checkedAt=now;busy=true;check.disabled=true;
 message('Searching public APRS position for '+name+'…');
 try{
  const resp=await fetch('./api/aprs?call='+encodeURIComponent(name),{cache:'no-store'});
  const data=await resp.json();
  if(name!==selected||requestId!==queryId)return;
  if(!resp.ok){
   const reason=String(data.error||'APRS provider unavailable');
   if(resp.status===404){
    position=null;removeMarker();latestError=reason;
    message('No verified public position for '+name+'. Check the station on APRS.fi or APRS World.');
   }else{
    latestError=reason;
    message('APRS feed unavailable for '+name+': '+reason+
     (position?' • Last verified report '+ageText(position.reportedAt):''));
   }
   return;
  }
  const p=data.position;
  if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))throw Error('No valid APRS coordinates in reply');
  position={callsign:String(p.callsign||name),latitude:p.latitude,longitude:p.longitude,
   reportedAt:Number.isFinite(p.reportedAt)?p.reportedAt:null,
   comment:String(p.comment||'').slice(0,180),source:String(data.source||'public APRS')};
  lastSuccess=Date.now();latestError='';
  render();
  message('APRS '+position.callsign+' • '+ageText(position.reportedAt)+
   (isRecent(position)?' • recently reported':' • OLD or unverified report time')+
   ' • '+position.source+' • checked '+new Date().toLocaleTimeString());
 }catch(e){
  latestError=String(e.message||e);
  message('APRS lookup failed: '+latestError+'.'+(position?' Last known position '+ageText(position.reportedAt):''));
 }finally{busy=false;check.disabled=false}
}
save.addEventListener('click',()=>{
 const value=input.value.trim().toUpperCase();
 if(!valid(value)){
  message('Enter a valid-looking ham call sign such as W1AW or W1AW-9. SSID may be 0–15.');
  return;
 }
 selected=value;position=null;removeMarker();queryId++;checkedAt=0;
 try{localStorage.setItem(KEY,selected)}catch(_){}
 setOn(true);
});
input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click()}});
toggle.addEventListener('click',()=>{if(!selected){message('Enter and save the call sign first.');return}setOn(!enabled)});
check.addEventListener('click',()=>{if(!enabled&&valid(selected)){enabled=true;render()}load(true)});
show.addEventListener('click',()=>{
 if(!position){message('No reported APRS position to show. Enter a call sign and check first.');return}
 map.setView([position.latitude,position.longitude],Math.max(9,map.getZoom()));
 if(marker)marker.openPopup();
});
window.addEventListener('online',()=>{if(enabled)load(true)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled)load(false)});
window.setInterval(()=>{if(enabled&&!document.hidden)load(false)},15000);
window.RoadtowerAPRS={getState:()=>({trackedCall:selected,enabled,checkedAt,lastSuccess,
 lastError:latestError,position}),
 track:c=>{input.value=String(c||'');save.click()},setOn};
render();
if(enabled){message('Saved call sign '+selected+' • checking for APRS reports…');load(true)}
})();
