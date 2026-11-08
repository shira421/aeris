// One request path for every data source.
//  - Inside the iOS or Android app: the native bridge (no browser CORS limits).
//  - In a browser with a proxy configured (local Node server or Cloudflare Worker): via the proxy
//    for hosts that do not send CORS headers.
//  - Otherwise: plain fetch, which works only for hosts that allow browser access.
const pending=new Map();let seq=0,proxyBase=null;
const g=typeof window!=='undefined'?window:globalThis;
// Hosts that send Access-Control-Allow-Origin for any page (checked by scripts/probe-providers.mjs).
const CORS_OK=new Set(['api.adsbdb.com','hexdb.io','api.planespotters.net']);
if(typeof window!=='undefined')window.__aerisNetReply=(id,reply)=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);reply&&!reply.error?p.resolve(reply):p.reject(new Error(reply?.error||'Native request failed'));};
export function bridge(){if(g.webkit?.messageHandlers?.aerisNet)return 'ios';if(g.AerisNative?.request)return 'android';return null;}
export function setProxy(url){proxyBase=url?String(url).replace(/\/+$/,''):null;}
export function getProxy(){return proxyBase;}
/** How a request to this URL will travel, or null when this environment cannot read it. */
export function route(url){const host=new URL(url).host;if(bridge())return 'native';if(CORS_OK.has(host))return 'direct';if(proxyBase)return 'proxy';return null;}
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function nativeRequest(url,timeout){
 const kind=bridge();
 if(kind==='ios')return g.webkit.messageHandlers.aerisNet.postMessage({url,timeout});
 return new Promise((resolve,reject)=>{const id='r'+(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The request timed out.'));},timeout+2000);pending.set(id,{resolve,reject,timer});g.AerisNative.request(id,url,timeout);});
}
/** Fetch JSON. Resolves {data, status, ms, via, serverDate}. Rejects with HttpError on non-2xx. */
export async function getJSON(url,{timeout=9000,signal,maxBytes=12_000_000}={}){
 const started=(g.performance?.now?.()??Date.now());const host=new URL(url).host;
 const via=route(url)||'direct';
 let status,text,serverDate=null;
 if(via==='native'){
  const reply=await nativeRequest(url,timeout);
  if(signal?.aborted)throw new Error('Cancelled.');
  status=reply.status;text=reply.body;serverDate=reply.date?Date.parse(reply.date)/1000||null:null;
 }else{
  const target=via==='proxy'?`${proxyBase}?url=${encodeURIComponent(url)}`:url;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});
  try{
   const r=await fetch(target,{signal:controller.signal,cache:'no-store',credentials:'omit',mode:'cors',headers:{Accept:'application/json'},priority:'high'});
   status=r.status;serverDate=Date.parse(r.headers.get('date')||'')/1000||null;text=await r.text();
  }catch(err){
   if(err.name==='AbortError')throw new Error(signal?.aborted?'Cancelled.':'The request to '+host+' timed out.');
   throw Object.assign(new Error(via==='proxy'?'Cannot reach the data proxy.':'Cannot reach '+host+' from this browser (network or CORS).'),{blocked:true});
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 const ms=(g.performance?.now?.()??Date.now())-started;
 if(status<200||status>=300)throw new HttpError(status,status===429?'Rate limited by '+host+'.':`${host} returned HTTP ${status}.`);
 if(text.length>maxBytes)throw new Error('Response too large.');
 let data;try{data=JSON.parse(text);}catch{throw new Error(host+' returned invalid JSON.');}
 return {data,status,ms,via,serverDate};
}

/** Ask the native app to do something (location, notifications, background watch list). */
export async function nativeCall(action,payload={},timeout=30000){
 const kind=bridge();
 if(kind==='ios'){if(!g.webkit.messageHandlers.aerisDevice)throw new Error('Unavailable in this app version.');return g.webkit.messageHandlers.aerisDevice.postMessage({action,...payload});}
 if(kind==='android'){if(!g.AerisNative.device)throw new Error('Unavailable in this app version.');return new Promise((resolve,reject)=>{const id='d'+(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('No answer from the device.'));},timeout);pending.set(id,{resolve:r=>resolve(r?.value),reject,timer});g.AerisNative.device(id,JSON.stringify({action,...payload}));});}
 throw new Error('No native app.');
}
