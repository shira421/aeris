// The world map: MapLibre GL with OpenStreetMap vector tiles (OpenFreeMap), satellite imagery,
// globe projection and 3D terrain. Aircraft are GPU-drawn symbols; the selected aircraft is
// also drawn as a 3D model in the real-world 3D view.
import maplibregl from 'maplibre-gl';
import {ModelLayer} from './model-layer.js';
import {geography} from './data.js';
import {destination,greatCircle,flightPathAngle,DEG} from './core.ts';
import {altitudeMSL} from './geo.js';
import {typeFor} from './types.js';

const OFM='https://tiles.openfreemap.org/styles/';
const GLYPHS='https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT=['Noto Sans Regular'],FONT_BOLD=['Noto Sans Bold'];
export const ATTRIBUTION={
 map:'<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
 satellite:'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
 terrain:'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles</a> (SRTM, GMTED, ETOPO1 and others)',
 offline:'Natural Earth · generalised offline geography'
};
function satelliteStyle(){return {version:8,glyphs:GLYPHS,sources:{
 imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:ATTRIBUTION.satellite},
 places:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19}},
 layers:[{id:'background',type:'background',paint:{'background-color':'#0b1d26'}},{id:'imagery',type:'raster',source:'imagery'},{id:'places',type:'raster',source:'places',paint:{'raster-opacity':.9}}]};}
