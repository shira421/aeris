// Screenshots and GIFs for the README, from the real app with real live data (needs internet;
// run in CI by .github/workflows/media.yml). Writes docs/media/ and also prints each file as
// base64 chunks ("MEDIA name part/total data") so it can be recovered from the job log.
// Map labels are Latin-script (see WorldMap.latinLabels), so world views show no empty boxes.
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import gifenc from 'gifenc';
const {GIFEncoder,quantize,applyPalette}=gifenc;

const PORT=4197,BASE=`http://127.0.0.1:${PORT}`,OUT=new URL('../docs/media/',import.meta.url);
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>existsSync(p));
await mkdir(OUT,{recursive:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','inherit']});
await new Promise(r=>server.stdout.once('data',r));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const written=[];
async function save(name,buffer){await writeFile(new URL(name,OUT),buffer);written.push([name,buffer]);console.log(`saved ${name} ${(buffer.length/1024).toFixed(0)} KB`);}
// Every screenshot waits for the map tiles in view (a slow tile server otherwise leaves blank map).
const tiles=page=>page.waitForFunction(()=>{const m=window.__aeris?.map?.map;return !m||m.areTilesLoaded();},null,{timeout:45000,polling:500}).catch(()=>console.log('tiles still loading'));
const jpeg=async(page,name,opts={})=>{await tiles(page);await wait(800);await save(name,await page.screenshot({type:'jpeg',quality:84,...opts}));};
/** A GIF from screenshots taken every `every` ms while `during` runs (and at least `min` frames). */
async function gif(page,name,{width=640,frames=24,every=350,during=null,delay=null}={}){
 const shots=[];let done=!during;const job=during?during().finally(()=>{done=true;}):null;
 while(shots.length<frames||!done){shots.push(await page.screenshot({type:'png'}));await wait(every);if(shots.length>frames*3)break;}
 await job;
 const first=await loadImage(shots[0]),height=Math.round(width*first.height/first.width);
 const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
 const pixels=[];for(const s of shots){ctx.drawImage(await loadImage(s),0,0,width,height);pixels.push(ctx.getImageData(0,0,width,height).data);}
 // One palette from a sample of frames keeps colours steady and the file small.
 const sample=new Uint8ClampedArray(pixels.length>4?pixels[0].length*4:pixels[0].length*pixels.length);
 const pick=pixels.length>4?[0,Math.floor(pixels.length/3),Math.floor(2*pixels.length/3),pixels.length-1]:pixels.map((_,i)=>i);
 pick.forEach((i,k)=>sample.set(pixels[i],k*pixels[0].length));
 const palette=quantize(sample,192);const enc=GIFEncoder();
 for(const p of pixels)enc.writeFrame(applyPalette(p,palette),width,height,{palette,delay:delay||every});
 enc.finish();await save(name,Buffer.from(enc.bytes()));
}
const report={};
// A region where it is daytime now, so the map is busy.
const hour=new Date().getUTCHours();
const REGION=hour<9?{name:'Singapore',center:[103.95,1.36],airport:[103.994,1.3502]}:hour<16?{name:'London',center:[-0.25,51.5],airport:[-0.4619,51.4706]}:{name:'New York',center:[-73.9,40.7],airport:[-73.7781,40.6413]};
report.region=REGION.name;
try{
 // ——— Desktop ———
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await context.addInitScript(()=>{try{localStorage.setItem('aeris-locationAsked','true');}catch{}});
 const page=await context.newPage();page.on('pageerror',e=>console.log('pageerror',e.message));
 await page.goto(BASE+'/');
 await page.evaluate(c=>window.__aeris.map.map.jumpTo({center:c,zoom:8.2}),REGION.center);
 const ready=await page.waitForFunction(()=>window.__aerisSelfTest().onMap>25,null,{timeout:90000}).then(()=>true,()=>false);
 console.log('state',JSON.stringify(await page.evaluate(()=>window.__aerisSelfTest())));
 if(!ready)throw new Error('No live aircraft on the map');
 await page.waitForFunction(()=>window.__aeris.map.map.areTilesLoaded(),null,{timeout:30000}).catch(()=>{});await wait(4000);
 await jpeg(page,'map.jpg');report.map=await page.evaluate(()=>window.__aerisSelfTest().onMap);

 // Live movement around the region's main airport.
 await page.evaluate(c=>window.__aeris.map.map.jumpTo({center:c,zoom:9.6}),REGION.airport);
 await page.waitForFunction(()=>window.__aeris.map.map.areTilesLoaded(),null,{timeout:30000}).catch(()=>{});await wait(5000);
 await gif(page,'live.gif',{width:720,frames:28,every:300,delay:300});

 // A flight with a confirmed route: try airline flights on screen until one shows "km to go".
 await page.evaluate(c=>window.__aeris.map.map.jumpTo({center:c,zoom:8.2}),REGION.center);await wait(4000);
 const ids=await page.evaluate(()=>{const b=window.__aeris.map.map.getBounds();return window.__aeris.live.list().filter(f=>/^[A-Z]{3}\d/.test(f.callsign)&&!f.onGround&&(f.altitude||0)>3000&&b.contains([f.lon,f.lat])).map(f=>f.id);});
 let chosen=null;
 for(const id of ids.slice(0,14)){
  await page.evaluate(id=>window.__aeris.selectFlight(id),id);
  const ok=await page.waitForFunction(()=>/km to go/.test(document.querySelector('#detail').textContent),null,{timeout:6000}).then(()=>true,()=>false);
  if(ok){chosen=id;break;}
 }
 report.flight=chosen&&await page.evaluate(()=>document.querySelector('.flight-heading h2')?.textContent);
 await wait(2500);await jpeg(page,'flight.jpg');

 // 3D over real terrain.
 if(chosen){await page.evaluate(()=>window.__aeris.openScene('chase'));await wait(9000);await jpeg(page,'3d.jpg');
  await page.evaluate(()=>window.__aeris.closeScene());await wait(2000);}
 await page.evaluate(()=>window.__aeris.deselect());

 // Search by airline name, then jump to one of its flights anywhere in the world.
 await page.evaluate(c=>window.__aeris.map.map.jumpTo({center:c,zoom:6}),REGION.center);await wait(3000);
 await gif(page,'search.gif',{width:720,frames:10,every:300,delay:300,during:async()=>{
  await page.click('#search');await page.type('#search','lufthansa',{delay:140});await wait(1200);
  await page.click('#search-results [data-airline="DLH"]');
  await page.waitForFunction(()=>document.querySelectorAll('#search-results [data-pick]').length>3,null,{timeout:40000}).catch(()=>{});await wait(1500);
  await page.click('#search-results [data-pick]').catch(()=>{});await wait(5000);
 }});
 await page.evaluate(()=>window.__aeris.deselect());
 await page.fill('#search','');await page.click('#search');await page.type('#search','lufthansa',{delay:40});await wait(1500);await jpeg(page,'search.jpg');
 await page.keyboard.press('Escape');

 // A trip, and a year of flight history.
 const today=new Date();const iso=d=>new Date(today.getTime()+d*864e5).toISOString().slice(0,10);
 await page.evaluate(([a,b])=>{const c=window.__aeris.collection;const A=n=>window.__aeris.airport?.(n);
  const t=c.addTrip('Singapore and back');
  const ap={SIN:{iata:'SIN',name:'Singapore Changi Airport',city:'Singapore',lat:1.3502,lon:103.994},LHR:{iata:'LHR',name:'London Heathrow Airport',city:'London',lat:51.4706,lon:-0.4619},CDG:{iata:'CDG',name:'Paris Charles de Gaulle Airport',city:'Paris',lat:49.0097,lon:2.5479},NRT:{iata:'NRT',name:'Narita International Airport',city:'Tokyo',lat:35.7647,lon:140.3864},SYD:{iata:'SYD',name:'Sydney Kingsford Smith Airport',city:'Sydney',lat:-33.9461,lon:151.1772},JFK:{iata:'JFK',name:'John F. Kennedy International Airport',city:'New York',lat:40.6413,lon:-73.7781},DXB:{iata:'DXB',name:'Dubai International Airport',city:'Dubai',lat:25.2532,lon:55.3657}};
  c.addTripFlight(t.id,{callsign:'SIA317',date:a,from:ap.LHR,to:ap.SIN});c.addTripFlight(t.id,{callsign:'SIA12',date:b,from:ap.SIN,to:ap.NRT});
  const past=[['BAW15','2026-02-14','LHR','SYD'],['QFA1','2026-03-02','SYD','SIN'],['AFR257','2026-05-20','CDG','SIN'],['UAE5','2026-07-08','DXB','LHR'],['BAW117','2026-08-30','LHR','JFK'],['SIA21','2026-09-03','JFK','SIN'],['JAL712','2026-10-11','NRT','SIN']];
  for(const [cs,d,f,to] of past)c.addHistory({callsign:cs,date:d,from:ap[f],to:ap[to],source:'added'});
  window.__aeris.openTrip(t.id);},[iso(0),iso(9)]);
 await wait(6000);await jpeg(page,'trip.jpg');
 await page.click('#detail [data-action="trips-list"]');await page.click('#detail [data-action="history"]');await wait(5000);await jpeg(page,'history.jpg');
 await context.close();

 // ——— Phone ———
 const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await phone.addInitScript(()=>{try{localStorage.setItem('aeris-locationAsked','true');}catch{}});
 const p2=await phone.newPage();await p2.goto(BASE+'/');
 await p2.evaluate(()=>window.__aeris.map.map.jumpTo({center:[103.95,1.33],zoom:8.6}));
 await p2.waitForFunction(()=>window.__aerisSelfTest().onMap>10,null,{timeout:90000}).catch(()=>{});await p2.waitForFunction(()=>window.__aeris.map.map.areTilesLoaded(),null,{timeout:30000}).catch(()=>{});await wait(4000);
 await jpeg(p2,'phone-map.jpg',{quality:80});
 const pid=await p2.evaluate(()=>{const b=window.__aeris.map.map.getBounds();return window.__aeris.live.list().filter(f=>/^[A-Z]{3}\d/.test(f.callsign)&&!f.onGround&&b.contains([f.lon,f.lat])).map(f=>f.id);});
 for(const id of pid.slice(0,10)){await p2.evaluate(id=>window.__aeris.selectFlight(id),id);if(await p2.waitForFunction(()=>/km to go/.test(document.querySelector('#detail').textContent),null,{timeout:6000}).then(()=>true,()=>false))break;}
 await wait(2500);await jpeg(p2,'phone-flight.jpg',{quality:80});
 await phone.close();
}finally{
 await browser.close();server.kill('SIGTERM');
 console.log('MEDIA_REPORT '+JSON.stringify(report));
 for(const [name,buffer] of written){const b64=buffer.toString('base64'),size=60000,parts=Math.ceil(b64.length/size);
  for(let i=0;i<parts;i++)console.log(`MEDIA ${name} ${i+1}/${parts} ${b64.slice(i*size,(i+1)*size)}`);}
}
