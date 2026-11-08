// Builds data/geoid-1deg.bin: EGM96 geoid undulation (metres, int8) on a 1° grid,
// 181 rows (lat -90..90) × 360 columns (lon -180..179), from the public-domain NGA EGM96
// 15' grid distributed by OSGeo/proj-datumgrid. Bilinear error vs the full grid: p99 < 2 m.
// Usage: node scripts/build-geoid.mjs [path/to/egm96_15.gtx]
import {readFile,writeFile} from 'node:fs/promises';
const src=process.argv[2]?await readFile(process.argv[2]):Buffer.from(await (await fetch('https://raw.githubusercontent.com/OSGeo/proj-datumgrid/master/egm96_15.gtx')).arrayBuffer());
const rows=src.readInt32BE(32),cols=src.readInt32BE(36),step=src.readDoubleBE(16);
const at=(r,c)=>src.readFloatBE(40+4*(r*cols+((c%cols)+cols)%cols));
function full(lat,lon){const r=(lat+90)/step,c=((lon+180)%360+360)%360/step;const r0=Math.min(Math.floor(r),rows-2),c0=Math.floor(c),fr=r-r0,fc=c-c0;
 return at(r0,c0)*(1-fr)*(1-fc)+at(r0+1,c0)*fr*(1-fc)+at(r0,c0+1)*(1-fr)*fc+at(r0+1,c0+1)*fr*fc;}
const out=new Int8Array(181*360);for(let i=0;i<181;i++)for(let j=0;j<360;j++)out[i*360+j]=Math.round(full(-90+i,-180+j));
await writeFile(new URL('../data/geoid-1deg.bin',import.meta.url),out);
console.log('geoid grid',out.length,'values; Singapore',out[(91)*360+284]);
