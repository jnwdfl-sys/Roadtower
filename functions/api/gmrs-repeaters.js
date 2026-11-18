// ROADTOWER public-data relay for licensed SSRF-Lite GMRS dataset.
// Upstream codeplug.json: https://github.com/Chicago-Offline/ssrf-lite (Apache-2.0).
// Includes only publisher's public records; it is NOT a complete US GMRS repeater directory.
export async function onRequestGet() {
 try {
  const response=await fetch('https://chicago-offline.github.io/ssrf-lite/codeplug.json',
    {headers:{'Accept':'application/json'}});
  if(!response.ok)return new Response(JSON.stringify({error:'GMRS open-data feed unavailable'}),{
    status:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
  });
  return new Response(response.body,{status:200,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'public,max-age=1200,s-maxage=3600',
    'X-Content-Type-Options':'nosniff'
  }});
 }catch(e){
  return new Response(JSON.stringify({error:'GMRS data unavailable'}),{
    status:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
  });
 }
}