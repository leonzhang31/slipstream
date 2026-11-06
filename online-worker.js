'use strict';
(()=>{
// A browser-hosted room runs the existing fixed-step engine in a worker.
const elements=new Map(),values=new Map();
const context2d=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:()=>{}});
function element(){return {textContent:'',innerHTML:'',value:'',style:{},hidden:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},blur(){},getBoundingClientRect(){return {width:1000,height:650}},getContext(){return context2d}}}
self.window={addEventListener(){},devicePixelRatio:1};
self.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},querySelector(){return element()},addEventListener(){}};
self.localStorage={getItem(key){return values.get(key)??null},setItem(key,value){values.set(key,String(value))}};
self.requestAnimationFrame=()=>{};
importScripts('usernames.js?v=1','data/circuits.js?v=2','game.js?v=39','lan-game.js?v=2','online-room.js?v=1');
let room=null,last=performance.now(),accumulator=0,broadcastClock=0;
self.onmessage=event=>{
 const m=event.data;
 if(m.type==='init'){
  room=self.SlipstreamRoom({engine:window.SlipstreamGame,invite:m.invite,code:m.code,send:(to,data)=>postMessage({to,data})});
  last=performance.now();postMessage({type:'worker-ready'});
 }else if(m.type==='message')room?.receive(m.connection,m.data);
 else if(m.type==='disconnect')room?.disconnect(m.connection);
 else if(m.type==='visibility')room?.visibility(m.hidden);
};
setInterval(()=>{
 const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;if(!room)return;
 accumulator+=dt;broadcastClock+=dt;
 while(accumulator>=1/120){room.tick(1/120);accumulator-=1/120}
 if(broadcastClock>=1/30){broadcastClock=0;room.emitState()}
},1000/120);
})();