function offlineStyle(dark){return {version:8,sources:{land:{type:'geojson',data:{type:'FeatureCollection',features:[...geography.world,...geography.regional]}}},
 layers:[{id:'background',type:'background',paint:{'background-color':dark?'#132a35':'#e5eef0'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':dark?'#29413f':'#f3f5ed','fill-outline-color':dark?'#405850':'#c4d2c6'}}]};}
export const STYLES={map:()=>OFM+'positron',detail:()=>OFM+'liberty',dark:()=>OFM+'dark',satellite:satelliteStyle};

// Top-view silhouettes on a 64×64 grid, nose up. Drawn white and recoloured on the GPU.
const SHAPES={
 narrow:'M32 4C34 4 35 8 35 12L35 25 58 37 58 41 35 35 35 49 43 55 43 58 32 55 21 58 21 55 29 49 29 35 6 41 6 37 29 25 29 12C29 8 30 4 32 4Z',
 heavy:'M32 2C34.5 2 35.5 7 35.5 12L35.5 24 62 38 62 42 35.5 35 35.5 50 45 56 45 59 32 56 19 59 19 56 28.5 50 28.5 35 2 42 2 38 28.5 24 28.5 12C28.5 7 29.5 2 32 2Z',
 jumbo:'M32 2C35 2 36 6 36 11L36 23 62 38 62 42 36 34 36 50 46 56 46 59 32 56 18 59 18 56 28 50 28 34 2 42 2 38 28 23 28 11C28 6 29 2 32 2ZM45 30h4v6h-4zM53 34h4v6h-4zM15 30h4v6h-4zM7 34h4v6h-4z',
 regional:'M32 6C34 6 34.5 9 34.5 13L34.5 27 54 35 54 38 34.5 34 34.5 47 37 47 41 52 41 55 32 53 23 55 23 52 27 47 29.5 47 29.5 34 10 38 10 35 29.5 27 29.5 13C29.5 9 30 6 32 6Z',
 turboprop:'M32 8C34 8 35 11 35 14L35 24 60 25 60 30 35 31 35 47 43 50 43 54 32 52 21 54 21 50 29 47 29 31 4 30 4 25 29 24 29 14C29 11 30 8 32 8ZM18 18h4v8h-4zM42 18h4v8h-4z',
 biz:'M32 10C33.5 10 34 13 34 16L34 29 50 38 50 41 34 37 34 47 39 51 39 53 32 52 25 53 25 51 30 47 30 37 14 41 14 38 30 29 30 16C30 13 30.5 10 32 10Z',
 light:'M32 14C33.5 14 34 16 34 18L34 24 54 24 54 29 34 29 34 44 40 46 40 49 32 48 24 49 24 46 30 44 30 29 10 29 10 24 30 24 30 18C30 16 30.5 14 32 14Z',
 heli:'M32 14a8 9 0 1 1-.01 0ZM31 30h2v24h-2zM26 52h12v3H26zM10 25h44v2H10zM31 6h2v40h-2z',
 ground:'M24 22h16v20H24z'
};
const ICONS={};
const SCALE={jumbo:1.15,heavy:1.05,narrow:.9,regional:.78,turboprop:.78,biz:.66,light:.6,heli:.66,ground:.45};
// Icon size by silhouette class, interpolated by zoom (zoom must be the outermost input).
const CLASS_SCALE=['match',['get','c'],'jumbo',SCALE.jumbo,'heavy',SCALE.heavy,'regional',SCALE.regional,'turboprop',SCALE.turboprop,'biz',SCALE.biz,'light',SCALE.light,'heli',SCALE.heli,'ground',SCALE.ground,SCALE.narrow];
const sizeByZoom=stops=>['interpolate',['linear'],['zoom'],...stops.flatMap(([z,k])=>[z,['*',k,CLASS_SCALE]])];
const ALT_COLOR=['interpolate',['linear'],['get','a'],-1,'#8e9ea0',0,'#c39a2c',4000,'#9aa83a',10000,'#56a061',20000,'#3a8e98',30000,'#3c6eb4',40000,'#7650ad'];

export class WorldMap{
 constructor(container,{onSelect,onAirport,onMove,onReady,onStyle,onError}={}){
  this.container=container;this.onSelect=onSelect;this.onAirport=onAirport;this.onMove=onMove;this.onReady=onReady;this.onStyle=onStyle;this.onError=onError;
  this.labels=true;this.trails=true;this.airports=true;this.altitudeColors=true;this.styleName='map';this.projection='mercator';this.meData=null;
  this.selected=null;this.flightsData={type:'FeatureCollection',features:[]};this.airportData=null;this.routeData=null;this.trailData=null;
  this.mode='map';this.cam={mode:'chase',bearing:0,pitch:72,zoom:17.6,dist:null};this.ok=false;this.styleFailed=false;
  const saved=readView();
  try{
   this.map=new maplibregl.Map({container,style:STYLES.map(),center:saved?.center||[103.99,1.36],zoom:saved?.zoom??6.6,attributionControl:false,maxPitch:85,
    canvasContextAttributes:{antialias:true,preserveDrawingBuffer:false},fadeDuration:0,renderWorldCopies:true,pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});
  }catch(err){this.map=null;onError?.('The map needs WebGL, which is unavailable here. Flight details still work.');return;}
  this.ok=true;this.model=new ModelLayer();
  const m=this.map;
  m.on('style.load',()=>{this.styleFailed=this.styleFailed&&this.styleName==='offline';this.install();onStyle?.(this.attribution());this.emitMove();if(!this.ready){this.ready=true;onReady?.();}});
  m.on('error',e=>{const msg=String(e?.error?.message||'');if(!/fetch|network|AJAX|Failed to load|status 0/i.test(msg))console.warn('Map:',msg);if(!this.styleLoaded()&&!this.styleFailed&&/style|fetch|load|network|Failed/i.test(msg)){this.styleFailed=true;this.setStyle('offline');}});
  m.on('load',()=>{if(!this.ready){this.ready=true;onReady?.();}this.emitMove();});
  // The viewport is known before any tiles load: start fetching aircraft immediately.
  setTimeout(()=>this.emitMove(),0);
  m.on('moveend',()=>{this.emitMove();writeView(m);});
  let last=0;m.on('move',()=>{const t=performance.now();if(t-last>(this.mode==='map'?150:600)){last=t;this.emitMove();}});
  m.on('click',e=>this.click(e));
  m.on('mousemove',e=>{if(this.mode!=='map')return;const hit=this.hit(e.point,12);m.getCanvas().style.cursor=hit?'pointer':'';});
  m.on('webglcontextlost',()=>onError?.('The map was paused by the device to save memory. It resumes when the page is visible again.'));
  // If the tile service cannot be reached at all, fall back to bundled offline geography.
  setTimeout(()=>{if(!this.styleLoaded()&&!this.styleFailed){this.styleFailed=true;this.setStyle('offline');}},9000);
 }
 styleLoaded(){try{return this.map.isStyleLoaded()||Boolean(this.map.getStyle()?.layers?.length);}catch{return false;}}
 attribution(){const name=this.styleName;let a=name==='satellite'?ATTRIBUTION.satellite:name==='offline'?ATTRIBUTION.offline:ATTRIBUTION.map;if(this.mode!=='map')a+=' · '+ATTRIBUTION.terrain;return a;}
 emitMove(){if(!this.map)return;const b=this.map.getBounds();if(![b.getWest(),b.getEast(),b.getSouth(),b.getNorth()].every(Number.isFinite)||b.getNorth()<=b.getSouth()){setTimeout(()=>this.emitMove(),250);return;}let west=b.getWest(),east=b.getEast();if(this.map.getZoom()<2.2||this.projection==='globe'&&this.map.getZoom()<2.6){west=-180;east=180;}
  this.onMove?.({west,east,south:b.getSouth(),north:b.getNorth()},this.map.getZoom(),this.map.getCenter());}
 setStyle(name){
  if(!this.map)return;this.styleName=name;
  const style=name==='offline'?offlineStyle(false):(STYLES[name]||STYLES.map)();
  // Terrain belongs to the map, not the style: detach it while the new style loads, or MapLibre
  // renders terrain depth against a style that has no projection yet. install() re-attaches it.
  if(this.mode!=='map')try{this.map.setTerrain(null);}catch{}
  this.map.setStyle(style,{diff:false});
 }
 setProjection(p){this.projection=p;if(this.map&&this.styleLoaded())try{this.map.setProjection({type:p});}catch{}}
 /** Adds Aeris sources and layers to whatever base style is loaded. Called after every style change. */
 /** Base-map labels in English or Latin script. The map fonts have no CJK, Thai or similar
  glyphs, so local-script names would show as empty boxes. */
 latinLabels(){
  const m=this.map,ours=/^(flight|selected|airport|plan|trail|route|me)/,field=['coalesce',['get','name:en'],['get','name_en'],['get','name:latin'],['get','name_int'],['get','name']];
  for(const layer of m.getStyle()?.layers||[]){
   if(layer.type!=='symbol'||ours.test(layer.id))continue;
   const tf=m.getLayoutProperty(layer.id,'text-field');
   if(tf&&/name/.test(JSON.stringify(tf))&&!/housenumber|ref/.test(JSON.stringify(tf)))try{m.setLayoutProperty(layer.id,'text-field',field);}catch{}
  }
 }
 install(){
  const m=this.map;
  try{m.setProjection({type:this.mode==='map'?this.projection:'mercator'});}catch{}
  try{this.latinLabels();}catch{}
  for(const [name,path] of Object.entries(SHAPES))if(!m.hasImage('ac-'+name))m.addImage('ac-'+name,ICONS[name]||(ICONS[name]=silhouette(path)),{sdf:true,pixelRatio:2});
  const hasGlyphs=Boolean(m.getStyle().glyphs);
  const src=(id,data,extra={})=>{if(!m.getSource(id))m.addSource(id,{type:'geojson',data,...extra});};
  src('route',this.routeData||empty());src('trail',this.trailData||empty(),{lineMetrics:true});src('airports',this.airportData||empty());src('flights',this.flightsData,{promoteId:'id'});src('selected',empty());src('me',this.meData||empty());src('plan',this.planData||empty());src('plan-airports',this.planAirports||empty());
  const add=layer=>{if(!m.getLayer(layer.id))m.addLayer(layer);};
  add({id:'route-done',type:'line',source:'route',filter:['==',['get','part'],'done'],paint:{'line-color':'#d96f49','line-width':1.4,'line-opacity':.45}});
  add({id:'route-next',type:'line',source:'route',filter:['==',['get','part'],'next'],paint:{'line-color':'#d96f49','line-width':1.6,'line-dasharray':[2,2.5],'line-opacity':.8}});
  // A trip's or the flight history's routes.
  add({id:'plan-past',type:'line',source:'plan',filter:['==',['get','s'],'done'],layout:{'line-cap':'round'},paint:{'line-color':'#6f8f88','line-width':1.6,'line-opacity':.75}});
  add({id:'plan-next',type:'line',source:'plan',filter:['==',['get','s'],'next'],layout:{'line-cap':'round'},paint:{'line-color':'#3d7779','line-width':1.8,'line-dasharray':[2,2]}});
  add({id:'plan-live',type:'line',source:'plan',filter:['==',['get','s'],'live'],layout:{'line-cap':'round'},paint:{'line-color':'#d96f49','line-width':2.2}});
  add({id:'plan-airport',type:'circle',source:'plan-airports',paint:{'circle-radius':4.5,'circle-color':'#ffffff','circle-stroke-color':'#204e51','circle-stroke-width':2}});
  if(hasGlyphs)add({id:'plan-airport-label',type:'symbol',source:'plan-airports',layout:{'text-field':['get','code'],'text-font':FONT_BOLD,'text-size':11,'text-offset':[0,1.2],'text-anchor':'top','text-allow-overlap':true},paint:{'text-color':this.styleName==='satellite'||this.styleName==='dark'?'#ffffff':'#204e51','text-halo-color':this.styleName==='satellite'||this.styleName==='dark'?'#0b1d26':'#ffffff','text-halo-width':1.5}});
  add({id:'trail',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':['interpolate',['linear'],['zoom'],3,1.5,10,3],'line-color':this.altitudeColors?['interpolate',['linear'],['get','a'],0,'#c39a2c',10000,'#56a061',20000,'#3a8e98',30000,'#3c6eb4',40000,'#7650ad']:'#d96f49','line-opacity':.95}});
  for(const [size,minzoom] of [['L',2.5],['M',6],['S',8]]){
   add({id:'airport-'+size,type:'circle',source:'airports',minzoom,filter:['==',['get','size'],size],paint:{'circle-radius':size==='L'?['interpolate',['linear'],['zoom'],3,2.5,10,6]:3.5,'circle-color':'#ffffff','circle-stroke-color':'#4f7f7b','circle-stroke-width':1.4}});
   if(hasGlyphs)add({id:'airport-label-'+size,type:'symbol',source:'airports',minzoom:minzoom+1.5,filter:['==',['get','size'],size],layout:{'text-field':['get','code'],'text-font':FONT_BOLD,'text-size':10,'text-offset':[0,1.1],'text-anchor':'top','text-optional':true},paint:{'text-color':this.styleName==='satellite'||this.styleName==='dark'?'#e8f1ef':'#3f6a66','text-halo-color':this.styleName==='satellite'||this.styleName==='dark'?'#0b1d26':'#ffffff','text-halo-width':1.2}});
  }
  add({id:'flights',type:'symbol',source:'flights',layout:{'icon-image':['concat','ac-',['get','c']],'icon-rotate':['get','t'],'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,
   'icon-size':sizeByZoom([[1,.32],[4,.42],[7,.6],[10,.82],[14,1.15]]),'symbol-sort-key':['get','a']},
   paint:{'icon-color':this.altitudeColors?ALT_COLOR:'#3d7779','icon-halo-color':'rgba(255,255,255,.95)','icon-halo-width':this.styleName==='satellite'||this.styleName==='dark'?.6:1.1,'icon-opacity':['case',['==',['get','st'],1],.42,1]}});
  if(hasGlyphs)add({id:'flight-labels',type:'symbol',source:'flights',minzoom:7.5,layout:{'text-field':['get','cs'],'text-font':FONT,'text-size':10,'text-offset':[1.4,0],'text-anchor':'left','text-optional':true,'text-allow-overlap':false},paint:{'text-color':this.styleName==='satellite'||this.styleName==='dark'?'#eaf2f0':'#2d5558','text-halo-color':this.styleName==='satellite'||this.styleName==='dark'?'rgba(10,25,32,.85)':'rgba(255,255,255,.9)','text-halo-width':1.3}});
  add({id:'selected-halo',type:'circle',source:'selected',paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,10,10,20],'circle-color':'rgba(217,111,73,.14)','circle-stroke-color':'rgba(217,111,73,.55)','circle-stroke-width':1,'circle-pitch-alignment':'map'}});
  add({id:'selected-icon',type:'symbol',source:'selected',layout:{'icon-image':['concat','ac-',['get','c']],'icon-rotate':['get','t'],'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-size':sizeByZoom([[1,.47],[4,.59],[7,.83],[10,1.12],[14,1.48]])},paint:{'icon-color':'#d96f49','icon-halo-color':'#ffffff','icon-halo-width':1.4,'icon-opacity':['case',['==',['get','m'],1],0,1]}});
  if(hasGlyphs)add({id:'selected-label',type:'symbol',source:'selected',layout:{'text-field':['get','cs'],'text-font':FONT_BOLD,'text-size':11,'text-offset':[1.6,0],'text-anchor':'left','text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffffff','text-halo-color':'#143b3b','text-halo-width':2.2,'text-opacity':['case',['==',['get','m'],1],0,1]}});
  add({id:'me-accuracy',type:'circle',source:'me',paint:{'circle-radius':['interpolate',['exponential',2],['zoom'],0,0,20,['/',['get','acc'],0.075]],'circle-color':'rgba(47,128,237,.12)','circle-stroke-color':'rgba(47,128,237,.35)','circle-stroke-width':1,'circle-pitch-alignment':'map'}});
  add({id:'me',type:'circle',source:'me',paint:{'circle-radius':6,'circle-color':'#2f80ed','circle-stroke-color':'#ffffff','circle-stroke-width':2.5}});
  if(!m.getLayer(this.model.id))m.addLayer(this.model);
  this.applyLayerToggles();
  if(this.mode!=='map')this.enableTerrain();
 }
 applyLayerToggles(){
  const m=this.map;if(!m)return;const vis=(id,on)=>{if(m.getLayer(id))m.setLayoutProperty(id,'visibility',on?'visible':'none');};
  vis('flight-labels',this.labels);vis('trail',this.trails);for(const s of ['L','M','S']){vis('airport-'+s,this.airports);vis('airport-label-'+s,this.airports&&this.labels);}
  if(m.getLayer('flights'))m.setPaintProperty('flights','icon-color',this.altitudeColors?ALT_COLOR:'#3d7779');
 }
 /** Cull raw reports before predicting visible positions; the selected aircraft is drawn separately. */
 setFlights(list,selectedId,iconClassOf,staleOf,positionOf=f=>f){
  if(!this.map)return;this.selected=selectedId;
  const b=this.map.getBounds(),pad=Math.max(2,(b.getNorth()-b.getSouth())*.15),wide=this.map.getZoom()<3;
  const features=[];
  for(const report of list){if(report.id===selectedId)continue;
   if(!wide&&(report.lat<b.getSouth()-pad||report.lat>b.getNorth()+pad||!lonIn(report.lon,b.getWest()-pad,b.getEast()+pad)))continue;
   const f=positionOf(report);
   features.push({type:'Feature',id:f.id,properties:{id:f.id,cs:f.callsign,t:f.track??f.trueHeading??0,c:iconClassOf(f),a:f.onGround?-1:(f.altitude??f.geometricAltitude??-1),st:staleOf(f)?1:0},geometry:{type:'Point',coordinates:[f.lon,f.lat]}});}
  this.flightsData={type:'FeatureCollection',features};this.map.getSource('flights')?.setData(this.flightsData);
  return features.length;
 }
 setSelected(f,iconClass){
  if(!this.map)return;const src=this.map.getSource('selected');
  if(!f){src?.setData(empty());this.model.setFlight(null);return;}
  src?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{cs:f.callsign,t:f.track??f.trueHeading??0,c:iconClass,m:this.mode!=='map'&&this.model.visible?1:0},geometry:{type:'Point',coordinates:[f.lon,f.lat]}}]});
 }
 setTrail(points,current){
  if(!this.map)return;const pts=[...points.map(p=>[p.lon,p.lat,p.altitude??0])];if(current)pts.push([current.lon,current.lat,current.altitude??0]);
  // Split into short segments so each carries its own altitude colour.
  const features=[];for(let i=1;i<pts.length;i++){if(Math.abs(pts[i][0]-pts[i-1][0])>180)continue;features.push({type:'Feature',properties:{a:pts[i][2]},geometry:{type:'LineString',coordinates:[pts[i-1].slice(0,2),pts[i].slice(0,2)]}});}
  this.trailData={type:'FeatureCollection',features};this.map.getSource('trail')?.setData(this.trailData);
 }
 setRoute(origin,dest,current){
  if(!this.map)return;if(!origin||!dest){this.routeData=empty();this.map.getSource('route')?.setData(this.routeData);return;}
  const line=(a,b,part)=>({type:'Feature',properties:{part},geometry:{type:'LineString',coordinates:greatCircle(a,b,48).map(([la,lo])=>[lo,la])}});
  const at=current?[current.lat,current.lon]:null;
  this.routeData={type:'FeatureCollection',features:at?[line([origin.lat,origin.lon],at,'done'),line(at,[dest.lat,dest.lon],'next')]:[line([origin.lat,origin.lon],[dest.lat,dest.lon],'next')]};
  this.map.getSource('route')?.setData(this.routeData);
 }
 /** Routes of a trip or of the flight history: {lines:[{from,to,state:'done'|'next'|'live'}]}. Null clears. */
 setPlan(plan){
  const lines=(plan?.lines||[]).filter(l=>l.from&&l.to&&Number.isFinite(l.from.lat)&&Number.isFinite(l.to.lat));
  const coords=l=>greatCircle([l.from.lat,l.from.lon],[l.to.lat,l.to.lon],64).map(([la,lo])=>[lo,la]);
  this.planData={type:'FeatureCollection',features:lines.map(l=>({type:'Feature',properties:{s:l.state||'next'},geometry:{type:'LineString',coordinates:coords(l)}}))};
  const seen=new Map();for(const l of lines)for(const p of [l.from,l.to])seen.set(p.code||p.name,p);
  this.planAirports={type:'FeatureCollection',features:[...seen.values()].map(p=>({type:'Feature',properties:{code:p.code||''},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))};
  this.map?.getSource('plan')?.setData(this.planData);this.map?.getSource('plan-airports')?.setData(this.planAirports);
  return lines.length;
 }
 /** Frame the routes set with setPlan. */
 fitPlan(padding=60){
  if(!this.map||!this.planData?.features.length)return;
  let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;
  for(const f of this.planData.features)for(const [lo,la] of f.geometry.coordinates){w=Math.min(w,lo);e=Math.max(e,lo);s=Math.min(s,la);n=Math.max(n,la);}
  if(e-w>300){this.map.flyTo({center:[0,20],zoom:1.2,duration:600});return;}
  this.map.fitBounds([[w,s],[e,n]],{padding,maxZoom:7,duration:700});
 }
 /** Your own position, as a blue dot with its accuracy circle. */
 setMe(p){this.meData=p?{type:'FeatureCollection',features:[{type:'Feature',properties:{acc:Math.max(10,p.accuracy||50)},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}]}:empty();this.map?.getSource('me')?.setData(this.meData);}
 setAirports(geojson){this.airportData=geojson;this.map?.getSource('airports')?.setData(geojson);}
 hit(point,radius){
  if(!this.map||!this.map.getLayer('flights'))return null;
  const box=[[point.x-radius,point.y-radius],[point.x+radius,point.y+radius]];
  const layers=['flights','selected-icon',...['L','M','S'].map(s=>'airport-'+s)].filter(id=>this.map.getLayer(id));
  const found=this.map.queryRenderedFeatures(box,{layers});if(!found.length)return null;
  const d=f=>{const p=this.map.project(f.geometry.coordinates);return Math.hypot(p.x-point.x,p.y-point.y)-(f.layer.id.startsWith('airport')?6:0);};
  return found.sort((a,b)=>d(a)-d(b))[0];
 }
 click(e){
  if(this.mode!=='map')return;const touch=e.originalEvent?.pointerType==='touch'||e.originalEvent?.sourceCapabilities?.firesTouchEvents;
  const hit=this.hit(e.point,touch?22:14);if(!hit)return;
  if(hit.layer.id.startsWith('airport'))this.onAirport?.(hit.properties.id);else if(hit.layer.id==='flights')this.onSelect?.(hit.properties.id);
 }
 flyTo(lat,lon,zoom){if(!this.map)return;this.map.flyTo({center:[lon,lat],zoom:zoom??Math.max(this.map.getZoom(),7),speed:1.6,essential:true});}
 zoom(f){if(!this.map)return;this.map.easeTo({zoom:this.map.getZoom()+Math.log2(f),duration:250});}
 resetNorth(){this.map?.easeTo({bearing:0,pitch:0,duration:400});}
 center(){return this.map?this.map.getCenter():{lat:1.36,lng:103.99};}
 getZoom(){return this.map?.getZoom()??6;}
 // ——— Real-world 3D view ———
 enableTerrain(){
  const m=this.map;if(!m.getSource('dem'))m.addSource('dem',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:14,attribution:ATTRIBUTION.terrain});
  try{m.setTerrain({source:'dem',exaggeration:1});}catch{}
  try{m.setSky({'sky-color':'#6aa7d8','horizon-color':'#d9e8ef','fog-color':'#cfe0e8','sky-horizon-blend':.6,'horizon-fog-blend':.5,'fog-ground-blend':.7,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,10,1,12,0]});}catch{}
 }
 enter3D(f,{camera='chase',style='satellite'}={}){
  if(!this.map)return false;this.prev={style:this.styleName,center:this.map.getCenter(),zoom:this.map.getZoom()};
  this.mode='3d';this.cam.mode=camera;this.cam.bearing=f.track??0;this.cam.dist=null;
  const m=this.map;m.dragPan.disable();m.scrollZoom.disable();m.touchZoomRotate.disable();m.dragRotate.disable();m.doubleClickZoom.disable();m.keyboard.disable();m.touchPitch.disable();
  try{m.setCenterClampedToGround(false);}catch{}
  m.setMaxPitch(camera==='cockpit'?110:85);
  this.model.setFlight(f,typeFor(f.type,f.category).code);this.model.visible=camera!=='cockpit';
  if(style&&this.styleName!==style&&!this.styleFailed)this.setStyle(style);else{try{m.setProjection({type:'mercator'});}catch{}this.enableTerrain();}
  this.bindCameraGestures();this.onStyle?.(this.attribution());return true;
 }
 exit3D(){
  if(!this.map||this.mode==='map')return;const m=this.map;this.mode='map';this.unbindCameraGestures();
  this.model.visible=false;this.model.setFlight(null);
  try{m.setTerrain(null);}catch{}try{m.setCenterClampedToGround(true);}catch{}
  m.dragPan.enable();m.scrollZoom.enable();m.touchZoomRotate.enable();m.dragRotate.enable();m.doubleClickZoom.enable();m.keyboard.enable();m.touchPitch.enable();m.setMaxPitch(85);
  if(this.prev&&this.prev.style!==this.styleName&&!this.styleFailed)this.setStyle(this.prev.style);else{try{m.setProjection({type:this.projection});}catch{}}
  m.jumpTo({pitch:0,bearing:0,center:this.prev?.center,zoom:Math.min(this.prev?.zoom??8,9)});this.onStyle?.(this.attribution());
 }
 setCamera(mode){this.cam.mode=mode;this.cam.dist=null;this.model.visible=mode!=='cockpit';this.map?.setMaxPitch(mode==='cockpit'?110:85);}
 /** Called every frame in 3D: places the model and the camera from the latest estimate. */
 update3D(f){
  if(!this.map||this.mode==='map'||!f)return;const m=this.map;
  const terrain=safe(()=>m.queryTerrainElevation([f.lon,f.lat]));const alt=altitudeMSL(f,terrain);this.lastAltitude=alt;
  const metres=(alt.metres??terrain??0)+(f.onGround?typeFor(f.type,f.category).spec.height*.18:0);
  const heading=f.trueHeading??f.track??0,pitch=flightPathAngle(f)/DEG,roll=f.roll??0;
  this.model.place(f,metres,heading,pitch,roll,f.onGround);
  const spec=typeFor(f.type,f.category).spec,L=spec.length;
  if(this.cam.mode==='orbit'){
   m.jumpTo({center:[f.lon,f.lat],elevation:metres,zoom:this.cam.zoom,bearing:this.cam.bearing,pitch:this.cam.pitch});
  }else if(this.cam.mode==='chase'){
   const dist=this.cam.dist??Math.max(90,L*3.4),elev=13*DEG;
   const back=destination(f.lat,f.lon,(heading+180)%360,dist*Math.cos(elev));
   const smooth=this.chase||(this.chase={bearing:heading});smooth.bearing=lerpAngle(smooth.bearing,heading,.12);
   const cb=destination(f.lat,f.lon,(smooth.bearing+180)%360,dist*Math.cos(elev));
   const opts=safe(()=>m.calculateCameraOptionsFromTo([cb[1],cb[0]],metres+dist*Math.sin(elev),[f.lon,f.lat],metres+L*.12));
   if(opts)m.jumpTo(opts);void back;
  }else if(this.cam.mode==='cockpit'){
   const nose=destination(f.lat,f.lon,heading,L*.44);
   const opts=safe(()=>m.calculateCameraOptionsFromCameraLngLatAltRotation([nose[1],nose[0]],metres+Math.max(2,spec.height*.22),heading,90+pitch,-roll));
   if(opts)m.jumpTo(opts);
  }
 }
 bindCameraGestures(){
  const el=this.map.getCanvasContainer();let drag=null,pinch=null;const pts=new Map();
  const down=e=>{pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===1)drag=[e.clientX,e.clientY];else if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}el.setPointerCapture?.(e.pointerId);};
  const move=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
   if(pts.size===2&&pinch){const [a,b]=[...pts.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);this.adjustDistance(pinch/d);pinch=d;return;}
   if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];
   if(this.cam.mode==='orbit'){this.cam.bearing=(this.cam.bearing-dx*.35+360)%360;this.cam.pitch=Math.max(0,Math.min(85,this.cam.pitch-dy*.25));}};
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size)drag=null;};
  const wheel=e=>{e.preventDefault();this.adjustDistance(Math.exp(e.deltaY*.0015));};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});
  this.unbind=()=>{el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);};
 }
 unbindCameraGestures(){this.unbind?.();this.unbind=null;}
 adjustDistance(factor){if(this.cam.mode==='orbit')this.cam.zoom=Math.max(10,Math.min(19.5,this.cam.zoom-Math.log2(factor)));else this.cam.dist=Math.max(25,Math.min(6000,(this.cam.dist??120)*factor));}
 resetCamera(f){this.cam.dist=null;this.cam.zoom=17.6;this.cam.pitch=72;this.cam.bearing=f?.track??0;this.chase=null;}
}
// Signed distance field from a filled path (Felzenszwalb EDT, as in TinySDF): crisp at any size
// and lets MapLibre recolour and outline the icon on the GPU.
function silhouette(path){
 const scale=2,pad=8,box=64*scale,size=box+pad*2,c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):Object.assign(document.createElement('canvas'),{width:size,height:size});
 const g=c.getContext('2d',{willReadFrequently:true});g.translate(pad,pad);g.scale(scale,scale);g.fillStyle='#000';g.fill(new Path2D(path));
 const alpha=g.getImageData(0,0,size,size).data,n=size*size,INF=1e20,outer=new Float64Array(n),inner=new Float64Array(n);
 for(let i=0;i<n;i++){const a=alpha[i*4+3]/255;outer[i]=a===1?0:a===0?INF:Math.max(0,.5-a)**2;inner[i]=a===1?INF:a===0?0:Math.max(0,a-.5)**2;}
 edt(outer,size,size);edt(inner,size,size);
 const radius=8*scale,cutoff=.25,out=new Uint8Array(n*4);
 for(let i=0;i<n;i++){const d=Math.sqrt(outer[i])-Math.sqrt(inner[i]);const v=Math.round(255-255*(d/radius+cutoff));out[i*4]=out[i*4+1]=out[i*4+2]=255;out[i*4+3]=Math.max(0,Math.min(255,v));}
 return {width:size,height:size,data:out};
}
function edt(grid,w,h){const f=new Float64Array(Math.max(w,h)),v=new Uint16Array(Math.max(w,h)),z=new Float64Array(Math.max(w,h)+1);
 for(let x=0;x<w;x++)edt1d(grid,x,w,h,f,v,z);for(let y=0;y<h;y++)edt1d(grid,y*w,1,w,f,v,z);}
