import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ecef,localENU,destination,distance,bearing,normalizeADSB,normalizeOpenSky,mergeReport,quality,predicted,coverageCircles,routeFit,greatCircle,FT,KT,NM,LIMITS,parseEndpoint,defaultFeedEndpoint,escapeHTML,topoFeatures} from './lib/core.js';
import {makeAircraft} from './lib/aircraft.js';
import {sampleFlight,sampleTakeoff,demoFlights} from './lib/scenarios.js';
import {geoidHeight,altitudeMSL} from './lib/geo.js';
import {TYPES,typeFor,iconClass} from './lib/types.js';
import {LiveFeed} from './lib/live.js';
import {setProxy,route} from './lib/net.js';

test('static and app installs use a provider URL instead of a nonexistent backend',()=>{
 const direct='https://api.adsb.lol/v2/point/1.36/103.99/100';
 for(const url of ['file:///tmp/Aeris.html','aeris://app/index.html','https://shira421.github.io/aeris/','https://appassets.androidplatform.net/assets/index.html'])assert.equal(defaultFeedEndpoint(new URL(url)),direct);
 assert.equal(defaultFeedEndpoint(new URL('http://localhost:4173/')),'http://localhost:4173/api/flights');
});
test('WGS84 reference axes and local frame are consistent',()=>{assert.deepEqual(ecef(0,0,0),[6378137,0,0]);const origin=[1.3644,103.9915,0];assert.ok(localENU(...origin,origin).every(v=>Math.abs(v)<1e-7));const east=localENU(1.3644,104.0015,0,origin),north=localENU(1.3744,103.9915,0,origin);assert.ok(east[0]>1100&&east[0]<1120);assert.ok(Math.abs(east[2])<1);assert.ok(north[2]<-1100&&north[2]>-1110);});
test('geodesic propagation crosses the dateline without discontinuity',()=>{const p=destination(0,179.99,90,10000);assert.ok(p[1]<-179.8);assert.ok(Math.abs(distance([0,179.99],p)-10000)<.001);assert.ok(Math.abs(bearing([0,179.99],p)-90)<1e-6);});
test('great-circle routes stay continuous across the antimeridian and follow the true path',()=>{
 const pts=greatCircle([1.35,103.99],[40.69,-74.17],64);assert.equal(pts.length,65);
 for(let i=1;i<pts.length;i++)assert.ok(Math.abs(pts[i][1]-pts[i-1][1])<180,'no wrap-around jump');
 // Singapore → Newark passes close to the North Pole (the real non-stop route is polar).
 assert.ok(Math.max(...pts.map(p=>p[0]))>75);
 const total=distance([1.35,103.99],[40.69,-74.17]);let sum=0;for(let i=1;i<pts.length;i++)sum+=distance(pts[i-1],[pts[i][0],((pts[i][1]+540)%360)-180]);assert.ok(Math.abs(sum-total)/total<.001);
});
test('ADS-B preserves zero and unknown values, and never substitutes ground speed for airspeed',()=>{const [f]=normalizeADSB({now:1000,ac:[{hex:'abc123',lat:1,lon:104,gs:0,track:0,alt_baro:0,baro_rate:0,seen_pos:2}]},1002);assert.equal(f.groundSpeed,0);assert.equal(f.track,0);assert.equal(f.altitude,0);assert.equal(f.verticalRate,0);assert.equal(f.trueAirspeed,null);assert.equal(f.indicatedAirspeed,null);assert.equal(f.geometricAltitude,null);assert.equal(f.positionTime,998);assert.equal(f.receivedTime,1002);assert.equal(f.callsign,'ABC123');});
test('extended readsb fields: autopilot, wind, accuracy, MLAT, operator and year',()=>{
 const [f]=normalizeADSB({now:5000,ac:[{hex:'76CDB5',flight:'SIA22  ',r:'9V-SMU',t:'A359',desc:'AIRBUS A-350-900',ownOp:'SINGAPORE AIRLINES',year:'2017',lat:2,lon:105,alt_baro:39000,alt_geom:39450,gs:480.5,track:12.3,track_rate:-.4,true_heading:10.1,baro_rate:64,nav_altitude_mcp:39008,nav_heading:10.5,nav_qnh:1013.6,wd:250,ws:62,oat:-56,nac_p:10,mlat:['lat','lon'],type:'mlat',emergency:'none',category:'A5',seen_pos:.3,dbFlags:0}]},5000,'adsb.fi');
 assert.equal(f.id,'76cdb5');assert.equal(f.callsign,'SIA22');assert.equal(f.registration,'9V-SMU');assert.equal(f.description,'AIRBUS A-350-900');assert.equal(f.operator,'SINGAPORE AIRLINES');assert.equal(f.year,'2017');
 assert.equal(f.navAltitude,39008);assert.equal(f.navQnh,1013.6);assert.equal(f.windDirection,250);assert.equal(f.windSpeed,62);assert.equal(f.outsideTemp,-56);assert.equal(f.nacp,10);assert.equal(f.trackRate,-.4);
 assert.equal(f.source,'MLAT');assert.equal(f.emergency,null);assert.equal(f.category,'A5');assert.deepEqual(f.providers,['adsb.fi']);assert.ok(Math.abs(f.positionTime-4999.7)<1e-9);
});
test('OpenSky state vectors convert from SI units without inventing values',()=>{
 const [f]=normalizeOpenSky({time:100,states:[['abc123','TGW12   ','Singapore',98,99,103.9,1.3,10000,false,200,45,-5,null,10100,'1234',false,0,4]]},101);
 assert.equal(f.callsign,'TGW12');assert.ok(Math.abs(f.altitude-10000/FT)<1e-9);assert.ok(Math.abs(f.groundSpeed-200/KT)<1e-9);assert.ok(Math.abs(f.verticalRate-(-5*60/FT))<1e-9);assert.equal(f.positionTime,98);assert.equal(f.category,'A3');assert.equal(f.indicatedAirspeed,null);
 const [g]=normalizeOpenSky({time:100,states:[['def456',null,'X',98,99,103.9,1.3,null,true,3,90,null,null,null,null,false,0,0]]},101);assert.equal(g.onGround,true);assert.equal(g.altitude,null);
 assert.throws(()=>normalizeOpenSky({ac:[]}));
});
test('merging keeps the freshest position and fills identity from other providers',()=>{
 const a=normalizeADSB({now:100,ac:[{hex:'aaa111',flight:'TEST1',r:'9V-ABC',t:'A320',lat:1,lon:104,gs:300,track:90,alt_baro:10000,seen_pos:1}]},100,'adsb.lol')[0];
 const b=normalizeOpenSky({states:[['aaa111','TEST1',null,101,101,104.01,1,3000,false,150,90,0,null,3050,null,false,0,0]]},101)[0];
 const {flight,fresh}=mergeReport(a,b);assert.equal(fresh,true);assert.equal(flight.lon,104.01);assert.equal(flight.registration,'9V-ABC');assert.equal(flight.type,'A320');assert.deepEqual(flight.providers.sort(),['OpenSky','adsb.lol']);
 const older={...b,positionTime:90};const kept=mergeReport(flight,older);assert.equal(kept.fresh,false);assert.equal(kept.flight.positionTime,101);
});
test('dead reckoning follows reported turns, is bounded, and freezes stale data',()=>{
 const [f]=normalizeADSB({now:1000,ac:[{hex:'abc123',lat:0,lon:0,gs:360,track:90,alt_baro:10000,baro_rate:600,seen_pos:0}]},1000);
 const p=predicted(f,1005);assert.ok(Math.abs(distance([0,0],[p.lat,p.lon])-360*KT*5)<.01);assert.equal(p.altitude,10050);
 assert.deepEqual(predicted(f,1000+LIMITS.extrapolate+1),predicted(f,1000+LIMITS.extrapolate));
 assert.equal(quality(f,1000+LIMITS.stale+1).status,'Stale');assert.equal(quality(f,1000+LIMITS.lost+1).status,'Lost');
 // A 3°/s right turn for 6 s: track changes by 18°, and the path bends right (south of the straight line).
 const turning={...f,trackRate:3};const q=predicted(turning,1006);assert.ok(Math.abs(q.track-108)<1e-6);assert.ok(q.lat<0,'turned right of a due-east track');
 const arc=360*KT*6;assert.ok(Math.abs(distance([0,0],[q.lat,q.lon])-arc*Math.sin(Math.PI/20)/(Math.PI/20))<.5,'chord of the arc');
});
test('ADS-B millisecond timestamps are normalized without changing units',()=>{const [f]=normalizeADSB({now:1700000000000,ac:[{hex:'ab',lat:1,lon:104,seen_pos:2,alt_baro:10000,ias:200,tas:230,mach:.4}]},1700000000);assert.equal(f.positionTime,1699999998);assert.equal(f.altitude,10000);assert.equal(f.indicatedAirspeed,200);assert.equal(f.trueAirspeed,230);});
test('invalid locations are rejected, on-ground altitude is not fabricated',()=>{const data={ac:[{hex:'a',lat:1,lon:1,alt_baro:'ground'},{hex:'b',lat:null,lon:1},{hex:'c',lat:91,lon:1},{hex:'d',lat:1,lon:190}]};const list=normalizeADSB(data,2000);assert.equal(list.length,1);assert.equal(list[0].onGround,true);assert.equal(list[0].altitude,null);assert.equal(quality(list[0],2000).status,'Unknown');});
test('coverage circles cover the whole view with at most 250 NM radius each',()=>{
 const small=coverageCircles({west:103,east:105,south:0.5,north:2.2});assert.equal(small.length,1);assert.ok(small[0].nm>=25&&small[0].nm<=250);
 // Views just under the limit must never ask for more than a provider allows.
 for(let w=4;w<=9;w+=.05){const cs=coverageCircles({west:104-w/2,east:104+w/2,south:1.36-w*.42,north:1.36+w*.42});assert.ok(cs.every(c=>c.nm<=250),'radius '+cs.map(c=>c.nm)+' at width '+w.toFixed(2));}
 const box={west:-10,east:30,south:35,north:60},cs=coverageCircles(box,250,200);assert.ok(cs.length>4);assert.ok(cs.every(c=>c.nm===250));
 // Every point of a grid inside the box lies within some circle.
 for(let lat=35;lat<=60;lat+=1.25)for(let lon=-10;lon<=30;lon+=1.25)assert.ok(cs.some(c=>distance([c.lat,c.lon],[lat,lon])<=c.nm*NM*1.001),`uncovered ${lat},${lon}`);
 const near=coverageCircles(box,250,3);assert.equal(near.length,3);assert.ok(distance([near[0].lat,near[0].lon],[47.5,10])<300000,'nearest the centre first');
});
test('route check accepts aircraft on the route and rejects stale callsign routes',()=>{
 const SIN=[1.35,103.99],LHR=[51.47,-0.45];
 const mid=greatCircle(SIN,LHR,10)[5];const hdg=bearing(mid,LHR);
 const ok=routeFit({lat:mid[0],lon:mid[1],track:hdg,onGround:false},SIN,LHR);assert.ok(ok.plausible);assert.ok(Math.abs(ok.progress-.5)<.02);
 assert.equal(routeFit({lat:mid[0],lon:mid[1],track:(hdg+180)%360,onGround:false},SIN,LHR).plausible,false,'flying the wrong way');
 assert.equal(routeFit({lat:-33.9,lon:151.2,track:0,onGround:false},SIN,LHR).plausible,false,'nowhere near the route');
 assert.ok(routeFit({lat:1.36,lon:104.0,track:200,onGround:true},SIN,LHR).plausible,'at the origin airport');
});
test('EGM96 geoid heights match published values and drive the sea-level altitude',()=>{
 for(const [lat,lon,expected] of [[1.36,103.99,8.4],[51.47,-.45,46.4],[40.64,-73.78,-32.2],[27,86,-58.6],[-6.1,106.6,16.9]])assert.ok(Math.abs(geoidHeight(lat,lon)-expected)<2.5,`${lat},${lon}: ${geoidHeight(lat,lon)}`);
 const gnss=altitudeMSL({lat:51.47,lon:-.45,geometricAltitude:1000/FT,altitude:900/FT,onGround:false});assert.ok(Math.abs(gnss.metres-(1000-geoidHeight(51.47,-.45)))<1e-6);assert.match(gnss.basis,/geoid/);
 const qnh=altitudeMSL({lat:1,lon:104,geometricAltitude:null,altitude:3000,navQnh:1003.25,onGround:false});assert.ok(Math.abs(qnh.metres-(3000-273)*FT)<.5);assert.match(qnh.basis,/QNH/);
 const ground=altitudeMSL({lat:1,lon:104,onGround:true,altitude:null,geometricAltitude:null},14);assert.equal(ground.metres,14);
 assert.ok(altitudeMSL({lat:1,lon:104,geometricAltitude:null,altitude:0,onGround:false},40).metres>=42,'never below terrain');
});
test('type catalogue: published dimensions, layouts and sensible fallbacks',()=>{
 assert.equal(TYPES.A359.length,66.8);assert.equal(TYPES.B77W.span,64.8);assert.equal(TYPES.A388.deck,'double');assert.equal(TYPES.B744.deck,'hump');assert.equal(TYPES.CRJ9.mount,'tail');assert.equal(TYPES.AT76.wing,'high');assert.equal(TYPES.MD11.eng,3);
 for(const [code,t] of Object.entries(TYPES)){assert.ok(t.length>5&&t.length<90&&t.span>5&&t.span<90&&t.height>1.5&&t.height<26,code);assert.ok(t.width>0.8&&t.width<8,code);}
 assert.equal(typeFor('B38M').exact,true);assert.equal(typeFor('ZZZZ','A5').code,'B77W');assert.equal(typeFor(null,'A7').spec.rotor,true);assert.equal(typeFor(null,null).spec.generic,true);
 assert.equal(iconClass({type:'A388'}),'jumbo');assert.equal(iconClass({type:null,category:'A1'}),'light');
});
test('aircraft models are finite, match each type\'s dimensions and keep gear control',()=>{
 for(const type of ['A359','A320','B788','B77W','A388','B744','CRJ9','AT76','MD11','C172','EC35','UNKNOWN']){
  const mesh=makeAircraft(type);assert.equal(mesh.userData.gear.visible,false);mesh.updateMatrixWorld(true);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  mesh.traverse(o=>{const p=o.geometry?.attributes.position;if(!p)return;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok([x,y,z].every(Number.isFinite));const a=o.matrixWorld.elements;const q=[a[0]*x+a[4]*y+a[8]*z+a[12],a[1]*x+a[5]*y+a[9]*z+a[13],a[2]*x+a[6]*y+a[10]*z+a[14]];q.forEach((v,j)=>{min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);});}});
  const spec=mesh.userData.spec;assert.ok(Math.abs(max[2]-min[2]-spec.length)<spec.length*.05,type+' length');assert.ok(Math.abs(max[0]-min[0]-spec.span)<spec.span*.05,type+' span');assert.ok(Math.abs(max[1]-min[1]-spec.height)<spec.height*.05,type+' height');
  // Nose forward (-Z): the front 10% of the length must be fuselage, near the centreline.
  assert.ok(min[2]<-spec.length*.45,type+' nose forward');
 }
});
test('live engine alternates sources, merges answers and stays inside rate limits',async()=>{
 setProxy('http://proxy.test/p');assert.equal(route('https://api.adsb.lol/v2/x'),'proxy');assert.equal(route('https://api.adsbdb.com/v0/x'),'direct');
 const start=1_700_000_000;let clock=start;const calls=[];
 globalThis.fetch=async url=>{const target=new URL(new URL(url).searchParams.get('url'));calls.push({host:target.host,t:clock});
  const body=target.host==='opensky-network.org'?{time:clock,states:[]}:{now:clock*1000,ac:[{hex:'abc123',flight:'TEST1',lat:1.3,lon:104,gs:400,track:90,alt_baro:30000,seen_pos:.5}]};
  return new Response(JSON.stringify(body),{status:200,headers:{date:new Date(clock*1000).toUTCString()}});};
 const feed=new LiveFeed({now:()=>clock});feed.setView({west:103,east:105,south:.5,north:2.2},7);
 for(let i=0;i<40;i++){feed.dispatch();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));clock+=.25;}
 assert.equal(feed.list().length,1);const hosts=calls.map(c=>c.host);
 assert.ok(hosts.includes('api.adsb.lol')&&hosts.includes('opendata.adsb.fi'),'both sources used: '+hosts.join(','));
 assert.ok(!hosts.includes('opensky-network.org'),'OpenSky credits are not spent while faster sources work');
 for(const host of new Set(hosts)){const times=calls.filter(c=>c.host===host).map(c=>c.t);for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=1,`${host} spaced ${times[i]-times[i-1]} s`);}
 const total=calls.length/(clock-start);assert.ok(total>=1&&total<=3.5,'about one area refresh per second overall: '+total.toFixed(2));
 assert.ok(feed.track('abc123').length>=1);assert.ok(feed.position('abc123').lon>104,'display position is dead-reckoned');
});
test('schema, credential-in-URL and rendering injection guards',()=>{assert.throws(()=>normalizeADSB({states:[]}));assert.throws(()=>parseEndpoint('javascript:alert(1)'));assert.throws(()=>parseEndpoint('https://secret:pass@example.com/'));assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');});
test('offline geography is valid and Singapore is in the expected bounds',()=>{for(const file of ['singapore','mys','idn']){const topo=JSON.parse(readFileSync(new URL('../data/'+file+'.topo.json',import.meta.url)));const fs=topoFeatures(topo);assert.ok(fs.length>0);for(const f of fs){const coords=f.geometry.coordinates.flat(f.geometry.type==='Polygon'?1:2);assert.ok(coords.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=180&&Math.abs(y)<=90));}}});
test('worldwide airport data is complete and correct for known airports',()=>{
 const {airports,meta}=JSON.parse(readFileSync(new URL('../data/airports.json',import.meta.url)));assert.ok(airports.length>5000);assert.match(meta.source,/OurAirports/);
 const sin=airports.find(a=>a[0]==='WSSS');assert.equal(sin[1],'SIN');assert.ok(Math.abs(sin[5]-1.35)<.05&&Math.abs(sin[6]-103.99)<.05);assert.equal(sin[9],'Asia/Singapore');
 const rw=sin[10].find(r=>r[0]==='02L / 20R');assert.equal(rw[1],4000);assert.ok(distance([rw[5],rw[6]],[rw[7],rw[8]])>3800&&distance([rw[5],rw[6]],[rw[7],rw[8]])<4200,'runway ends are 4 km apart');
 for(const a of airports){assert.ok(Math.abs(a[5])<=90&&Math.abs(a[6])<=180);}
});
test('demo examples preserve takeoff/landing states, finite measurements and consistent speeds',()=>{
 for(const t of [0,30,120,410,585,690]){const fs=demoFlights(t);assert.equal(fs.length,13);assert.equal(new Set(fs.map(f=>f.id)).size,13);assert.ok(fs.every(f=>[f.lat,f.lon,f.altitude,f.groundSpeed,f.track].every(Number.isFinite)));}
 assert.equal(sampleFlight(585).onGround,true);assert.equal(sampleFlight(690).altitude,22);assert.equal(sampleTakeoff(0).groundSpeed,0);assert.equal(sampleTakeoff(40).onGround,true);assert.equal(sampleTakeoff(120).onGround,false);assert.ok(sampleTakeoff(300).altitude>sampleTakeoff(120).altitude);
 for(const t of [10,40,100,400]){const a=sampleTakeoff(t),b=sampleTakeoff(t+.01);const measured=distance([a.lat,a.lon],[b.lat,b.lon])/.01/KT;assert.ok(Math.abs(measured-a.groundSpeed)<.1);}
});
