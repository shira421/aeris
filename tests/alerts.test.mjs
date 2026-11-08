// Alert rules, trips and flight history.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Collection,Watcher,evaluate,alertText,step,localDate} from './lib/collection.js';
import {distance} from './lib/core.js';

const SIN={iata:'SIN',icao:'WSSS',name:'Singapore Changi Airport',city:'Singapore',lat:1.3502,lon:103.994,tz:'Asia/Singapore'};
const EWR={iata:'EWR',icao:'KEWR',name:'Newark Liberty International Airport',city:'Newark',lat:40.6925,lon:-74.1687,tz:'America/New_York'};
const nearAirport=(lat,lon,km)=>[SIN,EWR].find(a=>distance([a.lat,a.lon],[lat,lon])<=km*1000)||null;
const T0=1_800_000_000;
const air=(o={})=>({id:'76cd01',callsign:'SIA22',lat:1.6,lon:103.6,altitude:12000,verticalRate:1500,groundSpeed:300,track:330,onGround:false,positionTime:T0,...o});
const onGround=(a,o={})=>air({lat:a.lat+.005,lon:a.lon+.005,altitude:null,verticalRate:0,groundSpeed:12,onGround:true,...o});
const route={origin:SIN,destination:EWR};
/** Run a sequence of observations a minute apart; collect the kinds of events. */
function run(obs,{start=null,r=route,gap=60}={}){let st=start,t=start?.t??T0;const kinds=[];for(const f of obs){t+=gap;const out=evaluate(st,f,{now:t,route:r,nearAirport});st=out.state;kinds.push(out.events.map(e=>e.kind));}return {st,kinds,t};}