function edt1d(grid,offset,stride,length,f,v,z){
 let q,k,s,r;v[0]=0;z[0]=-1e20;z[1]=1e20;for(q=0;q<length;q++)f[q]=grid[offset+q*stride];
 for(q=1,k=0,s=0;q<length;q++){do{r=v[k];s=(f[q]-f[r]+q*q-r*r)/(q-r)/2;}while(s<=z[k]&&--k>-1);k++;v[k]=q;z[k]=s;z[k+1]=1e20;}
 for(q=0,k=0;q<length;q++){while(z[k+1]<q)k++;r=v[k];grid[offset+q*stride]=f[r]+(q-r)*(q-r);}
}
const empty=()=>({type:'FeatureCollection',features:[]});
const safe=fn=>{try{const v=fn();return v===undefined||v===null||Number.isNaN(v)?null:v;}catch{return null;}};
const lonIn=(lon,w,e)=>{if(e-w>=360)return true;const x=((lon-w)%360+360)%360;return x<=e-w;};
const lerpAngle=(a,b,t)=>{const d=((b-a+540)%360)-180;return (a+d*t+360)%360;};
function readView(){try{const v=JSON.parse(localStorage.getItem('aeris-view')||'null');return v&&Number.isFinite(v.zoom)?v:null;}catch{return null;}}
function writeView(m){try{const c=m.getCenter();localStorage.setItem('aeris-view',JSON.stringify({center:[+c.lng.toFixed(4),+c.lat.toFixed(4)],zoom:+m.getZoom().toFixed(2)}));}catch{}}
