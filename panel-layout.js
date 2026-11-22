/* Roadtower movable, minimizable, independently maximizable map HUD panels.
   Offline-first, no dependencies, saves layout locally on this device. */
(function(){
'use strict';
const map=document.getElementById('map');
if(!map)return;
const configs=[
 {id:'radio',selector:'.rt-repeater-panel',title:'Radio repeaters'},
 {id:'nearest',selector:'.rt-nearest-dock',title:'Nearest repeaters'},
 {id:'gps',selector:'.rt-gps-hud',title:'My GPS'},
 {id:'status',selector:'.rt-status-hud',title:'Connection status'},
 {id:'layers',selector:'.rt-live-panel',title:'Airplanes and weather radar'},
 {id:'cb',selector:'.rt-cb-panel',title:'My radio ranges'},
 {id:'storm',selector:'.rt-storm-panel',title:'Storms Ahead warnings'},
 {id:'health',selector:'.rt-health-panel',title:'Live feed health'},
 {id:'aprs',selector:'.rt-aprs-panel',title:'APRS call sign tracker'}
];
const KEY='roadtower-panel-layout-v2';
let saved={};
try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
const states={};
const tray=document.createElement('nav');
tray.id='rtLayoutTray';
tray.setAttribute('aria-label','Colored map panel shortcuts');
const grip=document.createElement('div');
grip.className='rt-layout-dock-grip';grip.textContent='⠿ DOTS';
grip.title='Hold to move the panel dots';grip.setAttribute('role','button');
grip.tabIndex=0;grip.setAttribute('aria-label','Move panel dot shortcuts');
tray.appendChild(grip);
// The map launches with the panels available. A single tap clears them all
// into the same colored shortcut dots that were already supported.
function trayButton(label,description){
 const b=document.createElement('button');b.type='button';b.className='rt-layout-all-button';
 b.textContent=label;b.title=description;b.setAttribute('aria-label',description);
 tray.appendChild(b);return b;
}
const minimizeAll=trayButton('− ALL','Minimize all information panels into colored dots');
const showAll=trayButton('+ ALL','Open all information panels');
map.appendChild(tray);
if(window.L&&L.DomEvent){L.DomEvent.disableClickPropagation(tray);L.DomEvent.disableScrollPropagation(tray)}
const BUBBLES={
 radio:{icon:'📡',short:'HAM',color:'green'},
 nearest:{icon:'➊',short:'NEAR',color:'amber'},
 gps:{icon:'◎',short:'GPS',color:'cyan'},
 status:{icon:'●',short:'INFO',color:'blue'},
 layers:{icon:'✈',short:'LIVE',color:'orange'},
 cb:{icon:'📻',short:'RANGE',color:'cb'},
 storm:{icon:'⛈',short:'STORM',color:'storm'},
 health:{icon:'📶',short:'FEEDS',color:'health'},
 aprs:{icon:'📡',short:'APRS',color:'aprs'}
};
const DOCK_KEY='roadtower-dot-position-v1';
let dockSaved=null;
try{const p=JSON.parse(localStorage.getItem(DOCK_KEY)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))dockSaved=p}catch(e){}
function moveDock(x,y,store){
 const b=map.getBoundingClientRect(),w=tray.offsetWidth||66,h=tray.offsetHeight||260;
 const xx=Math.max(5,Math.min(Math.max(5,b.width-w-5),x));
 const yy=Math.max(5,Math.min(Math.max(5,b.height-h-5),y));
 tray.style.setProperty('left',xx+'px','important');tray.style.setProperty('top',yy+'px','important');
 if(store){
  dockSaved={x:xx/Math.max(1,b.width-w),y:yy/Math.max(1,b.height-h)};
  try{localStorage.setItem(DOCK_KEY,JSON.stringify(dockSaved))}catch(e){}
 }
}
let draggingDock=null;
grip.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 e.preventDefault();e.stopPropagation();
 const b=map.getBoundingClientRect(),p=tray.getBoundingClientRect();
 draggingDock={id:e.pointerId,px:e.clientX,py:e.clientY,x:p.left-b.left,y:p.top-b.top};
 grip.setPointerCapture(e.pointerId);
});
grip.addEventListener('pointermove',e=>{
 if(!draggingDock||e.pointerId!==draggingDock.id)return;
 moveDock(draggingDock.x+e.clientX-draggingDock.px,draggingDock.y+e.clientY-draggingDock.py,false);
});
function endDock(e){
 if(!draggingDock||e.pointerId!==draggingDock.id)return;
 const b=map.getBoundingClientRect(),p=tray.getBoundingClientRect();
 moveDock(p.left-b.left,p.top-b.top,true);draggingDock=null;
}
grip.addEventListener('pointerup',endDock);
grip.addEventListener('pointercancel',endDock);
grip.addEventListener('keydown',e=>{
 const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
 if(!d)return;e.preventDefault();
 const b=map.getBoundingClientRect(),p=tray.getBoundingClientRect();
 moveDock(p.left-b.left+d[0],p.top-b.top+d[1],true);
});
function refreshDock(){
 if(!dockSaved)return;
 const b=map.getBoundingClientRect(),w=tray.offsetWidth||66,h=tray.offsetHeight||260;
 moveDock(dockSaved.x*Math.max(1,b.width-w),dockSaved.y*Math.max(1,b.height-h),false);
}
function colorizeDots(){
 const radio=states.radio&&states.radio.el;
 const gmrs=!!(radio&&radio.classList.contains('rt-gmrs-mode'));
 const both=!!(radio&&radio.classList.contains('rt-both-mode'));
 for(const id of ['radio','nearest']){
  const p=states[id];
  if(p){
   p.restore.classList.toggle('rt-dot-gmrs',gmrs);
   p.restore.classList.toggle('rt-dot-both',both);
  }
 }
 if(states.radio)states.radio.restore.querySelector('.rt-layout-dot-label').textContent=both?'BOTH':gmrs?'GMRS':'HAM';
}

