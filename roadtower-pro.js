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
// All functions formerly in the permanent top / bottom screen bars
// are preserved here. These controls act on the original ROADTOWER
// buttons so map, CB, offline, and GPS behavior remains unchanged.
const toolsPanel=document.createElement('section');
toolsPanel.className='rt-map-tools-panel';
toolsPanel.id='rtMapToolsPanel';
toolsPanel.setAttribute('aria-label','ROADTOWER map and GPS controls');
toolsPanel.innerHTML=
 '<strong class="rt-map-tools-title">⚙ MAP & GPS TOOLS</strong>'+
 '<p class="rt-map-tools-intro">Your map stays full-screen. Open only the controls you need; minimize this panel to its TOOLS dot.</p>'+
 '<div class="rt-font-controls" role="group" aria-label="ROADTOWER text size">'+
 '<span class="rt-font-label">Text size</span>'+
 '<button id="rtFontSmaller" type="button" aria-label="Make all panel text smaller">A−</button>'+
 '<output id="rtFontValue" aria-live="polite">18 pt</output>'+
 '<button id="rtFontLarger" type="button" aria-label="Make all panel text larger">A+</button></div>'+
 '<div class="rt-map-tools-grid">'+
 '<button id="rtToolGps" type="button">◎ Start / Find GPS</button>'+
 '<button id="rtToolStop" type="button">■ Stop GPS</button>'+
 '<button id="rtToolFollow" type="button">↗ Follow GPS: ON</button>'+
 '<button id="rtToolMap" type="button">🗺 Map mode: AUTO</button>'+
 '<button id="rtToolCB" type="button">📻 CB ON/OFF</button>'+
 '<button id="rtToolHAM" type="button" aria-pressed="false">🟢 HAM RANGE: OFF</button>'+
 '<button id="rtToolRangeSettings" type="button">📏 Range settings</button>'+
 '<button id="rtToolRadio" type="button">📡 Repeaters</button>'+
 '<button id="rtToolLive" type="button">✈ Aircraft / Radar</button>'+
 '<button id="rtToolOffline" type="button">⬇ Offline Map Setup</button>'+
 '<button id="rtToolClear" type="button" class="rt-map-tool-clear">◱ Minimize all panels</button>'+
 '<button id="rtToolResetDots" type="button">⇥ Dock DOTS right</button>'+
 '</div>'+
 '<p class="rt-map-tools-intro">Offline Map Setup temporarily opens the regular settings page. Use Full Screen there to return. Chrome’s browser bars are controlled by Android, not by this website.</p>';
