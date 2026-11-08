// End-to-end check against the real world (needs internet; run in CI): the built app, served by
// server.mjs, fetches live aircraft from the public providers through the local proxy, loads
// OpenFreeMap tiles, looks up a real route, and opens the 3D view over real terrain.
// Prints small JPEG screenshots as base64 lines ("QA_SHOT name data") for remote review.
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const PORT=4195,BASE=`http://127.0.0.1:${PORT}`;
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>existsSync(p));
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','inherit']});
await new Promise(r=>server.stdout.once('data',r));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const shot=async(page,name)=>{const b=await page.screenshot({type:'jpeg',quality:48});console.log(`QA_SHOT ${name} ${b.toString('base64')}`);};
const report={};
try{
 const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1});
 // Skip the first-open location question: there is no one to answer it here.
 await context.addInitScript(()=>{try{localStorage.setItem('aeris-locationAsked','true');}catch{}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const view=[[1.36,103.99,'Singapore'],[51.47,-.45,'London']];
 for(const [lat,lon,name] of view){
  await page.goto(`${BASE}/`);await page.evaluate(([lat,lon])=>window.__aeris.map.map.jumpTo({center:[lon,lat],zoom:7.2}),[lat,lon]);
  const t0=Date.now();await page.waitForFunction(()=>window.__aerisSelfTest().aircraft>5,null,{timeout:45000});
  report[name+' first aircraft (ms)']=Date.now()-t0;
  await page.waitForTimeout(6000);
  const s=await page.evaluate(()=>{const st=window.__aerisSelfTest();const live=window.__aeris.live;const now=Date.now()/1000;const ages=live.list().map(f=>now-f.positionTime).sort((a,b)=>a-b);return {...st,medianAge:ages[ages.length>>1],tiles:window.__aeris.map.styleName,rendered:window.__aeris.map.map.queryRenderedFeatures({layers:['flights']}).length};});
  report[name]={aircraft:s.aircraft,rendered:s.rendered,medianPositionAgeS:+s.medianAge.toFixed(2),style:s.style,providers:s.providers.map(p=>`${p.id}:${p.state}${p.ms?' '+p.ms+'ms':''}${p.aircraft!=null?' '+p.aircraft+'ac':''}`).join(' | ')};
  assert.equal(s.style,'map','OpenFreeMap style loaded (not the offline fallback)');assert.ok(s.rendered>5,'aircraft drawn');assert.ok(s.medianAge<6,'positions are fresh: '+s.medianAge);
  await shot(page,'map-'+name);
 }
 // Select an airline flight with a known route, check the route lookup and open 3D over real terrain.
 const pick=await page.evaluate(async()=>{const list=window.__aeris.live.list().filter(f=>/^[A-Z]{3}\d/.test(f.callsign)&&!f.onGround&&f.altitude>3000).sort((a,b)=>a.altitude-b.altitude);for(const f of list.slice(0,12)){window.__aeris.selectFlight(f.id,{fly:true});for(let i=0;i<20&&window.__aeris.state.info.loading!==undefined&&window.__aeris.state.info.loading;i++)await new Promise(r=>setTimeout(r,300));await new Promise(r=>setTimeout(r,1500));const info=window.__aeris.state.info;if(info.route)return {callsign:f.callsign,type:f.type,route:`${info.route.origin.iata||info.route.origin.icao}-${info.route.destination.iata||info.route.destination.icao}`,photo:Boolean(info.photo),registration:info.aircraft?.registration||f.registration,detail:document.querySelector('.route-status').textContent};}return null;});
 report.routeLookup=pick;await shot(page,'selected');
 if(pick){await page.click('[data-action="3d"]');await page.waitForTimeout(12000);report.altitude3d=await page.evaluate(()=>window.__aeris.map.lastAltitude);await shot(page,'3d-follow');await page.click('[data-camera="cockpit"]');await page.waitForTimeout(6000);await shot(page,'3d-cockpit');}
 if(pick)await page.click('[data-action="map"]');
 // Worldwide search: find an A380 far from the map (London) by typing its flight number.
 const far=await page.evaluate(async()=>{const list=await window.__aeris.live.query('type','A388');const c=window.__aeris.map.map.getCenter();
  return list.filter(f=>f.lat!=null&&/^[A-Z]{3}\d/.test(f.callsign)&&!f.onGround).map(f=>({cs:f.callsign,id:f.id,lat:f.lat,lon:f.lon,d:Math.hypot(f.lat-c.lat,f.lon-c.lng)})).sort((a,b)=>b.d-a.d)[0]||null;});
 report.worldwideTarget=far;
 if(far){
  const t=Date.now();await page.fill('#search',far.cs);
  await page.waitForSelector(`#search-results [data-pick="${far.id}"]`,{timeout:20000});report['worldwide search result (ms)']=Date.now()-t;await shot(page,'search-world');
  await page.click(`#search-results [data-pick="${far.id}"]`);await page.waitForFunction(id=>window.__aeris.state.selected===id,far.id,{timeout:5000});await page.waitForTimeout(4000);
  report.worldwideJump=await page.evaluate(()=>{const c=window.__aeris.map.map.getCenter();return {center:[+c.lat.toFixed(2),+c.lng.toFixed(2)],title:document.querySelector('.flight-heading h2')?.textContent};});await shot(page,'search-world-selected');
 }
 // Airline search: "lufthansa" offers the airline; its list comes from OpenSky (may be rate limited from CI).
 await page.fill('#search','lufthansa');await page.waitForSelector('#search-results [data-airline="DLH"]',{timeout:5000});
 await page.click('#search-results [data-airline="DLH"]');
 await page.waitForFunction(()=>!/Searching worldwide/.test(document.querySelector('#search-results').textContent),null,{timeout:40000}).catch(()=>{});
 report.airlineList=await page.evaluate(()=>({text:document.querySelector('#search-results .result-back')?.textContent,rows:document.querySelectorAll('#search-results [data-pick]').length,error:document.querySelector('#search-results .empty')?.textContent||null}));await shot(page,'search-airline');
 report.errors=errors;console.log('LIVE_REPORT '+JSON.stringify(report,null,1));
 assert.ok(!far||report.worldwideJump,'worldwide search jumped to the flight');
 assert.deepEqual(errors,[]);
 console.log('PASS: live data, map tiles, routes and 3D against real services');
}finally{await browser.close();server.kill();}
