const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
raceType='derby';carCount=2;derbyStart=5;
for(const definition of tracks){
 selectTrack(definition.id);
 check(racers.length===10&&racers.filter(v=>v.driver==='ai').length===9,'exactly ten derby cars');
 check(car.total===-208,'player starts in midfield by default');
 check(new Set(racers.map(v=>v.color)).size===10,'all ten racers have distinct colors');
 check(racers.slice(1).every(v=>v.personality==='aggressive'),'every derby rival is aggressive');
 for(let i=0;i<10;i++)for(let j=0;j<i;j++)check(!carContact(racers[i],racers[j]),'compact grid is clear on '+definition.id);
 draw();
}
check(!$('car-count-group').hidden&&$('rival-style-group').hidden,'derby exposes car count while keeping aggressive personalities fixed');
selectSetup('p1','grid',10);check(car.total===-468&&derbyStart===10,'derby supports tenth starting slot');resetSetup('p1');check(derbyStart===5,'factory restores midfield derby start');
const factoryKey=bestKey();raceType='ai';selectTrack('foundry');check(bestKey()!==factoryKey,'derby records separate from normal racing');
const fixture={id:'derby-test',name:'Derby test',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[30000,0],[30000,4000],[0,4000]]};
tracks.push(fixture);raceType='derby';selectTrack(fixture.id);mode='running';
const target=opponent;
for(const wall of [false,true]){
 damageCar(car,400,car.x,car.y,wall);damageCar(target,400,target.x,target.y,wall);
 check(Math.abs(car.damage*5-target.damage)<1e-10,'fivefold human durability for car and wall impacts');
 const previous=car.damage;damageCar(car,400,car.x,car.y,wall);check(car.damage===previous,'repeated solver contacts do not stack damage');
}
check(car.damage>0&&!car.wrecked&&car.hitStun>0,'humans take real damage and hit stun');
updateHUD();check($('p1-damage').textContent==='BODY 89%'&&$('position').html.includes('/ 10'),'HUD shows remaining health and ten-car field');
for(let i=0;i<20;i++){target.damageCooldown=0;damageCar(target,1000);car.damageCooldown=0;damageCar(car,1000)}
check(target.wrecked&&car.wrecked,'both bots and durable humans can wreck');
moveVehicle(car,0,1/120,true);check(car.damage===1&&car.wrecked&&car.vx===0&&car.vy===0,'wrecks stay retired through physics');
check(checkWreckResult()&&mode==='finished','solo derby wreck ends in DNF');
console.log('PASS ten-car grids, colors, starts, fivefold durability, real wrecks, health HUD and isolated records');
function body(){return{x:1000,y:0,vx:0,vy:0,angle:0,spin:0,steer:0,driver:'ai',finishTime:null}}
raceType='ai';const ordinary=body();applyImpulse(ordinary,0,20,10,0);raceType='derby';const chaotic=body();applyImpulse(chaotic,0,20,10,0);
check(chaotic.spin>ordinary.spin*1.8,'derby increases impact spin');
const dampingA={...ordinary,hitStun:.4},dampingB={...ordinary,hitStun:.4};raceType='ai';moveVehicle(dampingA,0,1/120,false);raceType='derby';moveVehicle(dampingB,0,1/120,false);check(dampingB.spin>dampingA.spin,'derby spins last longer');
selectTrack(fixture.id);mode='running';Object.assign(car,{x:1200,y:0,angle:0,vx:200,vy:0});Object.assign(opponent,{x:1080,y:0,angle:0,vx:300,vy:0});
opponent.ai.derbyCooldown=0;const attack=derbyAim(opponent,vehicleNear(opponent),300);check(attack&&opponent.ai.derbyTarget===car&&opponent.ai.derbyAttack>0,'rivals deliberately attack nearby rear quarters');
raceType='ai';check(derbyAim(opponent,vehicleNear(opponent),300)===null,'deliberate attacks confined to derby');
raceType='derby';selectTrack('scrapyard');mode='running';let attacks=0,maxSpin=0;
for(let i=0;i<120*90&&mode==='running';i++){
 step(1/120);
 check(car.damage>=0&&car.damage<=1,'human damage stays bounded in a live derby');
 if(car.wrecked)check(mode==='finished'&&car.damage===1,'live player wreck ends derby without healing');
 check(racers.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.spin)&&Math.hypot(v.vx,v.vy)<2500),'ten-car collision simulation stays stable');
 check(particles.length<=160&&marks.length<=4000,'chaos effects remain bounded');
 for(const v of racers){if(v.ai.derbyAttack>0)attacks++;maxSpin=Math.max(maxSpin,Math.abs(v.spin))}
}
check(attacks>0&&maxSpin>1,'live derby produces attacks and large spins');
check(racers.slice(1).some(v=>v.damage>0||v.wrecked),'chaos causes rival damage');
console.log('PASS amplified spins, deliberate contact, 90-second ten-car stability and bounded effects');
selectTrack(fixture.id);mode='running';opponent.total=3*circuitLength+10;updateRacer(opponent,1/120);check(opponent.finishTime===null,'derby rivals keep racing past lap three');
for(const v of racers.slice(1)){v.damage=.99;v.damageCooldown=0;damageCar(v,400)}step(1/120);check(mode==='finished'&&playerFinished,'wrecking all rivals completes derby');
begin();check(racers.length===10&&racers.every(v=>!v.wrecked&&v.damage===0),'restart restores ten healthy cars');
mode='running';for(let i=1;i<racers.length;i++){const p=sampleTrack(1000+i*80);racers[i].x=p.x;racers[i].y=p.y;racers[i].angle=p.angle}
lap=3;progress=circuitLength;lastS=circuitLength-2;car.x=points[0].x;car.y=points[0].y;car.angle=carStartAngle();car.vx=Math.cos(car.angle)*80;car.vy=Math.sin(car.angle)*80;step(1/120);check(mode==='finished','three player laps can also complete derby');
raceType='ai';selectTrack('foundry');check(racers.length===2&&!$('car-count-group').hidden,'normal field restored after derby');car.damage=.99;car.damageCooldown=0;damageCar(car,400);check(car.wrecked,'normal player damage restored');
console.log('PASS both derby end conditions, restart and restoration of normal rules');
`,context);
