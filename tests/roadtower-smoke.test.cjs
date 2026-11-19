'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const get=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const page=get('roadtower.html'), rep=get('repeaters.js'), panels=get('panel-layout.js'), sw=get('sw.js');
test('all JavaScript parses',()=>{
 for(const f of ['repeaters.js','panel-layout.js','offline-maps.js','sw.js'])new vm.Script(get(f),{filename:f});
 const chunks=[...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
 assert.ok(chunks.length>=1);
 for(const c of chunks)new vm.Script(c,{filename:'roadtower-inline.js'});
});
test('startup always displays both radio services',()=>{
 assert.match(rep,/radioService='both';/);
 assert.doesNotMatch(rep,/radioService=pref/);
 assert.match(rep,/redraw\(\);\s*updateStatuses\(\);\s*\(async function/);
 assert.match(rep,/GMRS_STARTER_ROWS/);
 assert.match(rep,/LOCAL_CLUB/);
});
test('ham and GMRS dots render separately and use color-coded map pins',()=>{
 assert.match(rep,/const gmrs=inBounds\.filter/);
 assert.match(rep,/fillColor:isGMRS\(x\)\?'#b340cf'/);
 assert.match(rep,/x\.wide\?'#e9c54a':'#35c979'/);
 assert.match(rep,/CLOSEST GMRS/);
 assert.match(rep,/CLOSEST HAM/);
});
test('library and Overland Park tower stations remain in published local list',()=>{
 assert.match(rep,/jcrac-w0erh-145290/);
 assert.match(rep,/kcwide-k0ham-146910-op/);
 assert.match(rep,/Santa Fe Water Tower/);
 assert.doesNotMatch(rep,/rt-library-pin-icon/);
});
test('GPS automatically starts on secure browser and remains user-controlled',()=>{
 assert.match(page,/function autoStartRoadtower\(\)/);
 assert.match(page,/navigator\.geolocation\.watchPosition/);
 assert.match(page,/window\.isSecureContext/);
 assert.match(page,/visibleFollowZoom\(position\)/);
 assert.match(page,/GPS STARTING/);
 assert.match(page,/GPS ERROR/);
 assert.match(page,/\$\('stop'\)\.onclick/);
});
test('SOS marker is a distinct visible icon',()=>{
 assert.match(page,/@keyframes rt-gps-sos/);
 assert.match(page,/YOU · SOS/);
 assert.match(page,/rt-self-center/);
});
test('panels minimize at startup while support for opening, maximizing and restoring remains',()=>{
 assert.match(panels,/mode:'min'/);
 assert.match(panels,/minimizeAll\.addEventListener\('click'/);
 assert.match(panels,/showAll\.addEventListener\('click'/);
 assert.match(panels,/function setMode\(/);
 assert.match(panels,/rt-layout-restore/);
});
test('offline shell caches map and repeater scripts',()=>{
 assert.match(sw,/roadtower-offline-v\d+/);
 for(const p of ['roadtower.html','repeaters.js','panel-layout.js','gmrs-directory.json'])
  assert.ok(sw.includes("'./"+p+"'"),'precache '+p);
});
test('GMRS source records include verified frequency offsets and positions',()=>{
 const entries=JSON.parse(get('gmrs-directory.json')).repeaters;
 assert.ok(entries.length>=3);
 for(const x of entries){
  assert.equal(x.service,'gmrs');
  assert.ok(x.rx_mhz>=462.55&&x.rx_mhz<=462.725);
  assert.ok(Math.abs(x.tx_mhz-x.rx_mhz-5)<0.002);
  assert.ok(Number.isFinite(x.lat)&&Number.isFinite(x.lon));
 }
});
