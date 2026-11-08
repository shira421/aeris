import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4187'},stdio:['ignore','pipe','pipe']});
try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server startup timed out')),4000);proc.stdout.once('data',()=>{clearTimeout(t);resolve();});proc.once('exit',code=>{clearTimeout(t);reject(new Error('Server exited '+code));});});
 for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/style.css','text/css'],['/manifest.webmanifest','application/manifest+json'],['/sw.js','text/javascript'],['/airports.json','application/json']]){const r=await fetch('http://127.0.0.1:4187'+path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),new RegExp(type.replaceAll('+','\\+')));assert.ok((await r.text()).length>10);}
 const bad=await fetch('http://127.0.0.1:4187/%2e%2e%2fpackage.json');assert.equal(bad.status,403);
 const method=await fetch('http://127.0.0.1:4187/',{method:'POST'});assert.equal(method.status,405);
 // The proxy forwards only HTTPS requests to the flight-data allowlist.
 for(const target of ['https://example.com/','http://api.adsb.lol/v2/hex/abc123','https://user:pw@api.adsb.lol/','file:///etc/passwd','not a url']){const r=await fetch('http://127.0.0.1:4187/api/proxy?url='+encodeURIComponent(target));assert.equal(r.status,400,target);}
 console.log('PASS: static files and airport data served; traversal, unexpected methods and non-allowlisted proxy targets rejected.');
}finally{proc.kill('SIGTERM');}
