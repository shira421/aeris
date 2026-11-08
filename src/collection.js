// Saved flights, aircraft and airports; trips (collections of dated flights); flight history;
// and the alert rules for watched flights. The rules are pure functions so they can be unit-tested
// and reused unchanged by the iOS app in the background (see rules.js).
import {airlineFor,flightNumber} from './search.js';
import {distance,quality,routeFit} from './core.ts';

const KEY='aeris-collection';
export const EMERGENCY={'7500':'unlawful interference','7600':'radio failure','7700':'general emergency'};
const HOUR=3600;

/** Device-local calendar date, YYYY-MM-DD. */
export function localDate(t){const d=new Date(t*1000);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
/** Whole days from date a to date b (YYYY-MM-DD). */
export function daysBetween(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);}
/** The fields of an airport that are kept with a flight. */
export function place(a){return a?{code:a.iata||a.code||a.icao||'',icao:a.icao||null,name:a.name||'',city:a.city||'',lat:a.lat,lon:a.lon,tz:a.tz||null}:null;}
const near=(p,lat,lon,km)=>p&&Number.isFinite(p.lat)&&distance([p.lat,p.lon],[lat,lon])<=km*1000;
const ft=n=>Math.round(n).toLocaleString('en-GB');
const timeAt=(t,tz)=>{try{return new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',...(tz?{timeZone:tz}:{})});}catch{return null;}};

/**
 * One check of one watched flight. `prev` is the state from the last check (or null), `f` what the
 * live sources report now (or null when the flight is not in the air or out of coverage).
 *
 * A flight is followed one leg at a time, and each kind of alert is sent at most once per leg, so a
 * flight that drops out of coverage and comes back does not alert again. Nothing is said about a
 * flight that is not being received: alerts describe only what was observed.
 * The first look at a flight sets a baseline and sends nothing.
 */
export function evaluate(prev,f,{now,route=null,nearAirport=null}={}){
 const s={...(prev||{}),t:now};const events=[];
 if(!f){s.status=prev?.status?'unseen':null;return {state:s,events};}
 const first=!prev?.status,ground=Boolean(f.onGround),alt=f.altitude??f.geometricAltitude??null;
 let leg=prev?.leg?{...prev.leg,alerted:[...(prev.leg.alerted||[])]}:null;
 const tell=(kind,data={})=>{if(leg.alerted.includes(kind))return;leg.alerted.push(kind);if(!first)events.push({kind,...data});};
 if(!ground){
  // A new leg: nothing followed yet, the last leg landed at least 15 minutes ago (a shorter gap is
  // the ground flag flickering on the landing roll), or the flight has not been seen for 4 hours.
  const ended=leg?.landed&&now-(leg.endSeen??0)>15*60,lost=!prev?.seen||now-prev.seen>4*HOUR;
  if(!leg||ended||lost){
   const wasGround=prev?.status==='ground'&&prev.seen&&now-prev.seen<=30*60;
   leg={id:Math.round(now),start:now,alerted:[],takeoffAt:null,from:null,to:null,landed:false,landedAt:null,endSeen:null,at:null,logged:false};
   if(wasGround){
    leg.from=place(nearAirport?.(prev.lat,prev.lon,8))||(near(route?.origin,prev.lat,prev.lon,10)?place(route.origin):null);
    if(now-prev.seen<=5*60)leg.takeoffAt=now;
    tell('takeoff',{alt,from:leg.from,at:leg.takeoffAt});
   }else tell('airborne',{alt});
  }
  if(route?.destination&&!leg.to)leg.to=place(route.destination);
  if(route?.origin&&!leg.from&&!leg.alerted.includes('takeoff'))leg.from=place(route.origin);
  if(leg.to&&!leg.landed&&alt!=null&&alt<10000&&(f.verticalRate??0)<-200){
   const km=distance([f.lat,f.lon],[leg.to.lat,leg.to.lon])/1000;if(km<60)tell('approach',{alt,km,to:leg.to});
  }
 }else if(leg&&!leg.landed){
  // On the ground after a followed leg. The ground flag is believed only near an airport and at taxi speed.
  const at=place(nearAirport?.(f.lat,f.lon,8))||(near(leg.to,f.lat,f.lon,10)?leg.to:null)||(near(route?.destination,f.lat,f.lon,10)?place(route.destination):null);
  if(at&&(f.groundSpeed==null||f.groundSpeed<100)){
   leg.landed=true;leg.at=at;leg.endSeen=now;
   if(prev?.status==='airborne'&&prev.seen&&now-prev.seen<=5*60)leg.landedAt=now;
   tell('landed',{at,time:leg.landedAt});
  }
 }
 if(leg&&f.squawk&&EMERGENCY[f.squawk])tell('squawk-'+f.squawk,{code:f.squawk});
 Object.assign(s,{status:ground?'ground':'airborne',seen:now,lat:f.lat,lon:f.lon,alt,gs:f.groundSpeed??null,squawk:f.squawk||null,leg,
  type:f.type||prev?.type||null,reg:f.registration||prev?.reg||null,hex:f.id||prev?.hex||null});
 return {state:s,events};
}

/** The words of an alert. Only observed facts: where, how high, how far. */
export function alertText(e,label){
 const code=p=>p.code||p.icao||p.name;
 if(e.kind==='takeoff'){
  const when=e.at?timeAt(e.at,e.from?.tz):null;
  return {title:`${label} took off${e.from?` from ${code(e.from)}`:''}`,body:[e.from?`Left ${e.from.name}.`:null,when?`In the air by ${when} local time.`:null,e.alt!=null?`Climbing through ${ft(e.alt)} ft.`:null].filter(Boolean).join(' ')||'Now in the air.'};
 }
 if(e.kind==='airborne')return {title:`${label} is in the air`,body:e.alt!=null?`Flying at ${ft(e.alt)} ft.`:'Now airborne.'};
 if(e.kind==='approach')return {title:`${label} is descending into ${e.to.city||code(e.to)}`,body:`${Math.round(e.km)} km from ${code(e.to)}, at ${ft(e.alt)} ft.`};
 if(e.kind==='landed'){const when=e.time?timeAt(e.time,e.at.tz):null;return {title:`${label} landed at ${code(e.at)}`,body:`${e.at.name}.${when?` On the ground by ${when} local time.`:''}`};}
 if(e.kind.startsWith('squawk-'))return {title:`${label} is squawking ${e.code}`,body:`Transponder code ${e.code} means ${EMERGENCY[e.code]}.`};
 return {title:label,body:''};
}

/** The route to compare against, when the database route fits where the aircraft is. */
export function usableRoute(route,f){
 if(!route?.origin||!route?.destination)return null;
 if(!f||f.onGround)return route;
 return routeFit(f,[route.origin.lat,route.origin.lon],[route.destination.lat,route.destination.lon]).plausible?route:null;
}

/** One watched flight: the next state and the notifications to show. Used in the app and in the iOS background check. */
export function step(item,f,{now,nearAirport}){
 const route=usableRoute(item.route,f);
 const {state,events}=evaluate(item.state||null,f,{now,route,nearAirport});
 const alerts=item.notify?events.map(e=>({...alertText(e,item.label),tag:`${item.callsign}-${state.leg?.id||0}-${e.kind}`})):[];
 return {state,alerts};
}

export class Collection{
 constructor(storage){
  this.storage=storage;this.listeners=new Set();
  let data=null;try{data=JSON.parse(storage?.getItem(KEY)||'null');}catch{}
  this.data={flights:[],aircraft:[],airports:[],trips:[],history:[],watch:{},...(data||{})};
  // v0.4 saved flights had a notify switch and their own last state.
  for(const x of this.data.flights){if(!x.alerts)x.alerts=x.notify?'every':'off';if(x.alerts!=='off'&&!x.armedAt)x.armedAt=x.added/1000||0;delete x.notify;delete x.last;}
  // Earlier versions saved aircraft by address only.
  if(!data){try{const old=JSON.parse(storage?.getItem('aeris-saved')||'[]'),meta=JSON.parse(storage?.getItem('aeris-savedMeta')||'{}');for(const id of old)if(!String(id).startsWith('demo')){const m=meta[id]||{};this.data.aircraft.push({hex:id,registration:m.registration||null,type:m.type||null,label:m.registration||m.callsign||id.toUpperCase(),added:Date.now()});}if(this.data.aircraft.length)this.persist();}catch{}}
 }
 persist(){try{this.storage?.setItem(KEY,JSON.stringify(this.data));}catch{}for(const fn of this.listeners)fn();}
 onChange(fn){this.listeners.add(fn);}
 get count(){return this.data.flights.length+this.data.aircraft.length+this.data.airports.length;}
 // ——— Saved flights, keyed by ICAO callsign (SIA22). alerts: off | next | every
 flight(cs){return this.data.flights.find(x=>x.callsign===cs)||null;}
 addFlight(f){const cs=(f.flight||f.callsign||'').toUpperCase();if(!/^[A-Z]{3}\d/.test(cs))return null;if(this.flight(cs))return this.flight(cs);const a=airlineFor(cs);
  const item={callsign:cs,label:flightNumber(cs)||cs,airline:a?.name||f.operator||null,alerts:'off',armedAt:null,added:Date.now()};this.data.flights.unshift(item);this.persist();return item;}
 removeFlight(cs){this.data.flights=this.data.flights.filter(x=>x.callsign!==cs);this.persist();}
 setAlerts(cs,mode,now=Date.now()/1000){const x=this.flight(cs);if(!x)return;x.alerts=mode;x.armedAt=mode==='off'?null:now;this.persist();}
 // ——— Aircraft, keyed by ICAO 24-bit address
 aircraft(hex){return this.data.aircraft.find(x=>x.hex===hex)||null;}
 addAircraft(f){if(this.aircraft(f.id))return;this.data.aircraft.unshift({hex:f.id,registration:f.registration||null,type:f.type||null,label:f.registration||f.id.toUpperCase(),added:Date.now()});this.persist();}
 removeAircraft(hex){this.data.aircraft=this.data.aircraft.filter(x=>x.hex!==hex);this.persist();}
 // ——— Airports, keyed by ICAO code
 airport(icao){return this.data.airports.find(x=>x.icao===icao)||null;}
 addAirport(a){if(this.airport(a.icao))return;this.data.airports.unshift({icao:a.icao,iata:a.iata||'',name:a.name,city:a.city||'',added:Date.now()});this.persist();}
 removeAirport(icao){this.data.airports=this.data.airports.filter(x=>x.icao!==icao);this.persist();}
 // ——— Trips: named collections of dated flights. mine: add them to my history once flown.
 trip(id){return this.data.trips.find(t=>t.id===id)||null;}
 addTrip(name){const t={id:'t'+Date.now().toString(36),name:String(name||'').trim()||'Trip',mine:true,alerts:true,created:Date.now(),flights:[]};this.data.trips.unshift(t);this.persist();return t;}
 updateTrip(id,patch){const t=this.trip(id);if(!t)return;Object.assign(t,patch);this.persist();}
 removeTrip(id){this.data.trips=this.data.trips.filter(t=>t.id!==id);this.persist();}
 addTripFlight(tripId,{callsign,date,from=null,to=null}){
  const t=this.trip(tripId);const cs=String(callsign||'').toUpperCase();if(!t||!/^[A-Z]{3}\d/.test(cs)||!/^\d{4}-\d\d-\d\d$/.test(date||''))return null;
  const existing=t.flights.find(x=>x.callsign===cs&&x.date===date);if(existing)return existing;
  const a=airlineFor(cs);const item={id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),callsign:cs,label:flightNumber(cs)||cs,airline:a?.name||null,date,from:place(from),to:place(to)};
  t.flights.push(item);t.flights.sort((x,y)=>x.date.localeCompare(y.date));this.persist();return item;
 }
 removeTripFlight(tripId,flightId){const t=this.trip(tripId);if(!t)return;t.flights=t.flights.filter(x=>x.id!==flightId);this.persist();}
 // ——— History: flights taken. source: tracked (seen flying by Aeris) | added (entered by hand)
 addHistory(e){
  const key=e.legId?`${e.callsign}:${e.legId}`:`${e.callsign}:${e.date}`;
  if(this.data.history.some(h=>(h.legId?`${h.callsign}:${h.legId}`:`${h.callsign}:${h.date}`)===key||(h.callsign===e.callsign&&h.date===e.date)))return null;
  const a=airlineFor(e.callsign);const from=place(e.from),to=place(e.to);
  const item={id:'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),callsign:e.callsign,label:flightNumber(e.callsign)||e.callsign,airline:a?.name||null,date:e.date,from,to,
   distanceKm:from&&to?Math.round(distance([from.lat,from.lon],[to.lat,to.lon])/1000):null,takeoffAt:e.takeoffAt||null,landedAt:e.landedAt||null,type:e.type||null,registration:e.registration||null,legId:e.legId||null,source:e.source||'added',added:Date.now()};
  this.data.history.push(item);this.data.history.sort((x,y)=>y.date.localeCompare(x.date));this.persist();return item;
 }
 removeHistory(id){this.data.history=this.data.history.filter(h=>h.id!==id);this.persist();}
 /** Flights to check: saved flights with alerts on, and trip flights dated within a day of today. */
 targets(now){
  const today=localDate(now),out=new Map();
  const add=(cs,label,o)=>{const t=out.get(cs)||{callsign:cs,label,notify:false,log:[],armedAt:null,mode:null};t.notify||=o.notify;if(o.log)t.log.push(o.log);if(o.mode){t.mode=o.mode;t.armedAt=o.armedAt;}if(o.route&&!t.route)t.route=o.route;out.set(cs,t);};
  // Every saved flight is checked (its status shows in Saved); only those with alerts on notify.
  for(const x of this.data.flights)add(x.callsign,x.label,{notify:Boolean(x.alerts&&x.alerts!=='off'),mode:x.alerts||'off',armedAt:x.armedAt});
  for(const t of this.data.trips)for(const x of t.flights)if(Math.abs(daysBetween(today,x.date))<=1&&(t.alerts||t.mine))
   add(x.callsign,x.label,{notify:t.alerts,log:t.mine?{trip:t.id,flight:x.id,date:x.date}:null,route:x.from&&x.to?{origin:x.from,destination:x.to}:null});
  return [...out.values()];
 }
 /** After a check: log a finished leg to history, and turn off "next flight" alerts that are done. */
 afterCheck(target,state){
  const leg=state?.leg;if(!leg?.landed)return false;let changed=false;
  if(!leg.logged&&target.log?.length){
   const d=localDate(leg.start);const match=target.log.find(l=>Math.abs(daysBetween(l.date,d))<=1);
   if(match){const tf=this.trip(match.trip)?.flights.find(x=>x.id===match.flight);
    this.addHistory({callsign:target.callsign,date:tf?.date||d,from:leg.from||tf?.from,to:leg.at||leg.to||tf?.to,takeoffAt:leg.takeoffAt,landedAt:leg.landedAt,type:state.type,registration:state.reg,legId:leg.id,source:'tracked'});
    leg.logged=true;changed=true;}
  }
  const saved=this.flight(target.callsign);
  if(saved?.alerts==='next'&&(leg.endSeen??0)>=(saved.armedAt??0)&&leg.alerted.includes('landed')){saved.alerts='off';saved.armedAt=null;changed=true;}
  return changed;
 }
 /** Take the newer state of each flight from the iOS/Android app (which checks while Aeris is closed). */
 mergeWatch(items){
  let changed=false;for(const it of items||[]){const mine=this.data.watch[it.callsign];if(it.state&&(!mine||(it.state.t||0)>(mine.t||0))){this.data.watch[it.callsign]=it.state;changed=true;}}
  return changed;
 }
}

/** Checks watched flights every minute while Aeris is open, and keeps the app's background checks in step. */
export class Watcher{
 constructor({collection,live,routeFor,nearAirport,notify,native=null,onCheck=()=>{},now=()=>Date.now()/1000}){
  Object.assign(this,{collection,live,routeFor,nearAirport,notify,native,onCheck,now});this.timer=null;this.running=false;this.seen={};
 }
 start(){if(this.timer)return;this.timer=setInterval(()=>this.check(),60000);setTimeout(()=>this.check(),4000);}
 /** The items handed to the app for background checks. */
 items(){const c=this.collection;return c.targets(this.now()).map(t=>({callsign:t.callsign,label:t.label,notify:t.notify,route:t.route||c.data.watch[t.callsign]?.route||null,state:c.data.watch[t.callsign]||null}));}
 async check(){
  if(this.running)return;this.running=true;
  try{
   const c=this.collection;
   if(this.native){try{c.mergeWatch(await this.native.state());}catch{}}
   const targets=c.targets(this.now());const seen={};
   for(const t of targets){
    let f=this.live.list().find(x=>(x.flight||x.callsign)===t.callsign&&quality(x,this.now()).age<30)||null;
    if(!f){try{const list=await this.live.query('callsign',t.callsign);f=list.find(x=>x.lat!=null)||null;}catch{continue;}await new Promise(r=>setTimeout(r,1200));}
    let route=t.route||null;if(!route){try{route=await this.routeFor(t.callsign);}catch{}}
    const now=this.now();const {state,alerts}=step({...t,route,state:c.data.watch[t.callsign]||null},f,{now,nearAirport:this.nearAirport});
    if(route)state.route={origin:place(route.origin),destination:place(route.destination)};
    c.data.watch[t.callsign]=state;
    for(const a of alerts)this.notify(a.title,a.body,a.tag);
    c.afterCheck(t,state);
    if(f)seen[t.callsign]=f;
   }
   // Forget flights nobody watches any more.
   const keep=new Set(targets.map(t=>t.callsign));for(const cs of Object.keys(c.data.watch))if(!keep.has(cs))delete c.data.watch[cs];
   this.seen=seen;c.persist();this.onCheck(seen);
  }finally{this.running=false;}
 }
}
