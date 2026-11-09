import {WorldMap} from './worldmap.js';
import {Studio} from './studio.js';
import {LiveFeed} from './live.js';
import {PROVIDERS} from './providers.js';
import {bridge,setProxy,getProxy,nativeCall} from './net.js';
import {loadAirports,airportByCode,searchAirports,nearestAirports,airportsGeoJSON,localTime} from './airports.js';
import {routeFor,aircraftFor,photoFor} from './enrich.js';
import {typeFor,iconClass} from './types.js';
import {altitudeMSL} from './geo.js';
import {searchAirlines,searchTypes,directLookups,matchesFlight,airlineFor,flightNumber} from './search.js';
import {Collection,Watcher,place,localDate,daysBetween} from './collection.js';
import {currentLocation,notificationPermission,notify,createWatchSync,backgroundChecks} from './device.js';
import {quality,escapeHTML as e,FT,KT,distance,routeFit,LIMITS,parseEndpoint} from './core.ts';

const icons={
 plane:'M12 2v8l8 5v2l-8-2v5l3 2H9l3-2v-5l-8 2v-2l8-5Z',search:'m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',airport:'M12 3v18M4 9h16M6 17h12M9 3h6M4 21h16',
 bell:'M6 16V11a6 6 0 1 1 12 0v5l2 2H4Zm4 4a2 2 0 0 0 4 0',layers:'m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5',
 settings:'M9 4h6l1 3 3 1 2 5-3 2v4l-5 2-3-2-4 1-3-5 2-3-1-4 5-4Zm7 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0',info:'M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0m-9-1v6m0-10v.1',
 plus:'M12 5v14M5 12h14',minus:'M5 12h14',me:'M12 2v3m0 14v3M2 12h3m14 0h3M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-3 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 arrow:'M5 12h14m-6-6 6 6-6 6',back:'M19 12H5m6-6-6 6 6 6',close:'m6 6 12 12M6 18 18 6',
 orbit:'M18 6c5 3 5 7 0 10S6 22 3 18s1-10 6-13 8-3 10 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',chase:'m3 6 8 6-8 6m8-12 8 6-8 6',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',cube:'m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5m-9 5v10m0-10L3 7',
 signal:'M5 16v4m5-9v9m5-14v14m5-19v19',altitude:'m4 18 8-12 8 12M8 12l4 3 4-3M3 21h18',speed:'M4 18a9 9 0 1 1 16 0M12 14l6-6m-8 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0',
 vertical:'M12 3v18m-5-5 5 5 5-5M7 8l5-5 5 5',heading:'m12 3 8 18-8-5-8 5Z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 satellite:'m6 6 4 4m4 4 4 4M3 9l6-6 3 3-6 6Zm9 9 6-6 3 3-6 6Zm-3-3 6-6',airline:'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
 trip:'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4ZM4 12h16',globe:'M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
 edit:'M4 20h4L19 9l-4-4L4 16Zm9-13 4 4',trash:'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13'
};
// The aircraft drawn on the 3D button.
const planeSVG=`<svg class="preview-plane" viewBox="0 0 300 140" aria-hidden="true"><defs><linearGradient id="fuselage" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset=".4" stop-color="#f7f8f4"/><stop offset="1" stop-color="#8faaa3"/></linearGradient></defs><path d="m105 70 88-52 16 3-54 54 79 42-18 5-93-37Z" fill="#bbcfc5" stroke="#829f94" stroke-width="1"/><path d="m219 76 37-38 11 2-15 39 22 22-14 1-31-16Z" fill="#2c5860"/><path d="M30 74C42 62 62 61 85 62l156 9c21 1 28 7 17 11l-182 6C49 87 25 81 30 74Z" fill="url(#fuselage)" stroke="#96b1a4"/><path d="m91 75 65 49 20 1-29-47Z" fill="#e2ebe3" stroke="#8ea99d"/><path d="m123 90 21 5 7 8-4 7-26-9Z" fill="#f7f8f4" stroke="#829d92"/><ellipse cx="124" cy="96" rx="3" ry="7" fill="#1c4c58" transform="rotate(-38 124 96)"/><path d="m39 69 8-3 13 1-4 5-11 1Z" fill="#345b62"/><path d="m68 71 133 6" stroke="#77928c" stroke-width="2" stroke-dasharray="2 4"/><path d="m35 80 201 1" stroke="#cda36a" stroke-width="1.5"/></svg>`;
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.info}"/></svg>`;
const $=s=>document.querySelector(s);
function loadPref(k,fallback){try{return JSON.parse(localStorage.getItem('aeris-'+k))??fallback;}catch{return fallback;}}
function savePref(k,v){try{localStorage.setItem('aeris-'+k,JSON.stringify(v));}catch{}}
const now=()=>Date.now()/1000;
const storage=(()=>{try{return localStorage;}catch{return null;}})();

// ——— Data path: the native app's bridge, or (in browsers) the Aeris relay. Always live: no demo traffic. ———
const BUILD_PROXY=typeof __AERIS_PROXY__!=='undefined'?__AERIS_PROXY__:'';
const staticHost=!['http:','https:'].includes(location.protocol)||location.hostname==='appassets.androidplatform.net'||location.hostname.endsWith('.github.io');
const defaultProxy=()=>BUILD_PROXY||(staticHost?null:location.origin+'/api/proxy');
setProxy(loadPref('proxy',null)||defaultProxy());
const canLive=()=>Boolean(bridge()||getProxy());

const state={nav:'explore',tab:'overview',selected:null,airport:null,mode:'live',view3d:false,studio:false,camera:'chase',
 units:loadPref('units','aviation'),mapStyle:loadPref('mapStyle','map'),projection:loadPref('projection','mercator'),showGround:loadPref('showGround',true),info:{},center:{lat:1.36,lng:103.99},zoom:6.6,
 me:null,search:{q:'',remote:null,results:null},trip:null,tripView:'list',historyRange:'year',mapFilter:null,form:null};
let studio=null,lastUI=0,lastMapPush=0,lastFrame=0,lastTrail=0,lastSlow=0,lastSelected=0,toastTimer,dialogFocus,infoFor=null,searchTimer,searchSeq=0,pageVisible=true,mapDirty=true,mapInterval=250;
const picks=new Map();// search results not yet on the map, by id

$('#app').innerHTML=`
<header class="topbar"><button class="brand" data-action="explore" aria-label="Aeris home"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M2 27 16 3l14 24-14-7Z" fill="#204e51"/><path d="m6 30 10-6 10 6-10 5Z" fill="#d87852"/></svg><span>AERIS</span></button><nav class="nav" aria-label="Main navigation"><button data-action="explore" class="active">Explore</button><button data-action="trips">Trips</button><button data-action="saved">Saved<span class="saved-count"></span></button><button data-action="airports">Airports</button></nav><div class="top-actions"><button id="source-pill" class="sources-button" data-action="connect" aria-label="Data sources">${icon('signal')}<span>Sources</span></button><button class="iconbutton" data-action="settings" aria-label="Settings" title="Settings">${icon('settings')}</button></div></header>
<div class="workspace"><main class="stage" aria-label="Flight map"><div class="map-canvas" id="map" aria-label="Map of live aircraft"></div><div class="scene-container" id="scene"></div>
<div class="search-area"><div class="search-box">${icon('search')}<label class="sr-only" for="search">Search flights, airlines, aircraft and airports</label><input id="search" type="search" placeholder="Flight, airline, aircraft or airport" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-controls="search-results" aria-expanded="false"><button class="search-clear" data-action="clear-search" aria-label="Clear search">${icon('close')}</button></div><div class="search-results" id="search-results" role="listbox"></div></div>
<div class="map-tools"><div class="tool-group"><button class="compass" data-action="north" aria-label="Reset north and tilt" title="Reset north and tilt"><span>N</span></button></div><div class="tool-group"><button data-action="zoom-in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button><button data-action="zoom-out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button></div><div class="tool-group"><button data-action="locate-me" aria-label="Show my location" title="Show my location">${icon('me')}</button><button data-action="map-options" aria-label="Map style and filters" title="Map style and filters">${icon('layers')}</button></div></div>
<div class="error-inline" role="status" id="feed-error"></div>
<div class="scene-overlay"><div class="scene-top"><div class="scene-card"><button class="scene-back" data-action="map" aria-label="Back to the map" title="Back to the map">${icon('back')}</button><div class="scene-tag"><strong id="scene-callsign">—</strong><span id="scene-sub"></span></div></div><div class="tool-group scene-tools"><button data-action="scene-style" aria-label="Satellite or map ground" title="Satellite or map ground">${icon('satellite')}</button><button data-action="reset-camera" aria-label="Reset camera" title="Reset camera">${icon('me')}</button></div></div><div class="camera-bar" role="group" aria-label="Camera">${[['chase','chase','Follow'],['orbit','orbit','Orbit'],['cockpit','eye','Cockpit'],['model','cube','Model']].map(([k,ic,l])=>`<button data-camera="${k}" class="${k==='chase'?'active':''}">${icon(ic)}<span>${l}</span></button>`).join('')}</div></div>
<button class="mobile-detail-toggle" data-action="toggle-detail">${icon('plane')}<span id="mobile-flight-name">Details</span>${icon('arrow')}</button>
<div class="credits"><span id="map-credit"></span><button data-action="about">About the data</button></div></main>
<aside class="detail" aria-label="Details" id="detail"></aside></div><dialog id="dialog" aria-labelledby="dialog-title"></dialog><div class="toast" role="status" aria-live="polite" id="toast"></div>`;

// ——— Map, live feed, saved items ———
const map=new WorldMap($('#map'),{onSelect:id=>selectFlight(id),onAirport:selectAirport,onMove:onMapMove,onStyle:html=>{$('#map-credit').innerHTML=html;},onError:msg=>toast(msg),onReady:()=>{map.setProjection(state.projection);if(state.mapStyle!=='map')map.setStyle(state.mapStyle);if(state.me)map.setMe(state.me);}});
map.projection=state.projection;
{const lp=loadPref('layers',{})||{};for(const k of ['labels','trails','airports','altitudeColors'])if(typeof lp[k]==='boolean')map[k]=lp[k];}
const live=new LiveFeed({storage,onUpdate:()=>{mapDirty=true;updateTrail(true);},onStatus:()=>renderSource()});
for(const id of loadPref('disabledProviders',[]))live.setEnabled(id,false);
const collection=new Collection(storage);
const nearAirport=(lat,lon,km)=>{const a=nearestAirports(lat,lon,1,'LMS')[0];return a&&a.distanceKm<=km?a:null;};
// The iOS/Android app checks watched flights while Aeris is closed; its newer states are merged in before each check.
const nativeWatch=bridge()?{state:()=>nativeCall('watchState',{},8000).then(r=>Array.isArray(r)?r:[])}:null;
const watcher=new Watcher({collection,live,routeFor,nearAirport,native:nativeWatch,notify:(t,b,tag)=>notify(t,b,tag).catch(()=>{}),onCheck:seen=>{
 if(state.nav==='trips'&&state.tripView==='trip'){for(const f of Object.values(seen))if(!live.get(f.id))live.add(f);updatePlan(false);}
 if(['saved','trips'].includes(state.nav)||(!state.selected&&state.nav==='explore'))renderDetail();syncWatch();}});
collection.onChange(()=>renderNav());
let syncErrorShown=false;
const sendWatch=createWatchSync(undefined,{onError:()=>{if(!syncErrorShown){toast('Saved on this device. Background checks could not start; Aeris will retry.');syncErrorShown=true;}}});
async function syncWatch(){if(!bridge())return true;const ok=await sendWatch(watcher.items());if(ok)syncErrorShown=false;return ok;}
// Airports load after the first map frame so they never delay aircraft.
setTimeout(()=>loadAirports().then(()=>{map.setAirports(airportsGeoJSON());if(state.nav==='airports')renderDetail();}),600);
if(!map.ok){const v=loadPref('view',null),c=v?.center||[103.99,1.36];onMapMove({west:c[0]-4,east:c[0]+4,south:c[1]-3,north:c[1]+3},7,{lng:c[0],lat:c[1]});}
function onMapMove(bounds,zoom,center){state.center=center;state.zoom=zoom;mapDirty=true;live.setView(bounds,zoom);}

