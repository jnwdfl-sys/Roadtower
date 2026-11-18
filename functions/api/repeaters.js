// Cloudflare Pages Function: same-origin relay for HearHam's free app-use JSON feed.
// No GPS location, credentials, or user data are sent to this endpoint.
export async function onRequestGet(context) {
  const url='https://hearham.com/api/repeaters/v1';
  try {
    const upstream=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'ROADTOWER/1.0 repeater directory'}});
    if(!upstream.ok)return new Response(JSON.stringify({error:'HearHam directory unavailable'}),{
      status:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
    });
    return new Response(upstream.body,{
      status:200,
      headers:{
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'public, max-age=1800, s-maxage=86400',
        'X-Content-Type-Options':'nosniff',
        'Access-Control-Allow-Origin':'*'
      }
    });
  } catch(e) {
    return new Response(JSON.stringify({error:'Directory relay is temporarily unavailable'}),{
      status:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
    });
  }
}