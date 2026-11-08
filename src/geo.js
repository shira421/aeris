// Vertical datums. ADS-B geometric altitude is GNSS height above the WGS84 ellipsoid;
// terrain and sea level follow the geoid (EGM96), up to ±107 m away. Pressure altitude is
// relative to 1013.25 hPa unless corrected. 3D placement needs height above mean sea level.
import grid from '../data/geoid-1deg.bin';
import {FT} from './core.ts';
/** EGM96 geoid undulation N in metres (MSL = ellipsoid height − N). Bilinear on a 1° grid. */
export function geoidHeight(lat,lon){
 const r=Math.min(Math.max(lat+90,0),180),c=(((lon+180)%360)+360)%360;
 const r0=Math.min(Math.floor(r),179),c0=Math.floor(c),fr=r-r0,fc=c-c0,c1=(c0+1)%360;
 const v=(i,j)=>(grid[i*360+j]<<24)>>24;// stored as signed bytes
 return v(r0,c0)*(1-fr)*(1-fc)+v(r0+1,c0)*fr*(1-fc)+v(r0,c1)*(1-fr)*fc+v(r0+1,c1)*fr*fc;
}
/**
 * Best estimate of height above mean sea level (metres) for drawing an aircraft over terrain.
 * Order: terrain contact when on the ground; GNSS height corrected by the geoid; pressure
 * altitude corrected with the reported QNH below 18,000 ft; plain pressure altitude.
 */
export function altitudeMSL(f,terrain=null){
 if(f.onGround&&terrain!==null)return {metres:terrain,basis:'Ground contact (terrain model)'};
 let m=null,basis='Unavailable';
 if(f.geometricAltitude!==null&&f.geometricAltitude!==undefined){m=f.geometricAltitude*FT-geoidHeight(f.lat,f.lon);basis='GNSS height, geoid-corrected (EGM96)';}
 else if(f.altitude!==null&&f.altitude!==undefined){
  const q=f.navQnh;
  if(q&&q>940&&q<1060&&f.altitude<18000){m=(f.altitude+(q-1013.25)*27.3)*FT;basis='Pressure altitude, QNH-corrected';}
  else{m=f.altitude*FT;basis='Pressure altitude (standard atmosphere)';}
 }
 if(m!==null&&terrain!==null&&m<terrain+2){m=terrain+2;basis+=' · held above terrain';}
 return {metres:m,basis};
}
