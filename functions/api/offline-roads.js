// Same-origin fallback for the ROADTOWER offline road-data download.
// Requests a bounded OpenStreetMap Overpass area only; never raster map tiles.
// Data: © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
export async function onRequestGet({request}) {
 const url=new URL(request.url);
 const lat=Number(url.searchParams.get('lat'));
 const lon=Number(url.searchParams.get('lon'));
 const miles=Number(url.searchParams.get('miles'));
 const validPosition=Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
 if(!validPosition||![5,10,20].includes(miles))return new Response('Invalid region or radius',{status:400});
 const radius=Math.round(miles*1609.344);
 const q='[out:json][timeout:55][maxsize:67108864];'+
 '(way["highway"](around:'+radius+','+lat.toFixed(5)+','+lon.toFixed(5)+');'+
 'node["place"~"^(city|town|village|hamlet)$"](around:'+radius+','+lat.toFixed(5)+','+lon.toFixed(5)+'););out geom;';
 const endpoint='https://overpass-api.de/api/interpreter';
 try{
  const upstream=await fetch(endpoint,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:'data='+encodeURIComponent(q)
  });
  if(!upstream.ok)return new Response('Map data provider temporarily unavailable',{status:502});
  const headers={'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  return new Response(upstream.body,{status:200,headers});
 }catch(e){
  return new Response('Map data download unavailable; try again later',{status:502});
 }
}