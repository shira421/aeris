// Builds data/airports.json from OurAirports (public domain) with IANA time zones from
// mwgg/Airports (MIT). Keeps large and medium airports plus small ones with scheduled service.
// Usage: node scripts/build-airports.mjs [cacheDir]   (downloads when files are not cached)
import {readFile,writeFile} from 'node:fs/promises';
const cache=process.argv[2];
const SRC={
 airports:'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv',
 runways:'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv',
 tz:'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'
};
async function load(name,file){if(cache){try{return await readFile(cache+'/'+file,'utf8');}catch{}}const r=await fetch(SRC[name]);if(!r.ok)throw new Error(name+' HTTP '+r.status);return r.text();}
function csv(text){const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else q=false;}else field+=c;}else if(c==='"')q=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c!=='\r')field+=c;}if(field||row.length){row.push(field);rows.push(row);}const head=rows.shift();return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));}
const airports=csv(await load('airports','airports.csv'));
const runways=csv(await load('runways','runways.csv'));
const tz=JSON.parse(await load('tz','mwgg.json'));
const keep=airports.filter(a=>a.type==='large_airport'||a.type==='medium_airport'||(a.type==='small_airport'&&a.scheduled_service==='yes'&&a.iata_code));
const byRef=new Map();for(const r of runways){if(r.closed==='1')continue;const list=byRef.get(r.airport_ref)||[];list.push(r);byRef.set(r.airport_ref,list);}
const n=(v,d=0)=>v===''?null:Number(Number(v).toFixed(d));
const out=keep.map(a=>{
 const icao=a.icao_code||a.gps_code||a.ident;
 const rw=(byRef.get(a.id)||[]).filter(r=>r.length_ft).sort((x,y)=>y.length_ft-x.length_ft).slice(0,8).map(r=>[
  [r.le_ident,r.he_ident].filter(Boolean).join(' / '),Math.round(r.length_ft*.3048),r.width_ft?Math.round(r.width_ft*.3048):null,(r.surface||'').toUpperCase().slice(0,4),n(r.le_heading_degT,0),
  ...(r.le_latitude_deg&&r.he_latitude_deg?[n(r.le_latitude_deg,5),n(r.le_longitude_deg,5),n(r.he_latitude_deg,5),n(r.he_longitude_deg,5)]:[])
 ]);
 return [icao,a.iata_code||'',a.name,a.municipality||'',a.iso_country,n(a.latitude_deg,4),n(a.longitude_deg,4),n(a.elevation_ft),a.type[0].toUpperCase(),(tz[icao]||tz[a.ident]||{}).tz||'',rw,a.home_link||''];
}).filter(a=>Number.isFinite(a[5])&&Number.isFinite(a[6]));
// Larger airports first so map labels and search prefer them.
const rank={L:0,M:1,S:2};out.sort((x,y)=>rank[x[8]]-rank[y[8]]||y[10].length-x[10].length);
const meta={source:'OurAirports (public domain) https://ourairports.com/data/ · time zones: mwgg/Airports (MIT)',built:new Date().toISOString().slice(0,10),fields:['icao','iata','name','city','country','lat','lon','elevation_ft','size','tz','runways[ident,length_m,width_m,surface,heading,le_lat?,le_lon?,he_lat?,he_lon?]','website']};
await writeFile(new URL('../data/airports.json',import.meta.url),JSON.stringify({meta,airports:out}));
console.log(out.length,'airports;',out.filter(a=>a[8]==='L').length,'large;',out.filter(a=>a[9]).length,'with time zones');
