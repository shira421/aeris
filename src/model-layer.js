// MapLibre custom layer that draws the selected aircraft as a 3D model at its real position,
// altitude and attitude, sharing the map's WebGL context (works on mercator and globe).
import * as T from '../vendor/three.module.min.js';
import {makeAircraft} from './aircraft.js';
import {DEG} from './core.ts';
export class ModelLayer{
 constructor(){this.id='aircraft-model';this.type='custom';this.renderingMode='3d';this.visible=false;this.mesh=null;this.key=null;this.pose=null;}
 onAdd(map,gl){
  this.map=map;this.camera=new T.Camera();this.scene=new T.Scene();
  this.scene.add(new T.HemisphereLight(0xe6f2ff,0x7d8c7d,2.2));
  const sun=new T.DirectionalLight(0xfff3e0,2.6);sun.position.set(-.4,1,.3);this.scene.add(sun);
  this.renderer=new T.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});this.renderer.autoClear=false;
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  if(this.pending){const p=this.pending;this.pending=null;this.setFlight(...p);}
 }
 onRemove(){this.dispose();this.renderer=null;}
 dispose(){if(!this.mesh)return;this.scene?.remove(this.mesh);this.mesh.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});this.mesh=null;this.key=null;}
 setFlight(f,typeCode){
  if(!f){this.dispose();this.pose=null;return;}
  if(!this.scene){this.pending=[f,typeCode];return;}
  const key=(typeCode||f.type||'')+'|'+(f.category||'');
  if(key!==this.key){this.dispose();this.mesh=makeAircraft(typeCode||f.type,f.category);this.key=key;this.scene.add(this.mesh);}
 }
 place(f,metres,heading,pitch,roll,onGround){this.pose={lon:f.lon,lat:f.lat,metres,heading,pitch,roll};if(this.mesh)this.mesh.userData.gear.visible=Boolean(onGround)||(f.altitude!==null&&f.altitude<2500&&(f.verticalRate??0)<300);this.map?.triggerRepaint();}
 render(gl,args){
  if(!this.visible||!this.mesh||!this.pose||!this.renderer)return;
  const p=this.pose,map=this.map;
  const base=new T.Matrix4().fromArray(map.transform.getMatrixForModel([p.lon,p.lat],p.metres));
  // Keep the model at least ~48 px long when zoomed out, so it never vanishes.
  const metresPerPixel=40075016.686*Math.cos(p.lat*DEG)/(512*2**map.getZoom());
  const L=this.mesh.userData.spec.length,s=Math.max(1,48*metresPerPixel/L);
  // Model frame: +X east, +Y up, +Z south; the mesh nose points to -Z (north) before rotation.
  const attitude=new T.Matrix4().makeRotationFromEuler(new T.Euler(p.pitch*DEG,-p.heading*DEG,-p.roll*DEG,'YXZ'));
  const matrix=new T.Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(base).multiply(attitude).multiply(new T.Matrix4().makeScale(s,s,s));
  this.camera.projectionMatrix=matrix;this.camera.projectionMatrixInverse.copy(matrix).invert();
  this.renderer.resetState();this.renderer.render(this.scene,this.camera);
 }
}
