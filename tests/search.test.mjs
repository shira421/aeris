import test from 'node:test';
import assert from 'node:assert/strict';
import {searchAirlines,searchTypes,directLookups,matchesFlight,airlineFor,flightNumber} from './lib/search.js';
import {Collection,Watcher,evaluate} from './lib/collection.js';

test('airline names, radio callsigns and codes find the airline',()=>{
 assert.equal(searchAirlines('lufthansa')[0].icao,'DLH');
 assert.equal(searchAirlines('Lufthansa ')[0].icao,'DLH');
 assert.equal(searchAirlines('LH')[0].icao,'DLH');
 assert.equal(searchAirlines('DLH')[0].icao,'DLH');
 assert.equal(searchAirlines('singapore')[0].icao,'SIA');
 assert.equal(searchAirlines('scoot')[0].icao,'TGW');
 assert.equal(searchAirlines('speedbird')[0].icao,'BAW');
 assert.equal(searchAirlines('emirates')[0].icao,'UAE');
 assert.equal(searchAirlines('easyjet')[0].icao,'EZY');
 assert.deepEqual(searchAirlines('a'),[]);
});
test('callsigns turn into flight numbers and airlines',()=>{
 assert.equal(flightNumber('SIA22'),'SQ 22');assert.equal(flightNumber('DLH4AB'),'LH 4AB');assert.equal(flightNumber('9VSMU'),null);
 assert.equal(airlineFor('TGW553').name,'Scoot');assert.equal(airlineFor('N123AB'),null);
});
test('typed flight numbers, registrations and addresses become direct lookups',()=>{
 const has=(q,kind,value)=>directLookups(q).some(l=>l.kind===kind&&l.value===value);
 assert.ok(has('SQ22','callsign','SIA22'));assert.ok(has('sq 22','callsign','SIA22'));assert.ok(has('SQ022','callsign','SIA22'));
 assert.ok(has('LH 400','callsign','DLH400'));assert.ok(has('SIA22','callsign','SIA22'));assert.ok(has('6E 2341','callsign','IGO2341'));
 assert.ok(has('9V-SMU','reg','9V-SMU'));assert.ok(has('n123ab','reg','N123AB'));
 assert.ok(has('76cdb5','hex','76cdb5'));
 assert.deepEqual(directLookups('lufthansa'),[]);assert.deepEqual(directLookups('ab'),[]);
});
test('aircraft families map to ICAO type codes',()=>{
 assert.deepEqual(searchTypes('A380')[0].codes,['A388']);
 assert.ok(searchTypes('dreamliner')[0].codes.includes('B789'));
 assert.ok(searchTypes('737')[0].codes.includes('B38M'));
 assert.ok(searchTypes('a350')[0].codes.includes('A35K'));
 assert.deepEqual(searchTypes('xx'),[]);
});
test('flights on the map match by airline name, flight number, registration and type',()=>{
 const f={id:'76cd01',callsign:'SIA22',registration:'9V-SMU',type:'A359'};
 for(const q of ['singapore','SQ 22','sq22','SIA22','9v-smu','A359'])assert.ok(matchesFlight(f,q),q);
 assert.ok(!matchesFlight(f,'lufthansa'));
});

