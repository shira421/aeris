export type Flight = {
 id:string; callsign:string; registration:string|null; type:string|null; airline:string|null;
 lat:number; lon:number; altitude:number|null; geometricAltitude:number|null; groundSpeed:number|null;
 track:number|null; trueHeading:number|null; verticalRate:number|null; indicatedAirspeed:number|null;
 trueAirspeed:number|null; mach:number|null; roll:number|null; squawk:string|null; onGround:boolean;
 positionTime:number; receivedTime:number; source:string; simulated:boolean; route?:[string,string];
 // Extended ADS-B fields (null when not reported)
 flight?:string|null; category?:string|null; emergency?:string|null; description?:string|null; operator?:string|null; year?:string|null;
 trackRate?:number|null; magHeading?:number|null; navAltitude?:number|null; navHeading?:number|null; navQnh?:number|null;
 windDirection?:number|null; windSpeed?:number|null; outsideTemp?:number|null; positionSource?:string; military?:boolean;
 nacp?:number|null; rssi?:number|null; provider?:string; providers?:string[];
};
export const DEG=Math.PI/180, NM=1852, FT=.3048, KT=NM/3600, R_EARTH=6371008.8;
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const wrapLon=(v:number)=>((v+540)%360)-180;
export function distance(a:[number,number],b:[number,number]) {
 const p=a[0]*DEG,q=b[0]*DEG,dp=q-p,dl=(b[1]-a[1])*DEG;
 const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
 return R_EARTH*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function bearing(a:[number,number],b:[number,number]) {const p=a[0]*DEG,q=b[0]*DEG,d=(b[1]-a[1])*DEG;return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/DEG+360)%360;}
