import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
// Flight-data hosts the proxy may forward to. Nothing else is reachable through it.
export const ALLOWED_HOSTS=new Set(['api.adsb.lol','api.airplanes.live','opendata.adsb.fi','opensky-network.org','api.adsbdb.com','api.planespotters.net','hexdb.io']);
const UA='Aeris/0.4 (+https://github.com/shira421/aeris; local proxy)';
const cache=new Map();// url → {t, status, body, date}: absorbs duplicate requests within one second
async function forward(target){
 const hit=cache.get(target);if(hit&&Date.now()-hit.t<1000)return hit;
 const r=await fetch(target,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','User-Agent':UA}});
 const body=Buffer.from(await r.arrayBuffer());if(body.length>12_000_000)throw new Error('Oversized provider response');
 const out={t:Date.now(),status:r.status,body,date:r.headers.get('date')||new Date().toUTCString(),type:r.headers.get('content-type')||'application/json'};
 cache.set(target,out);if(cache.size>200)cache.delete(cache.keys().next().value);return out;
}
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
 if(u.pathname==='/api/proxy'||u.pathname==='/api/flights'){
  let target;try{target=new URL(u.pathname==='/api/flights'?'https://api.adsb.lol/v2/point/1.36/103.99/100':u.searchParams.get('url')||'');}catch{target=null;}
  if(!target||target.protocol!=='https:'||!ALLOWED_HOSTS.has(target.host)||target.username||target.password){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Only HTTPS flight-data hosts are allowed.'}));return;}
  try{const r=await forward(target.href);res.writeHead(r.status,{'Content-Type':r.type,'Cache-Control':'no-store','Date':r.date,'X-Proxied-For':target.host});res.end(req.method==='HEAD'?undefined:r.body);}
  catch(err){res.writeHead(502,{'Content-Type':'application/json','Retry-After':'15'});res.end(JSON.stringify({error:'Provider unavailable',detail:err.message}));}
  return;
 }
 let rel=decodeURIComponent(u.pathname);if(rel==='/')rel='/index.html';const staticRoot=resolve(root,'dist');const path=resolve(staticRoot,'.'+rel);
 if(!path.startsWith(staticRoot+sep)){res.writeHead(403);res.end('Forbidden');return;}
 if(!(await stat(path)).isFile())throw new Error('not file');const data=await readFile(path);
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(req.method==='HEAD'?undefined:data);
}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found. Run npm run build first, then open /.');}});
server.listen(port,host,()=>console.log(`Aeris preview: http://${host}:${port}`));
