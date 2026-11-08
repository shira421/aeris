// The alert rules for the iOS app's background check, run in JavaScriptCore so they are exactly
// the ones the app uses while open. Built to dist/rules.js as the global AerisRules.
import {normalizeADSB,distance} from './core.ts';
import {step} from './collection.js';
let airports=[];
/** Airports from airports.json (the app's own copy), for naming where a flight took off or landed. */
export function init(text){
 try{const raw=JSON.parse(text);airports=(raw.airports||[]).map(a=>({icao:a[0],iata:a[1],name:a[2],city:a[3],lat:a[5],lon:a[6],size:a[8],tz:a[9]||null}));}catch{airports=[];}
 return airports.length;
}
function nearAirport(lat,lon,km){
 let best=null,bd=Infinity;const box=km/90+.05;
 for(const a of airports){if(Math.abs(a.lat-lat)>box||Math.abs(a.lon-lon)>box/Math.max(.1,Math.cos(lat*Math.PI/180)))continue;const d=distance([lat,lon],[a.lat,a.lon]);if(d<bd){bd=d;best=a;}}
 return best&&bd<=km*1000?best:null;
}
/** One background check: the item from the app, adsb.lol's answer for its callsign (null if none). */
export function check(itemJSON,responseText,now){
 const item=JSON.parse(itemJSON);let f=null;
 if(responseText){const flights=normalizeADSB(JSON.parse(responseText),now,'adsb.lol');f=flights.find(x=>x.lat!=null)||null;}
 const {state,alerts}=step(item,f,{now,nearAirport});
 if(item.route)state.route=item.route;
 item.state=state;return JSON.stringify({item,alerts});
}