const air=(o={})=>({id:'abc123',callsign:'SIA22',lat:1.4,lon:103.9,altitude:2500,verticalRate:-900,groundSpeed:150,onGround:false,positionTime:1000,...o});
const SIN={city:'Singapore',iata:'SIN',name:'Singapore Changi',lat:1.3644,lon:103.9915},EWR={city:'Newark',iata:'EWR',name:'Newark',lat:40.69,lon:-74.17};
test('saved-flight alerts: take-off, approach, landing, emergencies, and no alert on the first look',()=>{
 const near=()=>({name:'Singapore Changi'});
 // First sighting sets the baseline only.
 let r=evaluate(null,air({onGround:true,altitude:0,verticalRate:0}),{origin:SIN,destination:EWR},1000,near);assert.equal(r.alerts.length,0);assert.equal(r.state.status,'ground');
 r=evaluate(r.state,air({altitude:3000,verticalRate:2000}),{origin:SIN,destination:EWR},1060,near);assert.deepEqual(r.alerts.map(a=>a.kind),['takeoff']);
 // Approach: low, descending, close to the destination; only once.
 const route={origin:EWR,destination:SIN};let s={status:'airborne',alt:30000,t:0};
 r=evaluate(s,air(),route,60,near);assert.deepEqual(r.alerts.map(a=>a.kind),['approach']);assert.ok(/min/.test(r.alerts[0].body));
 r=evaluate(r.state,air({altitude:1500}),route,120,near);assert.equal(r.alerts.length,0);
 r=evaluate(r.state,air({onGround:true,altitude:0,verticalRate:0}),route,180,near);assert.deepEqual(r.alerts.map(a=>a.kind),['landed']);assert.match(r.alerts[0].body,/Changi/);
 r=evaluate({status:'airborne',alt:35000,t:0,squawk:'1234'},air({altitude:35000,verticalRate:0,squawk:'7700'}),null,60,near);assert.deepEqual(r.alerts.map(a=>a.kind),['emergency']);
 r=evaluate(r.state,air({altitude:35000,verticalRate:0,squawk:'7700'}),null,120,near);assert.equal(r.alerts.length,0);
 // Lost low near an airport: probably landed. Lost high: nothing.
 r=evaluate({status:'airborne',alt:1200,lat:1.37,lon:103.98,t:0},null,null,60,near);assert.deepEqual(r.alerts.map(a=>a.kind),['probably-landed']);
 r=evaluate({status:'airborne',alt:35000,lat:1.37,lon:103.98,t:0},null,null,60,near);assert.equal(r.alerts.length,0);assert.equal(r.state.status,'unseen');assert.equal(r.state.lastSeen,0);
 // Seen again later in the air after being unseen: airborne alert.
 r=evaluate(r.state,air({altitude:12000,verticalRate:0}),null,900,near);assert.deepEqual(r.alerts.map(a=>a.kind),['airborne']);
});
function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};}
test('the collection saves flights, aircraft and airports and migrates the old saved list',()=>{
 const st=memory();st.setItem('aeris-saved',JSON.stringify(['76cd01','demo-1']));st.setItem('aeris-savedMeta',JSON.stringify({'76cd01':{registration:'9V-SMU',type:'A359'}}));
 const c=new Collection(st);assert.equal(c.data.aircraft.length,1);assert.equal(c.data.aircraft[0].label,'9V-SMU');
 const item=c.addFlight({callsign:'SIA22'});assert.equal(item.label,'SQ 22');assert.equal(item.airline,'Singapore Airlines');
 assert.equal(c.addFlight({callsign:'9VSMU'}),null);
 c.setNotify('SIA22',true);c.addAirport({icao:'WSSS',iata:'SIN',name:'Singapore Changi',city:'Singapore'});
 const again=new Collection(st);assert.equal(again.flight('SIA22').notify,true);assert.equal(again.count,3);
 again.removeFlight('SIA22');again.removeAircraft('76cd01');again.removeAirport('WSSS');assert.equal(again.count,0);
});
test('the watcher alerts on changes after a silent first check, and stays quiet after quietNext',async()=>{
 const c=new Collection(memory());c.addFlight({callsign:'SIA22'});c.setNotify('SIA22',true);
 let current=air({onGround:true,altitude:0,verticalRate:0}),t=1000;const sent=[];
 const live={list:()=>[],query:async()=>[current]};
 const w=new Watcher({collection:c,live,routeFor:async()=>({origin:SIN,destination:EWR}),nearAirport:()=>null,notify:(title,body)=>sent.push(title),now:()=>t});
 const orig=globalThis.setTimeout;globalThis.setTimeout=(fn)=>orig(fn,0);
 try{
  await w.check();assert.equal(sent.length,0);
  current=air({altitude:4000,verticalRate:2500});t+=60;await w.check();assert.deepEqual(sent,['SQ 22 took off']);
  current=air({altitude:4000,verticalRate:0,squawk:'7700'});t+=60;w.quietNext();await w.check();assert.equal(sent.length,1);
 }finally{globalThis.setTimeout=orig;}
});
