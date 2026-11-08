// Turns what people type into lookups: airline names and codes, flight numbers (SQ22, SQ 22,
// SIA22), registrations (9V-SMU, N123AB), ICAO hex addresses and aircraft types (A380, 787).
import airlines from '../data/airlines.json';
import {TYPES} from './types.js';
const AIRLINES=airlines.list.map(([icao,iata,name,callsign,country])=>({icao,iata,name,callsign,country,key:(name+' '+callsign).toLowerCase()}));
const BY_ICAO=new Map(AIRLINES.map(a=>[a.icao,a]));
const BY_IATA=new Map();for(const a of AIRLINES)if(a.iata){const l=BY_IATA.get(a.iata)||[];l.push(a);BY_IATA.set(a.iata,l);}
/** The airline a callsign belongs to (ICAO prefix + digit), or null for registrations and private flights. */
export function airlineFor(callsign){const m=/^([A-Z]{3})\d/.exec(String(callsign||''));return m?BY_ICAO.get(m[1])||null:null;}
/** "SIA22" → "SQ 22" when the airline has an IATA code. */
export function flightNumber(callsign){const a=airlineFor(callsign);const m=/^[A-Z]{3}(\d[0-9A-Z]*)$/.exec(String(callsign||''));return a?.iata&&m?`${a.iata} ${m[1]}`:null;}

// Aircraft families people search for, mapped to ICAO type designators.
const FAMILIES=[
 ['Airbus A220',['a220','cseries'],['BCS1','BCS3']],['Airbus A320 family',['a320','a319','a318','a321','a20n','a21n','a320neo','a321neo'],['A318','A319','A320','A321','A19N','A20N','A21N']],
 ['Airbus A330',['a330','a330neo'],['A332','A333','A338','A339']],['Airbus A340',['a340'],['A342','A343','A345','A346']],['Airbus A350',['a350','a35k','a359'],['A359','A35K']],['Airbus A380',['a380','a388','superjumbo'],['A388']],
 ['Boeing 737',['737','b737','b738','b38m','737max','max8','max9'],['B733','B734','B735','B736','B737','B738','B739','B37M','B38M','B39M','B3XM']],['Boeing 747',['747','b747','b744','b748','jumbo'],['B742','B744','B748']],
 ['Boeing 757',['757','b752'],['B752','B753']],['Boeing 767',['767','b763'],['B762','B763','B764']],['Boeing 777',['777','b777','b77w','triple7'],['B772','B77L','B773','B77W','B778','B779']],
 ['Boeing 787 Dreamliner',['787','b787','b788','b789','dreamliner'],['B788','B789','B78X']],['Embraer E-Jets',['e170','e175','e190','e195','ejet','embraer'],['E170','E75L','E75S','E190','E195','E290','E295']],
 ['ATR 42 / 72',['atr','atr72','atr42'],['AT43','AT45','AT46','AT72','AT75','AT76']],['Dash 8 / Q400',['dash8','q400','dhc8'],['DH8A','DH8C','DH8D']],['Bombardier CRJ',['crj','crj900','crj700'],['CRJ2','CRJ7','CRJ9','CRJX']],
 ['McDonnell Douglas MD-11',['md11','md-11'],['MD11']],['Lockheed C-130 Hercules',['c130','hercules'],['C130','C30J']],['Boeing C-17',['c17','globemaster'],['C17']]
];
const norm=s=>String(s||'').toLowerCase().replace(/[\s\-_.]/g,'');
export function searchAirlines(q,limit=4){
 const t=q.trim().toLowerCase(),u=q.trim().toUpperCase();if(t.length<2)return [];
 const exact=AIRLINES.filter(a=>a.icao===u||a.iata===u);
 const starts=t.length>=3?AIRLINES.filter(a=>!exact.includes(a)&&(a.name.toLowerCase().startsWith(t)||a.callsign.toLowerCase().startsWith(t))):[];
 const words=t.length>=3?AIRLINES.filter(a=>!exact.includes(a)&&!starts.includes(a)&&a.key.includes(t)):[];
 return [...exact,...starts,...words].slice(0,limit);
}
export function searchTypes(q,limit=2){
 const n=norm(q);if(n.length<3)return [];const out=[];
 for(const [name,keys,codes] of FAMILIES)if(keys.some(k=>k.startsWith(n)||n===k)||codes.some(c=>c.toLowerCase()===n))out.push({name,codes});
 if(!out.length){const code=Object.keys(TYPES).find(c=>c.toLowerCase()===n);if(code)out.push({name:TYPES[code].name,codes:[code]});}
 return out.slice(0,limit);
}
/**
 * What a query could identify directly. Each entry is one lookup to run against the live
 * sources: {kind:'callsign'|'reg'|'hex', value, label}.
 */
export function directLookups(q){
 const u=q.trim().toUpperCase(),c=u.replace(/\s+/g,'');const out=[];if(c.length<3)return out;
 if(/^[0-9A-F]{6}$/.test(c))out.push({kind:'hex',value:c.toLowerCase(),label:'Aircraft address '+c});
 // ICAO callsign: three letters and a number (SIA22, DLH4AB)
 if(/^[A-Z]{3}\d[0-9A-Z]{0,4}$/.test(c))out.push({kind:'callsign',value:c,label:c});
 // IATA flight number: two-character airline code and a number (SQ22, SQ 22, 6E2341)
 const m=/^([A-Z]{2}|[A-Z]\d|\d[A-Z])0*(\d{1,4}[A-Z]?)$/.exec(c);
 if(m)for(const a of BY_IATA.get(m[1])||[])out.push({kind:'callsign',value:a.icao+m[2],label:`${m[1]} ${m[2]} · ${a.name}`});
 // Registrations: with a dash (9V-SMU, G-XLEA) or US N-numbers
 if(/^[A-Z0-9]{1,3}-[A-Z0-9]{2,5}$/.test(c)||/^N\d{1,5}[A-Z]{0,2}$/.test(c))out.push({kind:'reg',value:c,label:'Registration '+c});
 return out.filter((x,i,a)=>a.findIndex(y=>y.kind===x.kind&&y.value===x.value)===i).slice(0,4);
}
/** Local text match for aircraft already loaded: callsign, flight number, registration, type, airline. */
export function matchesFlight(f,q){
 const t=q.trim().toLowerCase();if(!t)return false;const a=airlineFor(f.callsign);
 return [f.callsign,flightNumber(f.callsign),f.registration,f.type,f.operator,f.description,a?.name,a?.iata&&a.iata+' ',f.id].some(v=>v&&String(v).toLowerCase().includes(t))||(t.length>=3&&norm(flightNumber(f.callsign))===norm(t));
}
export {AIRLINES};
