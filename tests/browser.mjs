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
// A flight far from the map view: only callsign/hex/registration lookups return it.
const FAR={hex:'3c6444',type:'adsb_icao',flight:'DLH400  ',r:'D-AIXD',t:'A359',alt_baro:37000,alt_geom:37600,gs:480,track:290,baro_rate:0,lat:52.9,lon:-12.4,seen_pos:.5,seen:.3,category:'A5',squawk:'1000',messages:900,rssi:-22};
const REGION={...FAR,hex:'7c0001',flight:'QFA100',lat:-33.87,lon:151.21};
function aircraftAt(now){return fleet.map(a=>{const dt=now-t0,d=(a.gs*1852/3600)*dt/111320;const lat=a.lat0+d*Math.cos(a.track*Math.PI/180),lon=a.lon0+d*Math.sin(a.track*Math.PI/180)/Math.cos(a.lat0*Math.PI/180);
 return {hex:a.hex,type:'adsb_icao',flight:a.flight,r:a.r,t:a.t,alt_baro:a.alt,alt_geom:typeof a.alt==='number'?a.alt+150:undefined,gs:a.alt==='ground'?8:a.gs,track:a.track,track_rate:a.trackRate??undefined,baro_rate:a.rate,lat,lon,seen_pos:.4,seen:.2,nav_qnh:1011.2,ias:a.gs-140,tas:a.gs-10,mach:.78,wd:240,ws:31,oat:-41,nac_p:9,category:a.t==='EC35'?'A7':'A3',squawk:'2341',messages:1000,rssi:-20};});}
