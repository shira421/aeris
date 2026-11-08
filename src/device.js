// Location and notifications, through the native app when present, otherwise browser APIs.
import {bridge,nativeCall} from './net.js';
const g=typeof window!=='undefined'?window:globalThis;
/** Current position {lat, lon, accuracy}. Asks for permission the first time. */
export async function currentLocation(){
 if(bridge())return nativeCall('location');
 if(!g.navigator?.geolocation)throw new Error('Location is not available on this device.');
 return new Promise((resolve,reject)=>g.navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),err=>reject(new Error(err.code===1?'Location permission was not given.':'Your location could not be found.')),{enableHighAccuracy:false,maximumAge:120000,timeout:15000}));
}
/** 'granted' | 'denied' | 'default' | 'unsupported'. With request=true, asks the user. */
export async function notificationPermission(request=false){
 if(bridge()){try{return (await nativeCall('notifyPermission',{request}))||'default';}catch{return 'unsupported';}}
 if(!('Notification' in g))return 'unsupported';
 if(request&&g.Notification.permission==='default')return g.Notification.requestPermission();
 return g.Notification.permission;
}
export async function notify(title,body,tag){
 if(bridge())return nativeCall('notify',{title,body,id:tag});
 if(!('Notification' in g)||g.Notification.permission!=='granted')return;
 const reg=await g.navigator.serviceWorker?.getRegistration?.().catch(()=>null);
 if(reg?.showNotification)return reg.showNotification(title,{body,tag,icon:'./icons/icon-192.png'});
 new g.Notification(title,{body,tag,icon:'./icons/icon-192.png'});
}
/** Hand the watched flights to the iOS or Android app, which checks them in the background now and then. */
export async function syncWatchList(items){if(bridge()){try{await nativeCall('watch',{items});}catch{}}}
/** Whether alerts can arrive while Aeris is closed (the apps check in the background; browsers cannot). */
export const backgroundChecks=()=>Boolean(bridge());
