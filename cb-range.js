/* ROADTOWER equipment-based radio planning overlays.
   Circles estimate local station-to-station radio reach, NOT measured RF coverage.
   GPS never leaves the device for these drawings. HAM repeater data is separate. */
(function(){
'use strict';
const api=window.RoadtowerRepeaters;
const map=api&&typeof api.getMap==='function'?api.getMap():null;
const root=document.getElementById('map');
const toolbar=document.getElementById('mapToolbar');
if(!map||!root||!toolbar||!window.L)return;

const MILE=1609.344;
const K={
 cb:'roadtower.cb.range.enabled.v1',
 near:'roadtower.cb.range.near.v2',
 far:'roadtower.cb.range.far.v2',
 legacy:'roadtower.cb.range.miles.v1',
 ham:'roadtower.ham.simplex.enabled.v1'
};
const read=(k,fallback)=>{try{const v=localStorage.getItem(k);return v===null?fallback:v}catch(e){return fallback}};
const save=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(e){}};
const nearChoices=[1,2,3,5];
const farChoices=[5,7,10];
let cbOn=read(K.cb,'true')!=='false';
// Keep HAM simplex range visible for new installs; respect explicit saved OFF.
let hamOn=read(K.ham,'true')!=='false';
const legacy=Number(read(K.legacy,'3'));
let near=Number(read(K.near,String(nearChoices.includes(legacy)?legacy:3)));
let far=Number(read(K.far,'10'));
if(!nearChoices.includes(near))near=3;
if(!farChoices.includes(far))far=10;
if(near>far)far=near;
let coords=null;
const drawn={cbNear:null,cbFar:null,hamNear:null,hamFar:null};

const style=document.createElement('style');
style.textContent=[
'#map .rt-cb-panel{position:absolute;z-index:1480;top:50%;left:12px;width:min(295px,65%);max-height:55%;overflow:auto;padding:11px;border:2px solid #e8a94b;border-radius:14px;background:rgba(22,29,33,.96);color:#f5f9ff;box-shadow:0 5px 22px #000a;font:600 12px/1.5 system-ui,Arial;overscroll-behavior:contain}',
'#map .rt-cb-panel .rt-cb-heading{font-size:17px;font-weight:900;color:#ffe4b0;margin:0 0 8px}',
'#map .rt-cb-panel .rt-cb-row{display:flex;align-items:center;gap:9px;justify-content:space-between;margin:8px 0}',
'#map .rt-cb-panel .rt-cb-module{border:1px solid #647b85;background:#112937;border-radius:10px;padding:9px;margin:8px 0}',
'#map .rt-cb-panel .rt-cb-module.cb{border-color:#a96c2c}',
'#map .rt-cb-panel .rt-cb-module.ham{border-color:#308c79}',
'#map .rt-cb-panel .rt-cb-name{display:block;font-size:14px;font-weight:850}',
'#map .rt-cb-panel .rt-cb-gear{color:#c9d5dc;font-size:11px;font-weight:500;margin:4px 0 8px}',
'#map .rt-cb-panel label{display:block;font:700 12px system-ui,Arial;color:#f4dfbd;margin:8px 0 3px}',
'#map .rt-cb-panel select{width:100%;background:#203745;color:#fff;border:1px solid #5c8498;border-radius:8px;padding:9px;margin:0;font:700 12px system-ui,Arial}',
'#map .rt-cb-panel button{cursor:pointer;padding:8px 10px;border:1px solid #b8d0da;background:#294f63;color:#fff;border-radius:8px;font:800 12px system-ui,Arial}',
'#map .rt-cb-panel button[aria-pressed="true"]{border-color:#f5c26f;background:#d38c22;color:#1b180e}',
'#map .rt-cb-panel #rtHamSimplexToggle[aria-pressed="true"]{background:#179979;color:#061d19;border-color:#aafae1}',
'#map .rt-cb-panel .rt-cb-status{border:1px solid #5f7c8a;background:#113041;padding:8px;border-radius:9px;margin:10px 0}',
'#map .rt-cb-panel .rt-cb-note{color:#c8d8df;font:500 11px/1.45 system-ui,Arial;margin:7px 0}',
'#map .rt-cb-panel .rt-cb-legend{display:flex;flex-direction:column;gap:4px;margin:8px 0;font-size:11px}',
'#map .rt-cb-panel .rt-swatch{display:inline-block;width:19px;height:9px;border-radius:3px;margin-right:5px;vertical-align:middle}',
'#map .rt-cb-panel .rt-swatch.cb-near{background:#ffad37;border:2px solid #ffd278}',
'#map .rt-cb-panel .rt-swatch.cb-far{background:#643f1d;border:2px dashed #ffb45d}',
'#map .rt-cb-panel .rt-swatch.ham-near{background:#39ac81;border:2px solid #82f1ba}',
'#map .rt-cb-panel .rt-swatch.ham-far{background:#143d35;border:2px dashed #69e8bf}',
'#map .rt-cb-panel .rt-cb-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}',
'#map #rtLayoutTray .rt-dot-cb{--rt-dot:#ffb43a}',
'#mapToolbar #rtCbQuickToggle{background:#714819;color:#fff6dc;border:1px solid #ffcf76;white-space:nowrap}',
'#mapToolbar #rtCbQuickToggle[aria-pressed="true"]{background:#c3862a;color:#1c1307;border-color:#ffe3a1}',
'body.map-fullscreen #mapToolbar #rtCbQuickToggle{display:inline-block!important;font-size:11px;padding:8px 9px}',
'body.map-fullscreen #mapToolbar{flex-wrap:wrap}',
'@media(max-width:470px){#map .rt-cb-panel{width:min(230px,60%);padding:7px}#map .rt-cb-panel .rt-cb-heading{font-size:14px}body.map-fullscreen #mapToolbar #rtCbQuickToggle{font-size:10px;padding:8px 6px}}'
].join('\n');
document.head.appendChild(style);

const quick=document.createElement('button');
quick.id='rtCbQuickToggle';
quick.type='button';
quick.title='Toggle estimated CB range on map';
quick.setAttribute('aria-label','Turn CB range overlay on or off');
toolbar.appendChild(quick);

const panel=document.createElement('section');
panel.id='rtCbPanel';panel.className='rt-cb-panel';
panel.setAttribute('aria-label','My CB and HAM radio antenna range settings');
panel.innerHTML=
'<h3 class="rt-cb-heading">📻 MY RADIO RANGES</h3>'+
'<div class="rt-cb-module cb">'+
'<div class="rt-cb-row"><span class="rt-cb-name">🟠 CB • Cobra 75</span><button type="button" id="rtCbToggle" aria-pressed="true">ON</button></div>'+
'<div class="rt-cb-gear">102-inch stainless whip • 2020 GMC Sierra • AM/FM CB (your discussed setup)</div>'+
'<label for="rtCbNear">Nearby planning distance</label>'+
'<select id="rtCbNear"><option value="1">1 mile</option><option value="2">2 miles</option><option value="3">3 miles • default</option><option value="5">5 miles</option></select>'+
'<label for="rtCbFar">Favorable-conditions distance</label>'+
'<select id="rtCbFar"><option value="5">5 miles</option><option value="7">7 miles</option><option value="10">10 miles • default</option></select>'+
'<div class="rt-cb-legend"><span><i class="rt-swatch cb-near"></i>Solid amber: nearby planning zone</span><span><i class="rt-swatch cb-far"></i>Dashed amber: favorable-conditions limit</span></div>'+
'</div>'+
'<div class="rt-cb-module ham">'+
'<div class="rt-cb-row"><span class="rt-cb-name">🟢 HAM • Yaesu FTM-400XDR</span><button type="button" id="rtHamSimplexToggle" aria-pressed="false">OFF</button></div>'+
'<div class="rt-cb-gear">50 W stock • Comet CSB790A, 62-inch antenna • direct 2m simplex estimate</div>'+
'<div class="rt-cb-legend"><span><i class="rt-swatch ham-near"></i>Solid green: 5-mile planning zone</span><span><i class="rt-swatch ham-far"></i>Dashed green: 20-mile favorable range</span></div>'+
'<p class="rt-cb-note">HAM repeaters have their own locations and potential coverage; they are not measured by these circles.</p>'+
'<button type="button" id="rtCbRepeaters">Open HAM / GMRS repeaters</button>'+
'</div>'+
'<div id="rtCbStatus" class="rt-cb-status" role="status">Waiting for live GPS…</div>'+
'<div class="rt-cb-btns"><button type="button" id="rtCbShow">Fit visible radio range</button></div>'+
'<p class="rt-cb-note">Planning estimates ONLY. Terrain, antenna height, SWR, interference and weather affect reach; sporadic CB skip can go much farther. The circles are not RF measurements or guaranteed connections. ROADTOWER does not scan or transmit CB/HAM signals.</p>';
root.appendChild(panel);
if(L.DomEvent){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel);}

