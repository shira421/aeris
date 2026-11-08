// Saved flights (by flight number, so a loved one's flight can be followed before it departs),
// aircraft (by airframe) and airports, plus alerts for saved flights.
import {airlineFor,flightNumber} from './search.js';
import {distance,quality} from './core.ts';

const KEY='aeris-collection';
const EMERGENCY={'7500':'unlawful interference','7600':'radio failure','7700':'general emergency'};

export class Collection{
 constructor(storage){
  this.storage=storage;this.listeners=new Set();
  let data=null;try{data=JSON.parse(storage?.getItem(KEY)||'null');}catch{}
  this.data={flights:[],aircraft:[],airports:[],...(data||{})};
  // Earlier versions saved aircraft by address only.
  if(!data){try{const old=JSON.parse(storage?.getItem('aeris-saved')||'[]'),meta=JSON.parse(storage?.getItem('aeris-savedMeta')||'{}');for(const id of old)if(!String(id).startsWith('demo')){const m=meta[id]||{};this.data.aircraft.push({hex:id,registration:m.registration||null,type:m.type||null,label:m.registration||m.callsign||id.toUpperCase(),added:Date.now()});}if(this.data.aircraft.length)this.persist();}catch{}}
 }
 persist(){try{this.storage?.setItem(KEY,JSON.stringify(this.data));}catch{}for(const fn of this.listeners)fn();}
 onChange(fn){this.listeners.add(fn);}
 get count(){return this.data.flights.length+this.data.aircraft.length+this.data.airports.length;}
 // Flights, keyed by ICAO callsign (SIA22)
 flight(cs){return this.data.flights.find(x=>x.callsign===cs)||null;}
 addFlight(f){const cs=(f.flight||f.callsign||'').toUpperCase();if(!/^[A-Z]{3}\d/.test(cs)||this.flight(cs))return this.flight(cs);const a=airlineFor(cs);
  const item={callsign:cs,label:flightNumber(cs)||cs,airline:a?.name||f.operator||null,notify:false,added:Date.now(),last:null};this.data.flights.unshift(item);this.persist();return item;}
 removeFlight(cs){this.data.flights=this.data.flights.filter(x=>x.callsign!==cs);this.persist();}
 setNotify(cs,on){const x=this.flight(cs);if(x){x.notify=on;this.persist();}}
 // Aircraft, keyed by ICAO 24-bit address
 aircraft(hex){return this.data.aircraft.find(x=>x.hex===hex)||null;}
 addAircraft(f){if(this.aircraft(f.id))return;this.data.aircraft.unshift({hex:f.id,registration:f.registration||null,type:f.type||null,label:f.registration||f.id.toUpperCase(),added:Date.now()});this.persist();}
 removeAircraft(hex){this.data.aircraft=this.data.aircraft.filter(x=>x.hex!==hex);this.persist();}
 // Airports, keyed by ICAO code
 airport(icao){return this.data.airports.find(x=>x.icao===icao)||null;}
 addAirport(a){if(this.airport(a.icao))return;this.data.airports.unshift({icao:a.icao,iata:a.iata||'',name:a.name,city:a.city||'',added:Date.now()});this.persist();}
 removeAirport(icao){this.data.airports=this.data.airports.filter(x=>x.icao!==icao);this.persist();}
}

