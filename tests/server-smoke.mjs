import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4187'},stdio:['ignore','pipe','pipe']});
try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server startup timed out')),4000);proc.stdout.once('data',()=>{clearTimeout(t);resolve();});proc.once('exit',code=>{clearTimeout(t);reject(new Error('Server exited '+code));});});
 for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/style.css','text/css'],['/manifest.webmanifest','application/manifest+json'],['/sw.js','text/javascript']]){const r=await fetch('http://127.0.0.1:4187'+path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),new RegExp(type.replaceAll('+','\\+')));assert.ok((await r.text()).length>10);}
 const bad=await fetch('http://127.0.0.1:4187/%2e%2e%2fpackage.json');assert.equal(bad.status,403);
 const method=await fetch('http://127.0.0.1:4187/',{method:'POST'});assert.equal(method.status,405);
 console.log('PASS: static HTML, JS, CSS, manifest and service worker served; traversal and unexpected methods rejected.');
}finally{proc.kill('SIGTERM');}
