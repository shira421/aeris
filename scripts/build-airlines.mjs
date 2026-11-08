// Builds data/airlines.json (ICAO, IATA, name, radio callsign, country) for search, from
// OpenFlights airlines.dat (Open Database License) plus corrections for outdated entries.
// Usage: node scripts/build-airlines.mjs [airlines.dat]
import {readFile,writeFile} from 'node:fs/promises';
const src=process.argv[2]?await readFile(process.argv[2],'utf8'):await (await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat')).text();
const parse=line=>{const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out.map(v=>v==='\\N'?'':v.trim());};
// Current names and codes where OpenFlights is out of date or missing (checked November 2026).
const FIX={
 TGW:['TR','Scoot','SCOOTER','Singapore'],SCO:null,EJU:['U2','easyJet Europe','ALPINE','Austria'],EZS:['DS','easyJet Switzerland','TOPSWISS','Switzerland'],
 QLK:['QF','QantasLink','QLINK','Australia'],FDX:['FX','FedEx Express','FEDEX','United States'],UPS:['5X','UPS Airlines','UPS','United States'],CLX:['CV','Cargolux','CARGOLUX','Luxembourg'],
 ITY:['AZ','ITA Airways','ITARROW','Italy'],BEL:['SN','Brussels Airlines','BEELINE','Belgium'],HXA:['G5','China Express Airlines','CHINA EXPRESS','China'],
 GFA:['GF','Gulf Air','GULF AIR','Bahrain'],ASA:['AS','Alaska Airlines','ALASKA','United States'],AVA:['AV','Avianca','AVIANCA','Colombia'],LAN:['LA','LATAM Airlines','LAN CHILE','Chile'],
 TAM:['JJ','LATAM Airlines Brasil','TAM','Brazil'],VJC:['VJ','VietJet Air','VIETJET','Vietnam'],AIC:['AI','Air India','AIRINDIA','India'],AXM:['AK','AirAsia','RED CAP','Malaysia'],
 AIX:['IX','Air India Express','EXPRESS INDIA','India'],AKJ:['QP','Akasa Air','AKASA AIR','India'],JZA:['QK','Jazz','JAZZ','Canada'],SKW:['OO','SkyWest Airlines','SKYWEST','United States'],
 RPA:['YX','Republic Airways','BRICKYARD','United States'],ENY:['MQ','Envoy Air','ENVOY','United States'],EDV:['9E','Endeavor Air','ENDEAVOR','United States'],ASH:['YV','Mesa Airlines','AIR SHUTTLE','United States'],
 JIA:['OH','PSA Airlines','BLUE STREAK','United States'],QXE:['QX','Horizon Air','HORIZON','United States'],AAY:['G4','Allegiant Air','ALLEGIANT','United States'],SCX:['SY','Sun Country Airlines','SUN COUNTRY','United States'],
 HAL:['HA','Hawaiian Airlines','HAWAIIAN','United States'],NAX:['DY','Norwegian','NOR SHUTTLE','Norway'],NSZ:['D8','Norwegian Air Sweden','REDNOSE','Sweden'],TVF:['TO','Transavia France','FRANCE SOLEIL','France'],
 TRA:['HV','Transavia','TRANSAVIA','Netherlands'],EWG:['EW','Eurowings','EUROWINGS','Germany'],CFG:['DE','Condor','CONDOR','Germany'],TOM:['BY','TUI Airways','TOMSON','United Kingdom'],
 SWR:['LX','Swiss','SWISS','Switzerland'],JAL:['JL','Japan Airlines','JAPANAIR','Japan'],AFL:['SU','Aeroflot','AEROFLOT','Russia'],MXD:['OD','Batik Air Malaysia','MALINDO','Malaysia'],
 BTK:['ID','Batik Air','BATIK','Indonesia'],CTV:['QG','Citilink','SUPERGREEN','Indonesia'],AWQ:['QZ','Indonesia AirAsia','WAGON AIR','Indonesia'],APG:['Z2','Philippines AirAsia','COOL RED','Philippines'],
 FJI:['FJ','Fiji Airways','FIJI','Fiji'],RBA:['BI','Royal Brunei Airlines','BRUNEI','Brunei'],MMA:['8M','Myanmar Airways International','MYANMAR','Myanmar'],KME:['K6','Cambodia Angkor Air','ANGKOR AIR','Cambodia']
};
const byIcao=new Map();
for(const line of src.split('\n')){if(!line.trim())continue;const r=parse(line);const [,name,,iata,icao,callsign,country,active]=r;
 if(active!=='Y'||!/^[A-Z]{3}$/.test(icao))continue;const prev=byIcao.get(icao);if(prev&&prev[1]&&!iata)continue;byIcao.set(icao,[icao,/^[A-Z0-9]{2}$/.test(iata)?iata:'',name,callsign,country]);}
for(const [icao,fix] of Object.entries(FIX)){if(fix===null)byIcao.delete(icao);else byIcao.set(icao,[icao,...fix.slice(0,1),fix[1],fix[2],fix[3]]);}
const list=[...byIcao.values()].sort((a,b)=>a[2].localeCompare(b[2]));
await writeFile(new URL('../data/airlines.json',import.meta.url),JSON.stringify({meta:{source:'OpenFlights airlines (ODbL) with corrections',fields:['icao','iata','name','callsign','country']},list}));
console.log(list.length,'airlines');
