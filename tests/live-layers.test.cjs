/* Regression checks for optional aircraft (off by default) and radar (on) overlays.
 * No internet needed. Upstream providers are mocked.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const page=read('roadtower.html');
const js=read('live-layers.js');
const radar=read('functions/api/radar.js');
const aircraft=read('functions/api/aircraft.js');
const layout=read('panel-layout.js');
const sw=read('sw.js');

function worker(source,mock){
 const plain=source.replace('export async function onRequestGet','async function onRequestGet');
 assert.notEqual(plain,source,'Cloudflare entrypoint exists');
 return new Function('fetch','caches','Request','Response','AbortSignal',
  plain+'\nreturn onRequestGet;')(
  mock.fetch,mock.caches||{default:{match:async()=>null,put:async()=>{}}},
  Request,Response,AbortSignal
 );
}
const fakeRequest=url=>new Request(url);

test('new frontend and both Cloudflare worker scripts are valid JS',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotThrow(()=>new vm.Script(aircraft.replace('export async function onRequestGet','async function onRequestGet')));
 assert.doesNotThrow(()=>new vm.Script(radar.replace('export async function onRequestGet','async function onRequestGet')));
});

test('aircraft starts OFF to save API quota while radar stays ON, both toggle independently',()=>{
 assert.match(js,/let aircraftOn=false,radarOn=true/);
 assert.match(js,/setAuto\(true\);\s*loadRadar\(true\)/);
 assert.match(js,/setAircraft\(!aircraftOn\)/);
 assert.match(js,/setRadar\(!radarOn\)/);
 assert.match(js,/airGroup\.clearLayers\(\)/);
 assert.match(js,/map\.removeLayer\(radarLayer\)/);
});

test('live panel appears before draggable layout; minimization leaves layers active',()=>{
 const a=page.indexOf('<script src="./live-layers.js');
 const b=page.indexOf('<script src="./panel-layout.js');
 assert.ok(a>0&&b>a);
 assert.match(layout,/selector:'\.rt-live-panel'/);
 assert.match(layout,/layers:\{icon:'✈',short:'LIVE',color:'orange'\}/);
 assert.match(layout,/minimizeAll\.addEventListener/);
 assert.match(page,/rt-dot-orange/);
 assert.match(page,/rt-layout-maximized/);
});

test('transparent radar is latest observed image, not a forecast',()=>{
 assert.match(js,/RADAR_OPACITY=\.30/);
 assert.match(js,/maxNativeZoom:7/);
 assert.match(js,/pane:'rtRadarPane'/);
 assert.match(js,/pointerEvents='none'/);
 assert.match(js,/frame\.path\+'\/256\/\{z\}\/\{x\}\/\{y\}\/2\/1_1\.png'/);
 assert.match(js,/observed-precipitation frames, NOT future forecasts/);
 assert.match(js,/radarTile\(radarFrames\[radarFrames\.length-1\]\)/);
});

test('aircraft lookup rounds map center to 0.1 degrees and caches requests',async()=>{
 const urls=[];
 const get=worker(aircraft,{fetch:async url=>{
  urls.push(url);
  return new Response(JSON.stringify({ac:[{
   hex:'a12345',flight:' TEST123 ',t:'A320',lat:39.12,lon:-94.61,
   alt_baro:20000,gs:300,track:45,seen_pos:4
  }]}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 const response=await get({request:fakeRequest('https://roadtower.pages.dev/api/aircraft?lat=39.12345&lon=-94.65432')});
 assert.equal(response.status,200);
 assert.equal(urls.length,1);
 assert.match(urls[0],/\/lat\/39\.1\/lon\/-94\.7\/dist\/80/);
 const data=await response.json();
 assert.equal(data.flights.length,1);
 assert.equal(data.flights[0].call,'TEST123');
 assert.equal(data.flights[0].altFt,20000);
 assert.equal(data.center.lat,39.1);
 assert.equal(data.center.lon,-94.7);
 assert.match(data.credit,/adsb\.fi/);
 assert.match(response.headers.get('cache-control'),/max-age=180/);
 const invalid=await get({request:fakeRequest('https://roadtower.pages.dev/api/aircraft?lat=999&lon=-95')});
 assert.equal(invalid.status,400);
 assert.equal(urls.length,1,'bad coordinates never reach upstream');
});

test('radar metadata endpoint rejects untrusted hosts and allows valid frames',async()=>{
 const meta={version:'2.0',generated:1795082141,host:'https://tilecache.rainviewer.com',
 radar:{past:[
  {time:1795081800,path:'/v2/radar/d66f8464e8fe'},
  {time:1795081200,path:'/v2/radar/2b462c2b2234'}
 ]}};
 const good=worker(radar,{fetch:async()=>new Response(JSON.stringify(meta),{status:200})});
 const response=await good({request:fakeRequest('https://roadtower.pages.dev/api/radar')});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.host,'https://tilecache.rainviewer.com');
 assert.equal(data.frames.length,2);
 assert.match(data.note,/no future nowcast/);
 const bad=worker(radar,{fetch:async()=>new Response(JSON.stringify({
  ...meta,host:'https://untrusted.example.com'
 }),{status:200})});
 const result=await bad({request:fakeRequest('https://roadtower.pages.dev/api/radar')});
 assert.equal(result.status,502);
});

test('stale aircraft are not presented as live, no simulated flight tracks',()=>{
 assert.match(js,/airLastSuccess/);
 assert.match(js,/now-airLastSuccess>=360000/);
 assert.match(js,/last position/i);
 assert.doesNotMatch(js,/Math\.random\(\)/);
 assert.match(js,/AIR_INTERVAL=240000/);
});

test('new frontend file is in the cache but API data are network-only',()=>{
 assert.ok(sw.includes("'./live-layers.js'"));
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(page,/Exact GPS stays on this device/);
 assert.match(js,/Math\.round\(c\.lat\*10\)\/10/);
});
