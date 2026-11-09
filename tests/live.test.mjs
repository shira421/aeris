import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveFeed} from './lib/live.js';
import {setProxy} from './lib/net.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const box=(lat,lon)=>({south:lat-.1,north:lat+.1,west:lon-.1,east:lon+.1});
async function fixture(run){
 const previous=globalThis.fetch,requests=[];let now=1700000000;
 globalThis.fetch=url=>new Promise(resolve=>requests.push({url:decodeURIComponent(String(url)),done:(status=200)=>resolve(new Response(JSON.stringify({ac:[],now:now*1000}),{status}))}));
 setProxy('https://proxy.test');
 const live=new LiveFeed({now:()=>now});live.enabled=new Set(['adsblol']);live.running=true;
 try{await run({live,requests,advance:seconds=>now+=seconds});}
 finally{live.stop();for(const r of requests)r.done();await tick();globalThis.fetch=previous;setProxy(null);}
}

test('panning starts a bounded replacement before an obsolete slow response completes',()=>fixture(async({live,requests,advance})=>{
 live.setView(box(1,104),9);assert.equal(requests.length,1);
 live.setView(box(51,0),9);assert.equal(requests.length,1,'respect the provider start interval');
 advance(1.7);live.dispatch();assert.equal(requests.length,2);
 assert.match(requests[1].url,/lat\/51\.000\/lon\/0\.000/);
 live.setView(box(40,-74),9);advance(2);live.dispatch();
 assert.equal(requests.length,2,'at most two requests per provider even during repeated pans');
 requests[0].done();await tick();live.dispatch();
 assert.equal(requests.length,3);assert.match(requests[2].url,/lat\/40\.000\/lon\/-74\.000/);
}));

test('panning back reuses in-flight regions and does not duplicate them',()=>fixture(async({live,requests,advance})=>{
 live.setView(box(1,104),9);advance(2);live.setView(box(51,0),9);
 advance(2);live.setView(box(1,104),9);live.dispatch();assert.equal(requests.length,2);
 requests[1].done();await tick();live.dispatch();assert.equal(requests.length,2);
}));

test('new map areas precede off-screen selection; 3D still only requests the followed plane',()=>fixture(async({live,requests,advance})=>{
 live.setFocus('abcdef');live.setView(box(1,104),9);
 assert.match(requests[0].url,/\/lat\//);
 requests[0].done();await tick();advance(2);live.setFocusOnly(true);live.dispatch();
 assert.match(requests[1].url,/\/hex\/abcdef/);
 const state=live.circleState.get('focus');live.setView(box(51,0),9);
 assert.equal(live.circleState.get('focus'),state,'camera moves preserve focus request state');
 advance(2);live.dispatch();assert.equal(requests.length,2,'do not duplicate a pending focus request');
}));

test('slow responses do not add a second pacing delay; late success cannot clear a rate-limit cooldown',()=>fixture(async({live,requests,advance})=>{
 live.setView(box(1,104),9);advance(2);requests[0].done();await tick();
 live.setView(box(51,0),9);assert.equal(requests.length,2,'new viewport starts immediately after a slow response');
 advance(2);live.setView(box(40,-74),9);assert.equal(requests.length,3);
 requests[2].done(429);await tick();const cooldown=live.health.get('adsblol').nextAt;
 requests[1].done();await tick();assert.equal(live.health.get('adsblol').nextAt,cooldown);
 live.setView(box(-33,151),9);assert.equal(requests.length,3);
}));
