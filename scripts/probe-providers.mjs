// Checks every data source Aeris can use: reachability, latency, CORS headers for the
// GitHub Pages origin, payload shape and freshness. Run in CI (open internet); prints a table.
const ORIGIN='https://shira421.github.io';
const UA='Aeris/0.4 (+https://github.com/shira421/aeris; provider probe)';
const lat=1.36,lon=103.99;
const probes=[
 ['adsb.lol point','https://api.adsb.lol/v2/point/'+lat+'/'+lon+'/250','readsb'],
 ['adsb.lol lat/lon/dist','https://api.adsb.lol/v2/lat/'+lat+'/lon/'+lon+'/dist/250','readsb'],
 ['airplanes.live point','https://api.airplanes.live/v2/point/'+lat+'/'+lon+'/250','readsb'],
 ['adsb.fi lat/lon/dist','https://opendata.adsb.fi/api/v2/lat/'+lat+'/lon/'+lon+'/dist/250','readsb'],
 ['adsb.fi v3','https://opendata.adsb.fi/api/v3/lat/'+lat+'/lon/'+lon+'/dist/250','readsb'],
 ['adsb.lol London','https://api.adsb.lol/v2/point/51.47/-0.45/250','readsb'],
 ['airplanes.live New York','https://api.airplanes.live/v2/point/40.64/-73.78/250','readsb'],
 ['OpenSky bbox SEA','https://opensky-network.org/api/states/all?lamin=-1&lomin=101&lamax=4&lomax=106','opensky'],
 ['adsb.lol type A388','https://api.adsb.lol/v2/type/A388','readsb'],
 ['adsb.fi type A388','https://opendata.adsb.fi/api/v2/type/A388','readsb'],
 ['adsb.lol callsign','https://api.adsb.lol/v2/callsign/SIA22','readsb'],
 ['adsb.lol registration','https://api.adsb.lol/v2/reg/9V-SMU','readsb'],
 ['OpenSky worldwide','https://opensky-network.org/api/states/all','opensky'],
 ['OpenSky track','https://opensky-network.org/api/tracks/all?icao24=76cdb5&time=0','other'],
 ['adsbdb callsign','https://api.adsbdb.com/v0/callsign/SIA22','other'],
 ['adsbdb aircraft','https://api.adsbdb.com/v0/aircraft/76CDB5','other'],
 ['hexdb route','https://hexdb.io/callsign-route?callsign=SIA22','text'],
 ['planespotters hex','https://api.planespotters.net/pub/photos/hex/76CDB5','other'],
 ['adsb.lol routeset','POST https://api.adsb.lol/api/0/routeset','routeset'],
 ['adsb.lol openapi','https://api.adsb.lol/api/openapi.json','openapi'],
 ['OpenFreeMap liberty','https://tiles.openfreemap.org/styles/liberty','style'],
 ['OpenFreeMap dark','https://tiles.openfreemap.org/styles/dark','style'],
 ['AWS terrain tile','https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/806/507.png','binary'],
 ['Esri imagery tile','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/507/806','binary'],
 ['Esri labels tile','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/10/507/806','binary']
];
const rows=[];
for(const [name,spec,kind] of probes){
 const post=spec.startsWith('POST ');const url=post?spec.slice(5):spec;
 const started=performance.now();let row={name,status:'-',ms:0,cors:'-',detail:''};
 try{
  const r=await fetch(url,{method:post?'POST':'GET',headers:{Origin:ORIGIN,'User-Agent':UA,Accept:'application/json',...(post?{'Content-Type':'application/json'}:{})},body:post?JSON.stringify({planes:[{callsign:'SIA22',lat:40,lng:-30}]}):undefined,signal:AbortSignal.timeout(15000)});
  row.status=r.status;row.ms=Math.round(performance.now()-started);row.cors=r.headers.get('access-control-allow-origin')||'none';
  const text=kind==='binary'?'':await r.text();
  if(kind==='binary'){row.detail=(r.headers.get('content-type')||'')+' '+(await r.arrayBuffer()).byteLength+'B';}
  else if(kind==='readsb'){const d=JSON.parse(text);const ac=d.ac||d.aircraft||[];const now=d.now>1e12?d.now/1000:d.now;const pos=ac.filter(a=>Number.isFinite(a.lat));const ages=pos.map(a=>a.seen_pos??a.seen??0).sort((a,b)=>a-b);
   const keys=new Set();ac.slice(0,200).forEach(a=>Object.keys(a).forEach(k=>keys.add(k)));
   row.detail=`${ac.length} ac, ${pos.length} positioned, median seen_pos ${ages[ages.length>>1]?.toFixed?.(1)}s, server lag ${now?(Date.now()/1000-now).toFixed(1)+'s':'n/a'}, keys: ${[...keys].sort().join(' ')}`;}
  else if(kind==='opensky'){const d=JSON.parse(text);row.detail=`${d.states?.length??0} states, time lag ${(Date.now()/1000-d.time).toFixed(0)}s, remaining ${r.headers.get('x-rate-limit-remaining')}`;}
  else if(kind==='openapi'){const d=JSON.parse(text);row.detail=Object.keys(d.paths||{}).join(' ');}
  else if(kind==='style'){const d=JSON.parse(text);row.detail=`sources ${Object.keys(d.sources).join(',')}; glyphs ${d.glyphs}; sprite ${JSON.stringify(d.sprite).slice(0,80)}; ${d.layers.length} layers`;}
  else row.detail=text.slice(0,400).replace(/\s+/g,' ');
 }catch(err){row.status='ERR';row.ms=Math.round(performance.now()-started);row.detail=err.message;}
 rows.push(row);console.log(`PROBE | ${row.name} | ${row.status} | ${row.ms} ms | CORS ${row.cors} | ${row.detail}`);
}
// Repeat-latency sample: five back-to-back requests per readsb provider, spaced to respect 1 req/s.
for(const [name,url] of [['adsb.lol','https://api.adsb.lol/v2/point/51.47/-0.45/100'],['airplanes.live','https://api.airplanes.live/v2/point/51.47/-0.45/100'],['adsb.fi','https://opendata.adsb.fi/api/v2/lat/51.47/lon/-0.45/dist/100']]){
 const times=[];for(let i=0;i<5;i++){const t=performance.now();try{const r=await fetch(url,{headers:{'User-Agent':UA}});await r.text();times.push(r.status===200?Math.round(performance.now()-t):'HTTP'+r.status);}catch(e){times.push('ERR');}await new Promise(r=>setTimeout(r,1200));}
 console.log(`LATENCY | ${name} | ${times.join(' ')}`);
}
