/* ROADTOWER Nearest Plane: public ADS-B reports measured against phone GPS.
 * Client-only Haversine measurement. No fabricated planes; no radio scanning.
 * Altitude is reported to MSL/standard reference, NOT height above the user.
 */
(function(){
'use strict';
const rt=window.RoadtowerRepeaters,live=window.RoadtowerLiveLayers;
const map=rt&&rt.getMap&&rt.getMap(),host=document.getElementById('map');
if(!map||!host||!window.L||!live||!live.getAircraftSnapshot)return;
const MILES_EARTH=3958.7613;
const FRESH_MS=180000;
let current=null,link=null,halo=null,lineEnabled=false,requestedRefreshAt=0;
const panel=document.createElement('section');
panel.className='rt-nearest-plane-panel';
panel.id='rtNearestPlanePanel';
panel.setAttribute('aria-label','Closest verified aircraft to my GPS');
panel.innerHTML=
 '<strong class="rt-nearest-plane-title">✈ NEAREST AIRCRAFT</strong>'+
 '<div class="rt-nearest-plane-status" id="rtPlaneNearestStatus" role="status">Waiting for GPS and public aircraft data…</div>'+
 '<div class="rt-nearest-plane-metrics" id="rtPlaneNearestMetrics" hidden></div>'+
 '<div class="rt-nearest-plane-buttons">'+
 '<button id="rtPlaneNearestLocate" type="button" disabled>◎ Show on map</button>'+
 '<button id="rtPlaneNearestRefresh" type="button">↻ Check aircraft</button></div>'+
 '<p class="rt-nearest-plane-note">Distance is horizontal, straight-line distance from your phone GPS to a reported aircraft position—not its distance through the sky. Reported altitude (ft) is generally relative to sea level, not height above you. ADS-B coverage can be delayed, incomplete, or unavailable.</p>';
host.appendChild(panel);
if(L.DomEvent){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel)}
const $=id=>panel.querySelector('#'+id);
const status=$('rtPlaneNearestStatus'),metrics=$('rtPlaneNearestMetrics');
const locate=$('rtPlaneNearestLocate'),refresh=$('rtPlaneNearestRefresh');
const goodGps=()=>{
 const g=rt.getGps&&rt.getGps();
 return g&&Number.isFinite(g.latitude)&&Number.isFinite(g.longitude)&&
 Math.abs(g.latitude)<=90&&Math.abs(g.longitude)<=180?g:null;
};
function distance(a,b,c,d){
 const r=Math.PI/180,p=(c-a)*r,l=(d-b)*r;
 const h=Math.sin(p/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(l/2)**2;
 return MILES_EARTH*2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,h))));
}
function bearing(a,b,c,d){
 const r=Math.PI/180,x=Math.sin((d-b)*r)*Math.cos(c*r);
 const y=Math.cos(a*r)*Math.sin(c*r)-
   Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);
 return (Math.atan2(x,y)/r+360)%360;
}
const compass=n=>['N','NE','E','SE','S','SW','W','NW'][Math.round(n/45)%8];
function getResult(){
 const g=goodGps(),snapshot=live.getAircraftSnapshot(),checkedAt=snapshot.checkedAt||0;
 const ageMs=checkedAt?Math.max(0,Date.now()-checkedAt):Infinity;
 if(!g)return {state:'gps',error:'Start Live GPS to measure the closest plane to you.'};
 if(!snapshot.aircraftOn)return {state:'off',error:'Aircraft layer is OFF. Turn it ON in LIVE.'};
 if(!navigator.onLine&&ageMs>FRESH_MS)return {state:'offline',error:'Offline. Cannot verify nearby airplane positions.'};
 if(ageMs>FRESH_MS)return {state:'stale',error:snapshot.error?
  'Aircraft feed unavailable: '+snapshot.error:
  checkedAt?'Aircraft positions are more than 3 minutes old; waiting for updated reports.':
  'Waiting for the first aircraft response. Tap Check aircraft.'};
 if(snapshot.reportCenter&&distance(g.latitude,g.longitude,
  snapshot.reportCenter.lat,snapshot.reportCenter.lon)>45)
  return {state:'different-area',
   error:'Aircraft feed still covers an earlier map location. Updating the GPS area…'};
 let best=null;
 for(const plane of snapshot.flights||[]){
  if(!plane||!Number.isFinite(plane.lat)||!Number.isFinite(plane.lon))continue;
  const dist=distance(g.latitude,g.longitude,plane.lat,plane.lon);
  if(!best||dist<best.miles)
   best={plane,miles:dist,feet:dist*5280,bearing:bearing(g.latitude,g.longitude,plane.lat,plane.lon)};
 }
 if(!best)return {state:'empty',
  error:snapshot.error?'Latest aircraft update failed: '+snapshot.error:
  'No aircraft position reported in this area. This does NOT mean the sky is empty.'};
 return {...best,gps:g,state:snapshot.error?'previous':'reported',
  checkedAt,ageMs,source:snapshot.source||'aircraft feed',
  lastError:snapshot.error||''};
}
function removeLine(){
 if(link){map.removeLayer(link);link=null}
 if(halo){map.removeLayer(halo);halo=null}
}
function addMetric(label,value){
 const block=document.createElement('div');block.className='rt-nearest-plane-metric';
 const heading=document.createElement('small');heading.textContent=label;
 const amount=document.createElement('strong');amount.textContent=value;
 block.append(heading,amount);metrics.appendChild(block);
}
function drawLine(result){
 removeLine();
 if(!lineEnabled||!result||!result.plane)return;
 const a=[result.gps.latitude,result.gps.longitude],b=[result.plane.lat,result.plane.lon];
 link=L.polyline([a,b],{
  color:'#7ceafc',weight:3,opacity:.9,dashArray:'7 9',interactive:false
 }).addTo(map);
 halo=L.circleMarker(b,{
  radius:18,color:'#7ceafc',weight:3,opacity:.95,fillColor:'#33d3ee',
  fillOpacity:.1,interactive:false
 }).addTo(map);
}
function render(){
 const r=getResult();
 current=r.plane?r:null;
 metrics.replaceChildren();
 metrics.hidden=!current;
 locate.disabled=!current;
 locate.textContent=lineEnabled?'◌ Hide guide line':'◎ Show on map';
 if(!current){
  if(lineEnabled){lineEnabled=false;removeLine()}
  status.textContent=r.error;
  status.dataset.state=r.state;
  return;
 }
 const x=r.plane,call=x.call||x.hex||'Unidentified aircraft';
 status.dataset.state=r.state;
 status.textContent='✈ '+call+' · '+(r.state==='previous'?'LAST VERIFIED POSITION':'RECENT REPORT')+
  ' · '+compass(r.bearing)+' of your GPS';
 addMetric('HORIZONTAL MILES',r.miles.toFixed(r.miles<1?2:1)+' mi');
 addMetric('HORIZONTAL FEET','≈ '+Math.round(r.feet).toLocaleString()+' ft');
 addMetric('DIRECTION',compass(r.bearing)+' · '+Math.round(r.bearing)+'°');
 addMetric('REPORTED ALTITUDE',x.altFt===null?'Not reported':Math.round(x.altFt).toLocaleString()+' ft');
 addMetric('GROUND SPEED',x.speedKt===null?'Not reported':Math.round(x.speedKt*1.150779)+' mph');
 const ageSec=Math.round(r.ageMs/1000)+(Number.isFinite(x.seenSec)?x.seenSec:0);
 addMetric('REPORT AGE','≈ '+Math.round(ageSec)+' sec');
 const meta=document.createElement('p');meta.className='rt-nearest-plane-meta';
 meta.textContent='Source: '+r.source+' · '+(x.type?'Aircraft type: '+x.type+' · ':'')+
  (Number.isFinite(r.gps.accuracy)?'GPS ±'+Math.round(r.gps.accuracy)+' m · ':'')+
  (r.lastError?'Newest feed check failed; showing last verified position.':'Not instant onboard telemetry.');
 metrics.appendChild(meta);
 if(lineEnabled)drawLine(r);
}
function showPlane(){
 const r=getResult();
 if(!r.plane){render();return false}
 lineEnabled=!lineEnabled;
 drawLine(r);
 if(lineEnabled){
  const a=[r.gps.latitude,r.gps.longitude],b=[r.plane.lat,r.plane.lon];
  map.fitBounds(L.latLngBounds([a,b]).pad(.20),{animate:false,maxZoom:12});
 }
 render();
 return lineEnabled;
}
locate.addEventListener('click',showPlane);
refresh.addEventListener('click',()=>{
 if(live.refreshAircraft)live.refreshAircraft();
 render();
});
let gpsWasReady=false;
function gotGps(g){
 const ready=!!(g&&Number.isFinite(g.latitude)&&Number.isFinite(g.longitude));
 if(ready&&!gpsWasReady&&Date.now()-requestedRefreshAt>15000){
  requestedRefreshAt=Date.now();
  live.refreshAircraft?.();
 }
 gpsWasReady=ready;
 render();
}
const priorGps=rt.onGps;
rt.onGps=function(g){if(typeof priorGps==='function')priorGps(g);gotGps(g)};
window.addEventListener('online',()=>{live.refreshAircraft?.();render()});
window.addEventListener('pageshow',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.setInterval(()=>{if(!document.hidden)render()},12000);
window.RoadtowerNearestPlane={
 getState:()=>{
  const r=getResult();
  return {state:r.state,miles:r.miles??null,feet:r.feet??null,
   call:r.plane?(r.plane.call||r.plane.hex||'Aircraft'):null,
   altFt:r.plane?.altFt??null,source:r.source||null,error:r.error||r.lastError||null}
 },
 refresh:()=>live.refreshAircraft?.(),showOnMap:showPlane
};
render();
})();