test('a whole flight alerts once for each thing that happens, and the first look is silent',()=>{
 const nearEWR=o=>air({lat:40.95,lon:-74.0,altitude:6000,verticalRate:-1200,groundSpeed:220,track:200,...o});
 const {kinds,st}=run([onGround(SIN),air({altitude:2500}),air({altitude:30000,verticalRate:0}),null,null,air({lat:30,lon:120,altitude:35000,verticalRate:0}),nearEWR(),nearEWR({altitude:4000}),onGround(EWR),onGround(EWR)]);
 assert.deepEqual(kinds,[[],['takeoff'],[],[],[],[],['approach'],[],['landed'],[]]);
 assert.equal(st.leg.landed,true);assert.equal(st.leg.at.code,'EWR');assert.equal(st.leg.from.code,'SIN');
 assert.ok(st.leg.takeoffAt&&st.leg.landedAt,'times known to the minute');
});
test('dropping out of coverage and coming back does not alert again',()=>{
 const {kinds}=run([air(),null,air(),null,null,air(),air({squawk:'7700'}),null,air({squawk:'7700'})]);
 assert.deepEqual(kinds.flat(),['squawk-7700']);
});
test('nothing is said about a flight that is not being received: no "probably landed"',()=>{
 const {kinds,st}=run([air(),air({lat:1.36,lon:104.01,altitude:900,verticalRate:-700}),null,null,null]);
 assert.deepEqual(kinds.flat(),[]);assert.equal(st.status,'unseen');assert.equal(st.leg.landed,false);
 for(const kind of ['takeoff','airborne','approach','landed','squawk-7700'])assert.doesNotMatch(JSON.stringify(alertText({kind,code:'7700',alt:1000,km:10,from:{code:'SIN',name:'Changi'},to:{code:'EWR',name:'Newark'},at:{code:'EWR',name:'Newark'}},'SQ 22')),/probabl|likely|may have|expected/i);
});
test('a flickering ground flag on the landing roll is not a new flight; a real departure later is',()=>{
 const landed=run([air(),air({lat:40.7,lon:-74.17,altitude:800,verticalRate:-700}),onGround(EWR)]).st;
 const flicker=run([air({lat:40.69,lon:-74.17,altitude:100}),onGround(EWR)],{start:landed});
 assert.deepEqual(flicker.kinds.flat(),[]);assert.equal(flicker.st.leg.id,landed.leg.id);
 const waiting=run([onGround(EWR)],{start:flicker.st,gap:40*60});assert.deepEqual(waiting.kinds.flat(),[]);
 const next=run([air({lat:40.72,lon:-74.15,altitude:1500,verticalRate:2000})],{start:waiting.st});
 assert.deepEqual(next.kinds.flat(),['takeoff']);assert.notEqual(next.st.leg.id,landed.leg.id);assert.equal(next.st.leg.from.code,'EWR');
});
test('the ground flag is believed only near an airport at taxi speed',()=>{
 const {kinds}=run([air(),air({lat:20,lon:90,onGround:true,altitude:null,groundSpeed:450}),air({lat:20,lon:90.1,onGround:true,altitude:null,groundSpeed:20})]);
 assert.deepEqual(kinds.flat(),[]);
});
test('seen in the air again after more than 4 hours: a new flight, said plainly',()=>{
 const first=run([air()]).st;
 const later=run([air({altitude:31000,verticalRate:0})],{start:first,gap:5*3600});
 assert.deepEqual(later.kinds.flat(),['airborne']);
 assert.deepEqual(alertText({kind:'airborne',alt:31000},'SQ 22'),{title:'SQ 22 is in the air',body:'Flying at 31,000 ft.'});
});
test('alert wording uses only observed facts',()=>{
 const t=alertText({kind:'landed',at:{code:'EWR',name:'Newark Liberty International Airport',tz:'America/New_York'},time:Date.UTC(2026,10,9,11,12)/1000},'SQ 22');
 assert.deepEqual(t,{title:'SQ 22 landed at EWR',body:'Newark Liberty International Airport. On the ground by 06:12 local time.'});
 assert.equal(alertText({kind:'approach',km:42.4,alt:6000,to:{code:'EWR',city:'Newark'}},'SQ 22').title,'SQ 22 is descending into Newark');
 assert.equal(alertText({kind:'squawk-7700',code:'7700'},'SQ 22').body,'Transponder code 7700 means general emergency.');
 assert.equal(alertText({kind:'takeoff',alt:2500,from:null},'SQ 22').body,'Climbing through 2,500 ft.');
});
test('step: notifications only when alerts are on, tagged per leg so the phone shows each once',()=>{
 const base=step({callsign:'SIA22',label:'SQ 22',notify:false,route,state:null},onGround(SIN),{now:T0,nearAirport});
 const quiet=step({callsign:'SIA22',label:'SQ 22',notify:false,route,state:base.state},air({altitude:2500}),{now:T0+60,nearAirport});
 assert.equal(quiet.alerts.length,0);assert.ok(quiet.state.leg.alerted.includes('takeoff'));
 const loud=step({callsign:'SIA22',label:'SQ 22',notify:true,route,state:base.state},air({altitude:2500}),{now:T0+60,nearAirport});
 assert.equal(loud.alerts.length,1);assert.match(loud.alerts[0].tag,/^SIA22-\d+-takeoff$/);
});
test('a route that does not fit where the aircraft is, is not used for approach alerts',()=>{
 const wrong={origin:SIN,destination:{...EWR}};// the aircraft is near Changi, heading the other way
 const {kinds}=run([air({lat:1.4,lon:104.2,altitude:5000,verticalRate:-900,track:270})],{start:{status:'airborne',seen:T0,leg:{id:1,start:T0,alerted:[],landed:false}},r:null});
 assert.deepEqual(kinds.flat(),[]);
 const out=step({callsign:'SIA22',label:'SQ 22',notify:true,route:wrong,state:{status:'airborne',seen:T0,leg:{id:1,start:T0,alerted:[],landed:false}}},air({lat:-10,lon:80,altitude:35000,verticalRate:0,track:250}),{now:T0+60,nearAirport});
 assert.ok(!out.state.leg.to,'no destination taken from a route that does not fit');
});

