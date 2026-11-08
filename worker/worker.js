// Cloudflare Worker: lets the hosted Aeris web app read public ADS-B feeds, which do not
// send CORS headers. Forwards GET requests to an allowlist of flight-data hosts only.
// Deploy: see README "Live data in the web app". Free tier: 100,000 requests a day.
const ALLOWED_HOSTS=new Set(['api.adsb.lol','api.airplanes.live','opendata.adsb.fi','opensky-network.org','api.adsbdb.com','api.planespotters.net','hexdb.io']);
const UA='Aeris/0.4 (+https://github.com/shira421/aeris; Cloudflare Worker proxy)';
function cors(origin,env){const allowed=(env.ALLOWED_ORIGINS||'https://shira421.github.io,http://localhost:4173,http://127.0.0.1:4173').split(',').map(s=>s.trim());
 return {'Access-Control-Allow-Origin':allowed.includes(origin)||allowed.includes('*')?origin||'*':allowed[0],'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept','Access-Control-Max-Age':'86400','Vary':'Origin'};}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';const headers=cors(origin,env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
  let target;try{target=new URL(new URL(request.url).searchParams.get('url')||'');}catch{}
  if(!target||target.protocol!=='https:'||!ALLOWED_HOSTS.has(target.host))return Response.json({error:'Only HTTPS flight-data hosts are allowed.'},{status:400,headers});
  try{
   // A one-second edge cache merges identical requests from many viewers.
   const r=await fetch(target.href,{headers:{Accept:'application/json','User-Agent':UA},cf:{cacheTtl:1,cacheEverything:true}});
   return new Response(r.body,{status:r.status,headers:{...headers,'Content-Type':r.headers.get('content-type')||'application/json','Cache-Control':'no-store','Date':r.headers.get('date')||new Date().toUTCString()}});
  }catch(err){return Response.json({error:'Provider unavailable',detail:String(err)},{status:502,headers});}
 }
};
