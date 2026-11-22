/* Roadtower movable, minimizable, independently maximizable map HUD panels.
   Offline-first, no dependencies, saves layout locally on this device. */
(function(){
'use strict';
const map=document.getElementById('map');
if(!map)return;
const configs=[
 {id:'tools',selector:'.rt-map-tools-panel',title:'Map and GPS controls'},
 {id:'command',selector:'.rt-command-strip',title:'Field Command live status'},
 {id:'radio',selector:'.rt-repeater-panel',title:'Radio repeaters'},
 {id:'nearest',selector:'.rt-nearest-dock',title:'Nearest repeaters'},
 {id:'gps',selector:'.rt-gps-hud',title:'My GPS'},
 {id:'status',selector:'.rt-status-hud',title:'Connection status'},
 {id:'layers',selector:'.rt-live-panel',title:'Airplanes and weather radar'},
 {id:'nearestplane',selector:'.rt-nearest-plane-panel',title:'Nearest airplane to my GPS'},
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
grip.title='Hold to move • double-tap to dock on the right';grip.setAttribute('role','button');
grip.tabIndex=0;grip.setAttribute('aria-label','Move panel dot shortcuts');
tray.appendChild(grip);
const dockCollapse=document.createElement('button');
dockCollapse.type='button';dockCollapse.className='rt-dock-collapse-button';
dockCollapse.setAttribute('aria-label','Collapse the DOTS shortcuts');
dockCollapse.title='Collapse shortcut bar to one compact button';
dockCollapse.textContent='◀';
tray.insertBefore(dockCollapse,grip);
let dockIsCollapsed=false;
function setDockCollapsed(value){
 dockIsCollapsed=Boolean(value);
 tray.classList.toggle('rt-dock-collapsed',dockIsCollapsed);
 dockCollapse.textContent=dockIsCollapsed?'☰':'◀';
 dockCollapse.title=dockIsCollapsed?'Show ROADTOWER shortcuts':'Hide shortcut dots';
 dockCollapse.setAttribute('aria-label',dockCollapse.title);
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(refreshDock);
 else refreshDock();
}
dockCollapse.addEventListener('click',()=>setDockCollapsed(!dockIsCollapsed));
// The map launches with the panels available. A single tap clears them all
// into the same colored shortcut dots that were already supported.
function trayButton(label,description){
 const b=document.createElement('button');b.type='button';b.className='rt-layout-all-button';
 b.textContent=label;b.title=description;b.setAttribute('aria-label',description);
 tray.appendChild(b);return b;
}
const minimizeAll=trayButton('− ALL','Minimize all panels and collapse DOTS to one button');
const showAll=trayButton('+ ALL','Open all information panels');
map.appendChild(tray);
if(window.L&&L.DomEvent){L.DomEvent.disableClickPropagation(tray);L.DomEvent.disableScrollPropagation(tray)}
const BUBBLES={
 tools:{icon:'⚙',short:'TOOLS',color:'tools'},
 command:{icon:'▦',short:'CMD',color:'command'},
 radio:{icon:'📡',short:'HAM',color:'green'},
 nearest:{icon:'➊',short:'NEAR',color:'amber'},
 gps:{icon:'◎',short:'GPS',color:'cyan'},
 status:{icon:'●',short:'INFO',color:'blue'},
 layers:{icon:'✈',short:'LIVE',color:'orange'},
 nearestplane:{icon:'✈',short:'PLANE',color:'airplane'},
 cb:{icon:'📻',short:'RANGE',color:'cb'},
 storm:{icon:'⛈',short:'STORM',color:'storm'},
 health:{icon:'📶',short:'FEEDS',color:'health'},
 aprs:{icon:'📡',short:'APRS',color:'aprs'}
};
// v2 intentionally ignores the pre-redesign dock location: an old normalized
// center position was restored on the new Fold viewport and covered the map.
const DOCK_KEY='roadtower-dot-position-v2';
let dockSaved=null;
try{const p=JSON.parse(localStorage.getItem(DOCK_KEY)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))dockSaved=p}catch(e){}
function dockDimensions(){
 const b=map.getBoundingClientRect(),t=tray.getBoundingClientRect();
 return {width:b.width,height:b.height,
  dockWidth:t.width||tray.offsetWidth||54,
  dockHeight:t.height||tray.offsetHeight||260};
}
function moveDock(x,y,store){
 const d=dockDimensions();
 const maxX=Math.max(5,d.width-d.dockWidth-7);
 const maxY=Math.max(5,d.height-d.dockHeight-7);
 const xx=Math.max(5,Math.min(maxX,x));
 const yy=Math.max(5,Math.min(maxY,y));
 tray.style.setProperty('left',xx+'px','important');
 // An inline right:auto is necessary: the PRO stylesheet specifies a
 // right edge with !important, which otherwise fights with the draggable left.
 tray.style.setProperty('right','auto','important');
 tray.style.setProperty('top',yy+'px','important');
 tray.style.setProperty('bottom','auto','important');
 if(store){
  dockSaved={x:xx/Math.max(1,maxX-5),y:yy/Math.max(1,maxY-5)};
  try{localStorage.setItem(DOCK_KEY,JSON.stringify(dockSaved))}catch(e){}
 }
}
function dockToRight(){
 dockSaved=null;
 try{localStorage.removeItem(DOCK_KEY)}catch(e){}
 refreshDock();
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
// Double-tap the DOTS handle to re-dock it if it was dragged over the map.
grip.addEventListener('dblclick',e=>{e.preventDefault();dockToRight()});
grip.addEventListener('keydown',e=>{
 if(e.key==='Home'){e.preventDefault();dockToRight();return}
 const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
 if(!d)return;e.preventDefault();
 const b=map.getBoundingClientRect(),p=tray.getBoundingClientRect();
 moveDock(p.left-b.left+d[0],p.top-b.top+d[1],true);
});
function refreshDock(){
 const d=dockDimensions(),maxX=Math.max(5,d.width-d.dockWidth-7);
 const maxY=Math.max(5,d.height-d.dockHeight-7);
 if(!dockSaved){
  // Keep the dock on the RIGHT and below Field Command, including on Fold
  // screens whose visible viewport changes after Chrome hides its controls.
  const command=document.getElementById('rtCommandStrip');
  const mr=map.getBoundingClientRect(),cr=command&&command.getBoundingClientRect();
  const afterCommand=cr&&cr.height>0?Math.round(cr.bottom-mr.top+12):183;
  const preferred=Math.max(174,afterCommand);
  moveDock(maxX,Math.min(maxY,preferred),false);
  return;
 }
 // User-moved positions still persist within the current screen bounds.
 moveDock(5+dockSaved.x*Math.max(1,maxX-5),
 5+dockSaved.y*Math.max(1,maxY-5),false);
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
 if(s.id==='tools'){s.x=Math.max(8,b.width-w-12);s.y=12}
 else if(s.id==='command'){s.x=12;s.y=12}
 else if(s.id==='radio'){s.x=b.width-w-12;s.y=70}
 else if(s.id==='nearest'){s.x=b.width-w-12;s.y=b.height-h-96}
 else if(s.id==='gps'){s.x=12;s.y=88}
 else if(s.id==='layers'){s.x=b.width-w-12;s.y=Math.max(120,Math.round(b.height*.36))}
 else if(s.id==='nearestplane'){s.x=Math.max(8,b.width-w-12);s.y=Math.max(120,Math.round(b.height*.27))}
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
minimizeAll.addEventListener('click',()=>{
 Object.values(states).forEach(s=>setMode(s,'min'));
 setDockCollapsed(true);
});
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
 reset(){Object.values(states).forEach(s=>{s.mode='normal';s.el.style.removeProperty('left');s.el.style.removeProperty('top');s.el.style.removeProperty('right');s.el.style.removeProperty('bottom');s.el.classList.remove('rt-layout-managed','rt-layout-minimized','rt-layout-maximized','rt-layout-hidden')});try{localStorage.removeItem(KEY);localStorage.removeItem(DOCK_KEY)}catch(e){}location.reload()},
 resetDock:dockToRight,
 reflowDock:refreshDock,
 getModes(){return Object.fromEntries(Object.entries(states).map(([k,v])=>[k,v.mode]))},
 minimizeAll(){minimizeAll.click()},
 showAll(){setDockCollapsed(false);showAll.click()},
 toggleDock:()=>setDockCollapsed(!dockIsCollapsed),
 collapseDock:()=>setDockCollapsed(true),
 expandDock:()=>setDockCollapsed(false),
 clearMap:()=>{Object.values(states).forEach(s=>setMode(s,'min'));setDockCollapsed(true)},
 open(id){const s=states[id];if(s)setMode(s,'normal')},
 maximize(id){const s=states[id];if(s)setMode(s,'max')},
 minimize(id){const s=states[id];if(s)setMode(s,'min')}
};
})();