export function destination(lat:number,lon:number,track:number,metres:number):[number,number] {
 const d=metres/R_EARTH,p=lat*DEG,l=lon*DEG,h=track*DEG;
 const p2=Math.asin(clamp(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(h),-1,1));
 return [p2/DEG,wrapLon((l+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2)))/DEG)];
}
/** Points along the great circle from a to b, for drawing routes that look right on any projection. */
export function greatCircle(a:[number,number],b:[number,number],steps=64):[number,number][] {
 const d=distance(a,b);if(d<1)return [a,b];const out:[number,number][]=[];let prev:number|null=null;
 for(let i=0;i<=steps;i++){const f=i/steps,delta=d/R_EARTH,A=Math.sin((1-f)*delta)/Math.sin(delta),B=Math.sin(f*delta)/Math.sin(delta);
  const p1=a[0]*DEG,l1=a[1]*DEG,p2=b[0]*DEG,l2=b[1]*DEG;
  const x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2),y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2),z=A*Math.sin(p1)+B*Math.sin(p2);
  let lon=Math.atan2(y,x)/DEG;const lat=Math.atan2(z,Math.hypot(x,y))/DEG;
  // Unwrap longitudes so a line crossing the antimeridian stays continuous.
  if(prev!==null){while(lon-prev>180)lon-=360;while(lon-prev<-180)lon+=360;}prev=lon;out.push([lat,lon]);}
 return out;
}
export function ecef(lat:number,lon:number,h=0):[number,number,number] {const a=6378137,e2=6.69437999014e-3,p=lat*DEG,l=lon*DEG,n=a/Math.sqrt(1-e2*Math.sin(p)**2);return [(n+h)*Math.cos(p)*Math.cos(l),(n+h)*Math.cos(p)*Math.sin(l),(n*(1-e2)+h)*Math.sin(p)];}
// Three coordinates: east (+X), up (+Y), south (+Z); WGS84 ellipsoid, metres.
export function localENU(lat:number,lon:number,h:number,origin:[number,number,number]):[number,number,number] {
 const p=origin[0]*DEG,l=origin[1]*DEG,a=ecef(lat,lon,h),b=ecef(...origin),x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];
 return [-Math.sin(l)*x+Math.cos(l)*y,Math.cos(p)*Math.cos(l)*x+Math.cos(p)*Math.sin(l)*y+Math.sin(p)*z,Math.sin(p)*Math.cos(l)*x+Math.sin(p)*Math.sin(l)*y-Math.cos(p)*z];
}
const numeric=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const text=(v:unknown):string|null=>typeof v==='string'&&v.trim()?v.trim():null;
const SOURCE_NAMES:Record<string,string>={adsb_icao:'ADS-B',adsb_icao_nt:'ADS-B',adsr_icao:'ADS-R',tisb_icao:'TIS-B',tisb_trackfile:'TIS-B',tisb_other:'TIS-B',adsr_other:'ADS-R',adsb_other:'ADS-B',adsc:'ADS-C',mlat:'MLAT',mode_s:'Mode S',other:'Other'};
/** Normalise a readsb / ADSBExchange-v2 style response (adsb.lol, adsb.fi, airplanes.live, tar1090). */
export function normalizeADSB(payload:any, receivedTime=Date.now()/1000, provider='ADS-B'):Flight[] {
 if(!payload||!Array.isArray(payload.ac)) throw new Error('Expected an ADS-B v2 response with an ac array.');
 const reportTime=numeric(payload.now);const time=reportTime!==null?(reportTime>1e12?reportTime/1000:reportTime):receivedTime;
 return payload.ac.filter((a:any)=>numeric(a.lat)!==null&&numeric(a.lon)!==null&&Math.abs(a.lat)<=90&&Math.abs(a.lon)<=180&&typeof a.hex==='string').map((a:any)=>{
  const seen=numeric(a.seen_pos),t=seen===null?0:time-Math.max(0,seen);
  const kind=typeof a.type==='string'?a.type:'';const mlat=Array.isArray(a.mlat)&&a.mlat.includes('lat');
  const flight=text(a.flight);const hex=a.hex.toLowerCase();
  return {id:hex,callsign:flight||text(a.r)||hex.replace(/^~/,'').toUpperCase(),flight,registration:text(a.r),type:text(a.t),airline:null,
   lat:a.lat,lon:a.lon,altitude:numeric(a.alt_baro),geometricAltitude:numeric(a.alt_geom),groundSpeed:numeric(a.gs),track:numeric(a.track),trueHeading:numeric(a.true_heading),
   verticalRate:numeric(a.baro_rate)??numeric(a.geom_rate),indicatedAirspeed:numeric(a.ias),trueAirspeed:numeric(a.tas),mach:numeric(a.mach),roll:numeric(a.roll),squawk:text(a.squawk),onGround:a.alt_baro==='ground',
   positionTime:t,receivedTime,source:mlat?'MLAT':(SOURCE_NAMES[kind]||'ADS-B'),simulated:false,
   category:text(a.category),emergency:a.emergency&&a.emergency!=='none'?String(a.emergency):null,description:text(a.desc),operator:text(a.ownOp),year:text(a.year),
   trackRate:numeric(a.track_rate),magHeading:numeric(a.mag_heading),navAltitude:numeric(a.nav_altitude_mcp)??numeric(a.nav_altitude_fms),navHeading:numeric(a.nav_heading),navQnh:numeric(a.nav_qnh),
   windDirection:numeric(a.wd),windSpeed:numeric(a.ws),outsideTemp:numeric(a.oat),positionSource:mlat?'mlat':kind||'adsb',military:typeof a.dbFlags==='number'&&(a.dbFlags&1)===1,
   nacp:numeric(a.nac_p),rssi:numeric(a.rssi),provider,providers:[provider]};
 });
}
const OPENSKY_SOURCE=['ADS-B','ASTERIX','MLAT','FLARM'];
const OPENSKY_CATEGORY=[null,null,'A1','A2','A3','A4','A5','A6','A7','B1','B2','B3','B4','B6','B7','C1','C2','C3','C4','C5'];
/** Normalise an OpenSky /states/all response (SI units) into the same Flight shape (feet, knots, ft/min). */
export function normalizeOpenSky(payload:any, receivedTime=Date.now()/1000, provider='OpenSky'):Flight[] {
 if(!payload||!('states' in payload))throw new Error('Expected an OpenSky states response.');
 return (payload.states||[]).filter((s:any[])=>Array.isArray(s)&&numeric(s[5])!==null&&numeric(s[6])!==null&&numeric(s[3])!==null).map((s:any[])=>{
  const m=(v:unknown)=>{const n=numeric(v);return n===null?null:n/FT;};const callsign=text(s[1]);const hex=String(s[0]).toLowerCase();
  return {id:hex,callsign:callsign||hex.toUpperCase(),flight:callsign,registration:null,type:null,airline:null,lat:s[6],lon:s[5],
   altitude:s[8]?null:m(s[7]),geometricAltitude:s[8]?null:m(s[13]),groundSpeed:numeric(s[9])===null?null:s[9]/KT,track:numeric(s[10]),trueHeading:null,
   verticalRate:numeric(s[11])===null?null:s[11]*60/FT,indicatedAirspeed:null,trueAirspeed:null,mach:null,roll:null,squawk:text(s[14]),onGround:Boolean(s[8]),
   positionTime:s[3],receivedTime,source:OPENSKY_SOURCE[s[16]]||'ADS-B',simulated:false,category:OPENSKY_CATEGORY[s[17]]??null,emergency:null,description:null,operator:null,year:null,
   trackRate:null,magHeading:null,navAltitude:null,navHeading:null,navQnh:null,windDirection:null,windSpeed:null,outsideTemp:null,positionSource:s[16]===2?'mlat':'adsb',military:false,nacp:null,rssi:null,provider,providers:[provider]};
 });
}
const STATIC_FIELDS=['registration','type','description','operator','year','category','flight','airline'] as const;
/**
 * Merge a report into the store. The newest position wins; identity fields missing from it
 * are kept from the previous report. Returns the merged flight and whether its position changed.
 */
