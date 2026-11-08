// Close-up model viewer: the selected aircraft's parametric model on a neutral apron,
// with orbit and free-fly cameras. Geography is in the map's 3D view, not here.
import * as T from '../vendor/three.module.min.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {makeAircraft} from './aircraft.js';
import {clamp} from './core.ts';
export class Studio{
 constructor(container,onError){
  this.container=container;this.mode='orbit';this.active=false;this.keys=new Set();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){onError?.('WebGL is unavailable. The map and flight details remain usable.');throw e;}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;container.append(this.renderer.domElement);
  this.scene=new T.Scene();this.scene.background=new T.Color('#cfe0e6');this.scene.fog=new T.Fog('#cfe0e6',260,900);
  this.camera=new T.PerspectiveCamera(40,1,.3,3000);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=!this.reduced;this.controls.maxPolarAngle=Math.PI*.495;
  this.scene.add(new T.HemisphereLight(0xe8f4ff,0x8a978c,2.3));const sun=new T.DirectionalLight(0xfff1dc,3.4);sun.position.set(-60,120,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:400});this.scene.add(sun);
  const ground=new T.Mesh(new T.CircleGeometry(600,64),new T.MeshStandardMaterial({color:0x9aa7a2,roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
  const grid=new T.GridHelper(400,40,0x7f8f8a,0x8e9c97);grid.position.y=.02;grid.material.transparent=true;grid.material.opacity=.35;this.scene.add(grid);
  const el=this.renderer.domElement;el.tabIndex=0;el.setAttribute('aria-label','3D model view. Drag to orbit, scroll to zoom. In free camera use W A S D and Q E.');
  el.addEventListener('keydown',e=>{if(['w','a','s','d','q','e','Shift'].includes(e.key)){e.preventDefault();this.keys.add(e.key);}});el.addEventListener('keyup',e=>this.keys.delete(e.key));el.addEventListener('blur',()=>this.keys.clear());
  let look=null;el.addEventListener('pointerdown',e=>{if(this.mode==='free'){look=[e.clientX,e.clientY];el.setPointerCapture(e.pointerId);this.camera.rotation.reorder('YXZ');}});
  el.addEventListener('pointermove',e=>{if(look){this.camera.rotation.y-=(e.clientX-look[0])*.004;this.camera.rotation.x=clamp(this.camera.rotation.x-(e.clientY-look[1])*.004,-1.45,1.45);look=[e.clientX,e.clientY];}});
  el.addEventListener('pointerup',()=>look=null);el.addEventListener('pointercancel',()=>look=null);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  this.last=performance.now();this.renderer.setAnimationLoop(t=>this.frame(t));
 }
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(w&&h){this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}}
 show(f){
  const key=(f.type||'')+'|'+(f.category||'');
  if(key!==this.key){if(this.aircraft){this.scene.remove(this.aircraft);this.aircraft.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});}
   this.aircraft=makeAircraft(f.type,f.category);this.key=key;this.scene.add(this.aircraft);}
  const spec=this.aircraft.userData.spec,box=new T.Box3().setFromObject(this.aircraft);this.aircraft.position.y-=box.min.y-(spec.rotor?0:0);
  this.aircraft.userData.gear.visible=true;this.reset();
 }
 reset(){const spec=this.aircraft?.userData.spec;if(!spec)return;const d=Math.max(spec.length,spec.span);this.controls.target.set(0,spec.height*.4,0);this.camera.position.set(d*.9,d*.38,d*.95);this.controls.minDistance=d*.25;this.controls.maxDistance=d*6;this.controls.update();}
 setMode(mode){this.mode=mode;this.controls.enabled=mode==='orbit';if(mode==='orbit')this.reset();}
 setQuality(q){this.renderer.setPixelRatio(q==='low'?1:Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=q!=='low';this.resize();}
 frame(t){const dt=Math.min((t-this.last)/1000,.05);this.last=t;if(!this.active||document.hidden)return;
  if(this.mode==='free'&&this.keys.size){const dir=new T.Vector3();this.camera.getWorldDirection(dir);const right=new T.Vector3().crossVectors(dir,new T.Vector3(0,1,0)).normalize();const d=new T.Vector3();if(this.keys.has('w'))d.add(dir);if(this.keys.has('s'))d.sub(dir);if(this.keys.has('d'))d.add(right);if(this.keys.has('a'))d.sub(right);if(this.keys.has('q'))d.y-=1;if(this.keys.has('e'))d.y+=1;this.camera.position.add(d.multiplyScalar(dt*(this.keys.has('Shift')?60:15)));}
  if(this.controls.enabled)this.controls.update();this.renderer.render(this.scene,this.camera);}
}
