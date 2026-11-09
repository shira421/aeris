import test from 'node:test';
import assert from 'node:assert/strict';
import {createWatchSync, syncWatchList} from './lib/device.js';
import {nativeCall} from './lib/net.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const flight={callsign:'SIA22',notify:true,route:null,state:null};

test('a failed native save is reported and the same watch list can be retried',async()=>{
 let attempts=0,errors=[];
 const sync=createWatchSync(async items=>{assert.deepEqual(items,[flight]);if(++attempts===1)throw Error('scheduler unavailable');},{onError:e=>errors.push(e.message)});
 assert.equal(await sync([flight]),false);
 assert.equal(await sync([flight]),true);
 assert.equal(await sync([flight]),true);
 assert.equal(attempts,2);
 assert.deepEqual(errors,['scheduler unavailable']);
});

test('rapid alert and trip edits serialize writes and keep the latest snapshot',async()=>{
 const writes=[],release=[];
 const sync=createWatchSync(items=>{writes.push(items);return new Promise(resolve=>release.push(resolve));});
 const first=sync([flight]);await tick();
 sync([{...flight,notify:false}]);
 const latest=sync([]); // removing a flight must not be undone by an earlier native write
 assert.equal(writes.length,1);
 release.shift()();await tick();
 assert.deepEqual(writes,[[flight],[]]);
 release.shift()();assert.equal(await first,true);assert.equal(await latest,true);
 await sync([]); // acknowledged duplicates must not leave the queue stuck
 const added=sync([flight]);await tick();
 assert.equal(writes.length,3);release.shift()();await added;
});

test('iOS watch failures propagate, missing replies time out, and the next call can succeed',async()=>{
 const previous=globalThis.webkit;
 try{
  globalThis.webkit={messageHandlers:{aerisNet:{},aerisDevice:{postMessage:async()=>{throw Error('device failure');}}}};
  await assert.rejects(syncWatchList([flight]),/device failure/);
  globalThis.webkit.messageHandlers.aerisDevice.postMessage=()=>new Promise(()=>{});
  await assert.rejects(nativeCall('watch',{items:[flight]},20),/No answer/);
  globalThis.webkit.messageHandlers.aerisDevice.postMessage=async message=>message.items.length===1;
  assert.equal(await syncWatchList([flight]),true);
 }finally{if(previous===undefined)delete globalThis.webkit;else globalThis.webkit=previous;}
});
