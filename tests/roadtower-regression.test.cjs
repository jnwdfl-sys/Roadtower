/* Roadtower regression checks: Node built-ins only, no packages required.
 * Run: node --test tests/roadtower-regression.test.cjs
 * These checks protect source contracts; physical phone/GPS testing is still required.
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function read(name){return fs.readFileSync(path.join(root,name),'utf8')}
const html=read('roadtower.html');
const radio=read('repeaters.js');
const panels=read('panel-layout.js');
const sw=read('sw.js');
const gmrs=JSON.parse(read('gmrs-directory.json'));

test('JavaScript modules and all inline scripts parse',()=>{
 for(const [name,js] of [['repeaters.js',radio],['panel-layout.js',panels],['sw.js',sw]]){
  assert.doesNotThrow(()=>new vm.Script(js,{filename:name}),name);
 }
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(x=>x.trim());
 assert.ok(scripts.length>0,'Main page contains its GPS application code');
 for(const [index,code] of scripts.entries()){
  assert.doesNotThrow(()=>new vm.Script(code,{filename:'roadtower-inline-'+index+'.js'}));
 }
 for(const script of ['repeaters.js','offline-maps.js','panel-layout.js']){
  assert.ok(html.includes('<script src="./'+script),'Linked '+script);
 }
});

test('Startup always shows BOTH services regardless of older saved preferences',()=>{
 assert.match(radio,/radioService='both'/);
 assert.doesNotMatch(radio,/localStorage\.getItem\('roadtower-radio-view-v1'\)/,
  'A saved HAM-only mode must not suppress GMRS at startup');
 assert.match(radio,/id="rtHam"/);
 assert.match(radio,/id="rtGMRS"/);
 assert.match(radio,/id="rtBoth"/);
 assert.match(radio,/\/\/ Paint all bundled HAM and GMRS references immediately/);
 assert.match(radio,/map\.on\('moveend zoomend resize'/);
});

test('HAM/GMRS data really combines and filters independently',()=>{
 const start=radio.indexOf('function isGMRS(');
 const end=radio.indexOf('function setIndicator(',start);
 const sortStart=radio.indexOf('function anchor(');
 const sortEnd=radio.indexOf('function coord(',sortStart);
 assert.ok(start>=0&&end>start&&sortStart>=0&&sortEnd>sortStart);
 const source=`
 function gmrsOutput(mhz){return [462.55,462.575,462.60,462.625,462.65,462.675,462.70,462.725].some(n=>Math.abs(n-mhz)<0.0002)}
 function hamBand(mhz){return mhz>=144&&mhz<=148?'2m':mhz>=420&&mhz<=450?'70cm':null}
 function current(){return null}
 `+radio.slice(start,end)+'\n'+radio.slice(sortStart,sortEnd)+'\nreturn {all:getAllStations(),nearest:sorted()};';
 const factory=new Function('radioService','customRecords','LOCAL_CLUB','gmrsData','GMRS_STARTER','data','wideOnly','bandFilter','map','distance',source);
 const ham=[{call:'K0HAM',mhz:146.910,lat:38.9878,lon:-94.6709,wide:true}];
 const g=[{service:'gmrs',call:'WSHC585',mhz:462.600,lat:38.96611,lon:-94.73389,wide:false}];
 const map={getCenter:()=>({lat:38.969826,lng:-94.699526})};
 const d=(a,b,c,e)=>Math.hypot(c-a,e-b);
 const args=service=>factory(service,[],ham,[],g,[],false,'both',map,d);
 const hamOnly=args('ham').all,gmrsOnly=args('gmrs').all,both=args('both');
 assert.equal(hamOnly.length,1);
 assert.equal(gmrsOnly.length,1);
 assert.equal(both.all.length,2);
 assert.equal(both.all.filter(x=>x.service==='gmrs').length,1);
 assert.equal(both.all.filter(x=>x.service!=='gmrs').length,1);
 assert.equal(both.nearest.length,2);
});

test('Map markers include green HAM and purple GMRS even with large directories',()=>{
 assert.match(radio,/inBounds\.filter\(it=>!isGMRS\(it\.x\)\)/);
 assert.match(radio,/inBounds\.filter\(it=>isGMRS\(it\.x\)\)/);
 assert.match(radio,/fillColor:isGMRS\(x\)\?'#b340cf'/);
 assert.match(radio,/L\.circleMarker\(coord\(x\)/);
 assert.match(radio,/L\.popup\(\{maxWidth:340/);
 assert.match(radio,/CLOSEST GMRS/);
 assert.match(radio,/CLOSEST HAM/);
 assert.match(radio,/kcwide-k0ham-146910-op/);
 assert.match(radio,/jcrac-w0erh-145290/);
 assert.doesNotMatch(radio,/rt-library-pin-icon/,'Library must remain an ordinary green marker');
});

test('GMRS starter data has valid duplex channels and clear location caveats',()=>{
 assert.ok(Array.isArray(gmrs.repeaters)&&gmrs.repeaters.length>=3);
 for(const s of gmrs.repeaters){
  assert.equal(s.service,'gmrs');
  assert.ok(s.rx_mhz>=462.55&&s.rx_mhz<=462.725);
  assert.ok(Math.abs(s.tx_mhz-s.rx_mhz-5)<0.002);
  assert.ok(Number.isFinite(s.lat)&&Number.isFinite(s.lon));
  assert.ok(s.approximate===true,'Location is not a surveyed tower coordinate');
 }
});

test('Follow GPS starts tracking if off and keeps the SOS position marker',()=>{
 assert.match(html,/navigator\.geolocation\.watchPosition\(/);
 assert.match(html,/if\(watch===null&&navigator\.geolocation\)\$\('start'\)\.click\(\)/);
 assert.match(html,/rt-self-beacon/);
 assert.match(html,/@keyframes rt-gps-sos\{/);
 assert.match(html,/rt-self-center/);
 assert.match(html,/function visibleFollowZoom\(/);
 const a=html.indexOf("$('followMap').onclick=()=>{");
 const b=html.indexOf("$('saveCurrent').onclick=",a);
 assert.ok(a>=0&&b>a);
 const followHandler=html.slice(a,b);
 const run=new Function('enabled','watchInitially','hasPosition',`
 let followMap=enabled,watch=watchInitially,position=hasPosition?{latitude:39,longitude:-94.67}:null;
 let starts=0,centers=0;
 const map={invalidateSize(){},setView(){centers++}};
 const nodes={followMap:{textContent:''},start:{click(){starts++;watch=1}}};
 function $(id){return nodes[id]}
 function gpsHudState(){}
 function visibleFollowZoom(){return 11}
 function resumeGpsFollow(){followMap=true;if(position)centers++}
 function clearFollowPause(){}
 function updateFollowLabel(){}
 function followPaused(){return false}
 `+followHandler+`
 nodes.followMap.onclick();
 return {followMap,starts,centers};
 `);
 const first=run(true,null,false);
 assert.equal(first.starts,1);assert.equal(first.followMap,true);
 const searching=run(true,1,false);
 assert.equal(searching.starts,0);assert.equal(searching.followMap,true);
 const withFix=run(false,1,true);
 assert.equal(withFix.followMap,true);assert.equal(withFix.centers,1);
});

test('Panels start minimized while all live layers remain active and can reopen',()=>{
 assert.match(panels,/mode:'min'/);
 assert.match(panels,/update\(s,false\);/);
 assert.match(panels,/rt-layout-restore/);
 assert.match(panels,/rt-layout-all-button/);
 assert.match(panels,/minimizeAll\.addEventListener\('click'/);
 assert.match(panels,/showAll\.addEventListener\('click'/);
 assert.match(panels,/function move\(/);
 assert.match(panels,/rt-layout-maximized/);
 assert.match(panels,/function colorizeDots/);
 assert.match(html,/rt-layout-dot-symbol/);
});

test('Offline shell includes scripts and JSON directory and is versioned',()=>{
 for(const asset of ['roadtower.html','repeaters.js','gmrs-directory.json','panel-layout.js']){
  assert.ok(sw.includes("'./"+asset+"'"),asset+' must be precached');
 }
 assert.match(sw,/roadtower-offline-v\d+/);
});

test('GPS follow pauses during map browsing and auto-centers after 60 seconds',()=>{
 const start=html.indexOf('const FOLLOW_IDLE_MS=60000;');
 const end=html.indexOf("try{if(!window.L)",start);
 assert.ok(start>=0&&end>start);
 assert.match(html,/map\.on\('dragstart',pauseGpsFollow\)/);
 assert.match(html,/map\.on\('dragend',scheduleGpsReturn\)/);
 assert.match(html,/if\(followMap&&!followPaused\(\)\)map\.panTo/);
 const helpers=html.slice(start,end);
 const simulate=new Function(
  "let followMap=true,watch=1,position={latitude:39,longitude:-94.5},map=null;\n"+
  "let now=1000,timer=null,pan=[];\n"+
  "const Date={now:()=>now};\n"+
  "const setTimeout=(callback,delay)=>{timer={callback,delay};return 1};\n"+
  "const clearTimeout=()=>{timer=null};\n"+
  "const buttons={followMap:{textContent:'',title:''}};\n"+
  "const $=id=>buttons[id];\n"+
  "function visibleFollowZoom(){return 12}\n"+
  "map={panTo:coords=>pan.push(coords),setView:()=>{}};\n"+helpers+
  "pauseGpsFollow();\n"+
  "const paused=followMap&&followPaused()&&buttons.followMap.textContent.includes('PAUSED');\n"+
  "scheduleGpsReturn();\n"+
  "const delay=timer&&timer.delay;\n"+
  "position={latitude:40,longitude:-95};\n"+
  "const held=followPaused();\n"+
  "now+=60000;\n"+
  "timer.callback();\n"+
  "const resumed=followMap&&!followPaused()&&pan.length===1&&pan[0][0]===40&&pan[0][1]===-95;\n"+
  "followMap=false;pauseGpsFollow();\n"+
  "return {paused,delay,held,resumed,offDoesNotPause:!followPaused()};"
 );
 const r=simulate();
 assert.equal(r.paused,true);assert.equal(r.delay,60000);
 assert.equal(r.held,true);assert.equal(r.resumed,true);assert.equal(r.offDoesNotPause,true);
});
