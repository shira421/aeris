// Live traffic engine: decides what to ask which provider and when, merges answers,
// and keeps short tracks. Polls the area on screen about once a second, alternating
// providers so each stays within its published rate limit.
import {PROVIDERS,openSkyCost} from './providers.js';
import {getJSON,route} from './net.js';
import {normalizeADSB,normalizeOpenSky,mergeReport,predicted,coverageCircles,quality,LIMITS,distance} from './core.ts';

const TRACK_STRIDE=8;        // seconds between kept track points for unselected aircraft
const TRACK_MAX=60;          // points kept per unselected aircraft (~8 minutes)
const FOCUS_MAX=2400;        // points kept for the selected aircraft (~40 minutes at 1 Hz)
const SMOOTH_TAU=.7;         // seconds over which a correction blends in
const OPENSKY_BUDGET=380;    // anonymous credits used per UTC day (of 400)

export class LiveFeed{
 constructor({onUpdate=()=>{},onStatus=()=>{},storage=null,now=()=>Date.now()/1000}={}){
  this.onUpdate=onUpdate;this.onStatus=onStatus;this.storage=storage;this.now=now;
  this.flights=new Map();this.tracks=new Map();this.offsets=new Map();
  this.focus=null;this.view=null;this.circles=[];this.circleState=new Map();
  this.running=false;this.timer=null;this.paused=false;
  this.enabled=new Set(PROVIDERS.map(p=>p.id));
  this.health=new Map(PROVIDERS.map(p=>[p.id,{id:p.id,name:p.name,state:'idle',ok:0,fail:0,ms:null,aircraft:null,lastOk:null,error:null,nextAt:0,backoff:0,busy:false}]));
  this.lastUpdate=null;this.lastData=null;
 }
 providers(){return PROVIDERS.filter(p=>this.enabled.has(p.id));}
 /** Providers this environment can actually reach (native app, proxy, or CORS-enabled host). */
 reachable(){return this.providers().filter(p=>route(p.kind==='opensky'?p.hex('000000'):p.area({lat:0,lon:0,nm:10})));}
 setEnabled(id,on){on?this.enabled.add(id):this.enabled.delete(id);this.onStatus(this.status());}
 start(){if(this.running)return;this.running=true;this.loop();}
 stop(){this.running=false;clearTimeout(this.timer);}
 setPaused(p){this.paused=p;}
 setView(bounds,zoom){
  this.view={bounds,zoom};
  const circles=coverageCircles(bounds,250,24);const key=c=>c.lat.toFixed(1)+','+c.lon.toFixed(1)+','+c.nm;
  // Keep timing state for circles that are still wanted, so panning does not refetch everything.
  const next=new Map();for(const c of circles){const k=key(c);next.set(k,this.circleState.get(k)||{last:0,busy:false});}
  const fresh=circles.some(c=>!this.circleState.has(key(c)));
  this.circles=circles.map(c=>({...c,key:key(c)}));this.circleState=next;
  // A new area on screen is fetched right away rather than on the next tick.
  if(fresh&&this.running&&!this.paused)this.dispatch();
 }
 setFocus(id){this.focus=id;}
 /** In the 3D view only the followed aircraft is refreshed: far fewer requests. */
 setFocusOnly(on){this.focusOnly=on;}
 /** Aircraft to keep fresh wherever they are (the flights of an open trip), by address. */
 setTracked(ids){this.tracked=new Set(ids||[]);}
 /** Seconds between refreshes wanted for the i-th circle (nearest the centre first). */
 interval(i){return i<1?1:i<3?2.5:i<8?5:10;}
 loop(){
  if(!this.running)return;
  if(!this.paused)this.dispatch();
  this.prune();
  this.timer=setTimeout(()=>this.loop(),200);
 }
 dispatch(){
  const now=this.now()*1000;const readsb=this.reachable().filter(p=>p.kind==='readsb');
  // Round-robin: the source that has waited longest goes first, so requests alternate.
  for(const p of [...readsb].sort((a,b)=>(this.health.get(a.id).lastUsed||0)-(this.health.get(b.id).lastUsed||0))){
   const h=this.health.get(p.id);if(h.busy||now<h.nextAt)continue;
   const job=this.nextJob(p);if(!job)continue;
   this.run(p,job);
  }
  // OpenSky is the fallback when every faster source is failing (it is slower and credit-limited).
  const os=this.reachable().find(p=>p.kind==='opensky');
  if(os&&this.view&&!this.focusOnly){const h=this.health.get(os.id);const noReadsb=!readsb.length||readsb.every(p=>['error','blocked','refused','limited'].includes(this.health.get(p.id).state));
   if(!h.busy&&now>=h.nextAt&&noReadsb)this.runOpenSky(os);}
 }
 nextJob(p){
  const now=this.now();
  // The selected aircraft first, when it is not inside any circle refreshed in the last 2 s.
  if(this.focus&&!this.focus.startsWith('demo')){const f=this.flights.get(this.focus);const covered=f&&this.circles.some((c,i)=>i<3&&distance([c.lat,c.lon],[f.lat,f.lon])<c.nm*1852*.95);
   const st=this.circleState.get('focus')||{last:0,busy:false};this.circleState.set('focus',st);
   if((!covered||this.focusOnly)&&!st.busy&&now-st.last>=1.5)return {kind:'hex',id:this.focus,state:st};}
  if(this.focusOnly)return null;
  for(const id of this.tracked||[]){if(id===this.focus)continue;const f=this.flights.get(id);const covered=f&&this.circles.some((c,i)=>i<3&&distance([c.lat,c.lon],[f.lat,f.lon])<c.nm*1852*.95);
   const key='t:'+id,st=this.circleState.get(key)||{last:0,busy:false};this.circleState.set(key,st);
   if(!covered&&!st.busy&&now-st.last>=5)return {kind:'hex',id,state:st};}
  let best=null,score=-Infinity;
  this.circles.forEach((c,i)=>{const st=this.circleState.get(c.key);if(!st||st.busy)return;const overdue=now-st.last-this.interval(i);if(overdue>=0&&overdue>score){score=overdue;best={kind:'area',circle:c,state:st};}});
  return best;
 }
 async run(p,job){
  const h=this.health.get(p.id);h.busy=true;h.lastUsed=this.now();job.state.busy=true;
  const url=job.kind==='hex'?p.hex(job.id):p.area({...job.circle,nm:Math.min(job.circle.nm,p.maxRadius)});
  try{
   const {data,ms,serverDate}=await getJSON(url,{timeout:8000});
   const flights=normalizeADSB(data,this.now(),p.name);
   job.state.last=this.now();this.ingest(flights);
   Object.assign(h,{state:'ok',ok:h.ok+1,ms:Math.round(ms),aircraft:flights.length,lastOk:this.now(),error:null,backoff:0,nextAt:this.now()*1000+p.minGap,serverLag:serverDate?Math.round(this.now()-serverDate):null});
  }catch(err){
   job.state.last=this.now()-this.interval(0)+1.5;// retry this area soon, via another provider
   h.fail++;h.error=err.message;h.backoff=Math.min(300000,Math.max(5000,(h.backoff||2500)*2));
   h.state=err.status===429?'limited':err.status===403?'refused':err.blocked?'blocked':'error';
   h.nextAt=this.now()*1000+(err.status===403?600000:h.backoff);
  }finally{h.busy=false;job.state.busy=false;this.onStatus(this.status());}
 }
 openSkyCredits(){const day=new Date(this.now()*1000).toISOString().slice(0,10);let s={day,used:0};try{s=JSON.parse(this.storage?.getItem('aeris-opensky')||'null')||s;}catch{}if(s.day!==day)s={day,used:0};return s;}
 async runOpenSky(p){
  const b=this.view.bounds,box={west:Math.max(-180,b.west),east:Math.min(180,b.east),south:Math.max(-90,b.south),north:Math.min(90,b.north)};
  const cost=openSkyCost(box),credits=this.openSkyCredits(),h=this.health.get(p.id);
  if(credits.used+cost>OPENSKY_BUDGET){h.state='limited';h.error='Daily anonymous credit budget used.';h.nextAt=this.now()*1000+600000;return;}
  h.busy=true;
  try{
   const {data,ms}=await getJSON(p.bbox(box),{timeout:12000});
   credits.used+=cost;try{this.storage?.setItem('aeris-opensky',JSON.stringify(credits));}catch{}
   const flights=normalizeOpenSky(data,this.now(),p.name);this.ingest(flights);
   Object.assign(h,{state:'ok',ok:h.ok+1,ms:Math.round(ms),aircraft:flights.length,lastOk:this.now(),error:null,backoff:0,credits:OPENSKY_BUDGET-credits.used,nextAt:this.now()*1000+Math.max(p.minGap,cost*15000)});
  }catch(err){h.fail++;h.error=err.message;h.state=err.status===429?'limited':err.blocked?'blocked':'error';h.nextAt=this.now()*1000+(err.status===429?900000:60000);}
  finally{h.busy=false;this.onStatus(this.status());}
 }
 ingest(list){
  const now=this.now();let changed=0;
  for(const next of list){
   const prev=this.flights.get(next.id);
   if(prev&&next.positionTime<prev.positionTime-.05&&next.positionTime>0){// older than what we have: only fill identity fields
    const {flight}=mergeReport(prev,next);this.flights.set(next.id,flight);continue;}
   const before=prev?this.position(prev.id,now):null;
   const {flight,fresh}=mergeReport(prev,next);this.flights.set(next.id,flight);
   if(!fresh)continue;changed++;
   // Blend out the jump between where the old estimate had the aircraft and the new report.
   if(before){const after=predicted(flight,now);const dLat=before.lat-after.lat,dLon=before.lon-after.lon;
    if(Math.abs(dLat)<.02&&Math.abs(dLon)<.02)this.offsets.set(flight.id,{dLat,dLon,t:now});else this.offsets.delete(flight.id);}
   this.record(flight);
  }
  if(changed){this.lastUpdate=now;this.onUpdate();}
 }
 record(f){
  if(!f.positionTime)return;let t=this.tracks.get(f.id);if(!t){t=[];this.tracks.set(f.id,t);}
  const focus=f.id===this.focus,last=t.at(-1);
  if(last&&f.positionTime<=last.positionTime)return;
  if(!focus&&last&&f.positionTime-last.positionTime<TRACK_STRIDE)return;
  t.push({positionTime:f.positionTime,lat:f.lat,lon:f.lon,altitude:f.altitude,geometricAltitude:f.geometricAltitude,groundSpeed:f.groundSpeed,verticalRate:f.verticalRate,track:f.track,callsign:f.callsign,onGround:f.onGround,simulated:false});
  const max=focus?FOCUS_MAX:TRACK_MAX;if(t.length>max)t.splice(0,t.length-max);
 }
 /** Display position: dead-reckoned to now, with any recent correction blended out. */
 position(id,now=this.now()){
  const f=this.flights.get(id);if(!f)return null;const p=predicted(f,now);const o=this.offsets.get(id);
  if(o){const k=Math.exp(-(now-o.t)/SMOOTH_TAU);if(k<.01)this.offsets.delete(id);else{p.lat+=o.dLat*k;p.lon+=o.dLon*k;}}
  return p;
 }
 prune(){
  const now=this.now();
  for(const [id,f] of this.flights){const age=now-f.positionTime;if(age>LIMITS.lost*(id===this.focus||this.tracked?.has(id)?5:1)){this.flights.delete(id);this.offsets.delete(id);if(id!==this.focus)this.tracks.delete(id);}}
  for(const [id,t] of this.tracks){if(!this.flights.has(id)&&id!==this.focus&&(!t.length||now-t.at(-1).positionTime>1800))this.tracks.delete(id);}
 }
 list(){return [...this.flights.values()];}
 get(id){return this.flights.get(id)||null;}
 track(id){return this.tracks.get(id)||[];}
 /** Look up aircraft anywhere in the world without adding them to the map. kind: callsign | reg | hex | type. */
 async query(kind,value){
  // A search is one request, so a source that is only pacing the map refresh (rate limited) is still tried, last.
  const rank=p=>({ok:0,idle:0,error:1,limited:2})[this.health.get(p.id).state]??1;
  const usable=this.reachable().filter(p=>p.kind==='readsb'&&p[kind==='reg'?'reg':kind]&&!['refused','blocked'].includes(this.health.get(p.id).state)).sort((a,b)=>rank(a)-rank(b));
  if(!usable.length)throw new Error('No live source can be reached right now.');
  let lastError=null;
  for(const p of usable){
   try{const {data}=await getJSON(p[kind==='reg'?'reg':kind](value),{timeout:kind==='type'?15000:8000});return normalizeADSB(data,this.now(),p.name);}
   catch(err){lastError=err;if(err.status===429){const h=this.health.get(p.id);h.state='limited';h.nextAt=this.now()*1000+30000;}}
  }
  if(lastError)throw lastError;return [];
 }
 /** Every aircraft OpenSky sees worldwide (one request, cached for 90 s); used to list an airline's flights. */
 async snapshot(){
  if(this.snap&&this.now()-this.snap.t<90)return this.snap.flights;if(this.snapPending)return this.snapPending;
  const os=this.reachable().find(p=>p.kind==='opensky');if(!os)throw new Error('Worldwide lists need the Aeris app or a data proxy.');
  const credits=this.openSkyCredits();if(credits.used+4>OPENSKY_BUDGET)throw new Error('The worldwide list is used up for today. Try again tomorrow.');
  this.snapPending=(async()=>{try{const {data}=await getJSON(os.all(),{timeout:20000,maxBytes:30_000_000});credits.used+=4;try{this.storage?.setItem('aeris-opensky',JSON.stringify(credits));}catch{}
   const flights=normalizeOpenSky(data,this.now(),os.name);this.snap={t:this.now(),flights};return flights;}finally{this.snapPending=null;}})();
  return this.snapPending;
 }
 /** Find one aircraft anywhere and add it to the map. Returns its id or null. */
 async find(lookup){const flights=await this.query(lookup.kind,lookup.value);const f=flights.find(f=>f.lat!=null);if(!f)return null;this.ingest([f]);return f.id;}
 add(f){this.ingest([f]);return f.id;}
 status(){
  const hs=[...this.health.values()];const reachable=new Set(this.reachable().map(p=>p.id));
  const live=hs.some(h=>h.state==='ok'&&this.now()-(h.lastOk||0)<20);
  return {live,providers:hs.map(h=>({...h,enabled:this.enabled.has(h.id),reachable:reachable.has(h.id)})),aircraft:this.flights.size,lastUpdate:this.lastUpdate,circles:this.circles.length,anyReachable:reachable.size>0};
 }
 visibleCount(){let n=0;const now=this.now();for(const f of this.flights.values())if(quality(f,now).age<=LIMITS.lost)n++;return n;}
}
