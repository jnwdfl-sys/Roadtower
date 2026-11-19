// ROADTOWER same-origin fallback relay for Roadtower's own curated GMRS JSON file.
// This is a LIMITED set of attributed, published repeater references. NOT nationwide complete.
// Some records originate in SSRF-Lite (Apache-2.0), with location caveats.
export async function onRequestGet() {
 try {
  const response=await fetch('https://raw.githubusercontent.com/jnwdfl-sys/Roadtower/main/gmrs-directory.json',
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