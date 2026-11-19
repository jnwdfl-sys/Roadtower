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
 {id:'status',selector:'.rt-status-hud',title:'Connection status'}
];
const KEY='roadtower-panel-layout-v1';
let saved={};
try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
const states={};
const tray=document.createElement('nav');
tray.id='rtLayoutTray';
tray.setAttribute('aria-label','Restore hidden map panels');
map.appendChild(tray);
function store(){
 try{const obj={};Object.keys(states).forEach(k=>{const s=states[k];obj[k]={x:s.x,y:s.y,mode:s.mode}});localStorage.setItem(KEY,JSON.stringify(obj))}catch(e){}
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
function update(s,shouldSave=true){
 const {el,mode}=s;
 el.classList.toggle('rt-layout-minimized',mode==='min');
 el.classList.toggle('rt-layout-maximized',mode==='max');
 el.classList.toggle('rt-layout-hidden',mode==='hide');
 el.classList.add('rt-layout-managed');
 s.minBtn.textContent=mode==='min'?'Expand':'Minimize';
 s.maxBtn.textContent=mode==='max'?'Restore':'Full screen';
 s.hideBtn.textContent='Hide';
 s.minBtn.setAttribute('aria-expanded',String(mode!=='min'&&mode!=='hide'));
 s.maxBtn.setAttribute('aria-pressed',String(mode==='max'));
 s.restore.hidden=mode!=='hide';
 if(mode==='normal'||mode==='min')move(s,s.x,s.y);
 else {el.style.removeProperty('left');el.style.removeProperty('top');el.style.removeProperty('right');el.style.removeProperty('bottom')}
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
 s.mode=mode;update(s);
}
function makeButton(label,action){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();action()});return b
}
function attach(c){
 const el=map.querySelector(c.selector);if(!el)return;
 const v=saved[c.id]||{};
 const s={id:c.id,el,x:Number.isFinite(v.x)?v.x:0,y:Number.isFinite(v.y)?v.y:0,
  mode:['normal','min','max','hide'].includes(v.mode)?v.mode:'normal'};
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
 s.restore=makeButton('Show '+c.title,()=>setMode(s,'normal'));
 s.restore.className='rt-layout-restore';tray.appendChild(s.restore);
 if(window.L&&L.DomEvent){L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el)}
 let drag=null;
 grip.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  if(s.mode==='max'||s.mode==='hide')return;
  e.preventDefault();e.stopPropagation();
  const b=bounds(el);
  // A newly positioned panel starts at its current on-screen location.
  s.x=b.rect.left-b.area.left;s.y=b.rect.top-b.area.top;
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:s.x,y:s.y};
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
  move(s,x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0));store()
 });
 states[c.id]=s;
 // Delay saved placement until CSS and fonts have been laid out.
 requestAnimationFrame(()=>{
  if(!Number.isFinite(v.x)||!Number.isFinite(v.y)){
   const b=bounds(el);s.x=b.rect.left-b.area.left;s.y=b.rect.top-b.area.top;
  }
  update(s,false);
 });
}
configs.forEach(attach);
window.addEventListener('resize',()=>{Object.values(states).forEach(s=>{if(s.mode==='normal'||s.mode==='min')move(s,s.x,s.y)})});
window.RoadtowerPanelLayout={
 reset(){Object.values(states).forEach(s=>{s.mode='normal';s.el.style.removeProperty('left');s.el.style.removeProperty('top');s.el.style.removeProperty('right');s.el.style.removeProperty('bottom');s.el.classList.remove('rt-layout-managed','rt-layout-minimized','rt-layout-maximized','rt-layout-hidden')});try{localStorage.removeItem(KEY)}catch(e){}location.reload()},
 getModes(){return Object.fromEntries(Object.entries(states).map(([k,v])=>[k,v.mode]))}
};
})();
