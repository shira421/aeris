import {writeFile,mkdir} from 'node:fs/promises';
import {makeAircraft} from '../tests/aircraft.mjs';
import {GLTFExporter} from '../vendor/GLTFExporter.js';
// Browser FileReader bridge for the vendored exporter. No external textures are used.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onload?.({target:this});this.onloadend?.({target:this});});}readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onload?.({target:this});this.onloadend?.({target:this});});}};
await mkdir(new URL('../models/',import.meta.url),{recursive:true});
for(const type of ['A359','A320','B788','B77W']){const mesh=makeAircraft(type);const glb=await new GLTFExporter().parseAsync(mesh,{binary:true,onlyVisible:true});await writeFile(new URL('../models/'+type+'.glb',import.meta.url),new Uint8Array(glb));console.log(type,glb.byteLength,'bytes');}
