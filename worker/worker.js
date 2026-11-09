// Aeris relay (Cloudflare Worker). Web pages may not read the public ADS-B feeds directly (they send
// no CORS headers), so the web app asks this relay instead. It forwards GET requests to an allowlist
// of public flight-data hosts only, adds CORS headers for the Aeris web app, and nothing else: no
// logging, no storage. Deployed by .github/workflows/pages.yml when the Cloudflare secrets are set.
// Free tier: 100,000 requests a day.
const ALLOWED_HOSTS=new Set(['api.adsb.lol','api.airplanes.live','opendata.adsb.fi','opensky-network.org','api.adsbdb.com','api.planespotters.net','hexdb.io']);
const UA='Aeris/1.0 (+https://github.com/shira421/aeris; relay)';
/** The Origin to echo back, or null when this origin may not use the relay. */
export function allowedOrigin(origin,env={}){
 const list=(env.ALLOWED_ORIGINS||'https://shira421.github.io').split(',').map(s=>s.trim()).filter(Boolean);
 if(!origin)return null;
 if(list.includes('*')||list.includes(origin))return origin;
 if(origin==='null')return 'null';// the standalone Aeris.html opened from a file
 if(/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin))return origin;// local development
 return null;
}
function corsHeaders(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept','Access-Control-Expose-Headers':'Date','Access-Control-Max-Age':'86400','Vary':'Origin'};}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,service:'aeris-relay'},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  const origin=allowedOrigin(request.headers.get('Origin'),env);
  if(!origin)return Response.json({error:'This relay serves the Aeris web app only.'},{status:403,headers:{'Vary':'Origin'}});
  const headers=corsHeaders(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers});
  let target;try{target=new URL(url.searchParams.get('url')||'');}catch{}
  if(!target||target.protocol!=='https:'||!ALLOWED_HOSTS.has(target.host)||target.username||target.password)
   return Response.json({error:'Only HTTPS flight-data hosts are allowed.'},{status:400,headers});
  try{
   const r=await fetch(target.href,{headers:{Accept:'application/json','User-Agent':UA},signal:AbortSignal.timeout(10000)});
   return new Response(r.body,{status:r.status,headers:{...headers,'Content-Type':r.headers.get('content-type')||'application/json','Cache-Control':'no-store','Date':r.headers.get('date')||new Date().toUTCString()}});
  }catch(err){return Response.json({error:'The flight-data source did not answer.',detail:String(err)},{status:502,headers});}
 }
};
