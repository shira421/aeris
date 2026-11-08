export type Flight = {
 id:string; callsign:string; registration:string|null; type:string|null; airline:string|null;
 lat:number; lon:number; altitude:number|null; geometricAltitude:number|null; groundSpeed:number|null;
 track:number|null; trueHeading:number|null; verticalRate:number|null; indicatedAirspeed:number|null;
 trueAirspeed:number|null; mach:number|null; roll:number|null; squawk:string|null; onGround:boolean;
 positionTime:number; receivedTime:number; source:string; simulated:boolean; route?:[string,string];
};
export const DEG=Math.PI/180, NM=1852, FT=.3048, KT=NM/3600;
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const wrapLon=(v:number)=>((v+540)%360)-180;
export function distance(a:[number,number],b:[number,number]) {
 const p=a[0]*DEG,q=b[0]*DEG,dp=q-p,dl=(b[1]-a[1])*DEG;
 return 6371008.8*2*Math.atan2(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2),Math.sqrt(Math.max(0,1-(Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2))));
}
export function bearing(a:[number,number],b:[number,number]) {const p=a[0]*DEG,q=b[0]*DEG,d=(b[1]-a[1])*DEG;return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/DEG+360)%360;}
export function destination(lat:number,lon:number,track:number,metres:number):[number,number] {
 const d=metres/6371008.8,p=lat*DEG,l=lon*DEG,h=track*DEG;
 const p2=Math.asin(clamp(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(h),-1,1));
 return [p2/DEG,wrapLon((l+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2)))/DEG)];
}
export function ecef(lat:number,lon:number,h=0):[number,number,number] {const a=6378137,e2=6.69437999014e-3,p=lat*DEG,l=lon*DEG,n=a/Math.sqrt(1-e2*Math.sin(p)**2);return [(n+h)*Math.cos(p)*Math.cos(l),(n+h)*Math.cos(p)*Math.sin(l),(n*(1-e2)+h)*Math.sin(p)];}
// Three coordinates: east (+X), up (+Y), south (+Z); WGS84 ellipsoid, metres.
export function localENU(lat:number,lon:number,h:number,origin:[number,number,number]):[number,number,number] {
 const p=origin[0]*DEG,l=origin[1]*DEG,a=ecef(lat,lon,h),b=ecef(...origin),x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];
 return [-Math.sin(l)*x+Math.cos(l)*y,Math.cos(p)*Math.cos(l)*x+Math.cos(p)*Math.sin(l)*y+Math.sin(p)*z,Math.sin(p)*Math.cos(l)*x+Math.sin(p)*Math.sin(l)*y-Math.cos(p)*z];
}
const numeric=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function normalizeADSB(payload:any, receivedTime=Date.now()/1000):Flight[] {
 if(!payload||!Array.isArray(payload.ac)) throw new Error('Expected an ADS-B v2 response with an ac array.');
 const reportTime=numeric(payload.now);const time=reportTime!==null?(reportTime>1e12?reportTime/1000:reportTime):receivedTime;
 return payload.ac.filter((a:any)=>numeric(a.lat)!==null&&numeric(a.lon)!==null&&Math.abs(a.lat)<=90&&Math.abs(a.lon)<=180&&typeof a.hex==='string').map((a:any)=>{
  const seen=numeric(a.seen_pos),t=seen===null?0:time-Math.max(0,seen);
  return {id:a.hex,callsign:String(a.flight||a.hex).trim(),registration:typeof a.r==='string'?a.r:null,type:typeof a.t==='string'?a.t:null,airline:null,
   lat:a.lat,lon:a.lon,altitude:numeric(a.alt_baro),geometricAltitude:numeric(a.alt_geom),groundSpeed:numeric(a.gs),track:numeric(a.track),trueHeading:numeric(a.true_heading),
   verticalRate:numeric(a.geom_rate)??numeric(a.baro_rate),indicatedAirspeed:numeric(a.ias),trueAirspeed:numeric(a.tas),mach:numeric(a.mach),roll:numeric(a.roll),squawk:typeof a.squawk==='string'?a.squawk:null,onGround:a.alt_baro==='ground',positionTime:t,receivedTime,source:String(a.type||'ADS-B'),simulated:false};
 });
}
export function quality(f:Flight,now=Date.now()/1000) {const age=Math.max(0,now-f.positionTime);return {age,status:f.simulated?'Simulated':!f.positionTime?'Unknown':age>60?'Lost':age>15?'Stale':'Recent',extrapolate:!f.simulated&&f.positionTime>0&&age<=10};}
export function predicted(f:Flight,now=Date.now()/1000):Flight {
 const q=quality(f,now);if(f.simulated||!f.positionTime||f.track===null||f.groundSpeed===null||f.onGround)return {...f};const dt=Math.min(q.age,10);
 const [lat,lon]=destination(f.lat,f.lon,f.track,f.groundSpeed*KT*dt);const vertical=(f.verticalRate??0)/60*dt;
 return {...f,lat,lon,altitude:f.altitude===null?null:f.altitude+vertical,geometricAltitude:f.geometricAltitude===null?null:f.geometricAltitude+vertical};
}
export function flightPathAngle(f:Flight) {return f.groundSpeed!==null&&f.groundSpeed>20&&f.verticalRate!==null?Math.atan2(f.verticalRate*FT/60,f.groundSpeed*KT):0;}
export function parseEndpoint(url:string) {const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw new Error('Use an HTTP or HTTPS endpoint.');if(u.username||u.password||u.hash)throw new Error('Do not embed credentials or fragments in the URL.');return u.href;}
export function defaultFeedEndpoint(page:{protocol:string,hostname?:string,origin:string}) {
 const host=page.hostname||'';
 const staticHost=page.protocol==='file:'||host==='appassets.androidplatform.net'||host.endsWith('.github.io');
 return staticHost?'https://api.adsb.lol/v2/point/1.36/103.99/100':page.origin+'/api/flights';
}
export function topoFeatures(t:any) {
 const arcs=t.arcs.map((arc:number[][])=>{let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return [x*t.transform.scale[0]+t.transform.translate[0],y*t.transform.scale[1]+t.transform.translate[1]];});});
 const ring=(a:number[])=>a.flatMap((v,i)=>{let p=(v<0?[...arcs[~v]].reverse():arcs[v]);return i?p.slice(1):p;});
 return Object.values(t.objects).flatMap((o:any)=>o.geometries.map((g:any)=>({type:'Feature',properties:g.properties,geometry:{type:g.type,coordinates:g.type==='Polygon'?g.arcs.map(ring):g.arcs.map((p:any)=>p.map(ring))}})));
}
export const escapeHTML=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