function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};}
test('saved flights from v0.4 keep their alerts; old saved aircraft lists migrate',()=>{
 const st=memory();st.setItem('aeris-collection',JSON.stringify({flights:[{callsign:'SIA22',label:'SQ 22',notify:true,added:1,last:{status:'airborne'}},{callsign:'DLH400',label:'LH 400',notify:false,added:2}],aircraft:[],airports:[]}));
 const c=new Collection(st);assert.equal(c.flight('SIA22').alerts,'every');assert.equal(c.flight('DLH400').alerts,'off');assert.equal(c.flight('SIA22').last,undefined);
 const old=memory();old.setItem('aeris-saved',JSON.stringify(['76cd01']));old.setItem('aeris-savedMeta',JSON.stringify({'76cd01':{registration:'9V-SMU'}}));
 assert.equal(new Collection(old).data.aircraft[0].label,'9V-SMU');
});
test('trips hold dated flights; flights within a day of today are watched',()=>{
 const c=new Collection(memory());const t=c.addTrip(' Tokyo ');assert.equal(t.name,'Tokyo');
 const now=T0,today=localDate(now),later=localDate(now+5*86400);
 assert.equal(c.addTripFlight(t.id,{callsign:'SIA12',date:today,from:SIN,to:{iata:'NRT',name:'Narita',lat:35.76,lon:140.38}}).label,'SQ 12');
 c.addTripFlight(t.id,{callsign:'SIA11',date:later});assert.equal(c.addTripFlight(t.id,{callsign:'9VSMU',date:today}),null);
 assert.equal(c.trip(t.id).flights.length,2);
 const targets=c.targets(now);assert.deepEqual(targets.map(x=>x.callsign),['SIA12']);assert.equal(targets[0].notify,true);assert.equal(targets[0].route.origin.code,'SIN');
 c.updateTrip(t.id,{alerts:false});assert.equal(c.targets(now)[0].notify,false);
 c.updateTrip(t.id,{alerts:false,mine:false});assert.deepEqual(c.targets(now),[]);
 c.addFlight({callsign:'DLH400'});assert.deepEqual(c.targets(now).map(x=>[x.callsign,x.notify]),[['DLH400',false]]);
 c.setAlerts('DLH400','next',now);assert.deepEqual(c.targets(now).map(x=>[x.callsign,x.notify,x.mode]),[['DLH400',true,'next']]);
});
test('history: logged from a watched leg of my trip once it lands, never twice; past flights can be added',()=>{
 const c=new Collection(memory());const t=c.addTrip('Home');const d=localDate(T0);c.addTripFlight(t.id,{callsign:'SIA22',date:d,from:SIN,to:EWR});
 const target=c.targets(T0)[0];const {st}=run([onGround(SIN),air({altitude:2500}),air({lat:40.95,lon:-74,altitude:6000,verticalRate:-1000}),onGround(EWR)]);
 assert.equal(c.afterCheck(target,st),true);assert.equal(c.data.history.length,1);
 const h=c.data.history[0];assert.equal(h.source,'tracked');assert.equal(h.from.code,'SIN');assert.equal(h.to.code,'EWR');assert.ok(Math.abs(h.distanceKm-15340)<60,h.distanceKm);assert.ok(h.landedAt>h.takeoffAt);
 assert.equal(c.afterCheck(target,st),false);assert.equal(c.data.history.length,1);
 assert.equal(c.addHistory({callsign:'BAW15',date:'2026-03-02',from:{iata:'LHR',name:'Heathrow',lat:51.47,lon:-.45},to:SIN}).label,'BA 15');
 assert.equal(c.addHistory({callsign:'BAW15',date:'2026-03-02',from:SIN,to:SIN}),null);
 assert.deepEqual(c.data.history.map(x=>x.date),[d,'2026-03-02'].sort().reverse());
});
test('"Next flight" alerts turn themselves off after that flight lands',()=>{
 const c=new Collection(memory());c.addFlight({callsign:'SIA22'});c.setAlerts('SIA22','next',T0);
 const {st}=run([air(),air({lat:40.95,lon:-74,altitude:6000,verticalRate:-1000}),onGround(EWR)]);
 c.afterCheck(c.targets(T0)[0],st);assert.equal(c.flight('SIA22').alerts,'off');
 c.setAlerts('SIA22','every',T0);c.afterCheck(c.targets(T0)[0],st);assert.equal(c.flight('SIA22').alerts,'every');
});
test('the watcher alerts once per event across many checks, and takes newer states from the phone app',async()=>{
 const c=new Collection(memory());c.addFlight({callsign:'SIA22'});c.setAlerts('SIA22','every',T0);
 let current=onGround(SIN),t=T0;const sent=[];let nativeStates=[];
 const live={list:()=>[],query:async()=>current?[current]:[]};
 const w=new Watcher({collection:c,live,routeFor:async()=>route,nearAirport,notify:(title)=>sent.push(title),native:{state:async()=>nativeStates},now:()=>t});
 const orig=globalThis.setTimeout;globalThis.setTimeout=fn=>orig(fn,0);
 try{
  await w.check();assert.deepEqual(sent,[]);
  for(const f of [air({altitude:2500}),air({altitude:9000}),null,air({altitude:30000,verticalRate:0}),null,air({altitude:31000,verticalRate:0})]){current=f;t+=60;await w.check();}
  assert.deepEqual(sent,['SQ 22 took off from SIN']);
  // The phone app saw the approach while Aeris was closed and already alerted it.
  const phone=JSON.parse(JSON.stringify(c.data.watch.SIA22));phone.t=t+600;phone.leg.alerted.push('approach');nativeStates=[{callsign:'SIA22',state:phone}];
  current=air({lat:40.95,lon:-74,altitude:5000,verticalRate:-1000});t+=900;await w.check();
  assert.deepEqual(sent,['SQ 22 took off from SIN']);
  nativeStates=[];current=onGround(EWR);t+=300;await w.check();
  assert.deepEqual(sent,['SQ 22 took off from SIN','SQ 22 landed at EWR']);
  for(let i=0;i<3;i++){t+=60;await w.check();}assert.equal(sent.length,2);
  const items=w.items();assert.equal(items[0].callsign,'SIA22');assert.equal(items[0].notify,true);assert.equal(items[0].route.destination.code,'EWR');assert.equal(items[0].state.leg.landed,true);
 }finally{globalThis.setTimeout=orig;}
});
test('the iOS background check runs the same rules from dist/rules.js',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../dist/rules.js',import.meta.url),'utf8'),ctx);
 assert.ok(ctx.AerisRules.init(readFileSync(new URL('../dist/airports.json',import.meta.url),'utf8'))>5000);
 const resp=a=>JSON.stringify({now:(T0)*1000,ac:[{hex:'76cd01',flight:'SIA22   ',seen_pos:0,...a}]});
 let r=JSON.parse(ctx.AerisRules.check(JSON.stringify({callsign:'SIA22',label:'SQ 22',notify:true,route:null,state:null}),resp({lat:1.355,lon:103.99,alt_baro:'ground',gs:10}),T0));
 assert.deepEqual(r.alerts,[]);
 r=JSON.parse(ctx.AerisRules.check(JSON.stringify(r.item),resp({lat:1.42,lon:104.05,alt_baro:3000,baro_rate:1800,gs:180}),T0+60));
 assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].title,'SQ 22 took off from SIN');
 r=JSON.parse(ctx.AerisRules.check(JSON.stringify(r.item),null,T0+120));assert.deepEqual(r.alerts,[]);assert.equal(r.item.state.status,'unseen');
 r=JSON.parse(ctx.AerisRules.check(JSON.stringify(r.item),resp({lat:3,lon:102,alt_baro:30000,gs:450}),T0+180));assert.deepEqual(r.alerts,[]);
});
