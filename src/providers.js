// Live ADS-B sources. All readsb-style ones share one response format; OpenSky has its own.
// `cors:false` means a browser page cannot read the response directly: these need the
// iOS/Android app's native bridge, the local Node server, or a configured proxy.
const f=n=>Number(n).toFixed(3);
export const PROVIDERS=[
 {id:'adsblol',name:'adsb.lol',kind:'readsb',cors:false,maxRadius:250,minGap:1600,
  area:c=>`https://api.adsb.lol/v2/lat/${f(c.lat)}/lon/${f(c.lon)}/dist/${Math.round(c.nm)}`,
  hex:id=>`https://api.adsb.lol/v2/hex/${id}`,callsign:cs=>`https://api.adsb.lol/v2/callsign/${encodeURIComponent(cs)}`,reg:r=>`https://api.adsb.lol/v2/reg/${encodeURIComponent(r)}`,
  licence:'ODbL 1.0',site:'https://adsb.lol',terms:'Open data (ODbL). Best-effort community service.'},
 {id:'adsbfi',name:'adsb.fi',kind:'readsb',cors:false,maxRadius:250,minGap:1100,
  area:c=>`https://opendata.adsb.fi/api/v3/lat/${f(c.lat)}/lon/${f(c.lon)}/dist/${Math.round(c.nm)}`,
  hex:id=>`https://opendata.adsb.fi/api/v2/hex/${id}`,callsign:cs=>`https://opendata.adsb.fi/api/v2/callsign/${encodeURIComponent(cs)}`,reg:r=>`https://opendata.adsb.fi/api/v2/registration/${encodeURIComponent(r)}`,
  licence:'Personal, non-commercial use with attribution',site:'https://adsb.fi',terms:'1 request per second. Personal, non-commercial use; attribution required.'},
 {id:'airplaneslive',name:'airplanes.live',kind:'readsb',cors:false,maxRadius:250,minGap:1100,
  area:c=>`https://api.airplanes.live/v2/point/${f(c.lat)}/${f(c.lon)}/${Math.round(c.nm)}`,
  hex:id=>`https://api.airplanes.live/v2/hex/${id}`,callsign:cs=>`https://api.airplanes.live/v2/callsign/${encodeURIComponent(cs)}`,reg:r=>`https://api.airplanes.live/v2/reg/${encodeURIComponent(r)}`,
  licence:'Non-commercial use',site:'https://airplanes.live',terms:'1 request per second. Non-commercial use. Blocks some networks.'},
 {id:'opensky',name:'OpenSky Network',kind:'opensky',cors:false,minGap:12000,
  bbox:b=>`https://opensky-network.org/api/states/all?lamin=${f(b.south)}&lomin=${f(b.west)}&lamax=${f(b.north)}&lomax=${f(b.east)}&extended=1`,
  hex:id=>`https://opensky-network.org/api/states/all?icao24=${id}&extended=1`,
  licence:'Research and non-commercial use',site:'https://opensky-network.org',terms:'Anonymous use: 400 credits a day, 10-second resolution.'}
];
export const PROVIDER_HOSTS=['api.adsb.lol','opendata.adsb.fi','api.airplanes.live','opensky-network.org','api.adsbdb.com','api.planespotters.net','hexdb.io'];
/** OpenSky anonymous credit cost by bounding-box area in square degrees. */
export function openSkyCost(b){const area=Math.max(0,b.north-b.south)*Math.max(0,b.east-b.west);return area<=25?1:area<=100?2:area<=400?3:4;}
