/* ROADTOWER + Waze companion.
   Official Waze deep links launch Waze for navigation. Waze alerts remain
   inside Waze; ROADTOWER browser location/alerts are NOT guaranteed to run
   when Android backgrounds the browser. Split screen is best effort. */
(function(){
'use strict';
const map=document.getElementById('map');
if(!map||!window.L)return;
const style=document.createElement('style');
style.textContent=[
 '#map .rt-waze-panel{position:absolute;z-index:1475;top:43%;right:12px;width:min(315px,76%);max-height:53%;overflow:auto;padding:11px;border:2px solid #50cdd0;border-radius:13px;background:rgba(9,33,49,.97);color:#f0faff;box-shadow:0 5px 19px #001b;font:600 12px/1.5 system-ui,Arial}',
 '#map .rt-waze-title{display:block;font:900 17px/1.3 system-ui,Arial;color:#7ff3e7;margin-bottom:9px}',
 '#map .rt-waze-panel label{display:block;color:#c9e5f0;font-weight:800;margin:7px 0 5px}',
 '#map .rt-waze-panel input{display:block;width:100%;min-height:43px;padding:10px;border:1px solid #77b9c8;border-radius:8px;background:#102e43;color:#fff;font:700 14px system-ui,Arial}',
 '#map .rt-waze-panel .rt-waze-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}',
 '#map .rt-waze-panel a.rt-waze-go,#map .rt-waze-panel button{display:inline-flex;justify-content:center;align-items:center;min-height:41px;flex:1 1 125px;text-align:center;padding:9px;text-decoration:none;border:1px solid #a7f1e7;border-radius:9px;background:#128e83;color:#fff;font:850 12px system-ui,Arial;cursor:pointer}',
 '#map .rt-waze-panel .rt-waze-secondary{background:#24566e!important;border-color:#7dbac9!important}',
 '#map .rt-waze-panel .rt-waze-notice{padding:8px;background:#193a49;border-left:3px solid #f0b765;margin:8px 0;border-radius:5px;color:#d3eaf4;font:500 11px/1.5 system-ui,Arial}',
 '#map .rt-waze-panel .rt-waze-steps{padding-left:20px;margin:6px 0;color:#cee8f0;font:550 11px/1.65 system-ui,Arial}',
 '#map .rt-waze-panel .rt-waze-steps li{margin:3px 0}',
 '#map .rt-waze-panel .rt-waze-status{font:600 11px system-ui,Arial;color:#fcdf9f;margin:7px 0}',
 '#map #rtLayoutTray .rt-dot-waze{--rt-dot:#3ae1ce}',
 '@media(max-width:470px){#map .rt-waze-panel{width:min(240px,67%);padding:8px}.rt-waze-title{font-size:14px}}'
].join('\n');
document.head.appendChild(style);
const panel=document.createElement('section');
panel.id='rtWazePanel';panel.className='rt-waze-panel';
panel.setAttribute('aria-label','Waze and Roadtower together navigation companion');
panel.innerHTML=
 '<strong class="rt-waze-title">🚙 WAZE + ROADTOWER</strong>'+
 '<label for="rtWazeDestination">Enter address or place name</label>'+
 '<input id="rtWazeDestination" type="search" autocomplete="street-address" maxlength="180" placeholder="Street address, business, or destination">'+
 '<div class="rt-waze-actions"><a id="rtWazeGo" class="rt-waze-go" href="https://waze.com/ul" target="_blank" rel="noopener noreferrer">▶ Navigate in Waze</a>'+
 '<button id="rtWazeStormCheck" type="button" class="rt-waze-secondary">⛈ Check storms first</button></div>'+
 '<div id="rtWazeStatus" class="rt-waze-status" role="status">Waze provides directions and reported road hazards. ROADTOWER provides weather and radio.</div>'+
 '<div class="rt-waze-actions"><a id="rtWazeOpen" class="rt-waze-go rt-waze-secondary" href="https://waze.com/ul" target="_blank" rel="noopener noreferrer">Open Waze (no destination)</a></div>'+
 '<strong>Keep both visible (Android Fold):</strong>'+
 '<ol class="rt-waze-steps"><li>Open ROADTOWER in Chrome, then Waze.</li>'+
 '<li>Open Recent apps and choose Split screen from the app icon/menu.</li>'+
 '<li>Choose Chrome for the other half. Waze handles navigation and its police/obstacle reports; ROADTOWER shows weather and radios.</li>'+
 '<li>Save the app pair on your home screen if your phone offers it.</li></ol>'+
 '<p class="rt-waze-notice">Waze reports are not imported into ROADTOWER. Split-screen weather updates are best effort and depend on Android/Chrome activity. If Waze is full-screen, the ROADTOWER web app may stop receiving GPS or weather checks. Reliable background spoken weather alerts require a native Android app.</p>';
map.appendChild(panel);
if(L.DomEvent){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel)}
const destination=panel.querySelector('#rtWazeDestination');
const link=panel.querySelector('#rtWazeGo'),msg=panel.querySelector('#rtWazeStatus');
function navigateLink(q){
 const name=String(q||'').trim();
 return name?'https://waze.com/ul?q='+encodeURIComponent(name)+'&navigate=yes':'https://waze.com/ul';
}
function update(){
 const q=destination.value.trim();
 link.href=navigateLink(q);
 link.textContent=q?'▶ Navigate to destination':'▶ Open Waze';
 msg.textContent=q?'Waze will locate “'+q.slice(0,80)+'” and start navigation if found. Police and object alerts are delivered by Waze.':
  'Enter an address or place name. Waze provides directions and road hazard alerts.';
}
destination.addEventListener('input',update);
destination.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&destination.value.trim()){
  e.preventDefault();link.click();
 }
});
panel.querySelector('#rtWazeStormCheck').addEventListener('click',()=>{
 const api=window.RoadtowerStorms;
 if(api&&typeof api.check==='function'){
  api.check();
  msg.textContent='Storms Ahead check requested. Tap the ⛈ STORM dot for official NWS results before driving.';
  if(window.RoadtowerPanelLayout)window.RoadtowerPanelLayout.open('storm');
 }else msg.textContent='Storms Ahead is unavailable; check official weather alerts before traveling.';
});
update();
window.RoadtowerWaze={
 linkFor:navigateLink,
 toCoordinates:(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)?
  'https://waze.com/ul?ll='+lat.toFixed(6)+','+lon.toFixed(6)+'&navigate=yes':null,
 navigate:(query)=>window.open(navigateLink(query),'_blank','noopener,noreferrer')
};
})();
