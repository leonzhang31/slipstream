const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
const fixture={id:'damage-test',name:'Damage test',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[30000,0],[30000,4000],[0,4000]]};
tracks.push(fixture);selectTrack(fixture.id);mode='running';
const body=(x,y,vx=200,vy=0)=>({x,y,vx,vy,angle:0,steer:0,spin:0,driver:'p1',model:'balanced',damage:0,finishTime:null});
let attacker=body(1000,ROAD/2-44,200,220),target=body(1000,ROAD/2-30);
resolveCars(attacker,target);check(target.vy>100,'shunt transfers force toward barrier');
check(attacker.damage>0&&target.damage>0,'hard contact damages both cars');
const beforeWall=target.damage;for(let i=0;i<120;i++)moveVehicle(target,0,1/120,true);
check(target.damage>beforeWall,'barrier impact adds damage after a shunt');
check(vehicleNear(target).d<=ROAD/2-7.9,'shunted car remains contained by barrier');
attacker=body(1000,0,350);target=body(1030,4,100);resolveCars(attacker,target);
check(Math.abs(attacker.spin)+Math.abs(target.spin)>.1,'offset rear shunt rotates cars');
const lightA=body(1000,0,110),lightB=body(1030,0,100);resolveCars(lightA,lightB);
check(lightA.damage===0&&lightB.damage===0,'light rubs do not cause damage');
let v=body(1000,0);damageCar(v,250);const initial=v.damage;
for(let i=0;i<50;i++)damageCar(v,250);check(v.damage===initial,'contact solver does not multiply damage per iteration');
damageCar(v,320);check(v.damage>initial&&v.damage<.3,'only additional severity counted in one contact burst');
for(let i=0;i<30;i++)moveVehicle(v,0,1/120,true);const after=v.damage;damageCar(v,250);check(v.damage>after,'a later separate hit causes new damage');
for(let i=0;i<20;i++){v.damageCooldown=0;damageCar(v,1000)}check(v.damage===1,'damage caps at 100 percent');
const healthy=body(1000,0,0),damaged=Object.assign(body(1000,0,0),{damage:.95});
for(let i=0;i<120*10;i++){moveVehicle(healthy,0,1/120,true);moveVehicle(damaged,0,1/120,true)}
check(damaged.vx<healthy.vx*.85&&damaged.vx>healthy.vx*.6,'nearly wrecked car remains drivable until zero health');
for(const type of ['ai','friend']){
 raceType=type;carCount=5;selectTrack(fixture.id);mode='running';
 for(const racer of racers)damageCar(racer,300);
 check(racers.every(r=>r.damage>0),'all human and AI cars take damage in '+type);
 car.damage=.75;opponent.damage=.25;updateHUD();check($('p1-damage').textContent==='BODY 25%'&&$('p2-damage').textContent==='BODY 75%','independent body condition displays');
 pause();const snapshot=car.damageCooldown;step(1);check(car.damageCooldown===snapshot,'pause freezes impact timers');pause();
 reset();check(racers.every(r=>r.damage===0&&r.hitStun===0),'restart repairs every car');
}
car.damage=.8;opponent.damage=.8;mode='running';step(1/120);check(particles.some(p=>p.damage),'heavily damaged cars emit capped smoke');
check(particles.length<=160,'damage smoke respects particle cap');
raceType='ai';carCount=3;selectTrack(fixture.id);mode='running';
opponent.damage=.99;damageCar(opponent,200);
check(opponent.wrecked&&opponent.finishTime===null&&opponent.damage===1,'zero-health AI retires without a false finish');
const wreckX=opponent.x,wreckProgress=opponent.total;for(let i=0;i<120;i++)updateRacer(opponent,1/120);
check(opponent.x===wreckX&&opponent.total===wreckProgress,'wrecked AI cannot move or gain progress');
check(standings().at(-1)===opponent,'retired AI ranks below live cars');
check(!resolveCars(car,opponent),'retired wreck does not block the race');
check(!checkWreckResult(),'AI retirement leaves human race running');
car.damage=.99;damageCar(car,200);step(1/120);
check(mode==='finished'&&!playerFinished&&car.finishTime===null,'solo zero health ends race as DNF');
check($('p1-damage').textContent==='WRECKED · DNF','zero health is explicit in the HUD');
begin();check(mode==='countdown'&&racers.every(r=>!r.wrecked&&r.damage===0),'restart repairs and re-enters all cars');
raceType='friend';carCount=2;selectTrack(fixture.id);mode='running';car.damage=.99;damageCar(car,200);
const retiredX=car.x;for(let i=0;i<60;i++)step(1/120);
check(mode==='running'&&car.x===retiredX&&Math.hypot(opponent.vx,opponent.vy)>0,'surviving local player continues driving');
opponent.damage=.99;damageCar(opponent,200);step(1/120);check(mode==='finished'&&!playerFinished,'both local wrecks end with DNF');
raceType='friend';selectTrack(fixture.id);mode='running';car.damage=.99;damageCar(car,200);finish(2);
check(opponent.finishTime!==null&&car.finishTime===null&&standings()[0]===opponent,'survivor can finish while wreck remains DNF');
selectTrack(fixture.id);car.damage=.999;updateHUD();check($('p1-damage').textContent==='BODY 1%','positive health never rounds prematurely to zero');
const impulseBody=body(1000,0,0);applyImpulse(impulseBody,0,40,10,0);
check(Math.abs(impulseBody.spin)>40*10*12/(34*34+16*16)*1.6,'offset impulse spins more than previous inertia');
const centered=body(1000,0,0);applyImpulse(centered,80,0,10,0);check(centered.spin===0,'centered impact does not invent a spin');
console.log('PASS barrier shunts, offset rotation, mutual damage, glancing contact, burst limits, performance, all modes, independent HUDs, pause, repair and smoke');
console.log('PASS zero-health AI/player retirement, DNF ranking/results, surviving local player, restart, health rounding and stronger offset spins');
`,context);
