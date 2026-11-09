// The web app's relay (worker/worker.js): who may use it, what it forwards, and the CORS headers.
import test from 'node:test';
import assert from 'node:assert/strict';
import relay,{allowedOrigin} from '../worker/worker.js';

const env={ALLOWED_ORIGINS:'https://shira421.github.io'};
const call=(path,{origin='https://shira421.github.io',method='GET'}={})=>relay.fetch(new Request('https://aeris-proxy.example.workers.dev'+path,{method,headers:origin?{Origin:origin}:{}}),env);
const feed='/?url='+encodeURIComponent('https://api.adsb.lol/v2/point/1.36/103.99/250');

test('origins: the GitHub Pages app, the standalone file and local development; nobody else',()=>{
 assert.equal(allowedOrigin('https://shira421.github.io',env),'https://shira421.github.io');
 assert.equal(allowedOrigin('null',env),'null');
 assert.equal(allowedOrigin('http://localhost:4173',env),'http://localhost:4173');
 assert.equal(allowedOrigin('http://127.0.0.1:8080',env),'http://127.0.0.1:8080');
 for(const o of ['https://evil.example','http://localhost.evil.example','https://shira421.github.io.evil.example','',null])assert.equal(allowedOrigin(o,env),null,String(o));
 assert.equal(allowedOrigin('https://anything.example',{ALLOWED_ORIGINS:'*'}),'https://anything.example');
});
test('forwards allowlisted HTTPS feeds with CORS headers that expose the Date header',async t=>{
 const seen=[];const real=globalThis.fetch;
 globalThis.fetch=async(u,o)=>{seen.push([String(u),o.headers['User-Agent']]);return new Response('{"ac":[]}',{status:200,headers:{'content-type':'application/json',date:'Mon, 09 Nov 2026 02:00:00 GMT'}});};
 t.after(()=>{globalThis.fetch=real;});
 const r=await call(feed);
 assert.equal(r.status,200);assert.equal(await r.text(),'{"ac":[]}');
 assert.equal(r.headers.get('access-control-allow-origin'),'https://shira421.github.io');
 assert.equal(r.headers.get('access-control-expose-headers'),'Date');assert.equal(r.headers.get('date'),'Mon, 09 Nov 2026 02:00:00 GMT');
 assert.equal(seen[0][0],'https://api.adsb.lol/v2/point/1.36/103.99/250');assert.match(seen[0][1],/^Aeris\//);
 const pre=await call(feed,{method:'OPTIONS'});assert.equal(pre.status,204);
});
test('refuses other sites, other hosts, plain HTTP, credentials and writes',async()=>{
 assert.equal((await call(feed,{origin:'https://evil.example'})).status,403);
 assert.equal((await call(feed,{origin:null})).status,403);
 for(const u of ['https://example.com/','http://api.adsb.lol/v2/point/1/1/1','https://user:pw@api.adsb.lol/','not a url'])assert.equal((await call('/?url='+encodeURIComponent(u))).status,400,u);
 assert.equal((await call(feed,{method:'POST'})).status,405);
 const h=await call('/health',{origin:null});assert.equal(h.status,200);assert.deepEqual(await h.json(),{ok:true,service:'aeris-relay'});
});
test('a source that does not answer becomes a 502 with CORS headers, so the app can say so',async t=>{
 const real=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('timeout');};t.after(()=>{globalThis.fetch=real;});
 const r=await call(feed);assert.equal(r.status,502);assert.equal(r.headers.get('access-control-allow-origin'),'https://shira421.github.io');
});