map.appendChild(toolsPanel);
if(window.L&&L.DomEvent){
 L.DomEvent.disableClickPropagation(toolsPanel);
 L.DomEvent.disableScrollPropagation(toolsPanel);
}
const tool=id=>toolsPanel.querySelector('#'+id);
// Persist the same readable typography across MAP TOOLS, HAM/GMRS, APRS,
// aircraft, radar, Storms Ahead and every other information panel.
// A single default is larger than the previous 11-13px panel styles.
const FONT_KEY='roadtower.ui.fontPointSize.v1';
const FONT_OPTIONS=[16,18,20,22,24];
let fontPoints=18;
try{
 const n=Number(localStorage.getItem(FONT_KEY));
 if(FONT_OPTIONS.includes(n))fontPoints=n;
}catch(_){}
function syncReadableFont(){
 document.body.style.setProperty('--rt-readable-size',fontPoints+'pt');
 document.body.style.setProperty('--rt-readable-title',(fontPoints+3)+'pt');
 tool('rtFontValue').textContent=fontPoints+' pt';
 tool('rtFontSmaller').disabled=fontPoints===FONT_OPTIONS[0];
 tool('rtFontLarger').disabled=fontPoints===FONT_OPTIONS[FONT_OPTIONS.length-1];
}
function changeFont(delta){
 const idx=FONT_OPTIONS.indexOf(fontPoints);
 fontPoints=FONT_OPTIONS[Math.min(FONT_OPTIONS.length-1,Math.max(0,idx+delta))];
 try{localStorage.setItem(FONT_KEY,String(fontPoints))}catch(_){}
 syncReadableFont();
}
tool('rtFontSmaller').addEventListener('click',()=>changeFont(-1));
tool('rtFontLarger').addEventListener('click',()=>changeFont(1));
syncReadableFont();
function proxy(id){
 const button=document.getElementById(id);
 if(button&&!button.disabled){button.click();return true}
 return false;
}
function syncTools(){
 const follow=document.getElementById('followMap');
 const mapMode=document.getElementById('offlineQuickMode');
 const cb=document.getElementById('rtCbQuickToggle');
 const radioRange=window.RoadtowerCBRange;
 const stop=document.getElementById('stop');
 tool('rtToolFollow').textContent=follow?.textContent||'Follow GPS';
 tool('rtToolMap').textContent=mapMode?.textContent||'Map mode';
 tool('rtToolCB').textContent=cb?.textContent||'CB range';
 const ham=radioRange&&typeof radioRange.isHamOn==='function'?
  radioRange.isHamOn():null;
 const hamControl=tool('rtToolHAM');
 hamControl.textContent=ham===null?'🟢 HAM RANGE: CHECK':
  ham?'🟢 HAM RANGE: ON':'🟢 HAM RANGE: OFF';
 hamControl.setAttribute('aria-pressed',String(ham===true));
 hamControl.dataset.active=ham===true?'true':'false';
 hamControl.title=ham===true?
  'HAM 2m simplex planning circles: solid green 5 miles, dashed green 20 miles. Requires GPS.':
  'Enable the 5 and 20 mile HAM simplex planning circles around your GPS.';
 tool('rtToolStop').disabled=!stop||stop.disabled;
}
tool('rtToolGps').addEventListener('click',()=>{
 const center=document.getElementById('center');
 if(center&&!center.disabled)proxy('center');
 else proxy('start');
 syncTools();
});
tool('rtToolStop').addEventListener('click',()=>{proxy('stop');syncTools()});
tool('rtToolFollow').addEventListener('click',()=>{proxy('followMap');syncTools()});
tool('rtToolMap').addEventListener('click',()=>{proxy('offlineQuickMode');syncTools()});
tool('rtToolCB').addEventListener('click',()=>{proxy('rtCbQuickToggle');syncTools()});
tool('rtToolHAM').addEventListener('click',()=>{
 const radioRange=window.RoadtowerCBRange;
 if(radioRange&&typeof radioRange.setHamOn==='function'){
  radioRange.setHamOn(!radioRange.isHamOn());
  radioRange.refresh?.();
  syncTools();
 }else go('cb');
});
tool('rtToolRangeSettings').addEventListener('click',()=>go('cb'));
tool('rtToolRadio').addEventListener('click',()=>go('radio'));
tool('rtToolLive').addEventListener('click',()=>go('layers'));
tool('rtToolClear').addEventListener('click',()=>{
 window.RoadtowerPanelLayout?.minimizeAll?.();
});
tool('rtToolResetDots').addEventListener('click',()=>{
 window.RoadtowerPanelLayout?.resetDock?.();
});
tool('rtToolOffline').addEventListener('click',()=>{
 const fullscreen=document.getElementById('fullscreenMap');
 if(document.body.classList.contains('map-fullscreen')&&fullscreen)fullscreen.click();
 const offline=document.getElementById('offlineTravelCard');
 if(offline)offline.scrollIntoView({behavior:'smooth',block:'start'});
});
toolsPanel.addEventListener('click',syncTools);
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
 stampClock();syncTools();
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
 }else{
  const mr=map.getBoundingClientRect();
  const tr=topToolbar&&topToolbar.getBoundingClientRect();
  const measured=tr&&tr.height>0?tr.bottom-mr.top+10:10;
  const safe=tr&&tr.height>0?
    Math.max(10,Math.min(Math.round(measured),Math.max(110,mr.height*.33))):10;
  map.style.setProperty('--rt-pro-command-top',safe+'px');
 }
 // Once the strip is measured, keep the default DOTS rail beside it instead
 // of restoring an old centered position.
 const manager=window.RoadtowerPanelLayout;
 if(manager&&typeof manager.reflowDock==='function'){
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>manager.reflowDock());
  else manager.reflowDock();
 }
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
window.RoadtowerProUI={refresh:update,openPanel:go,align:alignCommand,refreshTools:syncTools};
update();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
window.addEventListener('pageshow',update);
window.addEventListener('online',update);
window.addEventListener('offline',update);
window.setInterval(()=>{if(!document.hidden)update()},12000);
})();