const el=id=>document.getElementById(id);
const cbButton=el('rtCbToggle'),hamButton=el('rtHamSimplexToggle'),status=el('rtCbStatus');
const selectNear=el('rtCbNear'),selectFar=el('rtCbFar'),fit=el('rtCbShow');
selectNear.value=String(near);selectFar.value=String(far);

function gpsOK(g){return !!(g&&Number.isFinite(g.latitude)&&Number.isFinite(g.longitude)&&Math.abs(g.latitude)<=90&&Math.abs(g.longitude)<=180);}
function deleteLayer(k){if(drawn[k]){map.removeLayer(drawn[k]);drawn[k]=null;}}
function syncLayer(key,center,radius,opt,active){
 if(!active){deleteLayer(key);return;}
 if(!drawn[key])drawn[key]=L.circle(center,Object.assign({radius,interactive:false},opt)).addTo(map);
 else{
  drawn[key].setLatLng(center);drawn[key].setRadius(radius);
  // Recover if Leaflet layers were cleared or map mode changed.
  if(!map.hasLayer(drawn[key]))drawn[key].addTo(map);
 }
}
function render(g){
 if(g!==undefined)coords=gpsOK(g)?{latitude:g.latitude,longitude:g.longitude}:null;
 const live=api.getGps();
 if(!gpsOK(live)){coords=null;}
 else{coords={latitude:live.latitude,longitude:live.longitude};}
 cbButton.textContent=cbOn?'ON':'OFF';cbButton.setAttribute('aria-pressed',String(cbOn));
 hamButton.textContent=hamOn?'ON':'OFF';hamButton.setAttribute('aria-pressed',String(hamOn));
 quick.textContent=cbOn?'📻 CB ON':'📻 CB OFF';quick.setAttribute('aria-pressed',String(cbOn));
 quick.title=(cbOn?'Hide':'Show')+' CB circles: '+near+' and '+far+' miles';
 selectNear.disabled=!cbOn;selectFar.disabled=!cbOn;
 if(!coords){
  Object.keys(drawn).forEach(deleteLayer);
  status.textContent=(!cbOn&&!hamOn)?'Both range overlays OFF.':'GPS not connected. Start live GPS to place the radio circles.';
  fit.disabled=true;
  return;
 }
 const center=[coords.latitude,coords.longitude];
 // Outer zone first in Leaflet stacking; local range stays prominent.
 syncLayer('cbFar',center,far*MILE,{color:'#ffba58',weight:2,opacity:0.95,dashArray:'9 8',fillColor:'#df8a24',fillOpacity:0.035},cbOn);
 syncLayer('hamFar',center,20*MILE,{color:'#4ae5ad',weight:2,opacity:.90,dashArray:'8 7',fillColor:'#2f9d80',fillOpacity:.015},hamOn);
 syncLayer('cbNear',center,near*MILE,{color:'#ffba41',weight:3,opacity:1,fillColor:'#f7a22c',fillOpacity:.14},cbOn);
 syncLayer('hamNear',center,5*MILE,{color:'#45cf95',weight:3,opacity:1,fillColor:'#2ab18a',fillOpacity:.10},hamOn);
 fit.disabled=!(cbOn||hamOn);
 if(cbOn&&hamOn)status.textContent='CB '+near+' / '+far+' mi • HAM simplex 5 / 20 mi. Live GPS-following estimates.';
 else if(cbOn)status.textContent='CB '+near+' / '+far+' miles • live GPS-following estimate.';
 else if(hamOn)status.textContent='HAM 2m simplex 5 / 20 miles • live GPS-following estimate.';
 else status.textContent='Both radio range overlays OFF.';
}
function setCB(v){cbOn=Boolean(v);save(K.cb,cbOn);render();}
function setHAM(v){hamOn=Boolean(v);save(K.ham,hamOn);render();}
cbButton.addEventListener('click',()=>setCB(!cbOn));
quick.addEventListener('click',()=>setCB(!cbOn));
hamButton.addEventListener('click',()=>setHAM(!hamOn));
selectNear.addEventListener('change',()=>{
 const v=Number(selectNear.value);
 if(!nearChoices.includes(v))return;
 near=v;if(near>far){far=near;selectFar.value=String(far);}
 save(K.near,near);save(K.far,far);render();
});
selectFar.addEventListener('change',()=>{
 const v=Number(selectFar.value);
 if(!farChoices.includes(v))return;
 far=v;if(far<near){near=far;selectNear.value=String(near);}
 save(K.far,far);save(K.near,near);render();
});
fit.addEventListener('click',()=>{
 const active=Object.entries(drawn).filter(([k,v])=>v);
 if(!active.length)return;
 let bounds=null;
 for(const [k,v] of active){const next=v.getBounds();bounds=bounds?bounds.extend(next):next;}
 if(bounds)map.fitBounds(bounds.pad(.1));
});
el('rtCbRepeaters').addEventListener('click',()=>{
 if(window.RoadtowerPanelLayout)window.RoadtowerPanelLayout.open('radio');
});
const previous=api.onGps;
api.onGps=function(g){if(typeof previous==='function')previous(g);render(g);};
for(const id of ['stop','rtGpsStopQuick']){const b=el(id);if(b)b.addEventListener('click',()=>setTimeout(render,0));}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.addEventListener('pageshow',()=>render());
setInterval(()=>{if((cbOn||hamOn)&&document.visibilityState==='visible')render();},6000);
render();
window.RoadtowerCBRange={
 isOn:()=>cbOn,getMiles:()=>near,getFavorableMiles:()=>far,
 isHamOn:()=>hamOn,setOn:setCB,setHamOn:setHAM,refresh:()=>render(),
 getProfile:()=>({cb:{radio:'Cobra 75',antenna:'102-inch stainless whip',vehicle:'2020 GMC Sierra',nearMiles:near,favorableMiles:far},ham:{radio:'Yaesu FTM-400XDR',antenna:'Comet CSB790A 62-inch',powerWatts:50,simplexNearMiles:5,simplexFavorableMiles:20}})
};
})();
