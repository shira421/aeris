import {makeAircraft} from './aircraft.js';
import {GLTFExporter} from '../vendor/GLTFExporter.js';
import {FT,DEG,flightPathAngle} from './core.ts';
// Optional provider-backed renderer. Tokens remain in memory and are sent only to Cesium.
const CESIUM='https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/';
let pending;
async function loadCesium(){if(window.Cesium)return window.Cesium;if(pending)return pending;pending=new Promise((resolve,reject)=>{window.CESIUM_BASE_URL=CESIUM;const css=document.createElement('link');css.rel='stylesheet';css.href=CESIUM+'Widgets/widgets.css';document.head.append(css);const script=document.createElement('script');script.src=CESIUM+'Cesium.js';script.onload=()=>resolve(window.Cesium);script.onerror=()=>{pending=null;script.remove();reject(new Error('Could not load the terrain renderer. Check your connection.'));};document.head.append(script);});return pending;}
export async function startTerrain(container,token,flight){
 const C=await loadCesium();C.Ion.defaultAccessToken=token;
 const terrain=await C.createWorldTerrainAsync({requestVertexNormals:true});
 const viewer=new C.Viewer(container,{terrainProvider:terrain,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,baseLayer:false});
 let url,entity;try{
  viewer.imageryLayers.addImageryProvider(await C.IonImageryProvider.fromAssetId(2));
  viewer.scene.globe.depthTestAgainstTerrain=true;viewer.scene.globe.enableLighting=true;viewer.shadows=true;
  const mesh=makeAircraft(flight.type);mesh.rotation.y=-Math.PI/2;const glb=await new GLTFExporter().parseAsync(mesh,{binary:true});mesh.traverse(o=>o.geometry?.dispose());url=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
  entity=viewer.entities.add({position:C.Cartesian3.fromDegrees(flight.lon,flight.lat,(flight.geometricAltitude??flight.altitude??0)*FT),model:{uri:url,minimumPixelSize:64,maximumScale:1,scale:1},viewFrom:new C.Cartesian3(140,-140,55)});viewer.trackedEntity=entity;
  let photoreal=false;try{const tiles=await C.createGooglePhotorealistic3DTileset();viewer.scene.primitives.add(tiles);photoreal=true;}catch{/* World terrain remains available when Photorealistic 3D Tiles are not enabled on the account. */}
  return {photoreal,update(f){const position=C.Cartesian3.fromDegrees(f.lon,f.lat,(f.geometricAltitude??f.altitude??0)*FT);entity.position=position;entity.orientation=C.Transforms.headingPitchRollQuaternion(position,new C.HeadingPitchRoll(((f.trueHeading??f.track??0)-90)*DEG,flightPathAngle(f),(f.roll??0)*DEG));},destroy(){viewer.destroy();if(url)URL.revokeObjectURL(url);}};
 }catch(e){viewer.destroy();if(url)URL.revokeObjectURL(url);throw e;}
}