function store(){
 try{const obj={};Object.keys(states).forEach(k=>{const s=states[k];obj[k]={x:s.x,y:s.y,mode:s.mode,moved:s.moved}});localStorage.setItem(KEY,JSON.stringify(obj))}catch(e){}
}
function bounds(el){const area=map.getBoundingClientRect(),rect=el.getBoundingClientRect();return {area,rect}}
function move(s,x,y){
 const b=bounds(s.el);
 const w=Math.max(90,b.rect.width||180),h=Math.max(38,b.rect.height||70);
 const maxX=Math.max(4,b.area.width-Math.min(w,b.area.width)+0);
 const maxY=Math.max(4,b.area.height-Math.min(h,b.area.height)+0);
 s.x=Math.min(maxX,Math.max(4,x));s.y=Math.min(maxY,Math.max(4,y));
 s.el.style.setProperty('left',s.x+'px','important');
 s.el.style.setProperty('top',s.y+'px','important');
 s.el.style.setProperty('right','auto','important');
 s.el.style.setProperty('bottom','auto','important');
}
function putAtDefault(s){
 const b=map.getBoundingClientRect();
 const r=s.el.getBoundingClientRect();
 const w=Math.max(120,r.width||Math.min(b.width*.42,300));
 const h=Math.max(65,r.height||220);
 if(s.id==='radio'){s.x=b.width-w-12;s.y=70}
 else if(s.id==='nearest'){s.x=b.width-w-12;s.y=b.height-h-96}
 else if(s.id==='gps'){s.x=12;s.y=88}
 else if(s.id==='layers'){s.x=b.width-w-12;s.y=Math.max(120,Math.round(b.height*.36))}
 else if(s.id==='cb'){s.x=12;s.y=Math.max(170,Math.round(b.height*.54))}
 else if(s.id==='storm'){s.x=12;s.y=Math.max(120,Math.round(b.height*.30))}
 else if(s.id==='health'){s.x=b.width-w-12;s.y=Math.max(145,Math.round(b.height*.48))}
 else if(s.id==='aprs'){s.x=12;s.y=Math.max(170,Math.round(b.height*.47))}
 else {s.x=12;s.y=Math.max(160,b.height-h-106)}
 s.x=Math.max(4,s.x);s.y=Math.max(4,s.y);
}
function updateAllButtons(){
 const list=Object.values(states);
 minimizeAll.disabled=!!list.length&&list.every(v=>v.mode==='min'||v.mode==='hide');
 showAll.disabled=!!list.length&&list.every(v=>v.mode==='normal');
}
function update(s,shouldSave=true){
 const {el,mode}=s;
 el.classList.toggle('rt-layout-minimized',mode==='min');
 el.classList.toggle('rt-layout-maximized',mode==='max');
 el.classList.toggle('rt-layout-hidden',mode==='hide');
 el.classList.add('rt-layout-managed');
 s.minBtn.textContent='−';
 s.maxBtn.textContent=mode==='max'?'↙':'⛶';
 s.hideBtn.textContent='×';
 s.minBtn.title='Minimize into colored dot';s.minBtn.setAttribute('aria-label','Minimize into colored dot');
 s.maxBtn.title=mode==='max'?'Return to movable panel':'Make panel full screen';
 s.maxBtn.setAttribute('aria-label',s.maxBtn.title);
 s.hideBtn.title='Hide panel (tap colored dot to reopen)';
 s.hideBtn.setAttribute('aria-label','Hide panel (tap colored dot to reopen)');
 s.minBtn.setAttribute('aria-expanded',String(mode!=='min'&&mode!=='hide'));
 s.maxBtn.setAttribute('aria-pressed',String(mode==='max'));
 s.restore.hidden=!(mode==='hide'||mode==='min');
 s.restore.dataset.mode=mode;
 if(mode==='normal')move(s,s.x,s.y);
 else if(mode==='max'){el.style.removeProperty('left');el.style.removeProperty('top');el.style.removeProperty('right');el.style.removeProperty('bottom')}
 colorizeDots();
 updateAllButtons();
 if(shouldSave)store();
}
function setMode(s,mode){
 if(mode==='max'&&!document.body.classList.contains('map-fullscreen')){
  // Give an individual panel the full phone screen, even if the map was compact.
  const fullscreen=document.getElementById('fullscreenMap');
  if(fullscreen)fullscreen.click();
 }
 if(mode==='max'&&s.mode!=='max'){
  // Only one overlay should cover the map at a time.
  Object.values(states).forEach(other=>{if(other!==s&&other.mode==='max'){other.mode='normal';update(other,false)}});
 }
 s.mode=mode;
 if(mode==='normal'&&!s.moved){
  s.el.classList.remove('rt-layout-minimized','rt-layout-hidden','rt-layout-maximized');
  putAtDefault(s);
 }
 update(s);
}
function makeButton(label,action){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();action()});return b
}
function attach(c){
 const el=map.querySelector(c.selector);if(!el)return;
 const v=saved[c.id]||{};
 const s={id:c.id,el,x:Number.isFinite(v.x)?v.x:0,y:Number.isFinite(v.y)?v.y:0,moved:v.moved===true,
  // Start every information screen minimized into a colored dot.
  // This changes ONLY the panel view: GPS, HAM/GMRS, aircraft and radar
  // remain independently active and visible on the underlying map.
  // Manually dragged positions remain available when a panel reopens.
  mode:'min'};
 const header=document.createElement('div');header.className='rt-layout-header';
 const grip=document.createElement('div');grip.className='rt-layout-grip';
 grip.setAttribute('role','button');grip.tabIndex=0;
 grip.setAttribute('aria-label','Drag '+c.title+' panel to reposition');
 grip.innerHTML='<span aria-hidden="true">⠿</span> '+c.title;
 const controls=document.createElement('div');controls.className='rt-layout-actions';
 s.minBtn=makeButton('Minimize',()=>setMode(s,s.mode==='min'?'normal':'min'));
 s.maxBtn=makeButton('Full screen',()=>setMode(s,s.mode==='max'?'normal':'max'));
 s.hideBtn=makeButton('Hide',()=>setMode(s,'hide'));
 for(const b of [s.minBtn,s.maxBtn,s.hideBtn])controls.appendChild(b);
 header.append(grip,controls);el.insertBefore(header,el.firstChild);
 const meta=BUBBLES[c.id];
 s.restore=makeButton('',()=>setMode(s,'normal'));
 s.restore.className='rt-layout-restore rt-dot-'+meta.color;
 s.restore.innerHTML='<span class="rt-layout-dot-symbol" aria-hidden="true">'+meta.icon+'</span><span class="rt-layout-dot-label">'+meta.short+'</span>';
 s.restore.title='Open '+c.title;s.restore.setAttribute('aria-label','Open '+c.title+' panel');
 tray.appendChild(s.restore);
 // Apply minimization immediately, not one paint after the map appears.
 // The dots are clickable even while asynchronous feeds load.
 update(s,false);
 if(window.L&&L.DomEvent){L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el)}
 let drag=null;
 grip.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  if(s.mode==='max'||s.mode==='hide')return;
  e.preventDefault();e.stopPropagation();
  const b=bounds(el);
  // A newly positioned panel starts at its current on-screen location.
  s.x=b.rect.left-b.area.left;s.y=b.rect.top-b.area.top;
  s.moved=true;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:s.x,y:s.y};
  grip.setPointerCapture(e.pointerId);
  el.classList.add('rt-layout-dragging');
 });
 grip.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  e.preventDefault();
  move(s,drag.x+e.clientX-drag.startX,drag.y+e.clientY-drag.startY);
 });
 function endDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  drag=null;el.classList.remove('rt-layout-dragging');store();
 }
 grip.addEventListener('pointerup',endDrag);
 grip.addEventListener('pointercancel',endDrag);
 grip.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();const d=e.shiftKey?30:10;
  const b=bounds(el);
  const x=Number.isFinite(s.x)&&s.x!==0?s.x:b.rect.left-b.area.left;
  const y=Number.isFinite(s.y)&&s.y!==0?s.y:b.rect.top-b.area.top;
  s.moved=true;move(s,x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0));store()
 });
 states[c.id]=s;
 // Delay saved placement until CSS and fonts have been laid out.
 requestAnimationFrame(()=>{
  if(!s.moved||!Number.isFinite(v.x)||!Number.isFinite(v.y)){
   putAtDefault(s);
  }
  update(s,false);
 });
}
configs.forEach(attach);
minimizeAll.addEventListener('click',()=>Object.values(states).forEach(s=>setMode(s,'min')));
showAll.addEventListener('click',()=>Object.values(states).forEach(s=>setMode(s,'normal')));
updateAllButtons();
if(window.MutationObserver&&states.radio)new MutationObserver(colorizeDots).observe(states.radio.el,{attributes:true,attributeFilter:['class']});
colorizeDots();requestAnimationFrame(refreshDock);
function reflowPanels(){
 Object.values(states).forEach(p=>{
  if(p.mode==='normal'){
   if(!p.moved)putAtDefault(p);
   move(p,p.x,p.y)
  }
 });
 refreshDock();
}
window.addEventListener('resize',()=>requestAnimationFrame(reflowPanels));
if(window.MutationObserver)new MutationObserver(()=>requestAnimationFrame(reflowPanels))
 .observe(document.body,{attributes:true,attributeFilter:['class']});
window.RoadtowerPanelLayout={
 reset(){Object.values(states).forEach(s=>{s.mode='normal';s.el.style.removeProperty('left');s.el.style.removeProperty('top');s.el.style.removeProperty('right');s.el.style.removeProperty('bottom');s.el.classList.remove('rt-layout-managed','rt-layout-minimized','rt-layout-maximized','rt-layout-hidden')});try{localStorage.removeItem(KEY)}catch(e){}location.reload()},
 getModes(){return Object.fromEntries(Object.entries(states).map(([k,v])=>[k,v.mode]))},
 minimizeAll(){minimizeAll.click()},
 showAll(){showAll.click()},
 open(id){const s=states[id];if(s)setMode(s,'normal')},
 maximize(id){const s=states[id];if(s)setMode(s,'max')},
 minimize(id){const s=states[id];if(s)setMode(s,'min')}
};
})();
