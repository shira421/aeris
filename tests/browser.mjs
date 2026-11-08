// Real-browser test: headless Chrome with software WebGL, the built app served by server.mjs,
// and every external data source mocked. Map tiles are blocked unless AERIS_LIVE_TILES=1, which
// exercises the offline-geography fallback. Writes screenshots to qa/.
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const PORT=4191,BASE=`http://127.0.0.1:${PORT}`;
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>existsSync(p))||'/usr/bin/google-chrome';
await mkdir(new URL('../qa/',import.meta.url),{recursive:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('server start timeout')),5000);server.stdout.once('data',()=>{clearTimeout(t);res();});});

// ——— Synthetic traffic around Singapore, moving in real time ———
const t0=Date.now()/1000;
const fleet=Array.from({length:60},(_,i)=>({hex:(0x76c000+i).toString(16),flight:i===0?'SIA22   ':['SIA','AXM','TGW','QFA','CPA','UAE','JSA','MAS'][i%8]+(100+i)+' ',r:i===0?'9V-SMU':'9V-T'+i,t:['A359','A20N','B38M','B77W','A333','B789','E190','AT76','C172','EC35'][i%10],
 lat0:1.36+Math.sin(i*1.7)*1.4,lon0:103.99+Math.cos(i*2.3)*1.6,track:i===0?320:(i*37)%360,gs:i%10===8?110:i%10===9?120:430,alt:i===5?'ground':i%10===8?3500:i%10===9?1500:4000+((i*2300)%36000),rate:i%3?0:-800,trackRate:i===3?1.5:null}));
function aircraftAt(now){return fleet.map(a=>{const dt=now-t0,d=(a.gs*1852/3600)*dt/111320;const lat=a.lat0+d*Math.cos(a.track*Math.PI/180),lon=a.lon0+d*Math.sin(a.track*Math.PI/180)/Math.cos(a.lat0*Math.PI/180);
 return {hex:a.hex,type:'adsb_icao',flight:a.flight,r:a.r,t:a.t,alt_baro:a.alt,alt_geom:typeof a.alt==='number'?a.alt+150:undefined,gs:a.alt==='ground'?8:a.gs,track:a.track,track_rate:a.trackRate??undefined,baro_rate:a.rate,lat,lon,seen_pos:.4,seen:.2,nav_qnh:1011.2,ias:a.gs-140,tas:a.gs-10,mach:.78,wd:240,ws:31,oat:-41,nac_p:9,category:a.t==='EC35'?'A7':'A3',squawk:'2341',messages:1000,rssi:-20};});}
