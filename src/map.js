import {DEG,clamp,destination,quality} from './core.ts';
import {geography,airports,cities,sampleFlight,scenarioTrack} from './data.js';
export class FlightMap{
 constructor(canvas,onSelect,onAirport){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onSelect=onSelect;this.onAirport=onAirport;this.center=[103.94,1.35];this.scale=650;this.flights=[];this.selected=null;this.labels=true;this.trails=true;this.airports=true;this.dark=false;this.history=new Map();
  this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(canvas);
  let start=null,drag=false;
  canvas.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY,...this.center];drag=false;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(start){const dx=e.clientX-start[0],dy=e.clientY-start[1];drag ||= Math.hypot(dx,dy)>4;this.center=[start[2]-dx/this.scale,start[3]+dy/this.scale];this.draw();}else{const p=this.point(e);canvas.style.cursor=this.hits?.some(h=>Math.hypot(h.x-p[0],h.y-p[1])<20)?'pointer':'grab';}});
  canvas.addEventListener('pointerup',e=>{if(!drag){const p=this.point(e);const h=this.hits?.find(h=>Math.hypot(h.x-p[0],h.y-p[1])<22);if(h){h.airport?onAirport(h.id):onSelect(h.id);}}start=null;});
  canvas.addEventListener('pointercancel',()=>{start=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?1.16:1/1.16);},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['+','=','-','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')this.zoom(1.3);else if(e.key==='-')this.zoom(1/1.3);else{this.center[0]+=e.key==='ArrowRight'?.12:e.key==='ArrowLeft'?-.12:0;this.center[1]+=e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0;this.draw();}}});
 }
 point(e){const r=this.canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
 xy(lon,lat){const merc=a=>Math.log(Math.tan(Math.PI/4+clamp(a,-85,85)*DEG/2))/DEG;return [(lon-this.center[0])*this.scale+this.w*.52,(merc(this.center[1])-merc(lat))*this.scale+this.h*.50];}
 zoom(f){this.scale=clamp(this.scale*f,50,8500);this.draw();}
 recenter(lat=1.35,lon=103.94){this.center=[lon,lat];this.draw();}
 update(flights,selected,history){this.flights=flights;this.selected=selected;this.history=history;this.draw();}
 geo(features){const c=this.ctx;for(const f of features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys){if(!poly[0]?.some(p=>Math.abs(p[0]-this.center[0])<this.w/this.scale+2&&Math.abs(p[1]-this.center[1])<this.h/this.scale+2))continue;c.beginPath();for(const ring of poly){ring.forEach((p,i)=>{const [x,y]=this.xy(...p);i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();}c.fill('evenodd');c.stroke();}}}
 draw(){
  const c=this.ctx,w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.w=w;this.h=h;const d=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==w*d||this.canvas.height!==h*d){this.canvas.width=w*d;this.canvas.height=h*d;}c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const dark=this.dark;c.fillStyle=dark?'#132a35':'#e5eef0';c.fillRect(0,0,w,h);
  c.strokeStyle=dark?'#23404a':'#d7e3e5';c.lineWidth=.6;
  const step=this.scale>1300?.1:this.scale<150?2:.5;
  for(let lon=Math.floor(this.center[0]-w/this.scale);lon<this.center[0]+w/this.scale;lon+=step){let x=this.xy(lon,this.center[1])[0];c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  for(let lat=Math.floor(this.center[1]-h/this.scale);lat<this.center[1]+h/this.scale;lat+=step){let y=this.xy(this.center[0],lat)[1];c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.fillStyle=dark?'#29413f':'#f3f5ed';c.strokeStyle=dark?'#405850':'#c4d2c6';c.lineWidth=1;
  this.geo(this.scale<100?geography.world:geography.regional);
  // Map labels are independent of the flight layer.
  if(this.labels){for(const [name,lat,lon] of cities){const [x,y]=this.xy(lon,lat);if(x<20||x>w-20||y<20||y>h-20)continue;const sea=name.includes('SEA')||name.includes('STRAIT');c.font=sea?'11px system-ui':'12px system-ui';c.fillStyle=sea?(dark?'#719ba9':'#91aab1'):(dark?'#b2c6bd':'#718174');c.textAlign='center';c.fillText(name,x,y);}}
  this.hits=[];
  if(this.airports){for(const a of airports){const [x,y]=this.xy(a.lon,a.lat);if(x<0||x>w||y<0||y>h)continue;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fillStyle=dark?'#20383d':'#ffffff';c.fill();c.strokeStyle='#638b86';c.lineWidth=1.5;c.stroke();c.fillStyle='#638b86';c.fillRect(x-2,y-2,4,4);c.font='600 10px system-ui';c.textAlign='left';c.fillText(a.id,x+12,y+4);this.hits.push({x,y,id:a.id,airport:true});}}
  const f=this.flights.find(f=>f.id===this.selected);
  if(f&&this.trails){let points=f.simulated?scenarioTrack(f.id):this.history.get(f.id)||[];
   if(points.length>1){c.beginPath();points.forEach((p,i)=>{let [x,y]=this.xy(p.lon,p.lat);i?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle=dark?'#e5b6a0':'#c7a697';c.lineWidth=1.5;c.setLineDash([5,6]);c.stroke();c.setLineDash([]);let near=points.reduce((best,p,i)=>Math.hypot(p.lat-f.lat,p.lon-f.lon)<Math.hypot(points[best].lat-f.lat,points[best].lon-f.lon)?i:best,0);if(f.simulated)points=points.slice(0,near+1);c.beginPath();points.forEach((p,i)=>{let [x,y]=this.xy(p.lon,p.lat);i?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle='#d96941';c.lineWidth=2.5;c.stroke();}
  }
  for(const f of [...this.flights].sort((a,b)=>(a.id===this.selected?1:0)-(b.id===this.selected?1:0))){
   const [x,y]=this.xy(f.lon,f.lat);if(x<-30||x>w+30||y<-30||y>h+30)continue;const chosen=f.id===this.selected;
   c.save();c.translate(x,y);if(chosen){c.beginPath();c.arc(0,0,22,0,Math.PI*2);c.fillStyle='#df744018';c.fill();c.strokeStyle='#d96e4460';c.lineWidth=1;c.stroke();}
   c.rotate((f.track??0)*DEG);c.scale(chosen?1.1:.78,chosen?1.1:.78);c.globalAlpha=!f.simulated&&quality(f).age>15?.45:1;c.fillStyle=chosen?'#db7046':dark?'#82b7b7':'#4d858a';c.strokeStyle=dark?'#132a35':'#f2f7f8';c.lineWidth=1.4;
   c.beginPath();c.moveTo(0,-15);c.bezierCurveTo(2,-14,2,-8,2,-4);c.lineTo(12,3);c.lineTo(12,6);c.lineTo(2,3);c.lineTo(2,10);c.lineTo(6,13);c.lineTo(6,15);c.lineTo(0,13);c.lineTo(-6,15);c.lineTo(-6,13);c.lineTo(-2,10);c.lineTo(-2,3);c.lineTo(-12,6);c.lineTo(-12,3);c.lineTo(-2,-4);c.bezierCurveTo(-2,-8,-2,-14,0,-15);c.fill();c.stroke();c.restore();
   this.hits.unshift({x,y,id:f.id});
   if(chosen||this.labels&&this.scale>450){c.font=(chosen?'700':'600')+' 11px system-ui';const tw=c.measureText(f.callsign).width;const lx=x+21,ly=y-17;c.fillStyle=chosen?'#143b3b':dark?'#233d44ed':'#ffffffed';c.beginPath();c.roundRect(lx,ly,tw+16,24,5);c.fill();c.fillStyle=chosen?'#fff':dark?'#c2d9dc':'#437073';c.textAlign='left';c.fillText(f.callsign,lx+8,ly+16);}
  }
  const metresPerDegree=111195*Math.cos(this.center[1]*DEG),target=90/this.scale*metresPerDegree/1000;const km=[1,2,5,10,20,50,100,200,500].reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);let px=km*1000/metresPerDegree*this.scale;
  c.strokeStyle=dark?'#8ca8ae':'#789497';c.lineWidth=1;c.beginPath();c.moveTo(25,h-45);c.lineTo(25,h-40);c.lineTo(25+px,h-40);c.lineTo(25+px,h-45);c.stroke();c.font='10px system-ui';c.fillStyle=c.strokeStyle;c.textAlign='left';c.fillText(km+' km',25,h-49);
 }
}