const selected=()=>live.get(state.selected)||null;
function currentFlights(){return live.list();}
function displayFlight(f){return live.position(f.id)||f;}
function visibleFlights(){return currentFlights().filter(f=>(state.showGround||!f.onGround)&&quality(f).age<=LIMITS.lost&&(!state.mapFilter||state.mapFilter.has(f.flight||f.callsign)||f.id===state.selected));}
const stale=f=>quality(f).age>LIMITS.stale;

// ——— Formatting ———
function fmt(v,kind,digits=0){if(v===null||v===undefined||!Number.isFinite(v))return '—';let n=v;if(state.units==='metric'){if(kind==='alt')n*=FT;if(kind==='speed')n*=KT*3.6;if(kind==='vertical')n*=FT/60;}return new Intl.NumberFormat('en-SG',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);}
function unit(kind){return state.units==='metric'?({alt:'m',speed:'km/h',vertical:'m/s'}[kind]||kind):({alt:'ft',speed:'kt',vertical:'ft/min'}[kind]||kind);}
function phase(f){if(f.onGround)return 'On the ground';if(f.verticalRate===null)return 'In the air';return f.verticalRate<-250?'Descending':f.verticalRate>250?'Climbing':'Cruising';}
function ago(s){return s<1?'just now':s<90?Math.round(s)+' s ago':s<5400?Math.round(s/60)+' min ago':Math.round(s/3600)+' h ago';}
function duration(min){return min<60?`${min} min`:`${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')} min`;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4300);}
const nacpText=n=>n==null?'Not reported':({11:'< 3 m',10:'< 10 m',9:'< 30 m',8:'< 93 m',7:'< 185 m',6:'< 556 m',5:'< 926 m'})[n]||'> 1 km';
const airlineName=f=>state.info.route?.airline?.name||airlineFor(f.callsign)?.name||f.operator||f.airline||null;
const titleOf=f=>flightNumber(f.flight||f.callsign)||f.callsign;
const row=(k,v)=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`;
const closeButton=`<button class="iconbutton detail-close" data-action="toggle-detail" aria-label="Close panel">${icon('close')}</button>`;
const panelHead=title=>`<div class="panel-head"><h2>${e(title)}</h2>${closeButton}</div>`;

function renderNav(){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.action===state.nav));$('.saved-count').textContent=collection.count?' · '+collection.count:'';
 const panel=state.nav==='trips'&&state.tripView!=='list';$('.workspace').classList.toggle('has-selection',Boolean(state.selected)||panel);
 if(panel&&!state.selected)$('#mobile-flight-name').textContent=state.tripView==='history'?'History':collection.trip(state.trip)?.name||'Trip';}

// ——— Selecting things ———
function selectFlight(id,{fly=false}={}){
 const f=currentFlights().find(f=>f.id===id);if(!f){toast('This aircraft is no longer in the feed.');return;}
 if(state.nav==='trips')leavePlan();
 state.selected=id;state.nav='explore';state.airport=null;state.tab='overview';live.setFocus(id);closeSearch();
 renderNav();loadInfo(f);renderDetail();updateTrail(true);
 if(fly){const d=displayFlight(f);map.flyTo(d.lat,d.lon,Math.max(map.getZoom(),8));}
 if(state.view3d){map.model.setFlight(displayFlight(f),typeFor(f.type,f.category).code);map.resetCamera(f);if(state.studio)studio?.show(f);}
 if(innerWidth<=800)$('.workspace').classList.add('detail-open');
 pushMap(true);
}
function deselect(){state.selected=null;live.setFocus(null);state.info={};infoFor=null;map.setSelected(null);map.setTrail([]);map.setRoute(null);if(state.view3d)closeScene();renderNav();renderDetail();$('.workspace').classList.remove('detail-open');}
/** Put a flight found by search (anywhere in the world) on the map and go to it. */
function goTo(f){if(!live.get(f.id))live.add(f);selectFlight(f.id,{fly:true});}
async function findAndGo(kind,value,label){
 const local=currentFlights().find(f=>sameAs(f,{kind,value}));
 if(local){goTo(local);return true;}
 if(!canLive()){toast(liveProblem().short);return false;}
 toast(`Looking for ${label}…`);
 try{const list=await live.query(kind,value);const f=list.find(x=>x.lat!=null);if(f){goTo(f);return true;}}catch(err){toast(err.message);return false;}
 toast(`${label} is not in the air right now.`);return false;
}
async function loadInfo(f){
 if(infoFor===f.id)return;infoFor=f.id;state.info={loading:true};const id=f.id;
 const [r,a,p]=await Promise.allSettled([routeFor(f.flight||f.callsign),aircraftFor(id),photoFor(id,f.registration)]);
 if(state.selected!==id)return;
 state.info={route:r.value||null,aircraft:a.value||null,photo:p.value||null};renderDetail();updateRoute();
}
function routeCheck(f){const r=state.info.route;if(!r?.origin||!r?.destination)return null;return routeFit(displayFlight(f),[r.origin.lat,r.origin.lon],[r.destination.lat,r.destination.lon]);}
function updateRoute(){const f=selected();if(!f){map.setRoute(null);return;}const r=state.info.route,fit=routeCheck(f);if(r&&fit?.plausible)map.setRoute(r.origin,r.destination,displayFlight(f));else map.setRoute(null);}
function updateTrail(force=false){const t=performance.now();if(!force&&t-lastTrail<1000)return;lastTrail=t;const f=selected();if(!f||!map.trails){map.setTrail([]);return;}
 map.setTrail(live.track(f.id),displayFlight(f));}
function selectAirport(id){state.airport=airportByCode(id);if(!state.airport)return;if(state.nav==='trips')leavePlan();state.nav='airports';closeSearch();if(state.view3d)closeScene();map.flyTo(state.airport.lat,state.airport.lon,Math.max(map.getZoom(),10));renderNav();renderDetail();if(innerWidth<=800)$('.workspace').classList.add('detail-open');}
/** Push positions to the map, at a rate that drops as more aircraft are on screen. */
function pushMap(force=false){
 const t=performance.now();
 if(!force&&!mapDirty&&t-lastMapPush<mapInterval)return;lastMapPush=t;mapDirty=false;
 const count=map.setFlights(visibleFlights(),state.selected,iconClass,stale,displayFlight)||0;
 mapInterval=count<1500?250:count<5000?400:700;
}

// ——— Panels ———
function metric(label,value,kind,key,ic,note=''){return `<button class="metric" data-metric="${key}"><span class="metric-label">${icon(ic)}${label}</span><span class="metric-value" data-value="${key}">${fmt(value,kind,kind==='vertical'&&state.units==='metric'?1:0)}<small>${unit(kind)}</small></span><span class="metric-note" data-note="${key}">${note}</span></button>`;}
function vsNote(v){return v==null?'Not reported':v<-50?'Descending':v>50?'Climbing':'Level';}
function chart(f){let h=live.track(f.id);h=h.filter(p=>p.altitude!==null);if(h.length<2)return '';const max=Math.max(1000,...h.map(p=>p.altitude));const d=h.map((p,i)=>`${i?'L':'M'}${(i/(h.length-1)*280).toFixed(1)},${(64-Math.max(0,p.altitude)/max*55).toFixed(1)}`).join(' ');return `<div class="chart-heading">Altitude<span>since you opened Aeris · ${unit('alt')}</span></div><svg class="alt-chart" viewBox="0 0 280 78" role="img" aria-label="Altitude profile"><path d="M0 20H280M0 43H280M0 65H280" stroke="#e7ece5" stroke-dasharray="3 4"/><path d="${d}L280 70H0Z" fill="#8caa8d22"/><path d="${d}" fill="none" stroke="#729b7f" stroke-width="1.8"/></svg>`;}
function flightRow(f,extra=''){const a=airlineFor(f.callsign);return `<button class="flight-list-item" data-flight="${e(f.id)}"><span class="airline-monogram">${e((a?.iata||f.callsign||'?').slice(0,2))}</span><span><strong>${e(titleOf(f))}</strong><small>${e(extra||[a?.name||f.operator||f.registration,f.type].filter(Boolean).join(' · '))}</small></span><span class="item-end"><small>${f.onGround?'On ground':fmt(f.altitude,'alt')+' '+unit('alt')}</small></span>${icon('arrow')}</button>`;}
function routeHTML(f){
 const r=state.info.route,fit=r?routeCheck(f):null;const d=displayFlight(f);
 const end=(a,cls='')=>`<div class="${cls}"><div class="airport-code">${e(a.iata||a.icao||'—')}</div><div class="route-place">${e(a.city||a.name||'')}</div></div>`;
 if(r&&fit&&fit.plausible){
  let meta='';if(fit.progress!==null){const remaining=Math.round(fit.remainingKm),gs=d.groundSpeed;const eta=!f.onGround&&gs>80?Math.round(fit.remainingKm/(gs*1.852)*60):null;
   meta=`<div class="route-progress" role="img" aria-label="${Math.round(fit.progress*100)}% of the route flown"><span style="width:${Math.round(fit.progress*100)}%"></span></div><div class="route-meta"><span>${Math.max(0,Math.round(fit.totalKm-fit.remainingKm)).toLocaleString('en-SG')} km flown</span><span>${remaining.toLocaleString('en-SG')} km to go${eta?` · about ${duration(eta)}`:''}</span></div>`;}
  return `<div class="route-points">${end(r.origin)}<div class="route-line">${icon('plane')}</div>${end(r.destination,'route-end')}</div>${meta}`;}
 if(r&&fit&&!fit.plausible)return `<p class="route-note">Route not confirmed: the usual route for this flight is ${e(r.origin.iata||r.origin.icao)} → ${e(r.destination.iata||r.destination.icao)}, but the aircraft is not on it.</p>`;
 if(state.info.loading)return '<p class="route-note">Looking up the route…</p>';
 return '<p class="route-note">No route on record for this flight.</p>';
}
function photoHTML(){const p=state.info.photo;if(!p?.src)return '';return `<figure class="airframe-photo"><a href="${e(p.link)}" target="_blank" rel="noreferrer"><img src="${e(p.src)}" alt="This aircraft" loading="lazy" decoding="async"${p.width?` width="${p.width}" height="${p.height}"`:''}></a><figcaption>© ${e(p.photographer)} · <a href="${e(p.link)}" target="_blank" rel="noreferrer">Planespotters.net</a></figcaption></figure>`;}
function familyText(s){return ({heavy:'Wide-body',jumbo:'Wide-body, four engines',narrow:'Narrow-body',regional:'Regional jet',turboprop:'Turboprop',biz:'Business jet',light:'Light aircraft',heli:'Helicopter'})[s.cls]||'Aircraft';}
function engineText(s){if(s.generic)return 'Unknown';if(s.rotor)return 'Turbine';return `${s.eng} × ${s.prop?'propeller':'jet'}${s.mount==='tail'?', rear-mounted':s.mount==='tri'?', two on the wings and one in the tail':''}`;}
/** What is known about a flight number now: from the map, or from the last check. Only what was seen. */
function watchStatus(cs){
 const f=currentFlights().find(x=>(x.flight||x.callsign)===cs);
 if(f)return f.onGround?'On the ground':`In the air · ${fmt(f.altitude,'alt')} ${unit('alt')}`;
 const w=collection.data.watch[cs];if(!w?.status)return null;
 if(w.status==='airborne')return `In the air · ${fmt(w.alt,'alt')} ${unit('alt')}`;
 if(w.status==='ground')return w.leg?.landed&&w.leg.at?`Landed at ${w.leg.at.code}`:'On the ground';
 if(w.leg?.landed&&w.leg.at)return `Landed at ${w.leg.at.code} · ${ago(now()-(w.leg.endSeen||w.seen))}`;
 return w.seen?`Not in the air · last seen ${ago(now()-w.seen)}`:'Not in the air';
}
function savedFlightStatus(item){return watchStatus(item.callsign)||'Checking…';}
const alertModeText=m=>({next:'Alerts: next flight',every:'Alerts: every flight'})[m]||'';
function renderDetail(){
 const d=$('#detail');
 if(state.nav==='saved'){d.innerHTML=savedHTML();return;}
 if(state.nav==='trips'){const t=collection.trip(state.trip);d.innerHTML=state.tripView==='history'?historyHTML():state.tripView==='trip'&&t?tripHTML(t):tripsHTML();return;}
 if(state.nav==='airports'){d.innerHTML=state.airport?airportHTML(state.airport):airportsHTML();return;}
 const f=selected();if(!f){d.innerHTML=exploreHTML();return;}
 const t=typeFor(f.type,f.category),spec=t.spec,info=state.info,cs=f.flight||f.callsign;
 const isAirlineFlight=/^[A-Z]{3}\d/.test(cs),savedFlight=collection.flight(cs),savedAircraft=collection.aircraft(f.id);
 let content='';
 if(state.tab==='overview')content=`${photoHTML()}<div class="metric-grid">${metric('Altitude',f.altitude,'alt','altitude','altitude',f.onGround?'On ground':'Barometric')}${metric('Ground speed',f.groundSpeed,'speed','groundSpeed','speed','')}${metric('Vertical speed',f.verticalRate,'vertical','verticalRate','vertical',vsNote(f.verticalRate))}${metric('Track',f.track,'°','track','heading','')}</div><div id="altitude-chart">${chart(f)}</div>`;
 else if(state.tab==='aircraft'){const a=info.aircraft,reg=f.registration||a?.registration;content=`${photoHTML()}<h3>${e(t.exact||!f.description?spec.name:f.description)}</h3><p class="fact-note">${e(t.exact?familyText(spec):'Type not reported')}</p><dl class="fact-list">${row('Registration',reg||'Not reported')}${row('Type code',f.type||a?.icaoType||'Not reported')}${a?.type?row('Variant',a.type):''}${row('Operator',airlineName(f)||'Not reported')}${a?.owner&&a.owner!==airlineName(f)?row('Owner',a.owner):''}${a?.country?row('Registered in',a.country):''}${f.year?row('Built',f.year):''}${row('Length · span · height',`${spec.length} · ${spec.span} · ${spec.height} m`)}${row('Engines',engineText(spec))}${row('Mode S address',f.id.toUpperCase())}</dl>${`<button class="secondary wide ${savedAircraft?'on':''}" data-action="save-aircraft">${icon('star')} ${savedAircraft?'Aircraft saved':'Save this aircraft'}${reg?' ('+e(reg)+')':''}</button>`}`;}
 else{const msl=altitudeMSL(f),dp=displayFlight(f),age=quality(f).age;content=`<dl class="fact-list">${row('Indicated airspeed',f.indicatedAirspeed==null?'Not reported':fmt(f.indicatedAirspeed,'speed')+' '+unit('speed'))}${row('True airspeed',f.trueAirspeed==null?'Not reported':fmt(f.trueAirspeed,'speed')+' '+unit('speed'))}${row('Mach',f.mach==null?'Not reported':f.mach.toFixed(3))}${row('GPS altitude',f.geometricAltitude==null?'Not reported':fmt(f.geometricAltitude,'alt')+' '+unit('alt'))}${row('Height above sea level',msl.metres===null?'Unknown':fmt(msl.metres/FT,'alt')+' '+unit('alt')+' ('+msl.basis+')')}${row('Autopilot altitude',f.navAltitude==null?'Not reported':fmt(f.navAltitude,'alt')+' '+unit('alt'))}${row('Autopilot heading',f.navHeading==null?'Not reported':Math.round(f.navHeading)+'°')}${row('QNH',f.navQnh==null?'Not reported':f.navQnh.toFixed(1)+' hPa')}${row('Wind',f.windDirection==null||f.windSpeed==null?'Not reported':`${Math.round(f.windDirection)}° at ${fmt(f.windSpeed,'speed')} ${unit('speed')}`)}${row('Outside air',f.outsideTemp==null?'Not reported':f.outsideTemp+' °C')}${row('Heading',f.trueHeading==null?'Not reported':Math.round(f.trueHeading)+'°')}${row('Roll',f.roll==null?'Not reported':f.roll.toFixed(1)+'°')}${row('Squawk',f.squawk?(f.squawk+(f.emergency?' · '+f.emergency:'')):'Not reported')}${row('Position',dp.lat.toFixed(4)+', '+dp.lon.toFixed(4))}${row('Accuracy',nacpText(f.nacp))}${row('Source',f.source+' · '+(f.providers||[f.provider]).filter(Boolean).join(', '))}${row('Last report',age.toFixed(1)+' s ago')}</dl>${`<button class="secondary wide" style="margin-top:16px" data-action="export">${icon('download')} Export track (CSV)</button>`}`;}
 const status=f.emergency?f.emergency.toUpperCase():quality(f).status==='Recent'?'LIVE':quality(f).status.toUpperCase();
 const sub=[isAirlineFlight&&flightNumber(cs)?cs:null,airlineName(f)||f.registration].filter(Boolean).join(' · ');
 d.innerHTML=`<div class="detail-inner"><div class="detail-caption"><span class="tag ${f.emergency?'alert':''}">${e(status)}</span><span class="caption-age" id="detail-data-status">${e(ago(quality(f).age))}</span><button class="iconbutton" data-action="deselect" aria-label="Close flight">${icon('close')}</button></div>
