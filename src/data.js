import {distance,bearing,FT,KT,destination} from './core.ts';
import world from '../data/world.geojson';
import sg from '../data/singapore.topo.json';
import my from '../data/mys.topo.json';
import id from '../data/idn.topo.json';
import {topoFeatures} from './core.ts';
export const geography={world:world.features,regional:[...topoFeatures(my),...topoFeatures(id),...topoFeatures(sg)]};
export const airports=[
 {id:'SIN',icao:'WSSS',name:'Singapore Changi',city:'Singapore',lat:1.3644,lon:103.9915,elevation:22,tz:'Asia/Singapore',runways:[['02L / 20R',4000,60],['02C / 20C',4000,60],['02R / 20L',4000,60]],website:'https://www.changiairport.com/'},
 {id:'XSP',icao:'WSSL',name:'Seletar',city:'Singapore',lat:1.416956,lon:103.86764,elevation:46,tz:'Asia/Singapore',runways:[['03 / 21',1836,46]],website:'https://www.seletarairport.com/'},
 {id:'JHB',icao:'WMKJ',name:'Senai International',city:'Johor Bahru',lat:1.6413,lon:103.6696,elevation:135,tz:'Asia/Kuala_Lumpur',runways:[['16 / 34',3800,45]],website:'https://www.senaiairport.com/'},
 {id:'BTH',icao:'WIDD',name:'Hang Nadim',city:'Batam',lat:1.1210,lon:104.119,elevation:126,tz:'Asia/Jakarta',runways:[['04 / 22',4025,45]],website:'https://bthairport.com/'}
];
export const aircraftTypes={
 A359:{name:'Airbus A350-900',family:'Wide-body · Twin engine',length:66.8,span:64.75,height:17.05,engines:'2 × Rolls-Royce Trent XWB',material:'Carbon-fibre composite fuselage',source:'https://www.aircraft.airbus.com/en/aircraft/a350/a350-900'},
 B788:{name:'Boeing 787-8',family:'Wide-body · Twin engine',length:56.72,span:60.12,height:16.92,engines:'2 × GEnx-1B or Trent 1000',material:'Composite primary structure',source:'https://www.boeing.com/commercial/787'},
 A320:{name:'Airbus A320',family:'Narrow-body · Twin engine',length:37.57,span:35.8,height:11.76,engines:'2 × turbofan (variant dependent)',material:'Aluminium primary structure',source:'https://www.aircraft.airbus.com/en/aircraft/a320/a320ceo'},
 B77W:{name:'Boeing 777-300ER',family:'Wide-body · Twin engine',length:73.86,span:64.8,height:18.5,engines:'2 × GE90-115B',material:'Aluminium primary structure',source:'https://www.boeing.com/commercial/777'},
 GENERIC:{name:'Generic twin-engine jet',family:'Fallback geometry',length:60,span:55,height:16,engines:'Not known',material:'Not known',source:null}
};
// The whole scenario is synthetic. Names illustrate the product, never a real-time flight claim.
const others=[
 ['TR18','Scoot','B788','9V-DEMO2',1.70,104.02,138,31000,430,0,['SIN','MEL']],
 ['QF2','Qantas','B77W','VH-DEMO',1.03,103.37,116,28000,470,0,['LHR','SYD']],
 ['AK704','AirAsia','A320','9M-DEMO',1.63,103.60,190,14000,310,-700,['KUL','SIN']],
 ['SQ638','Singapore Airlines','B788','9V-DEMO3',1.53,104.27,40,24000,410,1200,['SIN','NRT']],
 ['CX715','Cathay Pacific','A359','B-DEMO',1.82,104.56,225,29000,465,-500,['HKG','SIN']],
 ['GA837','Garuda Indonesia','A320','PK-DEMO',.94,104.15,165,19000,390,900,['SIN','CGK']],
 ['MH603','Malaysia Airlines','A320','9M-DEMO2',1.83,103.15,139,18000,390,-500,['KUL','SIN']],
 ['EK354','Emirates','B77W','A6-DEMO',1.23,103.08,98,35000,482,0,['DXB','SIN']],
 ['TR426','Scoot','A320','9V-DEMO4',1.70,103.90,340,21000,405,1200,['SIN','PEN']],
 ['SQ12','Singapore Airlines','B77W','9V-DEMO5',1.26,104.70,69,33000,471,0,['SIN','NRT']],
 ['JQ8','Jetstar','B788','VH-DEMO2',.76,104.42,144,36000,476,0,['SIN','MEL']],
 ['TG401','Thai Airways','A359','HS-DEMO',1.95,103.79,165,26000,450,-600,['BKK','SIN']]
];
export const DEMO_DURATION=690;
export function sampleFlight(t){
 t=Math.max(0,Math.min(DEMO_DURATION,t));
 // Straight-in illustrative approach to Changi; touchdown and rollout included.
 const keys=[[0,.70,103.710,12600],[500,1.285,103.961,1300],[550,1.329,103.978,390],[585,1.349,103.986,22],[630,1.366,103.993,22],[690,1.370,103.995,22]];
 let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],u=(t-a[0])/(b[0]-a[0]);
 const lat=a[1]+(b[1]-a[1])*u,lon=a[2]+(b[2]-a[2])*u,alt=a[3]+(b[3]-a[3])*u;
 const gs=distance([a[1],a[2]],[b[1],b[2]])/(b[0]-a[0])/KT;
 return {id:'demo-sq228',callsign:'SQ228',airline:'Singapore Airlines',registration:'9V-DEMO',type:'A359',lat,lon,altitude:alt,geometricAltitude:alt,groundSpeed:gs,track:bearing([a[1],a[2]],[b[1],b[2]]),trueHeading:null,verticalRate:(b[3]-a[3])/(b[0]-a[0])*60,indicatedAirspeed:null,trueAirspeed:null,mach:null,roll:null,squawk:'2000',onGround:t>=585,positionTime:0,receivedTime:0,source:'Synthetic scenario',simulated:true,route:['MEL','SIN']};
}
export function demoFlights(t){return [sampleFlight(t),sampleTakeoff(t),...others.slice(1).map((v,i)=>{let [lat,lon]=destination(v[4],v[5],v[6],v[8]*KT*(t-350));return {id:'demo-'+(i+1),callsign:v[0],airline:v[1],type:v[2],registration:v[3],lat,lon,altitude:Math.max(2000,v[7]+v[9]*(t-350)/60),geometricAltitude:null,groundSpeed:v[8],track:v[6],trueHeading:null,verticalRate:v[9],indicatedAirspeed:null,trueAirspeed:null,mach:null,roll:null,squawk:null,onGround:false,positionTime:0,receivedTime:0,source:'Synthetic scenario',simulated:true,route:v[10]};})];}
export const cities=[['Singapore',1.300,103.82],['JOHOR',1.73,103.62],['Batam',1.05,104.03],['Bintan',1.00,104.48],['SINGAPORE STRAIT',1.08,103.78],['SOUTH CHINA SEA',1.70,104.61],['Jurong',1.34,103.69],['Johor Bahru',1.475,103.74]];

