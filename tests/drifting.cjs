const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
for(const level of Object.keys(aiLevels))for(const definition of tracks){
 difficulty=level;raceType='ai';carCount=2;selectTrack(definition.id);mode='running';
 let driftTicks=0,counterTicks=0,initiations=0,smoke=false;
 for(let i=0;i<120*500&&opponent.total<circuitLength;i++){
  elapsed+=1/120;updateRacer(opponent,1/120);updateTireEffects(opponent,1/120);
  const state=driftState(opponent);
  if(state.active){driftTicks++;if(opponent.steer*state.angle<0)counterTicks++}
  if(Math.abs(opponent.ai.driftAim||0)>.002)initiations++;
  if(particles.length)smoke=true;
  // Keep the fixture effect history bounded as the real game loop does.
  particles=[];if(marks.length>4000)marks.splice(0,marks.length-4000);
 }
 check(opponent.total>=circuitLength,level+' finishes '+definition.id);
 check(driftTicks>60,level+' has sustained physical drift on '+definition.id);
 check(counterTicks>0,level+' countersteers on '+definition.id);
 check(initiations>0,level+' intentionally initiates drifts on '+definition.id);
 check(marks.length>0&&smoke,level+' produces real tire effects on '+definition.id);
 console.log('PASS AI drift:',level,definition.id,driftTicks,'ticks');
}
selectTrack('foundry');difficulty='expert';
for(const model of Object.keys(carModels)){
 const common={x:car.x,y:car.y,angle:car.angle,vx:150,vy:60,steer:0,spin:0,model,finishTime:null};
 const human={...common,driver:'p1'},ai={...common,driver:'ai'};
 for(let i=0;i<30;i++){moveVehicle(human,.5,1/120,true);moveVehicle(ai,.5,1/120,false)}
 check(Math.abs(human.vx-ai.vx)<.000001&&Math.abs(human.vy-ai.vy)<.000001&&Math.abs(human.angle-ai.angle)<.000001,'AI and humans share drift physics for '+model);
}
marks=[];particles=[];score=0;
for(let i=0;i<5;i++){
 const v={x:i*100,y:0,angle:.5,vx:200,vy:0,finishTime:null,driver:i?'ai':'p1'};
 updateTireEffects(v,1/120);check(v.drifting,'all drivers use actual drift state');
}
check(marks.length===10&&particles.length===10,'all five cars emit tire marks and smoke');
check(score===0,'AI effects do not award player points');
const markCount=marks.length;
for(const v of [{x:0,y:0,angle:0,vx:200,vy:0,finishTime:null},{x:0,y:0,angle:1,vx:0,vy:0,finishTime:null},{x:0,y:0,angle:.5,vx:200,vy:0,finishTime:1}])updateTireEffects(v,1/120);
check(marks.length===markCount,'no fake drifting while straight, stationary or finished');
const v={x:0,y:0,angle:.5,vx:200,vy:0,finishTime:null};marks=[];particles=[];
for(let i=0;i<120;i++)updateTireEffects(v,1/120);
check(marks.length<=62&&particles.length<=160,'effect workload is bounded at 30 Hz per car');
reset();check(racers.every(v=>!v.drifting&&v.tireTimer===0),'restart clears drift effects');
console.log('PASS shared human/AI tire physics, five-car effects, no false drifting/scoring, bounded emissions and reset');
`,context);
