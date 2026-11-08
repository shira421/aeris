import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const esbuild=process.env.AERIS_ESBUILD?require(process.env.AERIS_ESBUILD):require('esbuild');
const root=fileURLToPath(new URL('.',import.meta.url));
await mkdir(root+'dist/icons',{recursive:true});
// Optional data proxy for the hosted web app (see worker/). Empty means: app bridge or demo.
const proxy=process.env.AERIS_PROXY_URL||'';
const loader={'.geojson':'json','.bin':'binary'};
const opts={absWorkingDir:root,bundle:true,format:'iife',target:['es2020','safari15'],loader,legalComments:'inline',minify:true,define:{__AERIS_PROXY__:JSON.stringify(proxy)},logLevel:'warning'};
await esbuild.build({...opts,entryPoints:['src/app.js'],outfile:'dist/app.js'});
// The alert rules on their own, for the iOS app's background check (JavaScriptCore).
await esbuild.build({...opts,entryPoints:['src/rules.js'],outfile:'dist/rules.js',globalName:'AerisRules'});
// Node bundles used by the unit tests (rebuilt from scratch so no stale chunks remain).
await rm(root+'tests/lib',{recursive:true,force:true});
const node={absWorkingDir:root,bundle:true,splitting:true,platform:'node',target:'node20',format:'esm',loader,logLevel:'warning'};
await esbuild.build({...node,entryPoints:{core:'src/core.ts',aircraft:'src/aircraft.js',scenarios:'src/data.js',geo:'src/geo.js',types:'src/types.js',live:'src/live.js',airports:'src/airports.js',net:'src/net.js',search:'src/search.js',collection:'src/collection.js',rules:'src/rules.js'},outdir:'tests/lib'});
const css=(await readFile(require.resolve('maplibre-gl/dist/maplibre-gl.css'),'utf8'))+'\n'+(await readFile(root+'src/style.css','utf8'));
await writeFile(root+'dist/style.css',css);
await copyFile(root+'data/airports.json',root+'dist/airports.json');
let html=await readFile(root+'index.html','utf8');
await writeFile(root+'dist/index.html',html.replace('./src/style.css','./style.css').replace('type="module" src="./src/app.js"','defer src="./app.js"'));
const js=await readFile(root+'dist/app.js','utf8');
await copyFile(root+'public/manifest.webmanifest',root+'dist/manifest.webmanifest');
for(const n of ['180','192','512','maskable-512'])await copyFile(root+'public/icon-'+n+'.png',root+'dist/icons/icon-'+n+'.png');
const sw=await readFile(root+'public/sw.js','utf8');
await writeFile(root+'dist/sw.js',sw.replace('SOURCE_VERSION',createHash('sha256').update(js+css).digest('hex').slice(0,12)));
// One self-contained file (offline demo + live data when opened inside a proxy-capable host).
const airports=await readFile(root+'data/airports.json','utf8');
const portable=html.replace(/<link rel="manifest"[^>]+>/,'').replace(/<link rel="apple-touch-icon"[^>]+>/,'').replace('<link rel="stylesheet" href="./src/style.css">',`<style>${css}</style>`).replace('<script type="module" src="./src/app.js"></script>',`<script>window.__AERIS_AIRPORTS__=${airports.replace(/<\//g,'<\\/')};</script><script>${js.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(root+'dist/Aeris.html',portable);
console.log(`Built dist/ (app.js ${(js.length/1e6).toFixed(2)} MB, ${proxy?'proxy '+proxy:'no build-time proxy'}) and self-contained dist/Aeris.html`);
