// One request path for every data source. Inside the iOS or Android app, requests go
// through the native bridge (no browser CORS limits). In a browser they use fetch.
const pending=new Map();let seq=0;
const g=typeof window!=='undefined'?window:globalThis;
if(typeof window!=='undefined')window.__aerisNetReply=(id,reply)=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);reply&&!reply.error?p.resolve(reply):p.reject(new Error(reply?.error||'Native request failed'));};
export function bridge(){if(g.webkit?.messageHandlers?.aerisNet)return 'ios';if(g.AerisNative?.request)return 'android';return null;}
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function nativeRequest(url,timeout){
 const kind=bridge();
 if(kind==='ios')return g.webkit.messageHandlers.aerisNet.postMessage({url,timeout});
 return new Promise((resolve,reject)=>{const id='r'+(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The request timed out.'));},timeout+2000);pending.set(id,{resolve,reject,timer});g.AerisNative.request(id,url,timeout);});
}
/** Fetch JSON. Resolves {data, status, ms, via, serverDate}. Rejects with HttpError on non-2xx. */
export async function getJSON(url,{timeout=9000,signal,maxBytes=12_000_000}={}){
 const started=(g.performance?.now?.()??Date.now());
 let status,text,serverDate=null,via;
 if(bridge()){
  via='native';
  const reply=await nativeRequest(url,timeout);
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  status=reply.status;text=reply.body;serverDate=reply.date?Date.parse(reply.date)/1000||null:null;
 }else{
  via='browser';
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});
  try{
   const r=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit',mode:'cors',headers:{Accept:'application/json'},priority:'high'});
   status=r.status;serverDate=Date.parse(r.headers.get('date')||'')/1000||null;text=await r.text();
  }catch(err){
   if(err.name==='AbortError')throw new Error(signal?.aborted?'Cancelled.':'The request timed out.');
   throw new Error('Cannot reach '+new URL(url).host+' (network or CORS).');
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 const ms=(g.performance?.now?.()??Date.now())-started;
 if(status<200||status>=300)throw new HttpError(status,status===429?'Rate limited by '+new URL(url).host+'.':`${new URL(url).host} returned HTTP ${status}.`);
 if(text.length>maxBytes)throw new Error('Response too large.');
 let data;try{data=JSON.parse(text);}catch{throw new Error(new URL(url).host+' returned invalid JSON.');}
 return {data,status,ms,via,serverDate};
}
