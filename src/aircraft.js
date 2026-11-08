import * as T from '../vendor/three.module.min.js';
import {typeFor} from './types.js';
// Original parametric aircraft. The configuration (engine count and position, wing height,
// tail, propellers, upper deck, rotorcraft) comes from the type catalogue, and the finished
// mesh is scaled to the type's published length, span and height. Axes: +X right wing,
// +Y up, -Z forward (nose). Neutral livery; no airline marks.
export function makeAircraft(type='A359',category=null){
 const {spec}=typeFor(type,category);
 const g=new T.Group();
 const white=new T.MeshStandardMaterial({color:0xeaf0f0,roughness:.32,metalness:.27});
 const teal=new T.MeshStandardMaterial({color:0x173b4a,roughness:.32,metalness:.3});
 const gold=new T.MeshStandardMaterial({color:0xc99864,roughness:.35,metalness:.65});
 const dark=new T.MeshStandardMaterial({color:0x111e24,roughness:.6,metalness:.5});
 const metal=new T.MeshStandardMaterial({color:0x8b979d,roughness:.22,metalness:.85});
 const glass=new T.MeshStandardMaterial({color:0x143342,roughness:.09,metalness:.7});
 const add=(geo,mat,pos=[0,0,0],parent=g)=>{const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const gear=new T.Group();g.add(gear);gear.visible=false;
 if(spec.rotor)return finish(g,spec,gear,buildHelicopter(spec,{add,white,teal,dark,metal,glass}));
 const L=spec.length,S=spec.span,r=spec.width/2,jet=!spec.prop,light=spec.cls==='light';
 // Fuselage: lathe profile from nose (-L/2) to tail (+L/2), lower half in the accent colour.
 const nose=light?[[-.5,.0],[-.49,.45],[-.44,.85],[-.36,1]]:[[-.50,0],[-.49,.25],[-.46,.68],[-.40,.95],[-.32,1]];
 const tailcone=light?[[.05,1],[.25,.62],[.45,.3],[.5,.18]]:[[.22,1],[.32,.92],[.40,.64],[.48,.22],[.50,.04]];
 const profile=[...nose,...tailcone].map(([z,q])=>new T.Vector2(r*q,L*z));
 const body=lathe(profile,64,r,white,teal);const bodyMesh=add(body,vertexMat(white));bodyMesh.rotation.x=Math.PI/2;
 if(spec.deck==='double')bodyMesh.scale.z=1.38;
 if(spec.deck==='hump'){const hump=[[-.40,0],[-.38,.5],[-.33,.78],[-.24,.86],[-.12,.7],[-.08,.2]].map(([z,q])=>new T.Vector2(r*q,L*z));const h=add(new T.LatheGeometry(hump,32),white,[0,r*.62,0]);h.rotation.x=Math.PI/2;h.scale.set(.82,1,.82);}
 // Wings: lofted aerofoil sections, swept for jets, straight and tapered for propeller aircraft.
 const sweep=jet?(spec.cls==='heavy'||spec.cls==='jumbo'?.62:spec.cls==='biz'?.5:.5):.06;
 const chord=jet?L*.165:Math.min(L*.2,S*.11),wingZ=spec.mount==='tail'?-L*.02:jet?-L*.1:-L*.16;
 const wingY=spec.wing==='high'?r*.9:-r*.35;
 const stations=[[r*.7,0,1,-0.0,.11],[S*.2,.42,.78,.01,.1],[S*.39,.74,.52,.03,.09],[S*.49,.98,.34,.05,.08],[S*.5,1.0,.3,.06,.07]];
 for(const side of [-1,1]){
  wing(side,stations.map(([x,frac,taper,dihedral,ratio])=>({x,front:wingZ+frac*sweep*S*.5*.9,chord:chord*taper,y:wingY+dihedral*(spec.wing==='high'?-.3:1)*S*.5*1.2,ratio})),{add,white,teal});
  // Horizontal tail: low on the tail cone, or on top of the fin for a T-tail.
  const span=S*(jet?.18:.19),tz=L*.36,ty=spec.tail==='T'?spec.height*.7:r*.5;
  const ht=extrude([[r*.1,tz],[span,tz+L*.09],[span,tz+L*.13],[r*.1,tz+L*.12]],.3,white,add);ht.rotation.x=Math.PI/2;ht.scale.x=side;ht.position.y=ty;
  // Cabin windows and doors along both sides; nav lights on the wing tips.
  const n=Math.max(4,Math.round(L*.62*(light?.25:1)));for(let i=0;i<n;i++){const z=-L*.33+i*(L*.6/n);const w=add(new T.SphereGeometry(Math.max(.08,r*.07),8,6),glass,[side*r*.99,r*.25,z]);w.scale.set(.18,1,1.3);}
  if(!light)for(const z of [-L*.32,-L*.05,L*.22])add(new T.BoxGeometry(.06,Math.min(1.5,r*.75),Math.min(.8,r*.4)),metal,[side*r*.985,.15,z]);
  add(new T.SphereGeometry(Math.max(.1,r*.08),8,6),new T.MeshBasicMaterial({color:side<0?0xff4055:0x40ffc0}),[side*S*.495,wingY+(spec.wing==='high'?-.018:.06)*S*.6,wingZ+sweep*S*.45+chord*.2]);
  if(!light)add(new T.BoxGeometry(.045,Math.max(.08,r*.08),L*.57),gold,[side*r*.998,-r*.05,-L*.03]);
 }
 // Fin.
 const finH=spec.height-r*2.2-(spec.deck==='double'?r*.75:0);
 const fin=extrude([[-L*.02,0],[L*.08,finH],[L*.15,finH],[L*.19,0]],.45,teal,add,[0,r*.66,L*.27]);fin.rotation.y=-Math.PI/2;
 // Engines.
 const nac=r*(spec.cls==='heavy'||spec.cls==='jumbo'?.56:spec.cls==='biz'?.42:.5);
 const mounts=[];
 if(spec.mount==='wing'||spec.mount==='tri'){const at=spec.eng>=4?[.27,.47]:[.33];for(const side of [-1,1])for(const f of at)mounts.push({x:side*S*.5*f,y:wingY+(spec.wing==='high'?-nac*.35:-nac*1.05),z:wingZ+f*sweep*S*.45-chord*(jet?.42:.1),pylon:true});}
 if(spec.mount==='tail'){for(const side of [-1,1])mounts.push({x:side*(r+nac*1.15),y:r*.45,z:L*.3});if(spec.eng===3)mounts.push({x:0,y:r*1.05,z:L*.33});}
 if(spec.mount==='tri')mounts.push({x:0,y:r*1.05+nac*.9,z:L*.33});
 if(spec.prop&&spec.eng===1)mounts.length=0;
 for(const m of mounts)(spec.prop?propNacelle:jetEngine)(m,{nac,L,add,white,dark,metal,g});
 if(spec.prop&&spec.eng===1)propeller([0,0,-L*.5-.05],r*1.7,{add,dark,metal,g});
 // Flight-deck glazing on the upper nose.
 cockpit(profile,L,r,glass,add);
 // Landing gear (shown only when the data says on ground, or in the demo near the runway).
 const mains=spec.cls==='jumbo'||spec.cls==='heavy'?[[-r*1.1,L*.05],[r*1.1,L*.05],[-r*.5,L*.09],[r*.5,L*.09]]:[[-r*1.1,L*.04],[r*1.1,L*.04]];
 const wheel=Math.max(.2,r*.24);
 for(const [x,z] of [[0,-L*.33],...mains]){add(new T.CylinderGeometry(wheel*.25,wheel*.25,r*.95,8),metal,[x,-r*1.15,z],gear);for(const side of [-1,1]){const w=add(new T.CylinderGeometry(wheel,wheel,wheel*.6,16),dark,[x+side*wheel*.55,-r*1.15-r*.48,z],gear);w.rotation.z=Math.PI/2;}}
 return finish(g,spec,gear);
}
function finish(g,spec,gear){
 const bounds=new T.Box3().setFromObject(g),size=bounds.getSize(new T.Vector3());
 g.scale.set(spec.span/size.x,spec.height/size.y,spec.length/size.z);
 g.userData={spec,gear};return g;
}
function vertexMat(white){const m=white.clone();m.color.set(0xffffff);m.vertexColors=true;return m;}
function lathe(profile,segments,r,white,teal){const geo=new T.LatheGeometry(profile,segments);const cols=[];const p=geo.attributes.position;for(let i=0;i<p.count;i++){const lower=-p.getZ(i)<-r*.12;const c=lower?teal.color:white.color;cols.push(c.r,c.g,c.b);}geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));return geo;}
function extrude(points,thick,mat,add,pos=[0,0,0]){const sh=new T.Shape();points.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();return add(new T.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:true,bevelSegments:2,bevelSize:.1,bevelThickness:.1,steps:1}),mat,pos);}
function wing(side,stations,{add,white,teal}){
 const verts=[],cols=[],idx=[],per=40;
 stations.forEach((s,j)=>{for(let k=0;k<per;k++){const top=k<=20,u=(top?k:40-k)/20;const thick=5*s.ratio*s.chord*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u**3-.1036*u**4);
  verts.push(side*s.x,s.y+s.chord*.02*Math.sin(Math.PI*u)+(top?thick:-thick),s.front+u*s.chord);const c=j===stations.length-1?teal.color:white.color;cols.push(c.r,c.g,c.b);}});
 for(let j=0;j<stations.length-1;j++)for(let k=0;k<per;k++){const n=(k+1)%per,a=j*per+k,b=j*per+n,c=(j+1)*per+k,d=(j+1)*per+n;idx.push(a,b,c,b,d,c);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.setIndex(idx);geo.computeVertexNormals();
 const mat=vertexMat(white);mat.side=T.DoubleSide;add(geo,mat);
}
function jetEngine(m,{nac,L,add,white,dark,metal,g}){
 const e=new T.Group();e.position.set(m.x,m.y,m.z);g.add(e);const len=nac*4.4;
 const shell=add(new T.LatheGeometry([[-len*.5,nac*.92],[-len*.46,nac],[len*.22,nac*.86],[len*.5,nac*.55]].map(([z,q])=>new T.Vector2(q,z)),40),white,[0,0,0],e);shell.rotation.x=Math.PI/2;
 add(new T.TorusGeometry(nac*.9,nac*.05,8,40),metal,[0,0,-len*.5],e);
 add(new T.CircleGeometry(nac*.84,40),dark,[0,0,-len*.49],e).rotation.y=Math.PI;
 const fan=new T.Group();fan.position.z=-len*.495;e.add(fan);
 for(let j=0;j<18;j++){const b=add(new T.BoxGeometry(nac*.05,nac*.78,nac*.03),metal,[Math.sin(j/18*Math.PI*2)*nac*.42,Math.cos(j/18*Math.PI*2)*nac*.42,0],fan);b.rotation.z=-j/18*Math.PI*2+.35;}
 add(new T.SphereGeometry(nac*.24,20,10),metal,[0,0,-len*.5],e).scale.z=1.8;
 if(m.pylon)add(new T.BoxGeometry(nac*.22,nac*1.2,len*.7),white,[m.x,m.y+nac*.95,m.z+len*.15]);
}
function propeller(pos,radius,{add,dark,metal,g},blades=4){
 const hub=new T.Group();hub.position.set(...pos);g.add(hub);
 add(new T.SphereGeometry(radius*.12,16,10),metal,[0,0,0],hub).scale.z=1.6;
 for(let j=0;j<blades;j++){const b=add(new T.BoxGeometry(radius*.1,radius,radius*.03),dark,[Math.sin(j/blades*Math.PI*2)*radius*.5,Math.cos(j/blades*Math.PI*2)*radius*.5,0],hub);b.rotation.z=-j/blades*Math.PI*2;}
}
function propNacelle(m,{nac,L,add,white,dark,metal,g}){
 const len=nac*5;const e=add(new T.CylinderGeometry(nac*.55,nac*.45,len,16),white,[m.x,m.y,m.z+len*.1]);e.rotation.x=Math.PI/2;
 propeller([m.x,m.y,m.z-len*.42],nac*2.6,{add,dark,metal,g},6);
}
function cockpit(profile,L,r,glass,add){
 const radiusAt=z=>{let i=0;while(i<profile.length-2&&profile[i+1].y<z)i++;const a=profile[i],b=profile[i+1];return a.x+(b.x-a.x)*(z-a.y)/(b.y-a.y)+.02;};
 for(const side of [-1,1])for(const [aa,bb] of [[.12,.55],[.59,1.0],[1.04,1.32]]){const pos=[],idx=[];for(let iz=0;iz<=5;iz++){const z=-L*.445+iz/5*L*.04,rr=radiusAt(z);for(let ia=0;ia<=5;ia++){const a=side*(aa+(bb-aa)*ia/5);pos.push(Math.sin(a)*rr,Math.cos(a)*rr,z);}}
  for(let iz=0;iz<5;iz++)for(let ia=0;ia<5;ia++){const j=iz*6+ia;idx.push(j,j+1,j+6,j+1,j+7,j+6);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const mat=glass.clone();mat.side=T.DoubleSide;add(geo,mat);}
}
function buildHelicopter(spec,{add,white,teal,dark,metal,glass}){
 const L=spec.length,D=spec.span,r=spec.width/2,cabinL=L*.42;
 const pod=add(new T.SphereGeometry(r,32,20),white,[0,0,-L*.5+cabinL*.5]);pod.scale.set(1,1.05,cabinL/(2*r));
 add(new T.SphereGeometry(r*.92,24,12,0,Math.PI*2,0,Math.PI*.42),glass,[0,r*.08,-L*.5+cabinL*.28]).rotation.x=-Math.PI*.42;
 const boom=add(new T.CylinderGeometry(r*.18,r*.38,L*.55,12),teal,[0,r*.25,-L*.5+cabinL+L*.24]);boom.rotation.x=Math.PI/2;
 add(new T.BoxGeometry(.12,r*1.4,L*.08),teal,[0,r*.85,L*.47]);
 const mast=add(new T.CylinderGeometry(r*.12,r*.12,r*.6,10),metal,[0,r*1.2,-L*.5+cabinL*.52]);
 const rotor=new T.Group();rotor.position.set(0,r*1.5,-L*.5+cabinL*.52);mast.parent.add(rotor);
 for(let j=0;j<4;j++){const b=add(new T.BoxGeometry(D*.06,.06,D),dark,[0,0,0],rotor);b.rotation.y=j*Math.PI/4;b.scale.x=j%2?1:1;}
 add(new T.CylinderGeometry(D*.5,D*.5,.02,48),new T.MeshStandardMaterial({color:0x223038,transparent:true,opacity:.18,depthWrite:false}),[0,0,0],rotor);
 const tr=new T.Group();tr.position.set(r*.2,r*.9,L*.48);mast.parent.add(tr);for(let j=0;j<2;j++){const b=add(new T.BoxGeometry(.05,D*.17,.15),dark,[0,0,0],tr);b.rotation.x=j*Math.PI/2;}
 for(const side of [-1,1]){const skid=add(new T.CylinderGeometry(.05,.05,cabinL*1.2,8),metal,[side*r*.95,-r*1.15,-L*.5+cabinL*.5]);skid.rotation.x=Math.PI/2;for(const z of [-.3,.3])add(new T.CylinderGeometry(.04,.04,r*.5,6),metal,[side*r*.85,-r*.95,-L*.5+cabinL*(.5+z)]);}
}
