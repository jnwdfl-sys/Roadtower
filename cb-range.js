/* ROADTOWER CB radio transmit-range map overlay.
   Illustrative estimate only; not an RF receiver or transmitter. */
(function(){
'use strict';
const rt=window.RoadtowerRepeaters;
const map=rt&&typeof rt.getMap==='function'?rt.getMap():null;
const mapEl=document.getElementById('map'),toolbar=document.getElementById('mapToolbar');
if(!map||!mapEl||!toolbar||!window.L)return;
const MI=1609.344,ON_KEY='roadtower.cb.range.enabled.v1',MILES_KEY='roadtower.cb.range.miles.v1';
const choices=[1,3,5,7,10];
let enabled=true,miles=3,circle=null,point=null;
try{enabled=localStorage.getItem(ON_KEY)!=='false';const saved=Number(localStorage.getItem(MILES_KEY));if(choices.includes(saved))miles=saved}catch(e){}
const css=document.createElement('style');
css.textContent=[
'#map .rt-cb-panel{position:absolute;z-index:1480;top:52%;left:12px;width:min(272px,58%);max-height:45%;overflow:auto;padding:10px;border:2px solid #f5b445;border-radius:13px;background:rgba(29,27,23,.95);color:#fff5de;box-shadow:0 5px 17px #0009;font:600 12px/1.4 system-ui,Arial}',
'#map .rt-cb-panel .rt-cb-bar{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}',
'#map .rt-cb-panel strong{font-size:15px;color:#ffe19c}',
'#map .rt-cb-panel button{cursor:pointer;border:1px solid #ffd06c;border-radius:8px;background:#76511f;color:#fff;padding:9px;font:800 12px system-ui,Arial}',
'#map .rt-cb-panel button[aria-pressed="true"]{background:#d38c22;color:#1e180c}',
'#map .rt-cb-panel label{display:block;margin-top:8px;color:#ffdfb5;font-weight:700}',
'#map .rt-cb-panel select{display:block;width:100%;background:#312d24;color:#fff;border:1px solid #e8b65f;border-radius:7px;margin:4px 0 8px;padding:9px;font:600 12px system-ui,Arial}',
'#map .rt-cb-panel .rt-cb-warning{margin:6px 0 0;color:#dacbb2;font-size:11px;font-weight:400}',
'#map .rt-cb-panel .rt-cb-status{margin-top:8px;padding:7px;background:#3c2e1e;border-radius:7px}',
'#map #rtLayoutTray .rt-dot-cb{--rt-dot:#ffb43a}',
'#mapToolbar #rtCbQuickToggle{background:#734717;color:#fff7da;border:1px solid #ffcc6d;white-space:nowrap}',
'#mapToolbar #rtCbQuickToggle[aria-pressed="true"]{background:#bb781c;border-color:#ffdf91;color:#120d05}',
'body.map-fullscreen #mapToolbar #rtCbQuickToggle{display:inline-block!important;font-size:12px;padding:8px 9px}',
'@media(max-width:470px){#map .rt-cb-panel{width:min(218px,58%);padding:7px}#map .rt-cb-panel strong{font-size:12px}body.map-fullscreen #mapToolbar #rtCbQuickToggle{font-size:11px;padding:8px 6px}}'
].join('\n');
document.head.appendChild(css);
const quick=document.createElement('button');
quick.id='rtCbQuickToggle';quick.type='button';quick.title='Show or hide estimated CB transmit range';
quick.setAttribute('aria-label','Toggle estimated CB radio transmission range');
toolbar.appendChild(quick);
const panel=document.createElement('section');
panel.id='rtCbPanel';panel.className='rt-cb-panel';
panel.setAttribute('aria-label','CB radio transmit-range options');
panel.innerHTML='<div class="rt-cb-bar"><strong>📻 CB RADIO • TX RANGE</strong><button type="button" id="rtCbToggle" aria-pressed="true">ON</button></div>'+
'<label for="rtCbMiles">Estimated coverage radius</label>'+
'<select id="rtCbMiles"><option value="1">1 mile • hills / buildings</option><option value="3">3 miles • typical mobile</option><option value="5">5 miles • open terrain</option><option value="7">7 miles • excellent conditions</option><option value="10">10 miles • optimistic / ideal</option></select>'+
'<div class="rt-cb-status" id="rtCbStatus" role="status">Waiting for live GPS…</div>'+
'<button id="rtCbShow" type="button" style="margin-top:8px">Show entire circle</button>'+
'<p class="rt-cb-warning">Amber circle = estimated CB transmit area from your GPS, not measured coverage. Hills, antennas, trees, interference and propagation can change real range. No CB signal is scanned or transmitted by this app.</p>';
mapEl.appendChild(panel);
if(L.DomEvent){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel);}
const toggle=panel.querySelector('#rtCbToggle'),selector=panel.querySelector('#rtCbMiles');
const status=panel.querySelector('#rtCbStatus'),show=panel.querySelector('#rtCbShow');
selector.value=String(miles);
function validGps(p){return p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
function removeCircle(){if(circle){map.removeLayer(circle);circle=null;}}
function paint(p){
 if(p!==undefined)point=validGps(p)?{lat:p.latitude,lng:p.longitude}:null;
 const live=rt&&typeof rt.getGps==='function'?rt.getGps():null;
 if(!validGps(live))point=null;
 else if(!point)point={lat:live.latitude,lng:live.longitude};
 toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'ON':'OFF';
 quick.setAttribute('aria-pressed',String(enabled));quick.textContent=enabled?'📻 CB ON':'📻 CB OFF';
 quick.title='CB transmit-range estimate: '+(enabled?'ON':'OFF')+', '+miles+' mile radius';
 if(!enabled){removeCircle();status.textContent='CB range hidden. Switch ON to show it.';show.disabled=true;return;}
 if(!point){removeCircle();status.textContent='Waiting for live GPS. Tap Start GPS and allow location access.';show.disabled=true;return;}
 const pos=[point.lat,point.lng],radius=miles*MI;
 if(!circle)circle=L.circle(pos,{radius,color:'#f5a72e',weight:3,opacity:.95,dashArray:'9 7',fillColor:'#ffae27',fillOpacity:.09,interactive:false}).addTo(map);
 else{circle.setLatLng(pos);circle.setRadius(radius);}
 status.textContent='CB estimate: '+miles+' mile radius around your live location.';show.disabled=false;
}
function setEnabled(on){enabled=Boolean(on);try{localStorage.setItem(ON_KEY,String(enabled))}catch(e){}paint();}
toggle.addEventListener('click',()=>setEnabled(!enabled));
quick.addEventListener('click',()=>setEnabled(!enabled));
selector.addEventListener('change',()=>{const n=Number(selector.value);if(!choices.includes(n))return;miles=n;try{localStorage.setItem(MILES_KEY,String(miles))}catch(e){}paint();});
show.addEventListener('click',()=>{if(circle)map.fitBounds(circle.getBounds().pad(.15));});
const previous=rt.onGps;
rt.onGps=function(coords){if(typeof previous==='function')previous(coords);paint(coords);};
for(const id of ['stop','rtGpsStopQuick']){const b=document.getElementById(id);if(b)b.addEventListener('click',()=>setTimeout(()=>paint(),0));}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint();});
window.addEventListener('pageshow',()=>paint());
setInterval(()=>{if(enabled&&document.visibilityState==='visible')paint();},6000);
paint();
window.RoadtowerCBRange={isOn:()=>enabled,getMiles:()=>miles,setOn:setEnabled};
})();