/* ROADTOWER Pro: progressive field command strip.
 * Read-only status summary of EXISTING GPS, aircraft, radar and NWS checks.
 * Never triggers a background service or reports unverified feeds as live.
 */
(function(){
'use strict';
const map=document.getElementById('map');
if(!map)return;
document.body.classList.add('rt-pro-ui');

const strip=document.createElement('nav');
strip.className='rt-command-strip';
strip.id='rtCommandStrip';
strip.setAttribute('aria-label','ROADTOWER field command quick actions');
strip.innerHTML=
 '<div class="rt-command-head">'+
 '<strong class="rt-command-title">◈ ROAD<span>TOWER</span> · FIELD COMMAND</strong>'+
 '<time class="rt-command-clock" id="rtCmdClock" aria-label="Local time">--:--</time></div>'+
 '<div class="rt-command-status" aria-label="Open the corresponding status panel">'+
 '<button id="rtCmdGps" type="button" data-health="warn" title="Open GPS panel">GPS · WAIT</button>'+
 '<button id="rtCmdRadar" type="button" data-health="warn" title="Open radar panel">RADAR · WAIT</button>'+
 '<button id="rtCmdAircraft" type="button" data-health="warn" title="Open aircraft panel">PLANES · WAIT</button>'+
 '<button id="rtCmdStorm" type="button" data-health="warn" title="Open Storms Ahead">NWS · WAIT</button></div>'+
 '<div class="rt-command-actions">'+
 '<button id="rtCmdCenter" type="button" title="Recenter on your GPS position">◎ FIND ME</button>'+
 '<button id="rtCmdUpdate" type="button" title="Request updates from your live feeds">↻ CHECK FEEDS</button>'+
 '</div>';
map.appendChild(strip);
if(window.L&&L.DomEvent){
 L.DomEvent.disableClickPropagation(strip);
 L.DomEvent.disableScrollPropagation(strip);
}
const $=id=>strip.querySelector('#'+id);
function go(id){
 const panels=window.RoadtowerPanelLayout;
 if(panels&&typeof panels.open==='function'){panels.open(id);return}
 const candidates={gps:'.rt-gps-hud',layers:'.rt-live-panel',storm:'.rt-storm-panel'};
 const el=map.querySelector(candidates[id]||'.rt-status-hud');
 if(el)el.scrollIntoView({block:'nearest',behavior:'smooth'});
}
$('rtCmdGps').addEventListener('click',()=>go('gps'));
$('rtCmdRadar').addEventListener('click',()=>go('layers'));
$('rtCmdAircraft').addEventListener('click',()=>go('layers'));
$('rtCmdStorm').addEventListener('click',()=>go('storm'));
$('rtCmdCenter').addEventListener('click',()=>{
 const center=document.getElementById('center');
 if(center&&!center.disabled){center.click();return}
 const quick=document.getElementById('rtGpsQuick');
 if(quick&&!quick.disabled){quick.click();return}
 const start=document.getElementById('start');
 if(start&&!start.disabled)start.click();
});
$('rtCmdUpdate').addEventListener('click',()=>{
 const live=window.RoadtowerLiveLayers;
 const storms=window.RoadtowerStorms;
 if(live&&typeof live.refresh==='function')live.refresh();
 if(storms&&typeof storms.check==='function')storms.check();
 update();
});
function age(ts){return ts?Math.max(0,Date.now()-ts):Infinity}
function put(id,state,label,detail){
 const b=$(id);
 if(!b)return;
 b.dataset.health=state;
 b.textContent=label;
 b.title=detail;
 b.setAttribute('aria-label',detail);
}
function stampClock(){
 const clock=$('rtCmdClock');
 if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}
function update(){
 stampClock();
 const gps=window.RoadtowerRepeaters&&window.RoadtowerRepeaters.getGps&&window.RoadtowerRepeaters.getGps();
 const gpsStatus=map.dataset.gps||'off';
 const gpsValid=gps&&Number.isFinite(gps.latitude)&&Number.isFinite(gps.longitude);
 const accuracy=gpsValid&&Number.isFinite(gps.accuracy)?Math.round(gps.accuracy):null;
 const gpsGood=gpsStatus==='live'&&gpsValid;
 put('rtCmdGps',
  gpsGood?'good':gpsStatus==='searching'?'warn':gpsStatus==='error'?'bad':'off',
  gpsGood?'GPS · ON':gpsStatus==='searching'?'GPS · SEARCH':'GPS · OFF',
  gpsGood?'GPS connected'+(accuracy!==null?' · accuracy ±'+accuracy+' m':''):
   gpsStatus==='searching'?'GPS acquiring position':'GPS off, denied, or unavailable · tap to inspect');

 const live=window.RoadtowerLiveLayers&&window.RoadtowerLiveLayers.getState&&window.RoadtowerLiveLayers.getState();
 if(!live){
  put('rtCmdRadar','warn','RADAR · WAIT','Radar layer not initialized · tap for details');
  put('rtCmdAircraft','warn','PLANES · WAIT','Aircraft layer not initialized · tap for details');
 }else{
  const connected=navigator.onLine!==false;
  const radarAge=age((live.radarFrameTime||0)*1000);
  const checkAge=age(live.radarLastSuccess);
  const radarState=!live.radar?'off':!connected||live.radarLastError?'bad':
   checkAge<=300000&&radarAge<=1800000?'good':
   checkAge<Infinity||radarAge<Infinity?'warn':'warn';
  let radarLabel=!live.radar?'RADAR · OFF':radarState==='good'?'RADAR · OK':
   radarState==='bad'?'RADAR · ERROR':'RADAR · LATE';
  put('rtCmdRadar',radarState,radarLabel,
   !live.radar?'Radar is switched off':live.radarLastError?'Radar error: '+live.radarLastError:
   Number.isFinite(radarAge)?'Radar last image '+Math.round(radarAge/60000)+' min old':
   'Waiting for a verified radar frame');

  const planeAge=age(live.airLastSuccess);
  const airState=!live.aircraft?'off':!connected||live.airLastError?'bad':
   planeAge<=180000?'good':planeAge<Infinity?'warn':'warn';
  put('rtCmdAircraft',airState,
   !live.aircraft?'PLANES · OFF':airState==='good'?'PLANES · OK':
    airState==='bad'?'PLANES · ERROR':'PLANES · WAIT',
   !live.aircraft?'Aircraft tracking switched off':live.airLastError?
    'Aircraft feed error: '+live.airLastError:
    Number.isFinite(planeAge)?(live.planes||0)+' reported planes · last response '+
      Math.round(planeAge/60000)+' min ago':'Waiting for aircraft feed');
 }
 const st=window.RoadtowerStorms&&window.RoadtowerStorms.getState&&window.RoadtowerStorms.getState();
 if(!st){
  put('rtCmdStorm','warn','NWS · WAIT','Storms Ahead not initialized');
 }else{
  const nwAge=age(st.lastCheckedAt);
  const level=!st.enabled?'off':!navigator.onLine||st.error?'bad':
   nwAge<=540000?(st.alerts>0?'warn':'good'):'warn';
  put('rtCmdStorm',level,
   !st.enabled?'NWS · OFF':level==='bad'?'NWS · ERROR':
   st.alerts>0?'NWS · '+st.alerts:
   level==='good'?'NWS · OK':'NWS · WAIT',
   !st.enabled?'Storms Ahead switched off':st.error?'Storms Ahead: '+st.error:
    st.lastCheckedAt?'NWS checked '+Math.round(nwAge/60000)+' min ago · '+
      st.alerts+' reported alerts at sampled points':
    'Waiting for official NWS check');
 }
}
// Full-screen toolbar lives outside #map (above its stacking context).
// Position FIELD COMMAND below the *measured* toolbar height so it cannot
// disappear behind Exit Map / Map mode / CB buttons on narrow Fold screens.
const topToolbar=document.getElementById('mapToolbar');
function alignCommand(){
 if(!document.body.classList.contains('map-fullscreen')){
  map.style.removeProperty('--rt-pro-command-top');
  return;
 }
 const mr=map.getBoundingClientRect();
 const tr=topToolbar&&topToolbar.getBoundingClientRect();
 const measured=tr&&tr.height>0?tr.bottom-mr.top+10:78;
 const safe=Math.max(62,Math.min(Math.round(measured),Math.max(110,mr.height*.33)));
 map.style.setProperty('--rt-pro-command-top',safe+'px');
}
window.addEventListener('resize',alignCommand);
if(typeof ResizeObserver!=='undefined'&&topToolbar){
 const ro=new ResizeObserver(alignCommand);ro.observe(topToolbar);
}
if(typeof MutationObserver!=='undefined'){
 const mo=new MutationObserver(alignCommand);
 mo.observe(document.body,{attributes:true,attributeFilter:['class']});
}
const fullscreenControl=document.getElementById('fullscreenMap');
if(fullscreenControl)fullscreenControl.addEventListener('click',()=>{
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(alignCommand);
 else alignCommand();
});
window.addEventListener('pageshow',alignCommand);
alignCommand();
window.RoadtowerProUI={refresh:update,openPanel:go,align:alignCommand};
update();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
window.addEventListener('pageshow',update);
window.addEventListener('online',update);
window.addEventListener('offline',update);
window.setInterval(()=>{if(!document.hidden)update()},12000);
})();