export function sampleTakeoff(t){
 t=Math.max(0,Math.min(DEMO_DURATION,t));const after=Math.max(0,t-60),accel=Math.min(after,240),speed=t<60?1.25*t:75+.20*accel;
 const metres=t<60?.625*t*t:2250+75*after+.1*accel*accel+.2*240*Math.max(0,after-240);
 const [lat,lon]=destination(1.3445,103.9848,23,metres);const alt=22+Math.max(0,metres-2250)*.083/FT;
 return {id:'demo-tr18',callsign:'TR18',airline:'Scoot',registration:'9V-DEMO2',type:'B788',lat,lon,altitude:alt,geometricAltitude:alt,groundSpeed:speed/KT,track:23,trueHeading:null,verticalRate:t<60?0:speed*.083/FT*60,indicatedAirspeed:null,trueAirspeed:null,mach:null,roll:null,squawk:'2000',onGround:t<60,positionTime:0,receivedTime:0,source:'Synthetic scenario',simulated:true,route:['SIN','MEL']};
}
const scenarioCache=new Map();
export function scenarioTrack(id){if(!scenarioCache.has(id))scenarioCache.set(id,Array.from({length:70},(_,i)=>({...demoFlights(i*10).find(f=>f.id===id),scenarioSeconds:i*10})).filter(f=>f.id));return scenarioCache.get(id);}
