const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);
vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
const fixture={id:'traffic-test',name:'Traffic test',kind:'arcade',theme:'park',polyline:true,width:130,ground:'#222',curb:'#fff',nodes:[[0,0],[20000,0],[20000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';carCount=2;
let hits=0;const oldImpact=impact;impact=(v,s)=>{if(v===opponent&&s>35)hits++;oldImpact(v,s)};
for(const name of Object.keys(aiLevels)){
 difficulty=name;selectTrack(fixture.id);mode='running';hits=0;
 Object.assign(car,{x:1200,y:0,angle:0,vx:0,vy:0});Object.assign(opponent,{x:960,y:0,angle:0,vx:300,vy:0,total:960,lastS:960});opponent.ai.nextMistake=Infinity;
 let passed=null;
 for(let i=0;i<120*8;i++){
  elapsed+=1/120;Object.assign(car,{x:1200,y:0,vx:0,vy:0,spin:0});updateRacer(opponent,1/120);bumpCars();
  if(passed===null&&opponent.x>1260)passed=elapsed;
 }
 check(passed!==null&&passed<3,name+' must pass a parked car promptly');
 if(name==='expert')check(hits===0,'Expert anticipates and passes a parked car without crashing');
 check(Math.abs(opponent.ai.trafficOffset)<3,'returns smoothly to normal line once clear');
 console.log('PASS traffic pass:',name,{seconds:passed,contacts:hits});
}
impact=oldImpact;difficulty='expert';carCount=3;selectTrack(fixture.id);mode='running';
Object.assign(car,{x:1200,y:-22,angle:0,vx:0,vy:0});Object.assign(racers[2],{x:1200,y:22,angle:0,vx:0,vy:0});
Object.assign(opponent,{x:900,y:0,angle:0,vx:300,vy:0,total:900,lastS:900});opponent.ai.nextMistake=Infinity;
for(let i=0;i<120*5;i++){
 elapsed+=1/120;Object.assign(car,{x:1200,y:-22,vx:0,vy:0,spin:0});Object.assign(racers[2],{x:1200,y:22,vx:0,vy:0,spin:0});
 updateRacer(opponent,1/120);bumpCars();
}
check(opponent.x>1700,'finds an open lane around two stopped cars');
console.log('PASS passing a two-car blockage');
carCount=2;selectTrack(fixture.id);Object.assign(car,{x:900,y:0,vx:300,vy:0});Object.assign(opponent,{x:1000,y:0,angle:0,vx:300,vy:0});
planTraffic(opponent,nearest(opponent.x,opponent.y),300);check(opponent.ai.passOffset===0,'car behind does not trigger a pass');
car.x=1250;planTraffic(opponent,nearest(opponent.x,opponent.y),300);check(opponent.ai.passOffset===0,'distant same-speed car does not trigger weaving');
car.vx=0;planTraffic(opponent,nearest(opponent.x,opponent.y),300);check(Math.abs(opponent.ai.passOffset)>40,'closing speed triggers early passing');
const side=Math.sign(opponent.ai.passOffset);Object.assign(opponent,{y:side*60});
planTraffic(opponent,nearest(opponent.x,opponent.y),300);check(Math.sign(opponent.ai.passOffset)===side,'holds passing side while alongside');
impact(opponent,100);planTraffic(opponent,nearest(opponent.x,opponent.y),300);check(Math.sign(opponent.ai.passOffset)===side,'impact recovery retains passing lane');
console.log('PASS closing-speed awareness, stable passing side and lane retention after contact');
// Strong spins still use ordinary steering and shared physics to recover.
for(const spin of [-5,5]){
 selectTrack(fixture.id);mode='running';car.x=10000;
 Object.assign(opponent,{x:1000,y:ROAD/2-12,angle:Math.PI/2,vx:0,vy:0,spin,total:1000,lastS:1000});opponent.ai.nextMistake=Infinity;
 for(let i=0;i<120*12;i++){elapsed+=1/120;updateRacer(opponent,1/120);bumpCars()}
 check(opponent.vx>100&&Math.cos(opponent.angle)>.8&&Math.abs(opponent.y)<50,'recovers forward motion and alignment after a wall-facing spin');
}
console.log('PASS post-impact steering recovery');
// An open-road pack must not perform the full wall/contact iteration budget.
carCount=5;selectTrack(fixture.id);
for(let i=0;i<racers.length;i++)Object.assign(racers[i],{x:2000+i*100,y:0,angle:0});
const realNearest=nearest;let wallQueries=0;nearest=(x,y)=>{wallQueries++;return realNearest(x,y)};
bumpCars();nearest=realNearest;
check(wallQueries<=10,'clear pack skips redundant wall/contact work');
console.log('PASS clear-pack collision workload:',wallQueries,'road queries');
tracks.pop();carCount=5;
for(const name of ['standard','expert']){
 difficulty=name;selectTrack('foundry');mode='running';car.driver='ai';
 for(let i=0;i<120*420&&racers.some(v=>v.finishTime===null);i++){
  elapsed+=1/120;for(const v of racers)updateRacer(v,1/120);bumpCars();
 }
 check(racers.every(v=>v.finishTime!==null),'entire '+name+' field completes a race in traffic');
 console.log('PASS full five-car traffic race:',name,racers.map(v=>Math.round(v.finishTime)));
}

`,context);
