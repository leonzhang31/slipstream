const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);
vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
let packContacts=0;
for(const id of ['foundry','monza','scrapyard']){
 raceType='ai';carCount=20;difficulty='expert';durabilitySettings.ai='10';selectTrack(id);mode='running';car.driver='ai';
 let contacts=0,checkpoint;const originalImpact=impact;impact=(v,s)=>{if(s>35)contacts++;originalImpact(v,s)};
 for(let i=0;i<120*60;i++){
  elapsed+=1/120;for(const v of racers)updateRacer(v,1/120);bumpCars();
  if(i===120*40)checkpoint=racers.map(v=>v.total);
 }
 impact=originalImpact;packContacts+=contacts;
 const distances=racers.map(v=>v.total/circuitLength).sort((a,b)=>a-b);
 check(racers.every(v=>!v.wrecked&&Number.isFinite(v.x)&&Number.isFinite(v.y)),'durable pack remains physical and active on '+id);
 check(distances[0]>distances[19]*.68,'rear of pack keeps racing on '+id);
 check(racers.every((v,i)=>v.total-checkpoint[i]>800),'no car remains trapped through final twenty seconds on '+id);
 console.log('PASS twenty-car pack:',id,{contacts,slowestLap:distances[0],medianLap:distances[10]});
}
check(packContacts<400,'crowded starts avoid repeated contact cascades');

const fixture={id:'pack-test',name:'Pack test',kind:'arcade',theme:'park',polyline:true,width:130,ground:'#222',curb:'#fff',nodes:[[0,0],[20000,0],[20000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';durabilitySettings.ai='default';difficulty='expert';carCount=3;
for(const ahead of [-60,20]){
 selectTrack(fixture.id);
 Object.assign(car,{x:1120,y:0,angle:0,vx:0,vy:0});
 Object.assign(opponent,{x:1000,y:0,angle:0,vx:300,vy:0});
 Object.assign(racers[2],{x:1000+ahead,y:-60,angle:0,vx:ahead<0?500:300,vy:0});
 planTraffic(opponent,vehicleNear(opponent),300);
 check(opponent.ai.passOffset>0,'passes on free side without cutting off '+(ahead<0?'fast rear traffic':'alongside traffic'));
}
carCount=4;selectTrack(fixture.id);
Object.assign(opponent,{x:1000,y:0,angle:0,vx:300,vy:0});
for(const [v,y] of [[car,0],[racers[2],-65],[racers[3],65]])Object.assign(v,{x:1050,y,angle:0,vx:0,vy:0});
planTraffic(opponent,vehicleNear(opponent),300);
check(opponent.ai.trafficThrottle>=0&&opponent.ai.trafficThrottle<1,'blocked pack yields instead of ramming');
const before=opponent.vx;moveVehicle(opponent,0,1/120,false);
check(opponent.vx<before,'yield uses shared engine and drag physics');
for(const v of [car,racers[2],racers[3]])v.x=5000;
planTraffic(opponent,vehicleNear(opponent),Math.hypot(opponent.vx,opponent.vy));
check(opponent.ai.trafficThrottle===1,'clear road immediately restores full engine power');

carCount=2;selectTrack(fixture.id);
Object.assign(car,{x:1072,y:-32,angle:0,vx:300,vy:0});
Object.assign(opponent,{x:1000,y:32,angle:0,vx:300,vy:0});
planTraffic(opponent,vehicleNear(opponent),300);
check(opponent.ai.trafficOffset>25&&opponent.ai.passOffset>20,'staggered pack keeps its initial lane while a safe merge develops');
console.log('PASS rear/side clearance, occupied-corridor yielding, full-power release and separate starting lanes');
`,context);
