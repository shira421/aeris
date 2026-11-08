// Identity and route lookups for the selected aircraft, from public databases.
// Everything here is reference data that can be wrong or stale; the UI labels it so.
import {getJSON,route} from './net.js';
import {airportByCode} from './airports.js';
const TTL={route:20*60,aircraft:7*86400,photo:3*86400};
const memory=new Map();
function store(){try{return globalThis.localStorage;}catch{return null;}}
function read(key){const m=memory.get(key);if(m)return m;try{const v=JSON.parse(store()?.getItem('aeris-x-'+key)||'null');if(v)memory.set(key,v);return v;}catch{return null;}}
function write(key,value,kind){const v={value,t:Date.now()/1000,kind};memory.set(key,v);try{store()?.setItem('aeris-x-'+key,JSON.stringify(v));trim();}catch{}}
function trim(){const s=store();if(!s)return;const keys=[];for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith('aeris-x-'))keys.push(k);}if(keys.length<400)return;keys.map(k=>{try{return [k,JSON.parse(s.getItem(k)).t];}catch{return [k,0];}}).sort((a,b)=>a[1]-b[1]).slice(0,keys.length-300).forEach(([k])=>s.removeItem(k));}
async function cached(key,kind,fn){const hit=read(key);if(hit&&Date.now()/1000-hit.t<TTL[kind])return hit.value;const value=await fn();write(key,value,kind);return value;}
const place=a=>a&&{icao:a.icao_code||a.icao||null,iata:a.iata_code||a.iata||null,name:a.name,city:a.municipality||a.city||'',country:a.country_name||a.country||'',lat:a.latitude??a.lat,lon:a.longitude??a.lon};
/** Scheduled route for a callsign (adsbdb, then hexdb). Null when unknown. */
export function routeFor(callsign){
 const cs=String(callsign||'').trim().toUpperCase();if(!/^[A-Z]{3}[0-9][0-9A-Z]{0,4}$/.test(cs))return Promise.resolve(null);
 return cached('route-'+cs,'route',async()=>{
  try{const {data}=await getJSON('https://api.adsbdb.com/v0/callsign/'+cs,{timeout:7000});const r=data?.response?.flightroute;
   if(r?.origin&&r?.destination)return {origin:place(r.origin),destination:place(r.destination),airline:r.airline?{name:r.airline.name,icao:r.airline.icao,iata:r.airline.iata,country:r.airline.country}:null,flightNumber:r.callsign_iata||null,source:'adsbdb'};}catch(err){if(err.status&&err.status!==404)throw err;}
  try{const {data}=await getJSON('https://hexdb.io/api/v1/route/icao/'+cs,{timeout:7000});const parts=String(data?.route||'').split('-');
   if(parts.length>=2){const o=airportByCode(parts[0]),d=airportByCode(parts.at(-1));if(o&&d)return {origin:place(o),destination:place(d),airline:null,flightNumber:null,source:'hexdb'};}}catch{}
  return null;
 });
}
/** Registration, type, operator and owner for an ICAO 24-bit address (adsbdb). */
export function aircraftFor(hex){
 const id=String(hex||'').toLowerCase();if(!/^[0-9a-f]{6}$/.test(id))return Promise.resolve(null);
 return cached('ac-'+id,'aircraft',async()=>{
  try{const {data}=await getJSON('https://api.adsbdb.com/v0/aircraft/'+id,{timeout:7000});const a=data?.response?.aircraft;
   return a?{registration:a.registration,type:a.type,icaoType:a.icao_type,manufacturer:a.manufacturer,owner:a.registered_owner,country:a.registered_owner_country_name,operatorCode:a.registered_owner_operator_flag_code,source:'adsbdb'}:null;}
  catch(err){if(err.status===404)return null;throw err;}
 });
}
/** Latest photo of this airframe from Planespotters.net (must be shown with credit and link). */
export function photoFor(hex,registration){
 const id=String(hex||'').toLowerCase();if(!/^[0-9a-f]{6}$/.test(id))return Promise.resolve(null);
 return cached('photo-'+id,'photo',async()=>{
  const urls=['https://api.planespotters.net/pub/photos/hex/'+id];if(registration)urls.push('https://api.planespotters.net/pub/photos/reg/'+encodeURIComponent(registration));
  for(const url of urls){try{const {data}=await getJSON(url,{timeout:7000});const p=data?.photos?.[0];if(p)return {src:p.thumbnail_large?.src||p.thumbnail?.src,width:p.thumbnail_large?.size?.width,height:p.thumbnail_large?.size?.height,link:p.link,photographer:p.photographer};}catch{}}
  return null;
 });
}
export const canEnrich=()=>Boolean(route('https://api.adsbdb.com/'));