let proxyHits=0;const providerHits={};
async function routes(context){
 await context.route('**/api/proxy?**',async route=>{proxyHits++;const target=new URL(new URL(route.request().url()).searchParams.get('url'));providerHits[target.host]=(providerHits[target.host]||0)+1;
  const now=Date.now()/1000;let body;
  if(target.host==='opensky-network.org')body={time:Math.floor(now),states:[]};
  else if(/\/hex\//.test(target.pathname)){const id=target.pathname.split('/').pop();body={ac:aircraftAt(now).filter(a=>a.hex===id),now:now*1000};}
  else if(/callsign|reg/.test(target.pathname)){const q=decodeURIComponent(target.pathname.split('/').pop()).toUpperCase();body={ac:aircraftAt(now).filter(a=>a.flight.trim()===q||a.r===q),now:now*1000};}
  else body={ac:aircraftAt(now),now:now*1000,msg:'No error'};
  await route.fulfill({status:200,contentType:'application/json',headers:{date:new Date().toUTCString()},body:JSON.stringify(body)});});
 await context.route('https://api.adsbdb.com/**',route=>{const u=new URL(route.request().url());
  if(u.pathname.includes('/callsign/SIA22'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{flightroute:{callsign:'SIA22',callsign_iata:'SQ22',airline:{name:'Singapore Airlines',icao:'SIA',iata:'SQ',country:'Singapore'},origin:{iata_code:'SIN',icao_code:'WSSS',name:'Singapore Changi Airport',municipality:'Singapore',country_name:'Singapore',latitude:1.35019,longitude:103.994},destination:{iata_code:'EWR',icao_code:'KEWR',name:'Newark Liberty International Airport',municipality:'Newark',country_name:'United States',latitude:40.6925,longitude:-74.1687}}}})});
  if(u.pathname.includes('/aircraft/'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{aircraft:{type:'A350 941',icao_type:'A359',manufacturer:'Airbus',registration:'9V-SMU',registered_owner:'Singapore Airlines',registered_owner_country_name:'Singapore'}}})});
  return route.fulfill({status:404,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"response":"unknown callsign"}'});});
 await context.route('https://hexdb.io/**',route=>route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:'{}'}));
 await context.route('https://api.planespotters.net/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({photos:[]})}));
 if(!process.env.AERIS_LIVE_TILES)await context.route(/tiles\.openfreemap\.org|arcgisonline\.com|elevation-tiles-prod/,route=>route.abort());
}
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const errors=[],consoleLog=[];let page;
const step=async(name,fn)=>{process.stdout.write('· '+name+' … ');const t=Date.now();try{await fn();}catch(err){console.log('FAILED');console.log('state:',JSON.stringify(await page.evaluate(()=>window.__aerisSelfTest?.()).catch(e=>'unavailable: '+e.message)));console.log('webgl:',await page.evaluate(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');return g?g.getParameter(g.VERSION)+' / '+(g.getExtension('WEBGL_debug_renderer_info')?g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):''):'none';}).catch(e=>e.message));console.log('console:\n'+consoleLog.slice(-25).join('\n'));throw err;}console.log('ok ('+(Date.now()-t)+' ms)');};
const self=()=>page.evaluate(()=>window.__aerisSelfTest());
try{
 for(const viewport of [{width:1280,height:800,name:'desktop'},{width:390,height:844,name:'iphone',mobile:true}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,isMobile:Boolean(viewport.mobile),hasTouch:Boolean(viewport.mobile)});
  await routes(context);page=await context.newPage();
  page.on('pageerror',err=>errors.push(viewport.name+': '+err.message));
  page.on('console',msg=>{consoleLog.push(msg.type()+': '+msg.text().slice(0,300));if(msg.type()==='error'&&!/Failed to load resource|net::ERR_FAILED|AJAXError|Failed to fetch|NetworkError|tiles\.openfreemap|arcgisonline|elevation-tiles/i.test(msg.text()))errors.push(viewport.name+' console: '+msg.text());});
  await step(viewport.name+': app loads in live mode through the proxy',async()=>{await page.goto(BASE+'/');await page.waitForFunction(()=>window.__aerisSelfTest?.().onMap>20,null,{timeout:25000});const s=await self();assert.equal(s.mode,'live');assert.ok(s.map,'map initialised');assert.match(s.source,/LIVE/);});
  await step(viewport.name+': aircraft render on the map',async()=>{await page.waitForTimeout(1500);const rendered=await page.evaluate(()=>window.__aeris.map.map.queryRenderedFeatures({layers:['flights']}).length);assert.ok(rendered>10,'rendered aircraft symbols: '+rendered);await page.screenshot({path:`qa/${viewport.name}-map.png`});});
  await step(viewport.name+': tapping an aircraft opens its details, route and type',async()=>{
   const id=await page.evaluate(()=>{const f=window.__aeris.live.list().find(f=>f.callsign==='SIA22');window.__aeris.map.flyTo(f.lat,f.lon,9);return f.id;});await page.waitForTimeout(1600);
   const pt=await page.evaluate(id=>{const p=window.__aeris.live.position(id);const s=window.__aeris.map.map.project([p.lon,p.lat]);const r=document.querySelector('#map').getBoundingClientRect();return {x:r.left+s.x,y:r.top+s.y};},id);
   await page.mouse.click(pt.x,pt.y);await page.waitForFunction(()=>window.__aeris.state.selected&&document.querySelector('#detail').textContent.includes('SIA22'),null,{timeout:5000});
   await page.waitForFunction(()=>/EWR/.test(document.querySelector('#detail').textContent),null,{timeout:8000});
   const text=await page.textContent('#detail');assert.match(text,/Singapore Airlines/);assert.match(text,/matches position/);assert.match(text,/km to go/);
   await page.click('[data-tab="aircraft"]');assert.match(await page.textContent('#detail'),/Airbus A350-900/);assert.match(await page.textContent('#detail'),/9V-SMU/);
   await page.click('[data-tab="telemetry"]');const tel=await page.textContent('#detail');assert.match(tel,/QNH-corrected|geoid-corrected/);assert.match(tel,/240° at/);assert.match(tel,/< 30 m/);
   await page.click('[data-tab="overview"]');await page.screenshot({path:`qa/${viewport.name}-selected.png`});});
  await step(viewport.name+': real-world 3D view and camera modes',async()=>{
   if(viewport.mobile)await page.evaluate(()=>document.querySelector('.workspace').classList.add('detail-open'));
   await page.click('[data-action="3d"]');await page.waitForFunction(()=>window.__aerisSelfTest().view3d,null,{timeout:30000});await page.waitForTimeout(2500);
   const drawn=await page.evaluate(()=>{const m=window.__aeris.map;return {visible:m.model.visible,mesh:Boolean(m.model.mesh),pose:m.model.pose,alt:m.lastAltitude};});assert.ok(drawn.mesh&&drawn.visible,'3D model present');assert.ok(Number.isFinite(drawn.alt.metres),'altitude estimate');
   // A map style change (satellite ↔ map) must keep the 3D model.
   await page.click('[data-action="scene-style"]');await page.waitForTimeout(2500);
   const kept=await page.evaluate(()=>{const m=window.__aeris.map;return {mesh:Boolean(m.model.mesh),renderer:Boolean(m.model.renderer),layer:Boolean(m.map.getLayer('aircraft-model'))};});
   assert.deepEqual(kept,{mesh:true,renderer:true,layer:true},'model survives a style change');
   await page.screenshot({path:`qa/${viewport.name}-3d-follow.png`});
   for(const cam of ['orbit','cockpit','model']){await page.click(`[data-camera="${cam}"]`);await page.waitForTimeout(1500);await page.screenshot({path:`qa/${viewport.name}-3d-${cam}.png`});}
   assert.ok(await page.evaluate(()=>window.__aeris.state.studio),'model studio open');
   await page.click('[data-action="map"]');await page.waitForFunction(()=>!window.__aerisSelfTest().view3d);});
  await step(viewport.name+': search finds airports and opens runways to scale',async()=>{
   await page.fill('#search','SIN');await page.waitForSelector('#search-results [data-airport]');await page.click('#search-results [data-airport="SIN"]');
   await page.waitForFunction(()=>/Changi/.test(document.querySelector('#detail').textContent));const text=await page.textContent('#detail');assert.match(text,/RUNWAYS TO SCALE/);assert.match(text,/02L \/ 20R/);assert.match(text,/TRAFFIC NOW/);});
  await step(viewport.name+': worldwide search, dialogs and demo switch',async()=>{
   await page.click('.nav [data-action="explore"]');
   // On phones the details drawer covers the map controls; close it the way a user would.
   if(viewport.mobile)await page.click('#detail [data-action="toggle-detail"]');
   await page.evaluate(()=>document.querySelector('#source-pill').click());const dlg=await page.textContent('#dialog');assert.match(dlg,/adsb\.lol/);assert.match(dlg,/Browser via proxy/);await page.click('#dialog [data-action="close-dialog"]');
   await page.click('[data-action="layers"]');assert.match(await page.textContent('#dialog'),/Globe view/);await page.click('#dialog [data-action="close-dialog"]');
   await page.click('[data-action="filters"]');await page.fill('#filter-min','40000');await page.fill('#filter-max','5000');await page.click('[data-action="apply-filters"]');assert.match(await page.textContent('#filter-error'),/minimum/);await page.click('[data-action="reset-filters"]');
   await page.evaluate(()=>document.querySelector('#source-pill').click());await page.click('[data-action="use-demo"]');await page.waitForFunction(()=>window.__aerisSelfTest().mode==='demo');assert.match(await page.textContent('#detail'),/SQ228/);});
  await context.close();
 }
 assert.ok(providerHits['api.adsb.lol']>0&&providerHits['opendata.adsb.fi']>0,'both readsb providers polled: '+JSON.stringify(providerHits));
 assert.deepEqual(errors,[],'page errors:\n'+errors.join('\n'));
 console.log('PASS: browser test · proxy requests',proxyHits,JSON.stringify(providerHits));
}finally{await browser.close();server.kill('SIGTERM');}