<div class="airline-row"><span class="airline-monogram">${e((airlineFor(cs)?.iata||cs).slice(0,2))}</span><div class="flight-heading"><h2>${e(titleOf(f))}</h2><p>${e(sub||'Unknown operator')}</p></div></div>
${`<div class="action-row"><button class="secondary ${(isAirlineFlight?savedFlight:savedAircraft)?'on':''}" data-action="save-flight" aria-pressed="${Boolean(isAirlineFlight?savedFlight:savedAircraft)}">${icon('star')}${(isAirlineFlight?savedFlight:savedAircraft)?'Saved':'Save'}</button>${isAirlineFlight?`<button class="secondary ${savedFlight&&savedFlight.alerts!=='off'?'on':''}" data-action="notify-flight">${icon('bell')}Alerts</button><button class="secondary" data-action="add-to-trip">${icon('trip')}Trip</button>`:''}</div>`}
<div class="route-card">${routeHTML(f)}<div class="route-status"><span class="phase"><span class="dot"></span><span id="flight-phase">${phase(f)}</span></span></div></div>
<button class="view-card" data-action="3d" aria-label="View ${e(titleOf(f))} in 3D"><span class="view-label"><strong>View in 3D</strong><small>Follow, orbit or cockpit</small></span>${planeSVG}<span class="view-arrow">${icon('arrow')}</span></button>
<div class="detail-tabs" role="tablist">${['overview','aircraft','telemetry'].map(x=>`<button role="tab" aria-selected="${state.tab===x}" class="${state.tab===x?'active':''}" data-tab="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div role="tabpanel">${content}</div></div>`;
 $('#mobile-flight-name').textContent=titleOf(f);$('#scene-callsign').textContent=titleOf(f)+' · '+spec.name;
}
function exploreHTML(){
 const flying=collection.data.flights.map(item=>({item,f:currentFlights().find(x=>(x.flight||x.callsign)===item.callsign)})).filter(x=>(x.f&&!x.f.onGround)||(!x.f&&collection.data.watch[x.item.callsign]?.status==='airborne'));
 return `<div class="detail-inner">${panelHead('Find a flight')}<p class="lead">Search for a flight number, airline, aircraft type, registration or airport. Or tap a plane on the map.</p><div class="examples">${['SQ 22','Lufthansa','A380','9V-SMU','Changi'].map(x=>`<button class="chip" data-example="${e(x)}">${e(x)}</button>`).join('')}</div>${flying.length?`<div class="section-sub">YOUR FLIGHTS IN THE AIR</div>${flying.map(({item,f})=>f?flightRow(f):`<button class="flight-list-item" data-saved-flight="${e(item.callsign)}"><span class="airline-monogram">${e(item.label.slice(0,2))}</span><span><strong>${e(item.label)}</strong><small>${e(savedFlightStatus(item))}</small></span>${icon('arrow')}</button>`).join('')}`:''}${liveProblem()?`<div class="notice"><strong>${e(liveProblem().title)}</strong><br>${e(liveProblem().short)}<br><button class="small-link" data-action="connect">Sources →</button></div>`:''}</div>`;
}
function savedHTML(){
 const c=collection.data;
 const flights=c.flights.map(x=>`<div class="saved-row"><button class="saved-main" data-saved-flight="${e(x.callsign)}"><strong>${e(x.label)}</strong><small>${e([x.airline,savedFlightStatus(x)].filter(Boolean).join(' · '))}</small>${x.alerts!=='off'?`<small class="mode">${e(alertModeText(x.alerts))}</small>`:''}</button><button class="iconbutton bell ${x.alerts!=='off'?'on':''}" data-bell="${e(x.callsign)}" aria-label="Alerts for ${e(x.label)}" title="Alerts">${icon('bell')}</button><button class="iconbutton" data-remove-flight="${e(x.callsign)}" aria-label="Remove ${e(x.label)}" title="Remove">${icon('close')}</button></div>`).join('');
 const aircraft=c.aircraft.map(x=>{const f=currentFlights().find(y=>y.id===x.hex);return `<div class="saved-row"><button class="saved-main" data-saved-aircraft="${e(x.hex)}"><strong>${e(x.label)}</strong><small>${e([x.type&&typeFor(x.type).spec.name,f?(f.onGround?'On the ground':'In the air as '+titleOf(f)):null].filter(Boolean).join(' · ')||'Aircraft')}</small></button><button class="iconbutton" data-remove-aircraft="${e(x.hex)}" aria-label="Remove ${e(x.label)}" title="Remove">${icon('close')}</button></div>`;}).join('');
 const airports=c.airports.map(x=>`<div class="saved-row"><button class="saved-main" data-airport="${e(x.iata||x.icao)}"><strong>${e(x.iata||x.icao)} · ${e(x.name)}</strong><small>${e(x.city)}</small></button><button class="iconbutton" data-remove-airport="${e(x.icao)}" aria-label="Remove ${e(x.name)}" title="Remove">${icon('close')}</button></div>`).join('');
 return `<div class="detail-inner">${panelHead('Saved')}${!collection.count?`<p class="lead">Nothing saved yet. Tap the star on a flight, aircraft or airport to keep it here.</p>`:''}${flights?`<div class="section-sub">FLIGHTS</div>${flights}`:''}${aircraft?`<div class="section-sub">AIRCRAFT</div>${aircraft}`:''}${airports?`<div class="section-sub">AIRPORTS</div>${airports}`:''}${c.flights.length?`<p class="fact-note">${alertsNote()}</p>`:''}</div>`;
}
function runwayPlan(a){
 const rw=a.runways.filter(r=>r.ends&&r.ends.flat().every(Number.isFinite));if(!rw.length)return '';
 const k=Math.cos(a.lat*Math.PI/180),xy=([la,lo])=>[(lo-a.lon)*k,-(la-a.lat)];const pts=rw.flatMap(r=>r.ends.map(xy)),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max((maxX-minX)/2.2,(maxY-minY),.004);
 const sc=110/span,cx=(minX+maxX)/2,cy=(minY+maxY)/2,P=p=>{const [x,y]=xy(p);return [150+(x-cx)*sc,67+(y-cy)*sc];},mpp=span*111320/110;
 return `<div class="airport-plan"><svg viewBox="0 0 300 135" role="img" aria-label="Runways to scale">${rw.map(r=>{const [x1,y1]=P(r.ends[0]),[x2,y2]=P(r.ends[1]);return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#70897e" stroke-width="${Math.max(2.5,(r.width||45)/mpp).toFixed(1)}"/>`;}).join('')}</svg><span>RUNWAYS TO SCALE · NORTH UP</span></div>`;
}
function airportTraffic(a){return currentFlights().map(f=>({f,d:distance([a.lat,a.lon],[displayFlight(f).lat,displayFlight(f).lon])})).filter(({f,d})=>d<30000&&(f.onGround||(f.altitude??99999)<10000)).sort((x,y)=>x.d-y.d).slice(0,12).map(({f,d})=>flightRow(f,(f.onGround?'On ground':f.verticalRate<-300?'Arriving':f.verticalRate>300?'Departing':'Nearby')+` · ${(d/1000).toFixed(1)} km`)).join('');}
function airportsHTML(){const near=nearestAirports(state.center.lat,state.center.lng,14,'LM');const saved=collection.data.airports;return `<div class="detail-inner">${panelHead('Airports')}<p class="lead">Nearest to the centre of the map. Search for any airport by name, city or code.</p>${saved.length?`<div class="section-sub">SAVED</div><div class="airport-list">${saved.map(a=>`<button class="airport-card" data-airport="${e(a.iata||a.icao)}"><span class="airport-code">${e(a.iata||a.icao)}</span><span><strong>${e(a.name)}</strong><small>${e(a.city)}</small></span>${icon('arrow')}</button>`).join('')}</div><div class="section-sub">NEARBY</div>`:''}<div class="airport-list">${near.map(a=>`<button class="airport-card" data-airport="${e(a.id)}"><span class="airport-code">${e(a.iata||a.icao)}</span><span><strong>${e(a.name)}</strong><small>${e(a.city||a.country)} · ${Math.round(a.distanceKm)} km</small></span>${icon('arrow')}</button>`).join('')}</div></div>`;}
function airportHTML(a){const lt=localTime(a),traffic=airportTraffic(a),saved=collection.airport(a.icao);
 return `<div class="detail-inner"><div class="detail-caption"><button data-action="airports">${icon('back')} AIRPORTS</button><span>${e(a.icao)}</span></div><div class="airline-row"><div class="flight-heading"><h2>${e(a.name)}</h2><p>${e([a.city,a.country].filter(Boolean).join(' · '))} · ${e(a.iata||a.icao)}</p></div></div><div class="action-row"><button class="secondary ${saved?'on':''}" data-action="save-airport" aria-pressed="${Boolean(saved)}">${icon('star')}${saved?'Saved':'Save'}</button></div>${runwayPlan(a)}<div class="section-sub">TRAFFIC NOW · WITHIN 30 KM</div>${traffic||`<p class="fact-note">${canLive()?'No aircraft below 10,000 ft near this airport right now.':e(liveProblem().short)}</p>`}<dl class="fact-list">${row('ICAO / IATA',a.icao+' / '+(a.iata||'—'))}${row('Elevation',a.elevation==null?'Unknown':fmt(a.elevation,'alt')+' '+unit('alt'))}${row('Local time',lt?lt+' · '+a.tz:'Unknown')}</dl><div class="section-sub">RUNWAYS</div><dl class="fact-list">${a.runways.length?a.runways.map(r=>row(r.ident,r.length.toLocaleString('en-SG')+(r.width?' × '+r.width:'')+' m'+(r.surface?' · '+r.surface:''))).join(''):row('Runways','Not listed')}</dl>${a.website?`<a class="secondary wide" style="display:block;text-align:center;text-decoration:none;margin-top:18px" href="${e(a.website)}" target="_blank" rel="noreferrer">Airport website ↗</a>`:''}</div>`;}
/** Why live data is not reaching this screen, or null. Shown once as an alert, then quietly in Explore. */
function liveProblem(){
 if(!canLive())return {kind:'no-relay',title:'Live data is not available here',short:'This web page has no relay to the live flight feeds.',
  body:'Web pages are not allowed to read the live flight feeds directly, and this copy of Aeris has no relay set up. The Aeris app for iPhone and Android, and the web app at shira421.github.io/aeris, show live flights.'};
 const s=live.status();
 if(s.live||!live.running)return null;
 const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
 const failing=s.providers.filter(p=>p.enabled&&p.reachable).every(p=>p.fail>0&&p.state!=='ok');
 if(!offline&&!(failing&&now()-startedAt>15))return null;
 return {kind:offline?'offline':'unreachable',title:offline?'You are offline':'Live data cannot be reached',short:offline?'Aeris will update as soon as you are back online.':'Aeris keeps trying and will update by itself.',
  body:offline?'Live flights need an internet connection. Aeris will update by itself as soon as you are back online.':'The live flight sources are not answering right now. Planes on the map fade when their data is old, and disappear after a minute. Aeris keeps trying and will update by itself.'};
}
let problemShown=false,problemNow=null;const startedAt=now();
/** Keeps the inline status line in step, and alerts the first time live data is unavailable. */
function renderSource(){
 const p=liveProblem(),kind=p?.kind||null;
 if(kind===problemNow)return;problemNow=kind;
 $('#feed-error').textContent=p&&p.kind!=='no-relay'?`${p.title}. ${p.short}`:'';
 if(p&&!problemShown){problemShown=true;try{if(sessionStorage.getItem('aeris-problem-'+p.kind))return;sessionStorage.setItem('aeris-problem-'+p.kind,'1');}catch{}
  const show=()=>{if($('#dialog').open){setTimeout(show,1500);return;}openDialog(p.title,`<p>${e(p.body)}</p><div class="button-row"><button class="primary" data-action="close-dialog">OK</button><button class="secondary" data-action="connect">Sources</button></div>`);};show();}
 if(!p&&state.nav==='explore'&&!state.selected)renderDetail();
}
function refresh(){renderNav();renderDetail();renderSource();pushMap(true);}

// ——— Trips and history ———
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate=d=>{const [y,m,day]=d.split('-').map(Number);return `${day} ${MONTHS[m-1]} ${y}`;};
const today=()=>localDate(now());
const km=n=>Math.round(n).toLocaleString('en-SG');
function alertsNote(){return 'Alerts come once per flight: take-off, descent into the destination, landing, and emergency codes. '+(backgroundChecks()?'Aeris checks every minute while open. When it is closed, your phone lets it check every 15 minutes or so, sometimes less often.':'They arrive while Aeris is open. Install the app to get them when it is closed.');}
function dateRange(t){const ds=t.flights.map(x=>x.date).sort();if(!ds.length)return 'No flights yet';const a=fmtDate(ds[0]),b=fmtDate(ds.at(-1));return a===b?a:`${a.replace(/ \d{4}$/,ds[0].slice(0,4)===ds.at(-1).slice(0,4)?'':' '+ds[0].slice(0,4))} – ${b}`;}
function routeCodes(list){const codes=[];for(const x of list){if(x.from&&codes.at(-1)!==x.from.code)codes.push(x.from.code);if(x.to)codes.push(x.to.code);}return codes.join(' → ');}
const lineKm=x=>x.from&&x.to?distance([x.from.lat,x.from.lon],[x.to.lat,x.to.lon])/1000:0;
function historyFor(cs,date){return collection.data.history.find(h=>h.callsign===cs&&Math.abs(daysBetween(h.date,date))<=1)||null;}
/** A trip flight's status, from what was seen. cls: live | done | '' */
function tripFlightStatus(x){
 const diff=daysBetween(today(),x.date),h=historyFor(x.callsign,x.date);
 if(h)return {text:h.landedAt?`Flown · landed ${new Date(h.landedAt*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',...(h.to?.tz?{timeZone:h.to.tz}:{})})}`:'Flown',cls:'done'};
 if(Math.abs(diff)<=1){
  const f=currentFlights().find(y=>(y.flight||y.callsign)===x.callsign),w=collection.data.watch[x.callsign];
  if(f&&!f.onGround)return {text:`In the air · ${fmt(f.altitude,'alt')} ${unit('alt')}`,cls:'live'};
  if(w?.leg?.landed&&Math.abs(daysBetween(localDate(w.leg.start),x.date))<=1)return {text:`Landed at ${w.leg.at?.code||''}`,cls:'done'};
  if(w?.status==='airborne'&&now()-w.seen<900)return {text:`In the air · ${fmt(w.alt,'alt')} ${unit('alt')}`,cls:'live'};
  return {text:diff===0?'Today':diff===1?'Tomorrow':'Yesterday',cls:''};
 }
 return diff>1?{text:`In ${diff} days`,cls:''}:{text:'Not flown with Aeris watching',cls:'done'};
}
function tripCard(t){
 const next=t.flights.find(x=>daysBetween(today(),x.date)>=-1);
 return `<button class="trip-card" data-open-trip="${e(t.id)}"><span class="trip-card-main"><strong>${e(t.name)}</strong><small>${e(dateRange(t))}</small><small>${t.flights.length} flight${t.flights.length===1?'':'s'}${t.flights.length?' · '+e(routeCodes(t.flights)):''}</small></span><span class="trip-card-end">${next?e(tripFlightStatus(next).text):t.flights.length?'Done':''}</span>${icon('arrow')}</button>`;
}
function historyIn(range){
 const list=collection.data.history;if(range==='all')return list;
 if(range==='year'){const from=localDate(now()-365*86400);return list.filter(h=>h.date>=from);}
 return list.filter(h=>h.date.startsWith(range));
}
function historyStats(list){
 const airports=new Set(),airlines=new Set();let dist=0,air=0,timed=0;
 for(const h of list){if(h.from)airports.add(h.from.code);if(h.to)airports.add(h.to.code);if(h.airline)airlines.add(h.airline);dist+=h.distanceKm||0;if(h.takeoffAt&&h.landedAt){air+=h.landedAt-h.takeoffAt;timed++;}}
 return {count:list.length,km:dist,airports:airports.size,airlines:airlines.size,air,timed};
}
function tripsHTML(){
 const h=historyStats(historyIn('year')),trips=collection.data.trips;
 return `<div class="detail-inner">${panelHead('Trips')}
<button class="history-card" data-action="history"><span class="history-icon">${icon('globe')}</span><span class="history-text"><strong>Flight history</strong><small>${h.count?`${h.count} flight${h.count===1?'':'s'} · ${km(h.km)} km in the past year`:'Your flights, logged as you fly them'}</small></span>${icon('arrow')}</button>
<div class="section-head"><span>YOUR TRIPS</span><button class="small-button" data-action="new-trip">${icon('plus')}New trip</button></div>
${trips.length?`<div class="trip-list">${trips.map(tripCard).join('')}</div>`:`<p class="lead">A trip is a set of flights with dates: a holiday, a work trip, or someone coming home. Open it to see its route, and only its planes, on the map.</p>`}</div>`;
}
function tripHTML(t){
 const total=t.flights.reduce((a,x)=>a+lineKm(x),0);
 const rows=t.flights.map(x=>{const st=tripFlightStatus(x),[y,m,d]=x.date.split('-');return `<div class="trip-flight"><button class="trip-flight-main" data-trip-flight="${e(x.id)}"><span class="date-tile"><b>${Number(d)}</b><small>${MONTHS[Number(m)-1]}</small></span><span class="trip-flight-text"><strong>${e(x.label)}${x.from&&x.to?` <span class="codes">${e(x.from.code)} → ${e(x.to.code)}</span>`:''}</strong><small>${e(x.airline||'')}</small><span class="status-line ${st.cls}">${e(st.text)}</span></span></button><button class="iconbutton" data-remove-trip-flight="${e(x.id)}" aria-label="Remove ${e(x.label)}" title="Remove">${icon('close')}</button></div>`;}).join('');
 return `<div class="detail-inner"><div class="detail-caption"><button data-action="trips-list">${icon('back')} TRIPS</button><button class="iconbutton" data-action="edit-trip" aria-label="Rename or delete this trip" title="Rename or delete">${icon('edit')}</button>${closeButton}</div>
<h2>${e(t.name)}</h2><p class="sub">${e(dateRange(t))}${t.flights.length?` · ${t.flights.length} flight${t.flights.length===1?'':'s'}${total?` · ${km(total)} km`:''}`:''}</p>
${rows?`<div class="trip-flights">${rows}</div>`:`<p class="lead">No flights yet. Add each flight with its date.</p>`}
<button class="secondary wide" data-action="add-trip-flight">${icon('plus')}Add a flight</button>
<div class="settings-group"><label class="switch-row"><span>Alerts for these flights<small>On the day of each flight</small></span><input type="checkbox" data-trip-setting="alerts" ${t.alerts?'checked':''}></label><label class="switch-row"><span>These are my flights<small>Add them to my flight history once flown</small></span><input type="checkbox" data-trip-setting="mine" ${t.mine?'checked':''}></label></div></div>`;
}
function historyHTML(){
 const years=[...new Set(collection.data.history.map(h=>h.date.slice(0,4)))].sort().reverse();
 const list=historyIn(state.historyRange),st=historyStats(list);
 const groups=new Map();for(const h of list){const k=h.date.slice(0,7);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(h);}
 const rows=[...groups].map(([k,hs])=>{const [y,m]=k.split('-');return `<div class="section-sub">${MONTHS[Number(m)-1].toUpperCase()} ${y}</div>${hs.map(h=>{const [,,d]=h.date.split('-');const dur=h.takeoffAt&&h.landedAt?duration(Math.round((h.landedAt-h.takeoffAt)/60)):null;
  return `<div class="trip-flight"><div class="trip-flight-main static"><span class="date-tile"><b>${Number(d)}</b><small>${MONTHS[Number(m)-1]}</small></span><span class="trip-flight-text"><strong>${e(h.label)}${h.from&&h.to?` <span class="codes">${e(h.from.code)} → ${e(h.to.code)}</span>`:''}</strong><small>${e([h.airline,h.distanceKm?km(h.distanceKm)+' km':null,dur].filter(Boolean).join(' · '))}</small><span class="status-line">${h.source==='tracked'?'Seen by Aeris':'Added by you'}</span></span></div><button class="iconbutton" data-remove-history="${e(h.id)}" aria-label="Remove ${e(h.label)} on ${e(fmtDate(h.date))}" title="Remove">${icon('close')}</button></div>`;}).join('')}`;}).join('');
 return `<div class="detail-inner"><div class="detail-caption"><button data-action="trips-list">${icon('back')} TRIPS</button>${closeButton}</div><h2>Flight history</h2>
<div class="segmented" role="tablist">${[['year','Past year'],...years.slice(0,3).map(y=>[y,y]),['all','All']].map(([k,l])=>`<button role="tab" aria-selected="${state.historyRange===k}" class="${state.historyRange===k?'active':''}" data-history-range="${k}">${l}</button>`).join('')}</div>
<div class="stat-grid"><div><b>${st.count}</b><small>Flights</small></div><div><b>${km(st.km)}</b><small>Kilometres</small></div><div><b>${st.airports}</b><small>Airports</small></div><div><b>${st.airlines}</b><small>Airlines</small></div></div>
${st.timed?`<p class="fact-note">Time in the air: ${duration(Math.round(st.air/60))}, from the ${st.timed} flight${st.timed===1?'':'s'} Aeris saw take off and land.</p>`:''}
<button class="secondary wide" data-action="add-past-flight">${icon('plus')}Add a past flight</button>
${rows||`<p class="lead">Flights in trips marked “These are my flights” are added here after Aeris sees them land. You can also add past flights yourself.</p>`}</div>`;
}
/** Map for the open trip or the history: their routes, and only the trip's own planes. */
function updatePlan(fit=true){
 let lines=[],filter=null;
 if(state.nav==='trips'&&state.tripView==='trip'){const t=collection.trip(state.trip);if(t){
  lines=t.flights.filter(x=>x.from&&x.to).map(x=>({from:x.from,to:x.to,state:tripFlightStatus(x).cls==='live'?'live':tripFlightStatus(x).cls==='done'?'done':'next'}));
  filter=new Set(t.flights.filter(x=>Math.abs(daysBetween(today(),x.date))<=1).map(x=>x.callsign));}}
 else if(state.nav==='trips'&&state.tripView==='history'){lines=historyIn(state.historyRange).filter(h=>h.from&&h.to).map(h=>({from:h.from,to:h.to,state:'done'}));filter=new Set();}
 map.setPlan(lines.length?{lines}:null);state.mapFilter=filter;
 live.setTracked(filter?currentFlights().filter(f=>filter.has(f.flight||f.callsign)).map(f=>f.id):[]);
 if(fit&&lines.length)map.fitPlan(innerWidth<=800?40:70);
 pushMap(true);
}
function leavePlan(){state.mapFilter=null;map.setPlan(null);live.setTracked([]);}
async function openTrip(id){
 state.nav='trips';state.tripView='trip';state.trip=id;if(state.selected)deselect();renderNav();renderDetail();updatePlan(true);
 if(innerWidth<=800)$('.workspace').classList.add('detail-open');
 // Today's flights of the trip, wherever they are.
 const t=collection.trip(id);if(!canLive()||!t)return;
 for(const x of t.flights.filter(x=>Math.abs(daysBetween(today(),x.date))<=1)){
  try{const f=(await live.query('callsign',x.callsign)).find(f=>f.lat!=null);if(f&&!live.get(f.id))live.add(f);}catch{}
 }
 if(state.trip===id&&state.tripView==='trip'){updatePlan(false);renderDetail();}
}
// ——— Forms: a flight with a date (for a trip or the history) ———
function flightFormHTML({title,date,max=null,submit,note=''}){
 return `<form class="flight-form" data-form="flight" novalidate><label class="form-field">Flight number<input id="ff-flight" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SQ 22" required></label>
<label class="form-field">Date<input id="ff-date" type="date" value="${e(date)}"${max?` max="${e(max)}"`:''} required></label>
<div class="form-row"><label class="form-field">From<input id="ff-from" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SIN"></label><label class="form-field">To<input id="ff-to" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="EWR"></label></div>
<p class="form-hint" id="ff-hint">${e(note||'Enter the flight number. Aeris fills in the usual route; change it if yours was different.')}</p><div class="form-error" id="ff-error"></div>
<div class="button-row"><button class="primary" type="submit">${e(submit)}</button><button class="secondary" type="button" data-action="close-dialog">Cancel</button></div></form>`;
}
let lookupTimer,lookupSeq=0;
function lookupFormRoute(){
 clearTimeout(lookupTimer);const v=$('#ff-flight')?.value||'';const cs=directLookups(v).find(l=>l.kind==='callsign')?.value;
 if(!cs){$('#ff-hint').textContent=v.trim().length>2?'Use an airline flight number, like SQ 22 or BA 15.':'Enter the flight number. Aeris fills in the usual route; change it if yours was different.';return;}
 const seq=++lookupSeq;$('#ff-hint').textContent='Looking up the route…';
 lookupTimer=setTimeout(async()=>{const r=await routeFor(cs).catch(()=>null);if(seq!==lookupSeq||!$('#ff-hint'))return;
  if(r){const o=r.origin.iata||r.origin.icao,d=r.destination.iata||r.destination.icao;if(!$('#ff-from').value||$('#ff-from').dataset.auto)Object.assign($('#ff-from'),{value:o}).dataset.auto='1';if(!$('#ff-to').value||$('#ff-to').dataset.auto)Object.assign($('#ff-to'),{value:d}).dataset.auto='1';
   $('#ff-hint').textContent=`${flightNumber(cs)||cs} usually flies ${o} → ${d} (${r.source}). Change it if yours was different.`;}
  else $('#ff-hint').textContent='No route on record for this flight. Enter the airports yourself.';},350);
}
function readFlightForm(){
 const err=m=>{$('#ff-error').textContent=m;return null;};
 const cs=directLookups($('#ff-flight').value).find(l=>l.kind==='callsign')?.value;if(!cs)return err('Enter an airline flight number, like SQ 22.');
 const date=$('#ff-date').value;if(!/^\d{4}-\d\d-\d\d$/.test(date))return err('Choose a date.');
 const code=id=>$(id).value.trim().toUpperCase();const from=code('#ff-from')?airportByCode(code('#ff-from')):null,to=code('#ff-to')?airportByCode(code('#ff-to')):null;
 if(code('#ff-from')&&!from)return err(`No airport with the code ${code('#ff-from')}.`);if(code('#ff-to')&&!to)return err(`No airport with the code ${code('#ff-to')}.`);
 return {callsign:cs,date,from,to};
}
function showTripFlightForm(){const t=collection.trip(state.trip);if(!t)return;state.form={kind:'trip',trip:t.id};const last=t.flights.at(-1)?.date;openDialog('Add a flight',flightFormHTML({title:'',date:last&&last>today()?last:today(),submit:'Add to trip'}));}
function showPastFlightForm(){state.form={kind:'history'};openDialog('Add a past flight',flightFormHTML({title:'',date:today(),max:today(),submit:'Add to history',note:'Enter the flight number and the date you flew. Aeris fills in the usual route; change it if yours was different.'}));}
function showNewTrip(after=null){state.form={kind:'new-trip',after};openDialog('New trip',`<form data-form="trip" novalidate><label class="form-field">Name<input id="trip-name" maxlength="60" placeholder="Tokyo, December" required></label><div class="form-error" id="trip-error"></div><div class="button-row"><button class="primary" type="submit">Create</button><button class="secondary" type="button" data-action="close-dialog">Cancel</button></div></form>`);}
function showEditTrip(){const t=collection.trip(state.trip);if(!t)return;state.form={kind:'edit-trip'};openDialog('Trip',`<form data-form="trip" novalidate><label class="form-field">Name<input id="trip-name" maxlength="60" value="${e(t.name)}" required></label><div class="form-error" id="trip-error"></div><div class="button-row"><button class="primary" type="submit">Save</button><button class="secondary danger" type="button" data-action="delete-trip">${icon('trash')}Delete trip</button></div></form>`);}
function showAddToTrip(){
 const f=selected();if(!f)return;const cs=f.flight||f.callsign;state.form={kind:'add-to-trip',callsign:cs};
 const trips=collection.data.trips;
 openDialog(`Add ${titleOf(f)} to a trip`,`<form data-form="add-to-trip" novalidate><label class="form-field">Date<input id="att-date" type="date" value="${e(today())}" required></label>
${trips.length?`<div class="choice-list" role="radiogroup">${trips.map((t,i)=>`<label class="choice"><input type="radio" name="att-trip" value="${e(t.id)}" ${i===0?'checked':''}><span><b>${e(t.name)}</b><small>${e(dateRange(t))}</small></span></label>`).join('')}<label class="choice"><input type="radio" name="att-trip" value="new"><span><b>New trip</b></span></label></div>`:'<input type="hidden" name="att-trip" value="new">'}
<label class="form-field" id="att-new"${trips.length?' hidden':''}>New trip name<input id="att-name" maxlength="60" placeholder="Tokyo, December"></label><div class="form-error" id="att-error"></div>
<div class="button-row"><button class="primary" type="submit">Add</button><button class="secondary" type="button" data-action="close-dialog">Cancel</button></div></form>`);
}
function submitForm(form){
 const k=state.form?.kind;
 if(form.dataset.form==='flight'){
  const v=readFlightForm();if(!v)return;
  if(k==='trip'){const x=collection.addTripFlight(state.form.trip,v);if(!x){$('#ff-error').textContent='This flight is already in the trip.';return;}closeDialog();toast(`${x.label} on ${fmtDate(x.date)} added.`);renderDetail();updatePlan(true);syncWatch();}
  else if(k==='history'){if(v.date>today()){$('#ff-error').textContent='That date has not happened yet. Add future flights to a trip.';return;}if(!v.from||!v.to){$('#ff-error').textContent='Enter both airports so the distance can be worked out.';return;}
   const h=collection.addHistory({...v,source:'added'});if(!h){$('#ff-error').textContent='This flight is already in your history.';return;}closeDialog();toast(`${h.label} on ${fmtDate(h.date)} added to your history.`);renderDetail();updatePlan(true);}
 }else if(form.dataset.form==='trip'){
  const name=$('#trip-name').value.trim();if(!name){$('#trip-error').textContent='Give the trip a name.';return;}
  if(k==='edit-trip'){collection.updateTrip(state.trip,{name});closeDialog();renderDetail();renderNav();}
  else{const t=collection.addTrip(name);closeDialog();openTrip(t.id);}
 }else if(form.dataset.form==='add-to-trip'){
  const date=$('#att-date').value,choice=form.querySelector('[name="att-trip"]:checked')?.value||form.querySelector('[name="att-trip"]')?.value;
  if(!/^\d{4}-\d\d-\d\d$/.test(date)){$('#att-error').textContent='Choose a date.';return;}
  let tripId=choice;if(choice==='new'){const name=$('#att-name').value.trim();if(!name){$('#att-error').textContent='Give the new trip a name.';return;}tripId=collection.addTrip(name).id;}
  const r=state.info.route,f=selected(),fit=f&&r?routeCheck(f):null;
  const x=collection.addTripFlight(tripId,{callsign:state.form.callsign,date,from:fit?.plausible?airportByCode(r.origin.icao||r.origin.iata)||r.origin:null,to:fit?.plausible?airportByCode(r.destination.icao||r.destination.iata)||r.destination:null});
  closeDialog();toast(x?`${x.label} added to ${collection.trip(tripId).name}.`:'Could not add this flight.');syncWatch();
 }
}
// ——— Alerts ———
function showAlerts(cs,f=null){
 const item=collection.flight(cs),mode=item?.alerts||'off',label=item?.label||flightNumber(cs)||cs;state.form={kind:'alerts',callsign:cs,flight:f};
 openDialog(`Alerts for ${label}`,`<div class="choice-list" role="radiogroup" aria-label="When to send alerts">${[['off','Off',''],['next','Next flight','Stops after it lands'],['every','Every flight','For a flight someone takes regularly']].map(([k,l,n])=>`<button class="choice ${mode===k?'active':''}" role="radio" aria-checked="${mode===k}" data-alert-mode="${k}"><span class="radio-mark"></span><span><b>${l}</b>${n?`<small>${n}</small>`:''}</span></button>`).join('')}</div><p class="fact-note">${e(alertsNote())}</p>`);
}
async function setAlertMode(cs,mode,f=null){
 if(mode!=='off'){
  let perm;try{perm=await notificationPermission(true);}catch{perm='unsupported';}
  if(perm!=='granted'){toast(perm==='unsupported'?'This browser cannot show notifications. Use the Aeris app.':'Notifications are off for Aeris. Turn them on in your phone settings.');return false;}
 }
 let item=collection.flight(cs);
 if(!item){if(mode==='off'){closeDialog();return true;}item=collection.addFlight(f||{callsign:cs});if(!item)return false;}
 collection.setAlerts(cs,mode);closeDialog();
 toast(mode==='off'?`Alerts off for ${item.label}.`:mode==='next'?`Alerts on for ${item.label}'s next flight.`:`Alerts on for every ${item.label} flight.`);
 renderDetail();syncWatch();setTimeout(()=>watcher.check(),300);return true;
}

// ——— Search ———
function clearSearchText(){$('#search').value='';state.search.q='';$('.search-box').classList.remove('has-text');}
function closeSearch(){$('#search-results').classList.remove('open');$('#search').setAttribute('aria-expanded','false');state.search.results=null;}
function openResults(html){$('#search-results').innerHTML=html;$('#search-results').classList.add('open');$('#search').setAttribute('aria-expanded','true');}
const section=(title,rows)=>rows?`<div class="result-section">${title}</div>${rows}`:'';
function resultRow(f,remote=false){if(remote)picks.set(f.id,f);const a=airlineFor(f.callsign);return `<button class="result" data-pick="${e(f.id)}">${icon('plane')}<span><b>${e(titleOf(f))}</b><small>${e([a?.name||f.operator||f.registration,f.type].filter(Boolean).join(' · ')||'Aircraft')}</small></span><span class="result-right">${f.onGround?'Ground':f.altitude!=null?fmt(f.altitude,'alt')+' '+unit('alt'):''}</span></button>`;}
function renderSearch(){
 const q=state.search.q;
 if(state.search.results){const r=state.search.results;openResults(`<button class="result result-back" data-action="search-back">${icon('back')}<span><b>${e(r.title)}</b><small>${r.loading?'Searching worldwide…':`${r.flights.length} in the air${r.note?' · '+r.note:''}`}</small></span></button>${r.error?`<div class="empty">${e(r.error)}</div>`:''}${r.flights.slice(0,80).map(f=>resultRow(f,true)).join('')}${r.flights.length>80?`<div class="result-status">${r.flights.length-80} more not shown. Search for a flight number to find one.</div>`:''}${!r.loading&&!r.flights.length&&!r.error?'<div class="empty">None in the air right now.</div>':''}`);return;}
 if(!q){const recents=loadPref('recent',[]),saved=collection.data.flights.slice(0,4);
  if(!recents.length&&!saved.length){closeSearch();return;}
  openResults(section('SAVED FLIGHTS',saved.map(x=>`<button class="result" data-saved-flight="${e(x.callsign)}">${icon('star')}<span><b>${e(x.label)}</b><small>${e(savedFlightStatus(x))}</small></span></button>`).join(''))+section('RECENT',recents.map(r=>`<button class="result" data-example="${e(r)}">${icon('search')}<span><b>${e(r)}</b></span></button>`).join('')));return;}
 const local=currentFlights().filter(f=>matchesFlight(f,q)).slice(0,6);
 const remote=(state.search.remote?.q===q?state.search.remote.flights:[]).filter(f=>!local.some(l=>l.id===f.id));
 const lookups=directLookups(q),airlines=searchAirlines(q,3),types=searchTypes(q,2),airports=searchAirports(q,4);
 const loading=state.search.remote?.q===q&&state.search.remote.loading;
 const others=airlines.length+types.length+airports.length;
 const remoteError=state.search.remote?.q===q?state.search.remote.error:null;
 const notFound=!loading&&!remoteError&&state.search.remote?.q===q&&!local.length&&!remote.length&&lookups.length&&!others;
 const flights=local.map(f=>resultRow(f)).join('')+remote.map(f=>resultRow(f,true)).join('')+(loading?`<div class="result-status">Searching worldwide…</div>`:'')+(notFound?`<div class="result-status">${e(lookups[0].label)} is not in the air right now.</div>`:'')+(remoteError&&!local.length?`<div class="result-status">Worldwide search failed: ${e(remoteError)}</div>`:'');
 openResults(section('FLIGHTS',flights)+section('AIRLINES',airlines.map(a=>`<button class="result" data-airline="${a.icao}">${icon('airline')}<span><b>${e(a.name)}</b><small>${e([a.iata,a.icao,a.country].filter(Boolean).join(' · '))}</small></span><span class="result-right">Flights ›</span></button>`).join(''))+section('AIRCRAFT TYPES',types.map((t,i)=>`<button class="result" data-family="${i}">${icon('plane')}<span><b>${e(t.name)}</b><small>${e(t.codes.join(', '))}</small></span><span class="result-right">In the air ›</span></button>`).join(''))+section('AIRPORTS',airports.map(a=>`<button class="result" data-airport="${e(a.id)}">${icon('airport')}<span><b>${e(a.iata||a.icao)} · ${e(a.name)}</b><small>${e([a.city,a.country].filter(Boolean).join(', '))}</small></span></button>`).join(''))+(!flights&&!others?'<div class="empty">No matches. Try a flight number (SQ 22), an airline, a registration (9V-SMU), an aircraft type (A350) or an airport.</div>':''));
}
function onSearchInput(){
 state.search.q=$('#search').value.trim();state.search.results=null;$('.search-box').classList.toggle('has-text',Boolean(state.search.q));renderSearch();
 clearTimeout(searchTimer);const q=state.search.q,lookups=directLookups(q);
 // Anything that could name one aircraft is also looked up worldwide, unless it is already on the map.
 if(canLive()&&lookups.length&&!lookups.some(l=>currentFlights().some(f=>sameAs(f,l))))searchTimer=setTimeout(()=>remoteSearch(q,lookups,++searchSeq),300);
}
function sameAs(f,{kind,value}){return kind==='callsign'?(f.flight||f.callsign)===value:kind==='hex'?f.id===value:f.registration===value;}
async function remoteSearch(q,lookups,seq){
 state.search.remote={q,loading:true,flights:[]};renderSearch();
 const settled=await Promise.allSettled(lookups.map(l=>live.query(l.kind,l.value)));if(seq!==searchSeq)return;
 const flights=[];for(const r of settled)if(r.status==='fulfilled')for(const f of r.value)if(f.lat!=null&&!flights.some(x=>x.id===f.id))flights.push(f);
 const failed=settled.every(r=>r.status==='rejected')?settled[0].reason?.message||'The live sources did not answer.':null;
 state.search.remote={q,loading:false,flights,error:failed};if(state.search.q===q)renderSearch();
}
function remember(q){if(!q)return;const r=[q,...loadPref('recent',[]).filter(x=>x.toLowerCase()!==q.toLowerCase())].slice(0,6);savePref('recent',r);}
async function showList(title,load,localFilter){
 const seq=++searchSeq;remember(state.search.q);const local=currentFlights().filter(localFilter);
 state.search.results={title,loading:true,flights:local};renderSearch();
 let flights=local,error=null,note='';
 try{const found=await load();flights=[...local,...found.filter(f=>f.lat!=null&&!local.some(l=>l.id===f.id))];}catch(err){error=err.message+(local.length?' Showing the ones on your map.':'');}
 if(seq!==searchSeq||!state.search.results)return;
 flights.sort((a,b)=>(a.onGround-b.onGround)||titleOf(a).localeCompare(titleOf(b),'en',{numeric:true}));
 state.search.results={title,loading:false,flights,error,note};renderSearch();
}
const showAirline=icao=>{const a=searchAirlines(icao,1)[0];showList(a?.name||icao,()=>live.snapshot().then(all=>all.filter(f=>f.callsign.startsWith(icao)&&/\d/.test(f.callsign[3]))),f=>(f.flight||f.callsign).startsWith(icao)&&/\d/.test((f.flight||f.callsign)[3]||''));};
const showFamily=fam=>showList(fam.name,async()=>{const out=[];for(const r of await Promise.allSettled(fam.codes.slice(0,4).map(c=>live.query('type',c))))if(r.status==='fulfilled')out.push(...r.value);if(!out.length&&fam.codes.length>4)for(const c of fam.codes.slice(4,8))try{out.push(...await live.query('type',c));}catch{}return out;},f=>fam.codes.includes(f.type));

// ——— Dialogs ———
function openDialog(title,body){const d=$('#dialog');dialogFocus=document.activeElement;d.innerHTML=`<div class="modal-head"><h2 id="dialog-title">${e(title)}</h2><button class="iconbutton" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div><div class="modal-body">${body}</div>`;if(!d.open)d.showModal();}
function closeDialog(){if($('#dialog').open)$('#dialog').close();dialogFocus?.focus?.();}
$('#dialog').addEventListener('click',ev=>{if(ev.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closeDialog();}});
const toggleRow=(key,label,note,on)=>`<label class="switch-row"><span>${label}${note?`<small>${note}</small>`:''}</span><input type="checkbox" data-setting="${key}" ${on?'checked':''}></label>`;
function showMapOptions(){openDialog('Map',`<div class="source-buttons">${[['map','Map'],['satellite','Satellite'],['dark','Night'],['detail','Detailed']].map(([k,l])=>`<button class="${state.mapStyle===k?'active':''}" data-style="${k}">${l}</button>`).join('')}</div>${toggleRow('showGround','Aircraft on the ground','',state.showGround)}${toggleRow('altitudeColors','Colour by altitude','',map.altitudeColors)}${toggleRow('labels','Labels','Flight numbers and airport codes',map.labels)}${toggleRow('airports','Airports','',map.airports)}${toggleRow('trails','Flight trail','',map.trails)}${toggleRow('globe','Globe','Uses more battery',state.projection==='globe')}<div class="button-row"><button class="primary" data-action="close-dialog">Done</button><button class="secondary" data-action="settings">Settings</button></div>`);}
async function showSettings(){const perm=await notificationPermission(false);openDialog('Settings',`<label class="form-field">Units<select id="units"><option value="aviation" ${state.units==='aviation'?'selected':''}>Feet, knots</option><option value="metric" ${state.units==='metric'?'selected':''}>Metres, km/h</option></select></label>${toggleRow('location','Show my location','A blue dot on the map',loadPref('location',false))}<div class="switch-row"><span>Notifications<small>${perm==='granted'?'Allowed':perm==='denied'?'Blocked. Turn them on in your device settings.':perm==='unsupported'?'Not available in this browser. Use the Aeris app.':'Not asked yet'}</small></span>${perm==='default'?'<button class="secondary" data-action="ask-notifications">Allow</button>':''}</div><div class="button-row"><button class="secondary" data-action="connect">Data sources</button><button class="secondary" data-action="about">About the data</button></div><div class="button-row"><button class="primary wide" data-action="save-settings">Save</button></div>`);}
function environmentText(){const b=bridge();if(b)return `The ${b==='ios'?'iPhone and iPad':'Android'} app reads the live feeds directly.`;if(getProxy())return `This web app reads the live feeds through the Aeris relay (${new URL(getProxy()).host}).`;return liveProblem().body;}
function showConnect(){
 const s=live.status(),p=liveProblem();
 const head=p?`<div class="notice"><strong>${e(p.title)}</strong><br>${e(p.short)}</div>`:s.live?`<p class="status-now"><span class="live-dot"></span>Live · updated ${e(ago(Math.max(0,now()-(s.lastUpdate||now()))))} · ${s.aircraft} aircraft in view</p>`:'<p class="status-now">Connecting…</p>';
 const rows=s.providers.map(p=>{const def=PROVIDERS.find(x=>x.id===p.id);const st=!p.reachable?'Not available here':p.state==='ok'?`${p.ms} ms · ${p.aircraft} aircraft · ${ago(now()-p.lastOk)}`:p.state==='idle'?'Standby':p.state==='limited'?'Busy, pausing for a moment':p.state==='refused'?'Refuses this network':p.state==='blocked'?'Blocked by the browser':p.error||'Error';
  return `<label class="switch-row"><span>${e(def.name)}<small>${e(st)}${p.credits!=null?' · '+p.credits+' credits left today':''}</small></span><input type="checkbox" data-provider="${p.id}" ${p.enabled?'checked':''}></label>`;}).join('');
 const relay=bridge()?'':`<details class="advanced"${canLive()?'':' open'}><summary>Relay for self-hosted copies</summary><label class="form-field">Relay URL<input id="proxy" type="url" value="${e(loadPref('proxy','')||'')}" placeholder="https://aeris-proxy.example.workers.dev/" spellcheck="false"></label><div class="form-error" id="connection-error"></div><div class="button-row"><button class="primary" data-action="save-proxy">Save</button></div></details>`;
 openDialog('Sources',`${head}<p>${e(environmentText())}</p>${rows}${relay}<div class="button-row"><button class="secondary" data-action="about">About the data</button></div>`);
}
function showAbout(){openDialog('About the data',`<p><strong>Positions</strong> come from community receiver networks: adsb.lol, adsb.fi, airplanes.live and OpenSky. The area on screen refreshes about once a second. Between updates, planes move along their reported track for up to ${LIMITS.extrapolate} seconds. Faded planes have not reported for ${LIMITS.stale} seconds. Coverage is thin over oceans and remote areas.</p><p><strong>Routes</strong> come from adsbdb and hexdb. Aeris hides a route if the plane is not on it. <strong>Aircraft details</strong> come from adsbdb; photos from Planespotters.net.</p><p><strong>Map:</strong> OpenStreetMap through OpenFreeMap. Satellite: Esri. Terrain: AWS Terrain Tiles. Airports: OurAirports. Airlines: OpenFlights. 3D models are drawn from each type's published size, without airline colours.</p><ul class="link-list"><li><a href="https://adsb.lol" target="_blank" rel="noreferrer">adsb.lol (ODbL)</a></li><li><a href="https://adsb.fi" target="_blank" rel="noreferrer">adsb.fi</a></li><li><a href="https://airplanes.live" target="_blank" rel="noreferrer">airplanes.live</a></li><li><a href="https://opensky-network.org" target="_blank" rel="noreferrer">OpenSky Network</a></li><li><a href="https://www.adsbdb.com" target="_blank" rel="noreferrer">adsbdb</a></li><li><a href="https://www.planespotters.net" target="_blank" rel="noreferrer">Planespotters.net</a></li><li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></li><li><a href="https://openflights.org/data" target="_blank" rel="noreferrer">OpenFlights (ODbL)</a></li><li><a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports</a></li></ul>`);}
const definitions={altitude:['Altitude','Pressure altitude, the number pilots and air traffic control use. It can differ from height above sea level. The Telemetry tab shows both.'],groundSpeed:['Ground speed','Speed over the ground. Wind makes it differ from airspeed.'],verticalRate:['Vertical speed','How fast the plane is climbing or descending.'],track:['Track','The direction the plane is moving over the ground, from true north.']};
function showLocationPrompt(){openDialog('Show your location?',`<p>Aeris can show where you are on the map and start the map there. Your location stays on this device.</p><div class="button-row"><button class="primary" data-action="allow-location">Allow</button><button class="secondary" data-action="deny-location">Not now</button></div>`);}
async function locateMe(center=true,quiet=false){
 try{const p=await currentLocation();state.me=p;map.setMe(p);savePref('location',true);if(center)map.flyTo(p.lat,p.lon,Math.max(8,Math.min(9,map.getZoom())));}
 catch(err){if(!quiet)toast(err.message);}
}
// ——— 3D ———
function openScene(camera='chase'){
 const f=selected();if(!f){toast('Select a plane first.');return false;}
 if(!(f.onGround||f.altitude!==null||f.geometricAltitude!==null)){toast('This plane reports no altitude, so it cannot be shown in 3D.');return false;}
 if(!map.ok){toast('3D needs WebGL, which this device does not have.');return false;}
 state.view3d=true;state.camera=camera;$('.workspace').classList.add('scene-mode');$('.workspace').classList.remove('detail-open');live.setFocusOnly(true);
 map.enter3D(displayFlight(f),{camera:camera==='model'?'chase':camera,style:state.mapStyle==='satellite'?null:'satellite'});setCamera(camera);return true;
}
function closeScene(){state.view3d=false;setStudio(false);live.setFocusOnly(false);$('.workspace').classList.remove('scene-mode','studio-mode');map.exit3D();const f=selected();if(f){const d=displayFlight(f);setTimeout(()=>map.flyTo(d.lat,d.lon,Math.max(8,Math.min(11,map.getZoom()))),50);}pushMap(true);}
function setStudio(on){state.studio=on;$('.workspace').classList.toggle('studio-mode',on);if(on){if(!studio){try{studio=new Studio($('#scene'),toast);}catch{state.studio=false;$('.workspace').classList.remove('studio-mode');return;}}studio.active=true;studio.resize();const f=selected();if(f)studio.show(f);}else if(studio)studio.active=false;}
function setCamera(mode){state.camera=mode;setStudio(mode==='model');if(mode!=='model')map.setCamera(mode);document.querySelectorAll('[data-camera]').forEach(b=>{b.classList.toggle('active',b.dataset.camera===mode);b.setAttribute('aria-pressed',String(b.dataset.camera===mode));});}
function exportTrack(){const f=selected();if(!f)return;const points=live.track(f.id);if(!points.length){toast('No positions recorded yet.');return;}const quote=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'").replaceAll('"','""')+'"';const head=['callsign','timestamp_utc','latitude','longitude','altitude_ft','gps_altitude_ft','ground_speed_kt','vertical_rate_ft_min','track_deg'];const csv=[head.join(','),...points.map(p=>[p.callsign,new Date(p.positionTime*1000).toISOString(),p.lat,p.lon,p.altitude,p.geometricAltitude,p.groundSpeed,p.verticalRate,p.track].map(quote).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='aeris-'+f.callsign.replace(/[^a-z0-9]/gi,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// ——— Actions ———
/** Switch the side panel; leaving Trips takes its routes off the map. */
function go(nav){if(state.nav==='trips'&&nav!=='trips')leavePlan();state.nav=nav;renderNav();if(innerWidth<=800)$('.workspace').classList.add('detail-open');}
function tripFlightTap(id){
 const t=collection.trip(state.trip),x=t?.flights.find(y=>y.id===id);if(!x)return;
 if(Math.abs(daysBetween(today(),x.date))<=1){findAndGo('callsign',x.callsign,x.label);return;}
 if(x.from&&x.to&&map.map){const w=Math.min(x.from.lon,x.to.lon),e2=Math.max(x.from.lon,x.to.lon);if(e2-w<180)map.map.fitBounds([[w,Math.min(x.from.lat,x.to.lat)],[e2,Math.max(x.from.lat,x.to.lat)]],{padding:innerWidth<=800?40:80,maxZoom:7,duration:600});}
 toast(daysBetween(today(),x.date)>1?`${x.label} is on ${fmtDate(x.date)}. Aeris starts watching it the day before.`:`${x.label} flew on ${fmtDate(x.date)}.`);
}
const actions={
 explore(){go('explore');state.airport=null;renderDetail();},
 saved(){go('saved');renderDetail();watcher.check();},
 airports(){go('airports');state.airport=null;renderDetail();},
 trips(){go('trips');state.tripView='list';state.trip=null;renderNav();renderDetail();updatePlan(false);},
 'trips-list'(){state.tripView='list';state.trip=null;renderNav();renderDetail();updatePlan(false);},
 history(){state.tripView='history';renderNav();renderDetail();updatePlan(true);},
 'new-trip':()=>showNewTrip(),'edit-trip':showEditTrip,'add-trip-flight':showTripFlightForm,'add-past-flight':showPastFlightForm,'add-to-trip':showAddToTrip,
 'delete-trip'(){const b=$('#dialog [data-action="delete-trip"]');if(b&&!b.dataset.confirm){b.dataset.confirm='1';b.lastChild.textContent='Tap again to delete';return;}const t=collection.trip(state.trip);collection.removeTrip(state.trip);closeDialog();toast(`${t?.name||'Trip'} deleted.`);actions['trips-list']();},
 'zoom-in':()=>map.zoom(2),'zoom-out':()=>map.zoom(.5),north:()=>map.resetNorth(),'locate-me':()=>locateMe(true),'map-options':showMapOptions,
 settings:showSettings,connect:showConnect,about:showAbout,'close-dialog':closeDialog,deselect,
 'toggle-detail':()=>$('.workspace').classList.toggle('detail-open'),'3d':()=>openScene('chase'),map:closeScene,
 'reset-camera'(){map.resetCamera(selected());if(state.studio)studio?.reset();},'scene-style'(){map.setStyle(map.styleName==='satellite'?'map':'satellite');},
 'clear-search'(){$('#search').value='';onSearchInput();$('#search').focus();},'search-back'(){state.search.results=null;renderSearch();},
 'save-flight'(){const f=selected();if(!f)return;const cs=f.flight||f.callsign;
  if(/^[A-Z]{3}\d/.test(cs)){const item=collection.flight(cs);if(item){collection.removeFlight(cs);toast(`${item.label} removed from Saved.`);}else{const it=collection.addFlight(f);toast(`${it.label} saved. Tap Alerts to be notified about it.`);watcher.check();}}
  else{if(collection.aircraft(f.id)){collection.removeAircraft(f.id);toast('Removed from Saved.');}else{collection.addAircraft(f);toast((f.registration||f.callsign)+' saved.');}}
  renderDetail();},
 'notify-flight'(){const f=selected();if(f)showAlerts(f.flight||f.callsign,f);},
 'save-aircraft'(){const f=selected();if(!f)return;if(collection.aircraft(f.id)){collection.removeAircraft(f.id);toast('Aircraft removed from Saved.');}else{collection.addAircraft(f);toast((f.registration||'Aircraft')+' saved.');}renderDetail();},
 'save-airport'(){const a=state.airport;if(!a)return;if(collection.airport(a.icao)){collection.removeAirport(a.icao);toast(a.name+' removed from Saved.');}else{collection.addAirport(a);toast(a.name+' saved.');}renderDetail();},
 'ask-notifications'(){notificationPermission(true).then(()=>showSettings());},
 'allow-location'(){savePref('locationAsked',true);closeDialog();locateMe(true);},
 'deny-location'(){savePref('locationAsked',true);savePref('location',false);closeDialog();},
 'save-settings'(){state.units=$('#units').value;savePref('units',state.units);closeDialog();refresh();},
 'save-proxy'(){const v=$('#proxy').value.trim();if(v){try{parseEndpoint(v);}catch(err){$('#connection-error').textContent=err.message;return;}}savePref('proxy',v||null);setProxy(v||defaultProxy());closeDialog();if(canLive()&&!live.running){live.start();watcher.start();}problemNow=undefined;refresh();toast(v?'Relay saved.':'Relay removed.');},
 export:exportTrack
};
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!ev.target.closest('.search-area'))closeSearch();if(!b)return;const ds=b.dataset;
 if(ds.action)actions[ds.action]?.();
 else if(ds.pick){const f=picks.get(ds.pick)||currentFlights().find(x=>x.id===ds.pick);remember(state.search.q);if(f){clearSearchText();goTo(f);}}
 else if(ds.flight){closeDialog();selectFlight(ds.flight,{fly:!state.view3d});}
 else if(ds.airport){closeDialog();remember(state.search.q);clearSearchText();selectAirport(ds.airport);}
 else if(ds.airline)showAirline(ds.airline);
 else if(ds.family){const fam=searchTypes(state.search.q,2)[Number(ds.family)];if(fam)showFamily(fam);}
 else if(ds.example){$('#search').value=ds.example;$('#search').focus();onSearchInput();}
 else if(ds.savedFlight){const item=collection.flight(ds.savedFlight);closeSearch();findAndGo('callsign',ds.savedFlight,item?.label||ds.savedFlight);}
 else if(ds.savedAircraft){const item=collection.aircraft(ds.savedAircraft);findAndGo('hex',ds.savedAircraft,item?.label||ds.savedAircraft);}
 else if(ds.bell)showAlerts(ds.bell);
 else if(ds.alertMode&&state.form?.kind==='alerts')setAlertMode(state.form.callsign,ds.alertMode,state.form.flight);
 else if(ds.openTrip)openTrip(ds.openTrip);
 else if(ds.tripFlight)tripFlightTap(ds.tripFlight);
 else if(ds.removeTripFlight){collection.removeTripFlight(state.trip,ds.removeTripFlight);renderDetail();updatePlan(false);syncWatch();}
 else if(ds.removeHistory){collection.removeHistory(ds.removeHistory);renderDetail();updatePlan(false);}
 else if(ds.historyRange){state.historyRange=ds.historyRange;renderDetail();updatePlan(true);}
 else if(ds.removeFlight){collection.removeFlight(ds.removeFlight);renderDetail();}
 else if(ds.removeAircraft){collection.removeAircraft(ds.removeAircraft);renderDetail();}
 else if(ds.removeAirport){collection.removeAirport(ds.removeAirport);renderDetail();}
 else if(ds.tab){state.tab=ds.tab;renderDetail();}
 else if(ds.camera)setCamera(ds.camera);
 else if(ds.style){state.mapStyle=ds.style;savePref('mapStyle',state.mapStyle);map.setStyle(state.mapStyle);document.querySelectorAll('[data-style]').forEach(x=>x.classList.toggle('active',x===b));}
 else if(ds.metric){const d=definitions[ds.metric];if(d)openDialog(d[0],`<p>${d[1]}</p><button class="primary" data-action="close-dialog">OK</button>`);}
});
document.addEventListener('submit',ev=>{ev.preventDefault();submitForm(ev.target);});
document.addEventListener('input',ev=>{if(ev.target.id==='ff-flight')lookupFormRoute();else if(ev.target.id==='ff-from'||ev.target.id==='ff-to')delete ev.target.dataset.auto;});
document.addEventListener('change',ev=>{const t=ev.target,k=t.dataset.setting;
 if(t.dataset.tripSetting){collection.updateTrip(state.trip,{[t.dataset.tripSetting]:t.checked});syncWatch();return;}
 if(t.name==='att-trip'){const n=$('#att-new');if(n)n.hidden=t.value!=='new';return;}
 if(k==='globe'){state.projection=t.checked?'globe':'mercator';savePref('projection',state.projection);map.setProjection(state.projection);}
 else if(k==='showGround'){state.showGround=t.checked;savePref('showGround',t.checked);pushMap(true);}
 else if(k==='location'){if(t.checked)locateMe(true);else{savePref('location',false);state.me=null;map.setMe(null);}}
 else if(k){map[k]=t.checked;map.applyLayerToggles();savePref('layers',{labels:map.labels,trails:map.trails,airports:map.airports,altitudeColors:map.altitudeColors});if(k==='trails')updateTrail(true);}
 else if(t.dataset.provider){live.setEnabled(t.dataset.provider,t.checked);savePref('disabledProviders',PROVIDERS.map(p=>p.id).filter(id=>!live.enabled.has(id)));}
});
$('#search').addEventListener('input',onSearchInput);
$('#search').addEventListener('focus',()=>{if(!state.search.q)renderSearch();});
$('#search').addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeSearch();$('#search').blur();}if(ev.key==='Enter'){ev.preventDefault();$('#search-results button:not(.result-back)')?.click();}if(ev.key==='ArrowDown'){ev.preventDefault();$('#search-results button')?.focus();}});
document.addEventListener('keydown',ev=>{if(['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName))return;if(ev.key==='/'&&!$('#dialog').open){ev.preventDefault();$('#search').focus();}if(ev.key==='Escape'&&!$('#dialog').open){if(state.view3d)closeScene();else if(state.selected)deselect();$('.workspace').classList.remove('detail-open');}});
document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;lastFrame=performance.now();live.setPaused(document.hidden);if(document.hidden)syncWatch();else{if(canLive())watcher.check();if(loadPref('location',false))locateMe(false,true);}});

function animate(t){
 const dt=lastFrame?Math.min((t-lastFrame)/1000,.1):0;lastFrame=t;
 if(pageVisible){
  const f=selected();
  if(f){const d=displayFlight(f);if(state.view3d)map.update3D(d);if(state.view3d||t-lastSelected>100){map.setSelected(d,iconClass(f));lastSelected=t;}}
  pushMap();updateTrail();
  if(t-lastUI>500){lastUI=t;renderSource();
   if(f){if(state.nav==='explore'&&state.tab==='overview'){for(const [key,kind] of [['altitude','alt'],['groundSpeed','speed'],['verticalRate','vertical'],['track','°']]){const el=$(`[data-value="${key}"]`);if(el)el.innerHTML=fmt(f[key],kind,kind==='vertical'&&state.units==='metric'?1:0)+`<small>${unit(kind)}</small>`;}const n=$('[data-note="verticalRate"]');if(n)n.textContent=vsNote(f.verticalRate);if($('#flight-phase'))$('#flight-phase').textContent=phase(f);}
    if($('#detail-data-status'))$('#detail-data-status').textContent=ago(quality(f).age);
    if(state.view3d){const alt=map.lastAltitude;$('#scene-sub').textContent=[quality(f).status==='Recent'?'Live':quality(f).status,alt?.metres!=null?`${fmt(alt.metres/FT,'alt')} ${unit('alt')} above sea level`:null].filter(Boolean).join(' · ');}}
   else if(state.selected&&!live.get(state.selected)){toast('That plane is out of coverage now.');deselect();}}
  if(t-lastSlow>3000){lastSlow=t;if(state.mapFilter&&state.nav==='trips')live.setTracked(currentFlights().filter(x=>state.mapFilter.has(x.flight||x.callsign)).map(x=>x.id));if(f){updateRoute();if(state.nav==='explore'&&state.tab==='overview'&&$('#altitude-chart'))$('#altitude-chart').innerHTML=chart(f);}if(state.nav==='airports'&&state.airport)renderDetail();}
 }
 requestAnimationFrame(animate);
}

// ——— Start ———
if(canLive()){live.start();watcher.start();}
$('#map-credit').innerHTML=map.attribution?.()||'';
refresh();requestAnimationFrame(animate);
const selfTest=new URLSearchParams(location.search).has('selftest');
if(loadPref('location',false))locateMe(false,true);
else if(selfTest&&bridge())locateMe(true,true);// simulator test: exercise the native location path without a tap
else if(!loadPref('locationAsked',false)&&map.ok)setTimeout(()=>{if(!$('#dialog').open)showLocationPrompt();},900);
// Read by the iOS/Android/browser smoke tests.
window.__aerisSelfTest=()=>{const s=live.status();return {hidden:document.hidden,running:live.running,circles:live.circles.length,loaded:true,bridge:bridge(),mode:canLive()?'live':'unavailable',map:map.ok,style:map.styleName,aircraft:state.mode==='live'?s.aircraft:state.flights.length,onMap:map.flightsData?.features?.length??0,source:liveProblem()?.kind||(s.live?'live':'connecting'),providers:s.providers.map(p=>({id:p.id,state:p.state,ms:p.ms,aircraft:p.aircraft,error:p.error})),selected:state.selected,view3d:state.view3d,saved:collection.count,me:Boolean(state.me),device:Boolean(window.webkit?.messageHandlers?.aerisDevice||window.AerisNative?.device),deviceTest:window.__aerisDeviceTest||null};};
// Simulator test: turn alerts on for a live flight the way the Alerts button does, add it to a trip,
// and check the app's background-check bridge answers. The CI step checks the app is still running after.
if(selfTest&&bridge())setTimeout(async()=>{const r={step:'start'};window.__aerisDeviceTest=r;
 const within=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),ms))]);
 try{
  const f=live.list().find(x=>/^[A-Z]{3}\d/.test(x.flight||x.callsign)&&!x.onGround);r.flight=f?.callsign||null;
  r.step='permission';r.permission=await within(notificationPermission(true),8000).catch(err=>err.message);
  if(f){r.step='alerts';r.alertsOn=await within(setAlertMode(f.flight||f.callsign,'every',f),15000).catch(err=>err.message);}
  r.step='trip';const t=collection.addTrip('Self-test');collection.addTripFlight(t.id,{callsign:f?.callsign||'SIA22',date:localDate(now())});
  r.step='check';await within(watcher.check(),60000).catch(()=>{});
  r.step='sync';r.synced=await syncWatch();
  r.step='state';const st=await within(nativeCall('watchState'),8000);r.watched=Array.isArray(st)?st.length:st;r.withState=Array.isArray(st)?st.filter(x=>x.state?.t).length:0;
  r.step='background';r.background=await within(nativeCall('runChecks'),90000).catch(err=>err.message);
  r.step='notify';r.notify=await within(notify('Aeris','Test alert from the simulator check.','selftest'),8000).then(()=>'ok',err=>err.message);
  r.step='done';
 }catch(err){r.error=err.message;}},12000);
window.__aeris={state,live,map,collection,watcher,selectFlight,openScene,closeScene,setCamera,deselect,goTo,openTrip,setAlertMode};
if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)&&location.hostname!=='appassets.androidplatform.net'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')navigator.serviceWorker.register('./sw.js').catch(()=>{});
