import test from 'node:test';
import assert from 'node:assert/strict';
import {searchAirlines,searchTypes,directLookups,matchesFlight,airlineFor,flightNumber} from './lib/search.js';

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

test('worldwide lookups try a rate-limited source last instead of giving up, and skip refused ones',async()=>{
 const {LiveFeed}=await import('./lib/live.js');const {setProxy}=await import('./lib/net.js');
 setProxy('http://proxy.test/p');const hosts=[];
 globalThis.fetch=async url=>{const target=new URL(new URL(url).searchParams.get('url'));hosts.push(target.host+target.pathname);
  if(target.host==='opendata.adsb.fi')return new Response('{}',{status:500});
  return new Response(JSON.stringify({now:Date.now(),ac:[{hex:'3c6444',flight:'DLH400  ',lat:52,lon:-12,gs:480,track:290,alt_baro:37000,seen_pos:.5}]}),{status:200});};
 const feed=new LiveFeed({});
 feed.health.get('adsblol').state='limited';feed.health.get('airplaneslive').state='refused';
 const found=await feed.query('callsign','DLH400');
 assert.equal(found[0].id,'3c6444');assert.deepEqual(hosts,['opendata.adsb.fi/api/v2/callsign/DLH400','api.adsb.lol/v2/callsign/DLH400']);
 feed.health.get('adsblol').state='refused';feed.health.get('adsbfi').state='blocked';
 await assert.rejects(feed.query('callsign','DLH400'),/No live source/);
});