let proxyHits=0;const providerHits={};
async function routes(context){
 await context.route('**/api/proxy?**',async route=>{proxyHits++;const target=new URL(new URL(route.request().url()).searchParams.get('url'));providerHits[target.host]=(providerHits[target.host]||0)+1;
  const now=Date.now()/1000;let body;
  if(target.host==='opensky-network.org')body={time:Math.floor(now),states:[]};
  else if(/\/hex\//.test(target.pathname)){const id=target.pathname.split('/').pop();body={ac:[...aircraftAt(now),FAR].filter(a=>a.hex===id),now:now*1000};}
  else if(/\/type\//.test(target.pathname)){const t=target.pathname.split('/').pop();body={ac:[...aircraftAt(now),FAR].filter(a=>a.t===t),now:now*1000};}
  else if(/callsign|reg/.test(target.pathname)){const q=decodeURIComponent(target.pathname.split('/').pop()).toUpperCase();body={ac:[...aircraftAt(now),FAR].filter(a=>a.flight.trim()===q||a.r===q),now:now*1000};}
  else {const lat=Number(target.pathname.match(/(?:lat|point)\/(-?[\d.]+)/)?.[1]);if(lat<-20)await new Promise(resolve=>setTimeout(resolve,250));body={ac:lat<-20?[REGION]:aircraftAt(now),now:now*1000,msg:'No error'};}
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
 for(const viewport of [...(process.env.ONLY_MOBILE?[]:[{width:1280,height:800,name:"desktop"}]),{width:390,height:844,name:'iphone',mobile:true}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,isMobile:Boolean(viewport.mobile),hasTouch:Boolean(viewport.mobile),geolocation:{latitude:1.30,longitude:103.85,accuracy:40},permissions:['geolocation','notifications']});
  await routes(context);page=await context.newPage();
  page.on('pageerror',err=>errors.push(viewport.name+': '+err.message));
  page.on('console',msg=>{consoleLog.push(msg.type()+': '+msg.text().slice(0,300));if(msg.type()==='error'&&!/Failed to load resource|net::ERR_FAILED|AJAXError|Failed to fetch|NetworkError|tiles\.openfreemap|arcgisonline|elevation-tiles/i.test(msg.text()))errors.push(viewport.name+' console: '+msg.text());});
  await step(viewport.name+': app loads in live mode through the proxy',async()=>{await page.goto(BASE+'/');await page.waitForFunction(()=>window.__aerisSelfTest?.().onMap>20,null,{timeout:25000});const s=await self();assert.equal(s.mode,'live');assert.ok(s.map,'map initialised');assert.match(s.source,/LIVE/);});
  await step(viewport.name+': first open asks for location and shows the blue dot',async()=>{
   await page.waitForSelector('#dialog[open] [data-action="allow-location"]',{timeout:8000});assert.match(await page.textContent('#dialog'),/Show your location\?/);
   await page.click('#dialog [data-action="allow-location"]');await page.waitForFunction(()=>window.__aeris.state.me&&window.__aeris.map.meData?.features?.length===1&&Boolean(window.__aeris.map.map.getLayer('me')),null,{timeout:8000});
   await page.waitForTimeout(1200);});
  await step(viewport.name+': aircraft render on the map',async()=>{await page.waitForTimeout(1500);const rendered=await page.evaluate(()=>window.__aeris.map.map.queryRenderedFeatures({layers:['flights']}).length);assert.ok(rendered>10,'rendered aircraft symbols: '+rendered);await page.screenshot({path:`qa/${viewport.name}-map.png`});});
  await step(viewport.name+': tapping an aircraft opens its details, route and type',async()=>{
   const id=await page.evaluate(()=>{const f=window.__aeris.live.list().find(f=>f.callsign==='SIA22');window.__aeris.map.flyTo(f.lat,f.lon,9);return f.id;});await page.waitForTimeout(1600);
   const pt=await page.evaluate(id=>{const p=window.__aeris.live.position(id);const s=window.__aeris.map.map.project([p.lon,p.lat]);const r=document.querySelector('#map').getBoundingClientRect();return {x:r.left+s.x,y:r.top+s.y};},id);
   await page.mouse.click(pt.x,pt.y);await page.waitForFunction(()=>window.__aeris.state.selected&&document.querySelector('#detail').textContent.includes('SIA22'),null,{timeout:5000});
   await page.waitForFunction(()=>/EWR/.test(document.querySelector('#detail').textContent),null,{timeout:8000});
   const text=await page.textContent('#detail');assert.match(text,/SQ 22/);assert.match(text,/Singapore Airlines/);assert.match(text,/km to go/);
   await page.click('[data-tab="aircraft"]');assert.match(await page.textContent('#detail'),/Airbus A350-900/);assert.match(await page.textContent('#detail'),/9V-SMU/);
   await page.click('[data-tab="telemetry"]');const tel=await page.textContent('#detail');assert.match(tel,/QNH-corrected|geoid-corrected/);assert.match(tel,/240° at/);assert.match(tel,/< 30 m/);
   await page.click('[data-tab="overview"]');await page.screenshot({path:`qa/${viewport.name}-selected.png`});});
  await step(viewport.name+': 3D button text fits beside its illustration',async()=>{
   if(viewport.mobile){await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.querySelector('.workspace').classList.add('detail-open'));}
   const layout=await page.locator('.view-card').evaluate(button=>{
    const b=button.getBoundingClientRect(),text=button.querySelector('.view-label').getBoundingClientRect(),plane=button.querySelector('.preview-plane').getBoundingClientRect(),arrow=button.querySelector('.view-arrow').getBoundingClientRect();
    const label=button.querySelector('.view-label');
    return {fits:text.left>=b.left&&text.right<=plane.left&&text.bottom<=b.bottom&&plane.right<=arrow.left&&arrow.right<=b.right,overflow:label.scrollWidth>label.clientWidth};
   });assert.ok(layout.fits);assert.equal(layout.overflow,false);
   const controls=await page.evaluate(()=>{
    const detail=document.querySelector('#detail').getBoundingClientRect();
    const actions=[...document.querySelectorAll('.action-row button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=detail.left&&r.right<=detail.right&&button.scrollWidth<=button.clientWidth;});
    const label=document.querySelector('#source-text'),before=label.innerHTML;
    const header=['LIVE','CONNECTING','RECONNECTING'].every(status=>{
     label.textContent=status;const brand=document.querySelector('.brand').getBoundingClientRect(),nav=document.querySelector('.nav').getBoundingClientRect(),pill=document.querySelector('#source-pill').getBoundingClientRect();
     return brand.right<=nav.left&&nav.right<=pill.left&&pill.right<=innerWidth;
    });label.innerHTML=before;return {actions,header};
   });assert.deepEqual(controls,{actions:true,header:true},'phone controls remain visible and do not overlap');
   await page.screenshot({path:`qa/${viewport.name}-3d-button.png`});
   if(viewport.mobile)await page.setViewportSize({width:viewport.width,height:viewport.height});
  });
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
   const cells=await page.evaluate(()=>[...document.querySelectorAll('.camera-bar button')].map(b=>{const r=b.getBoundingClientRect(),i=b.querySelector('svg').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),icon:i.width>0&&i.height>0,label:b.textContent.trim()};}));
   assert.deepEqual(cells.map(c=>c.label),['Follow','Orbit','Cockpit','Model']);assert.ok(cells.every(c=>c.icon),'every camera button shows its icon');assert.equal(new Set(cells.map(c=>c.w)).size,1,'equal cells');
   await page.click('[data-action="map"]');await page.waitForFunction(()=>!window.__aerisSelfTest().view3d);});
  await step(viewport.name+': search finds airports and opens runways to scale',async()=>{
   await page.fill('#search','SIN');await page.waitForSelector('#search-results [data-airport]');await page.click('#search-results [data-airport="SIN"]');
   await page.waitForFunction(()=>/Changi/.test(document.querySelector('#detail').textContent));const text=await page.textContent('#detail');assert.match(text,/RUNWAYS TO SCALE/);assert.match(text,/02L \/ 20R/);assert.match(text,/TRAFFIC NOW/);});
  await step(viewport.name+': saving an airport',async()=>{
   await page.click('#detail [data-action="save-airport"]');await page.waitForFunction(()=>window.__aeris.collection.airport('WSSS'));});
  await step(viewport.name+': airline names search; the airline lists its flights',async()=>{
   await page.click('.nav [data-action="explore"]');
   // On phones the details drawer covers the map; close it the way a user would.
   if(viewport.mobile)await page.click('.mobile-detail-toggle');
   await page.fill('#search','singapore');await page.waitForSelector('#search-results [data-airline="SIA"]');
   const r=await page.textContent('#search-results');assert.match(r,/FLIGHTS/);assert.match(r,/SQ 22/);assert.match(r,/Singapore Airlines/);
   await page.click('#search-results [data-airline="SIA"]');await page.waitForFunction(()=>/in the air/.test(document.querySelector('#search-results').textContent)&&document.querySelectorAll('#search-results [data-pick]').length>3,null,{timeout:10000});
   await page.screenshot({path:`qa/${viewport.name}-search-airline.png`});
   await page.fill('#search','A350');await page.waitForSelector('#search-results [data-family]');assert.match(await page.textContent('#search-results'),/Airbus A350/);
   await page.click('#search-results [data-family]');await page.waitForFunction(()=>document.querySelectorAll('#search-results [data-pick]').length>3,null,{timeout:10000});});
  await step(viewport.name+': a flight far from the map is found worldwide, opened, saved with alerts',async()=>{
   await page.fill('#search','LH 400');await page.waitForSelector('#search-results [data-pick="3c6444"]',{timeout:10000});
   await page.screenshot({path:`qa/${viewport.name}-search-world.png`});
   await page.click('#search-results [data-pick="3c6444"]');await page.waitForFunction(()=>window.__aeris.state.selected==='3c6444',null,{timeout:5000});
   await page.waitForFunction(()=>{const c=window.__aeris.map.map.getCenter();return Math.abs(c.lat-52.9)<2&&Math.abs(c.lng+12.4)<3;},null,{timeout:10000});
   assert.match(await page.textContent('#detail'),/LH 400/);
   await page.click('#detail [data-action="save-flight"]');await page.waitForFunction(()=>window.__aeris.collection.flight('DLH400'));
   await page.click('#detail [data-action="notify-flight"]');await page.waitForSelector('#dialog[open] [data-alert-mode="every"]');assert.match(await page.textContent('#dialog'),/Next flight/);
   await page.click('#dialog [data-alert-mode="every"]');await page.waitForFunction(()=>window.__aeris.collection.flight('DLH400')?.alerts==='every',null,{timeout:5000});
   await page.click('.nav [data-action="saved"]');await page.waitForFunction(()=>/LH 400/.test(document.querySelector('#detail').textContent)&&/Changi/.test(document.querySelector('#detail').textContent));
   assert.match(await page.textContent('#detail'),/Alerts: every flight/);
   await page.screenshot({path:`qa/${viewport.name}-saved.png`});
   const saved=await self();assert.equal(saved.saved,2);});
  await step(viewport.name+': a trip with dated flights shows its route and only its planes',async()=>{
   if(viewport.mobile)await page.click('.mobile-detail-toggle').catch(()=>{});
   await page.click('.nav [data-action="trips"]');await page.click('#detail [data-action="new-trip"]');await page.fill('#trip-name','Newark');await page.click('#dialog button[type="submit"]');
   await page.waitForFunction(()=>window.__aeris.state.tripView==='trip');
   await page.click('#detail [data-action="add-trip-flight"]');await page.fill('#ff-flight','SQ 22');await page.waitForFunction(()=>/usually flies SIN → EWR/.test(document.querySelector('#ff-hint').textContent),null,{timeout:8000});
   await page.click('#dialog button[type="submit"]');await page.waitForFunction(()=>window.__aeris.collection.data.trips[0]?.flights.length===1);
   await page.waitForTimeout(1200);
   const shown=await page.evaluate(()=>({plan:window.__aeris.map.planData.features.length,flights:[...new Set(window.__aeris.map.flightsData.features.map(f=>f.properties.cs))],text:document.querySelector('#detail').textContent}));
   assert.equal(shown.plan,1);assert.deepEqual(shown.flights,['SIA22']);assert.match(shown.text,/SQ 22/);assert.match(shown.text,/SIN → EWR/);assert.match(shown.text,/In the air/);
   await page.screenshot({path:`qa/${viewport.name}-trip.png`});
   // Leaving Trips puts every plane back.
   if(viewport.mobile)await page.click('#detail [data-action="toggle-detail"]');
   await page.click('.nav [data-action="explore"]');await page.waitForFunction(()=>new Set(window.__aeris.map.flightsData.features.map(f=>f.properties.cs)).size>5);
   assert.equal(await page.evaluate(()=>window.__aeris.map.planData.features.length),0);});
  await step(viewport.name+': flight history: add a past flight, see the year in numbers',async()=>{
   if(viewport.mobile)await page.click('#detail [data-action="toggle-detail"]').catch(()=>{});
   await page.click('.nav [data-action="trips"]');await page.click('#detail [data-action="history"]');
   await page.click('#detail [data-action="add-past-flight"]');await page.fill('#ff-flight','BA 15');
   await page.waitForFunction(()=>/No route on record/.test(document.querySelector('#ff-hint').textContent),null,{timeout:8000});
   await page.fill('#ff-date',new Date(Date.now()-40*86400e3).toISOString().slice(0,10));await page.fill('#ff-from','LHR');await page.fill('#ff-to','SIN');
   await page.click('#dialog button[type="submit"]');await page.waitForFunction(()=>window.__aeris.collection.data.history.length===1);
   const text=await page.textContent('#detail');assert.match(text,/BA 15/);assert.match(text,/LHR → SIN/);assert.match(text,/10,8\d\d km/);assert.match(text,/Added by you/);
   assert.equal(await page.evaluate(()=>window.__aeris.map.planData.features.length),1);
   await page.screenshot({path:`qa/${viewport.name}-history.png`});
   if(viewport.mobile)await page.click('#detail [data-action="toggle-detail"]');
   await page.click('.nav [data-action="explore"]');});
  await step(viewport.name+': map options and data sources',async()=>{
   if(viewport.mobile)await page.click('.mobile-detail-toggle');
   await page.click('[data-action="map-options"]');const dlg=await page.textContent('#dialog');assert.match(dlg,/Satellite/);assert.match(dlg,/Aircraft on the ground/);assert.match(dlg,/Globe/);
   await page.click('#dialog [data-style="satellite"]');await page.waitForFunction(()=>window.__aeris.state.mapStyle==='satellite');await page.click('#dialog [data-style="map"]');await page.click('#dialog [data-action="close-dialog"]');
   await page.evaluate(()=>document.querySelector('#source-pill').click());const src=await page.textContent('#dialog');assert.match(src,/adsb\.lol/);assert.match(src,/through the proxy/);await page.click('#dialog [data-action="close-dialog"]');});
  await step(viewport.name+': panning to a new region renders its planes promptly',async()=>{
   assert.equal(await page.evaluate(()=>window.__aeris.live.get('7c0001')),null,'the new region must not already be cached');
   const start=Date.now();await page.evaluate(()=>{window.__aeris.deselect();window.__aeris.map.map.jumpTo({center:[151.21,-33.87],zoom:8});});
   await page.waitForFunction(()=>window.__aeris.map.map.queryRenderedFeatures({layers:['flights']}).some(f=>f.properties.id==='7c0001'),null,{timeout:5000});
   console.log(`new region visible in ${Date.now()-start} ms`);
   await page.screenshot({path:`qa/${viewport.name}-new-region.png`});
  });
  await context.close();
 }
 // Exercise the UI through both native bridge contracts. The Android emulator suite separately
 // covers the real OS scheduler/permission, which a mocked bridge cannot validate.
 for(const platform of ['android','ios']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await routes(context);
  await context.addInitScript(platform=>{
   const calls=[];window.nativeTest={calls,failNext:false};
   const net=async url=>{const direct=/api\.adsbdb\.com|hexdb\.io|api\.planespotters\.net/.test(new URL(url).host);const r=await fetch(direct?url:'/api/proxy?url='+encodeURIComponent(url));return {status:r.status,body:await r.text()};};
   const device=async message=>{
    calls.push(message);
    if(message.action==='watch'){if(window.nativeTest.failNext&&message.items.length){window.nativeTest.failNext=false;throw Error('Scheduler unavailable');}window.nativeTest.saved=message.items;return true;}
    if(message.action==='watchState')return [];
    if(message.action==='notifyPermission')return 'granted';
    if(message.action==='location')return {lat:1.3,lon:103.85,accuracy:40};
    return true;
   };
   if(platform==='ios')window.webkit={messageHandlers:{aerisNet:{postMessage:message=>net(message.url)},aerisDevice:{postMessage:device}}};
   else window.AerisNative={request:(id,url)=>net(url).then(reply=>window.__aerisNetReply(id,reply),e=>window.__aerisNetReply(id,{error:e.message})),device:(id,json)=>device(JSON.parse(json)).then(value=>window.__aerisNetReply(id,{value}),e=>window.__aerisNetReply(id,{error:e.message}))};
  },platform);
  page=await context.newPage();page.on('pageerror',e=>errors.push(platform+': '+e.message));
  await step(platform+': alerts and trip saving survive a native watch failure',async()=>{
   await page.goto(BASE+'/');await page.waitForFunction(()=>window.__aerisSelfTest?.().onMap>20);
   await page.waitForSelector('#dialog[open] [data-action="deny-location"]');await page.click('#dialog [data-action="deny-location"]');
   await page.evaluate(()=>{window.__aeris.selectFlight('76c000');document.querySelector('.workspace').classList.add('detail-open');window.nativeTest.failNext=true;});
   await page.click('#detail [data-action="notify-flight"]');await page.click('#dialog [data-alert-mode="every"]');
   await page.waitForFunction(()=>window.__aeris.collection.flight('SIA22')?.alerts==='every'&&window.nativeTest.failNext===false);
   await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Aeris will retry'));
   // Repeat the same preference: failed snapshots must not be mistaken for acknowledged saves.
   await page.click('#detail [data-action="notify-flight"]');await page.click('#dialog [data-alert-mode="every"]');
   await page.waitForFunction(()=>window.nativeTest.saved?.some(x=>x.callsign==='SIA22'&&x.notify));
   await page.evaluate(()=>window.__aeris.selectFlight('76c001'));
   await page.click('#detail [data-action="add-to-trip"]');await page.fill('#att-name','Weekend');await page.click('#dialog button[type="submit"]');
   await page.waitForFunction(()=>window.__aeris.collection.data.trips[0]?.flights.length===1&&window.nativeTest.saved?.some(x=>x.callsign==='AXM101'));
   await page.screenshot({path:`qa/${platform}-trip-saved.png`});
   await page.reload();await page.waitForFunction(()=>window.__aeris?.collection.data.trips[0]?.flights.length===1);
   assert.equal(await page.evaluate(()=>window.__aeris.collection.flight('SIA22').alerts),'every');
  });await context.close();
 }
 assert.ok(providerHits['api.adsb.lol']>0&&providerHits['opendata.adsb.fi']>0,'both readsb providers polled: '+JSON.stringify(providerHits));
 assert.deepEqual(errors,[],'page errors:\n'+errors.join('\n'));
 console.log('PASS: browser test · proxy requests',proxyHits,JSON.stringify(providerHits));
}finally{await browser.close();server.kill('SIGTERM');}
