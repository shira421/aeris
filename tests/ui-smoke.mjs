// DOM integration checks, not a substitute for a browser/WebGL visual inspection.
import {parseHTML} from './vendor/linkedom.mjs';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.AERIS_CANVAS||'@napi-rs/canvas');
const {document,window}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'));
const canvasMap=new WeakMap();
Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{get(){return this.tagName==='CANVAS'?1000:1000;}},clientHeight:{get(){return this.tagName==='CANVAS'?800:800;}}});
window.HTMLCanvasElement.prototype.getContext=function(type){if(type!=='2d')throw new Error('WebGL unavailable in DOM test');let can=canvasMap.get(this);if(!can){can=createCanvas(1000,800);canvasMap.set(this,can);}return can.getContext('2d');};
window.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:1000,height:800,right:1000,bottom:800};};
window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.setPointerCapture=function(){};
const dialog=document.querySelector('dialog');window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};
let raf=[];let timer=0;const timeouts=new Map();const storage=new Map();
const sandbox={document,window,navigator:{userAgent:'Aeris DOM integration test'},location:{protocol:'http:',origin:'http://localhost:4180'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},devicePixelRatio:1,innerWidth:1440,innerHeight:900,ResizeObserver:class{constructor(cb){this.cb=cb}observe(){this.cb()}disconnect(){}},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{raf.push(fn);return raf.length;},performance:{now:()=>0},console,Intl,URL,Blob,AbortController,setTimeout:(fn)=>{timeouts.set(++timer,fn);return timer;},clearTimeout:id=>timeouts.delete(id),Date,fetch:async()=>new Response(JSON.stringify({ac:[]})),Response,Event:window.Event,Map,Set};
window.matchMedia=sandbox.matchMedia;const context=vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('../dist/app.js',import.meta.url),'utf8'),context,{timeout:20000});
function click(selector){const node=document.querySelector(selector);assert.ok(node,'Missing control: '+selector);node.dispatchEvent(new window.Event('click',{bubbles:true}));}
function input(selector,value){const n=document.querySelector(selector);n.value=value;n.dispatchEvent(new window.Event('input',{bubbles:true}));}
function close(){click('#dialog [data-action="close-dialog"]');}
assert.match(document.querySelector('#detail').textContent,/SQ228/);
assert.match(document.querySelector('#source-text').textContent,/DEMO/);
input('#search','TR18');assert.match(document.querySelector('#search-results').textContent,/Scoot/);click('#search-results [data-flight]');assert.match(document.querySelector('#detail').textContent,/TR18/);
click('[data-action="save-flight"]');assert.match(storage.get('aeris-saved'),/demo-tr18/);
input('#search','SQ228');click('#search-results [data-flight]');click('[data-action="save-flight"]');
click('.nav [data-action="saved"]');assert.match(document.querySelector('#detail').textContent,/TR18/);click('[data-action="compare"]');assert.match(document.querySelector('#dialog').textContent,/Ground speed/);close();
click('.nav [data-action="explore"]');click('[data-metric="groundSpeed"]');assert.match(document.querySelector('#dialog').textContent,/different from airspeed/);close();
click('[data-action="filters"]');document.querySelector('#filter-min').value='40000';document.querySelector('#filter-max').value='5000';click('[data-action="apply-filters"]');assert.match(document.querySelector('#filter-error').textContent,/minimum/);document.querySelector('#filter-min').value='40000';document.querySelector('#filter-max').value='50000';click('[data-action="apply-filters"]');assert.match(document.querySelector('#flight-count').textContent,/0 aircraft/);
click('[data-action="filters"]');click('[data-action="reset-filters"]');assert.match(document.querySelector('#flight-count').textContent,/13 aircraft/);
input('#search','nomatch_xyz');assert.match(document.querySelector('#search-results').textContent,/No matches/);input('#search','SIN');click('#search-results [data-airport]');assert.match(document.querySelector('#detail').textContent,/4,000/);
click('.nav [data-action="explore"]');click('[data-tab="telemetry"]');assert.match(document.querySelector('#detail').textContent,/True airspeed/);assert.match(document.querySelector('[data-value="trueAirspeed"]').textContent,/—/);
click('[data-action="help"]');assert.match(document.querySelector('#dialog').textContent,/W A S D/);close();
click('[data-tab="overview"]');input('#timeline',585);assert.match(document.querySelector('#flight-phase').textContent,/On ground/);input('#timeline',410);
click('[data-action="connect"]');sandbox.fetch=async()=>new Response(JSON.stringify({now:Date.now()/1000,ac:[{hex:'test123',flight:'REAL101',lat:1.35,lon:104,alt_baro:12000,gs:400,track:30,seen_pos:0}]}));click('[data-action="connect-feed"]');await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));assert.match(document.querySelector('#source-text').textContent,/LIVE FEED/);assert.match(document.querySelector('#detail').textContent,/REAL101/);assert.match(document.querySelector('#detail').textContent,/Route unavailable/);
click('[data-tab="telemetry"]');assert.match(document.querySelector('#detail').textContent,/Not reported/);
click('[data-action="connect"]');click('[data-action="use-demo"]');assert.match(document.querySelector('#source-text').textContent,/DEMO/);
click('[data-tab="overview"]');await mkdir(new URL('../qa/',import.meta.url),{recursive:true});
await writeFile(new URL('../qa/map-canvas.png',import.meta.url),canvasMap.get(document.querySelector('.map-canvas')).toBuffer('image/png'));
await writeFile(new URL('../qa/rendered-dom.html',import.meta.url),document.toString());
console.log('PASS: initial render, search, selection, saved flights, comparison, definitions, validation, filters, airport detail, unavailable telemetry, replay, live adapter transition, honest missing route, demo restore.');
console.log('Canvas layer rendered to qa/map-canvas.png; full browser and WebGL still require visual QA.');
