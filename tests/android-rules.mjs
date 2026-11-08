// Checks that Android's background alert rules (Rules.java) give the same alerts as the web app's
// (src/collection.js, built to dist/rules.js). Compiles Rules.java with small stand-ins for the
// Android and org.json classes it uses. Needs a JDK; run after `npm run build`.
import {readFileSync,mkdtempSync,readdirSync,statSync} from 'node:fs';import vm from 'node:vm';import {execFileSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join} from 'node:path';
const root=new URL('..',import.meta.url).pathname,here=root+'tests/android-rules/';
const out=mkdtempSync(join(tmpdir(),'aeris-rules-'));
const java=d=>readdirSync(d).flatMap(n=>statSync(join(d,n)).isDirectory()?java(join(d,n)):n.endsWith('.java')?[join(d,n)]:[]);
execFileSync('javac',['-d',out,...java(here),root+'android/app/src/main/java/com/shira421/aeris/Rules.java'],{stdio:'inherit'});
const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync(root+'dist/rules.js','utf8'),ctx);ctx.AerisRules.init(readFileSync(root+'dist/airports.json','utf8'));
const SIN={code:'SIN',icao:'WSSS',name:'Singapore Changi Airport',city:'Singapore',lat:1.35019,lon:103.994,tz:'Asia/Singapore'};
const EWR={code:'EWR',icao:'KEWR',name:'Newark Liberty International Airport',city:'Newark',lat:40.6925,lon:-74.1687,tz:'America/New_York'};
const ac=o=>({ac:[{hex:'76cd01',flight:'SIA22   ',t:'A359',r:'9V-SMU',seen_pos:0,...o}],now:0});
const none={ac:[]};
const T=1_800_000_000;
const scenarios={
 full:[ac({lat:1.355,lon:103.99,alt_baro:'ground',gs:10}),ac({lat:1.42,lon:104.05,alt_baro:3000,baro_rate:1800,gs:180,track:40}),ac({lat:5,lon:106,alt_baro:30000,gs:480,track:30}),none,null,ac({lat:40.95,lon:-74,alt_baro:6000,baro_rate:-1200,gs:230,track:200}),ac({lat:40.8,lon:-74.1,alt_baro:3000,baro_rate:-900,gs:180,track:200,squawk:'7700'}),ac({lat:40.69,lon:-74.17,alt_baro:'ground',gs:40,squawk:'7700'}),ac({lat:40.69,lon:-74.17,alt_baro:'ground',gs:5})],
 firstAir:[ac({lat:30,lon:120,alt_baro:35000,gs:480,track:40}),none,ac({lat:31,lon:121,alt_baro:35000,gs:480,track:40}),ac({lat:35,lon:125,alt_baro:35000,gs:480,track:40,squawk:'7600'})],
 badGround:[ac({lat:20,lon:90,alt_baro:30000,gs:450}),ac({lat:20,lon:90.1,alt_baro:'ground',gs:450}),ac({lat:20,lon:90.2,alt_baro:'ground',gs:30})],
};
let bad=0;
for(const [name,seq] of Object.entries(scenarios)){
 for(const route of [null,{origin:SIN,destination:EWR}]){
  const base={callsign:'SIA22',label:'SQ 22',notify:true,route,state:null};
  // JS
  let item=base;const js=[];const lines=[];
  seq.forEach((resp,i)=>{const now=T+i*60;const r=JSON.parse(ctx.AerisRules.check(JSON.stringify(item),resp?JSON.stringify(resp):null,now));item=r.item;js.push({alerts:r.alerts.map(a=>[a.title,a.body,a.tag]),status:r.item.state.status});lines.push(JSON.stringify({item:base,response:resp,now}));});
  const res=execFileSync('java',['-cp',out,'-Daeris.dist='+root+'dist','com.shira421.aeris.Harness'],{input:lines.join('\n')+'\n',stdio:['pipe','pipe','ignore']}).toString().trim().split('\n').map(l=>JSON.parse(l));const javaOut=res;
  for(let i=0;i<js.length;i++){const a=JSON.stringify(js[i]),b=JSON.stringify(javaOut[i]);if(a!==b){bad++;console.log('DIFF',name,route?'route':'noroute',i,'\n JS  ',a,'\n JAVA',b);}}
  console.log(name,route?'route':'noroute',js.flatMap(x=>x.alerts.map(a=>a[0]+' | '+a[1])));
 }
}
if(bad){console.error(`FAIL: ${bad} differences between Rules.java and the web rules`);process.exit(1);}
console.log('PASS: Android background rules (Rules.java) give the same alerts as the web app');