export function mergeReport(prev:Flight|undefined, next:Flight):{flight:Flight,fresh:boolean} {
 if(!prev)return {flight:next,fresh:true};
 const fresh=next.positionTime>prev.positionTime+.05;const base=fresh?{...next}:{...prev};const other=fresh?prev:next;
 for(const k of STATIC_FIELDS)if((base as any)[k]==null&&(other as any)[k]!=null)(base as any)[k]=(other as any)[k];
 if(base.callsign===base.id.toUpperCase()&&other.callsign!==other.id.toUpperCase())base.callsign=other.callsign;
 base.providers=[...new Set([...(prev.providers||[]),...(next.providers||[])])];
 return {flight:base,fresh};
}
export const LIMITS={extrapolate:20,stale:15,lost:60};
export function quality(f:Flight,now=Date.now()/1000) {const age=Math.max(0,now-f.positionTime);return {age,status:f.simulated?'Simulated':!f.positionTime?'Unknown':age>LIMITS.lost?'Lost':age>LIMITS.stale?'Stale':'Recent',extrapolate:!f.simulated&&f.positionTime>0&&age<=LIMITS.extrapolate};}
/**
 * Dead-reckon a report to `now`: along a constant-rate turn when a turn rate is reported
 * (for at most 8 s), then straight. Bounded to LIMITS.extrapolate seconds, then frozen.
 */
export function predicted(f:Flight,now=Date.now()/1000):Flight {
 if(f.simulated||!f.positionTime||f.track===null||f.groundSpeed===null||f.onGround)return {...f};
 const dt=clamp(now-f.positionTime,0,LIMITS.extrapolate);if(dt===0)return {...f};
 const v=f.groundSpeed*KT,h0=f.track*DEG,rate=clamp(f.trackRate??0,-6,6)*DEG,turnTime=Math.min(dt,8);
 let east:number,north:number,track=f.track;
 if(Math.abs(rate)>1e-4){const h1=h0+rate*turnTime;east=v/rate*(Math.cos(h0)-Math.cos(h1));north=v/rate*(Math.sin(h1)-Math.sin(h0));const rest=dt-turnTime;east+=v*rest*Math.sin(h1);north+=v*rest*Math.cos(h1);track=((h1/DEG)%360+360)%360;}
 else{east=v*dt*Math.sin(h0);north=v*dt*Math.cos(h0);}
 const [lat,lon]=destination(f.lat,f.lon,(Math.atan2(east,north)/DEG+360)%360,Math.hypot(east,north));const vertical=(f.verticalRate??0)/60*dt;
 return {...f,lat,lon,track,altitude:f.altitude===null?null:f.altitude+vertical,geometricAltitude:f.geometricAltitude===null?null:f.geometricAltitude+vertical};
}
export function flightPathAngle(f:Flight) {return f.groundSpeed!==null&&f.groundSpeed>20&&f.verticalRate!==null?Math.atan2(f.verticalRate*FT/60,f.groundSpeed*KT):0;}
/**
 * Circles (centre + radius in NM, at most `maxRadius`) that cover a lon/lat box, nearest the centre first.
 * Used to query point-radius APIs for exactly the area on screen.
 */