/** One saved flight's state and the alerts its change deserves. Pure, so it can be tested. */
export function evaluate(prev,f,route,now,nearAirport){
 const alerts=[];const state={t:now};
 if(f){
  state.status=f.onGround?'ground':'airborne';state.alt=f.altitude??f.geometricAltitude??null;state.lat=f.lat;state.lon=f.lon;state.vs=f.verticalRate;state.gs=f.groundSpeed;state.squawk=f.squawk||null;state.approach=prev?.approach&&state.status==='airborne';
  const dest=route?.destination,origin=route?.origin;
  if(prev&&prev.status!=='airborne'&&state.status==='airborne'){
   alerts.push(prev.status==='ground'?{kind:'takeoff',title:'took off',body:origin?`Departed ${origin.city||origin.iata||origin.name}.`:'Now airborne.'}:{kind:'airborne',title:'is in the air',body:state.alt!=null?`At ${Math.round(state.alt).toLocaleString('en-SG')} ft.`:'Now airborne.'});state.approach=false;}
  if(state.status==='airborne'&&dest&&!state.approach&&state.alt!=null&&state.alt<12000&&(state.vs??0)<-300){
   const km=distance([f.lat,f.lon],[dest.lat,dest.lon])/1000;
   if(km<70){const min=f.groundSpeed>60?Math.max(1,Math.round(km/(f.groundSpeed*1.852)*60)):null;alerts.push({kind:'approach',title:`is approaching ${dest.city||dest.iata||dest.name}`,body:min?`About ${min} min from landing.`:'Descending towards the airport.'});state.approach=true;}}
  if(prev?.status==='airborne'&&state.status==='ground'){const ap=nearAirport?.(f.lat,f.lon,8);alerts.push({kind:'landed',title:'has landed',body:ap?`At ${ap.name}.`:'On the ground.'});}
  if(state.squawk&&EMERGENCY[state.squawk]&&prev?.squawk!==state.squawk)alerts.push({kind:'emergency',title:`is squawking ${state.squawk}`,body:`Transponder code ${state.squawk} means ${EMERGENCY[state.squawk]}.`});
 }else{
  state.status='unseen';
  if(prev?.status==='airborne'&&prev.alt!=null&&prev.alt<3000){const ap=nearAirport?.(prev.lat,prev.lon,25);if(ap)alerts.push({kind:'probably-landed',title:'has probably landed',body:`Last seen at ${Math.round(prev.alt).toLocaleString('en-SG')} ft near ${ap.name}. Coverage close to the ground is limited.`});}
  // Keep the last position so the next appearance is compared with something real.
  if(prev){state.lastSeen=prev.status==='unseen'?prev.lastSeen:prev.t;state.lat=prev.lat;state.lon=prev.lon;}
 }
 return {state,alerts};
}

/** Checks saved flights with alerts on: every minute while Aeris is open. */
export class Watcher{
 constructor({collection,live,routeFor,nearAirport,notify,onCheck=()=>{},now=()=>Date.now()/1000}){
  Object.assign(this,{collection,live,routeFor,nearAirport,notify,onCheck,now});this.silent=false;this.timer=null;
 }
 start(){if(this.timer)return;this.timer=setInterval(()=>this.check(),60000);setTimeout(()=>this.check(),4000);}
 /** After returning from the background on iOS, the app has already alerted: take a quiet baseline. */
 quietNext(){this.silent=true;}
 async check(){
  if(this.running)return;this.running=true;
  try{
   const items=this.collection.data.flights;const silent=this.silent;this.silent=false;
   for(const item of items){
    const fresh=this.live.list().find(f=>(f.flight||f.callsign)===item.callsign&&quality(f,this.now()).age<30);
    let f=fresh||null;
    if(!f){if(!item.notify&&item.last&&this.now()-item.last.t<300)continue;try{const list=await this.live.query('callsign',item.callsign);f=list.find(x=>x.lat!=null)||null;}catch{continue;}await new Promise(r=>setTimeout(r,1200));}
    let route=null;if(f){try{route=await this.routeFor(item.callsign);}catch{}}
    const {state,alerts}=evaluate(item.last,f,route,this.now(),this.nearAirport);
    item.last=state;item.hex=f?.id||item.hex;
    if(item.notify&&!silent)for(const a of alerts)this.notify(`${item.label} ${a.title}`,a.body,`${item.callsign}-${a.kind}`);
   }
   this.collection.persist();this.onCheck();
  }finally{this.running=false;}
 }
}
