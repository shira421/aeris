// Draws the Aeris mark at every size the web app, iOS and Android need.
// Opaque, full-bleed squares: iOS rounds the corners itself and rejects transparency.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.AERIS_CANVAS||'@napi-rs/canvas');
const root=new URL('../',import.meta.url);
function draw(size,{inset=0}={}){
 const c=createCanvas(size,size),g=c.getContext('2d');
 g.fillStyle='#173e43';g.fillRect(0,0,size,size);
 // Artwork is laid out on a 512 grid; `inset` shrinks it for maskable/adaptive safe zones.
 const k=size/512*(1-inset),o=size*inset/2,p=(x,y)=>[o+x*k,o+y*k];
 const poly=(pts,color)=>{g.beginPath();pts.forEach(([x,y],i)=>{const [X,Y]=p(x,y);i?g.lineTo(X,Y):g.moveTo(X,Y);});g.closePath();g.fillStyle=color;g.fill();};
 poly([[256,104],[384,320],[256,256],[128,320]],'#f2f1e9');
 poly([[256,296],[352,352],[256,400],[160,352]],'#d87852');
 return c.toBuffer('image/png');
}
const out=[
 ['public/icon-180.png',180],['public/icon-192.png',192],['public/icon-512.png',512],
 ['public/icon-maskable-512.png',512,{inset:.2}],
 ['ios/Aeris/Assets.xcassets/AppIcon.appiconset/icon-1024.png',1024]
];
for(const [path,size,opts] of out){const url=new URL(path,root);await mkdir(new URL('./',url),{recursive:true});await writeFile(url,draw(size,opts));console.log(path,size);}