export function coverageCircles(bounds:{west:number,south:number,east:number,north:number},maxRadius=250,limit=40) {
 const south=clamp(bounds.south,-85,85),north=clamp(bounds.north,-85,85);let west=bounds.west,east=bounds.east;if(east-west>=360){west=-180;east=180;}
 const cLat=(south+north)/2,cLon=wrapLon((west+east)/2);
 const corners:[number,number][]=[[south,west],[south,east],[north,west],[north,east],[cLat,west],[cLat,east],[south,cLon],[north,cLon]];
 const reach=Math.max(...corners.map(c=>distance([cLat,cLon],c)))/NM;
 if(reach<=maxRadius)return [{lat:+cLat.toFixed(3),lon:+cLon.toFixed(3),nm:Math.max(25,Math.ceil(reach*1.05))}];
 // Hexagonal packing: circles of radius r cover the plane with row spacing 1.5r and column spacing sqrt(3)r.
 // Packed at 88% of the query radius so the circles still overlap on a curved Earth.
 const rKm=.88*maxRadius*NM/1000,dLat=1.5*rKm/111.2,out:{lat:number,lon:number,nm:number,d:number}[]=[];let row=0;
 for(let lat=south;lat<=north+dLat;lat+=dLat,row++){const dLon=Math.sqrt(3)*rKm/(111.32*Math.max(.05,Math.cos(clamp(lat,-80,80)*DEG)));
  for(let lon=west+(row%2?dLon/2:0);lon<=east+dLon/2;lon+=dLon){const p:[number,number]=[clamp(lat,-85,85),wrapLon(lon)];out.push({lat:+p[0].toFixed(3),lon:+p[1].toFixed(3),nm:maxRadius,d:distance([cLat,cLon],p)});}}
 return out.sort((a,b)=>a.d-b.d).slice(0,limit).map(({lat,lon,nm})=>({lat,lon,nm}));
}
/**
 * Does a database route fit what the aircraft is doing? Callsign routes are often stale
 * (re-used flight numbers, diversions). Checks distance from the great-circle path,
 * progress along it, and whether the aircraft heads towards the destination.
 */
export function routeFit(f:{lat:number,lon:number,track:number|null,onGround:boolean},origin:[number,number],dest:[number,number]) {
 const total=distance(origin,dest),fromOrigin=distance(origin,[f.lat,f.lon]),toDest=distance([f.lat,f.lon],dest);
 const d13=fromOrigin/R_EARTH,t13=bearing(origin,[f.lat,f.lon])*DEG,t12=bearing(origin,dest)*DEG;
 const xtd=Math.asin(clamp(Math.sin(d13)*Math.sin(t13-t12),-1,1))*R_EARTH;const atd=Math.acos(clamp(Math.cos(d13)/Math.cos(xtd/R_EARTH),-1,1))*R_EARTH;
 const progress=total>0?clamp(Math.cos(t13-t12)<0?-atd/total:atd/total,-1,2):0;
 const tolerance=Math.max(150000,total*.15);
 let heading=true;if(f.track!==null&&!f.onGround&&toDest>120000){const diff=Math.abs(((bearing([f.lat,f.lon],dest)-f.track)+540)%360-180);heading=diff<80;}
 const nearEnd=fromOrigin<40000||toDest<40000;
 const plausible=nearEnd||(Math.abs(xtd)<tolerance&&progress>-.05&&progress<1.05&&heading);
 return {plausible,crossTrackKm:Math.abs(xtd)/1000,progress:clamp(progress,0,1),remainingKm:toDest/1000,totalKm:total/1000};
}
export function parseEndpoint(url:string) {const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw new Error('Use an HTTP or HTTPS endpoint.');if(u.username||u.password||u.hash)throw new Error('Do not embed credentials or fragments in the URL.');return u.href;}
export function defaultFeedEndpoint(page:{protocol:string,hostname?:string,origin:string}) {
 const host=page.hostname||'';
 const staticHost=!['http:','https:'].includes(page.protocol)||host==='appassets.androidplatform.net'||host.endsWith('.github.io');
 return staticHost?'https://api.adsb.lol/v2/point/1.36/103.99/100':page.origin+'/api/flights';
}
export function topoFeatures(t:any) {
 const arcs=t.arcs.map((arc:number[][])=>{let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return [x*t.transform.scale[0]+t.transform.translate[0],y*t.transform.scale[1]+t.transform.translate[1]];});});
 const ring=(a:number[])=>a.flatMap((v,i)=>{let p=(v<0?[...arcs[~v]].reverse():arcs[v]);return i?p.slice(1):p;});
 return Object.values(t.objects).flatMap((o:any)=>o.geometries.map((g:any)=>({type:'Feature',properties:g.properties,geometry:{type:g.type,coordinates:g.type==='Polygon'?g.arcs.map(ring):g.arcs.map((p:any)=>p.map(ring))}})));
}
export const escapeHTML=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
