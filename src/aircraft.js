import * as T from '../vendor/three.module.min.js';
import {aircraftTypes} from './data.js';
export function makeAircraft(type='A359'){
 const spec=aircraftTypes[type]||aircraftTypes.GENERIC,L=spec.length,S=spec.span,r=L*.0435,g=new T.Group();
 const white=new T.MeshStandardMaterial({color:0xeaf0f0,roughness:.32,metalness:.27});
 const teal=new T.MeshStandardMaterial({color:0x173b4a,roughness:.32,metalness:.3});
 const gold=new T.MeshStandardMaterial({color:0xc99864,roughness:.35,metalness:.65});
 const dark=new T.MeshStandardMaterial({color:0x111e24,roughness:.6,metalness:.5});
 const metal=new T.MeshStandardMaterial({color:0x8b979d,roughness:.22,metalness:.85});
 const glass=new T.MeshStandardMaterial({color:0x143342,roughness:.09,metalness:.7});
 const add=(geo,mat,pos=[0,0,0],parent=g)=>{const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const shape=(points,thick,mat,pos=[0,0,0])=>{let sh=new T.Shape();points.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();return add(new T.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:true,bevelSegments:2,bevelSize:.12,bevelThickness:.12,steps:1}),mat,pos);};
 const profile=[[-.50,0],[-.49,.25],[-.46,.68],[-.40,.95],[-.32,1],[.22,1],[.32,.92],[.40,.64],[.48,.22],[.50,.04]].map(([z,q])=>new T.Vector2(r*q,L*z));
 const bodyGeo=new T.LatheGeometry(profile,64);const bodyColors=[];for(let i=0;i<bodyGeo.attributes.position.count;i++){const lower=-bodyGeo.attributes.position.getZ(i)<-r*.12;const col=lower?teal.color:white.color;bodyColors.push(col.r,col.g,col.b);}bodyGeo.setAttribute('color',new T.Float32BufferAttribute(bodyColors,3));const bodyMat=white.clone();bodyMat.color.set(0xffffff);bodyMat.vertexColors=true;const body=add(bodyGeo,bodyMat);body.rotation.x=Math.PI/2;
 const makeWing=side=>{const stations=[[r*.7,-L*.10,L*.16,-r*.30,.10],[S*.20,L*.005,L*.17,-r*.12,.09],[S*.39,L*.105,L*.23,r*.15,.085],[S*.475,L*.20,L*.252,r*.48,.08],[S*.50,L*.239,L*.262,r*.90,.07]];const verts=[],cols=[],indices=[],per=40;for(let j=0;j<stations.length;j++){const [x,front,back,y,ratio]=stations[j],chord=back-front;for(let k=0;k<per;k++){const top=k<=20,u=(top?k:40-k)/20;const thick=5*ratio*chord*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u);verts.push(side*x,y+chord*.02*Math.sin(Math.PI*u)+(top?thick:-thick),front+u*chord);const col=j===stations.length-1?teal.color:white.color;cols.push(col.r,col.g,col.b);}}for(let j=0;j<stations.length-1;j++)for(let k=0;k<per;k++){const n=(k+1)%per,a=j*per+k,b=j*per+n,c=(j+1)*per+k,d=(j+1)*per+n;indices.push(a,b,c,b,d,c);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=white.clone();mat.color.set(0xffffff);mat.vertexColors=true;mat.side=T.DoubleSide;add(geo,mat);};
 for(const side of [-1,1]){
  makeWing(side);
  const tail=shape([[r*.1,L*.34],[S*.18,L*.44],[S*.19,L*.50],[r*.1,L*.46]],.35,white);tail.rotation.x=Math.PI/2;tail.scale.x=side;tail.position.y=r*.6;
  const ex=side*S*.18,ey=-r*1.0,ez=-L*.035,engine=new T.Group();engine.position.set(ex,ey,ez);g.add(engine);
  const ep=[[-L*.055,r*.7],[-L*.05,r*.78],[L*.028,r*.65],[L*.052,r*.43]].map(([z,q])=>new T.Vector2(q,z));
  const shell=add(new T.LatheGeometry(ep,48),white,[0,0,0],engine);shell.rotation.x=Math.PI/2;
  const rim=add(new T.TorusGeometry(r*.69,.12,8,48),metal,[0,0,-L*.055],engine);
  add(new T.CircleGeometry(r*.63,48),dark,[0,0,-L*.054],engine).rotation.y=Math.PI;
  const fan=new T.Group();fan.position.z=-L*.056;engine.add(fan);
  for(let j=0;j<20;j++){const blade=add(new T.BoxGeometry(.12,r*.60,.07),metal,[Math.sin(j/20*Math.PI*2)*r*.31,Math.cos(j/20*Math.PI*2)*r*.31,0],fan);blade.rotation.z=-j/20*Math.PI*2+.35;}
  add(new T.SphereGeometry(r*.18,24,12),metal,[0,0,-L*.06],engine).scale.z=1.9;
  const pylon=add(new T.BoxGeometry(.55,r*.85,L*.08),white,[ex,-r*.42,L*.005]);
  for(let i=0;i<42;i++){let z=-L*.32+i*L*.013;const window=add(new T.SphereGeometry(.145,8,6),glass,[side*r*.99,r*.25,z]);window.scale.set(.18,1,1.3);}
  for(const z of [-L*.32,-L*.05,L*.22]){const door=add(new T.BoxGeometry(.06,1.5,.8),metal,[side*r*.985,.15,z]);}
  const nav=add(new T.SphereGeometry(.16,8,6),new T.MeshBasicMaterial({color:side<0?0xff4055:0x40ffc0}),[side*S*.49,1.4,L*.24]);
  const stripe=add(new T.BoxGeometry(.045,.16,L*.57),gold,[side*r*.998,-r*.05,-L*.03]);
 }
 const fin=shape([[-L*.02,0],[L*.08,spec.height-r*2.31-.55],[L*.17,spec.height-r*2.51-.55],[L*.20,0]],.5,teal,[0,r*.66,L*.27]);fin.rotation.y=-Math.PI/2;
 // Forward flight deck glazing follows the upper nose; parametric, approximate shape.
 const radiusAt=z=>{let i=0;while(i<profile.length-2&&profile[i+1].y<z)i++;const a=profile[i],b=profile[i+1];return a.x+(b.x-a.x)*(z-a.y)/(b.y-a.y)+.025;};
 for(const side of [-1,1])for(const [aa,bb] of [[.12,.55],[.59,1.0],[1.04,1.32]]){const pos=[],idx=[];for(let iz=0;iz<=5;iz++){const z=-L*.445+iz/5*L*.040,rr=radiusAt(z);for(let ia=0;ia<=5;ia++){const a=side*(aa+(bb-aa)*ia/5);pos.push(Math.sin(a)*rr,Math.cos(a)*rr,z);}}for(let iz=0;iz<5;iz++)for(let ia=0;ia<5;ia++){const j=iz*6+ia;idx.push(j,j+1,j+6,j+1,j+7,j+6);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const mat=glass.clone();mat.side=T.DoubleSide;add(geo,mat);}

 const gear=new T.Group();g.add(gear);
 for(const [x,z] of [[0,-L*.32],[-r*1.1,L*.05],[r*1.1,L*.05]]){add(new T.CylinderGeometry(.13,.14,r*.95,8),metal,[x,-r*1.15,z],gear);for(const side of [-1,1]){const wheel=add(new T.CylinderGeometry(.55,.55,.32,16),dark,[x+side*.28,-r*1.65,z],gear);wheel.rotation.z=Math.PI/2;}}
 gear.visible=false;const bounds=new T.Box3().setFromObject(g),size=bounds.getSize(new T.Vector3());g.scale.set(spec.span/size.x,spec.height/size.y,spec.length/size.z);g.userData={spec,gear};return g;
}
