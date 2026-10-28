const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
const fixture={id:'new-features-test',name:'Feature straight',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[30000,0],[30000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';difficulty='expert';selectTrack(fixture.id);
const passes={};for(const personality of Object.keys(rivalStyles)){
 Object.assign(car,{x:1200,y:0,angle:0,vx:0,vy:0});Object.assign(opponent,{x:960,y:0,angle:0,vx:300,vy:0,personality});
 Object.assign(opponent.ai,{passOffset:0,passHold:0,passTarget:null});planTraffic(opponent,vehicleNear(opponent),300);passes[personality]=Math.abs(opponent.ai.passOffset);
}
check(passes.cautious>passes.racer&&passes.racer>passes.aggressive,'personalities choose visibly different passing clearance');
carCount=5;selectRivalStyle('mixed');check(new Set(racers.filter(v=>v.driver==='ai').map(v=>v.personality)).size===3,'mixed field contains all three styles');
selectRivalStyle('cautious');check(racers.filter(v=>v.driver==='ai').every(v=>v.personality==='cautious'),'selected style applies to all AI');
check(localStorage.getItem('slipstream-rival-style')==='cautious','style preference saved');selectRivalStyle('invalid');check(rivalStyle==='mixed','invalid style defaults safely');
console.log('PASS rival clearance differences, mixed fields, selection and persistence');
function body(){return {x:1000,y:0,angle:.4,vx:200,vy:0,steer:.6,spin:0,driver:'p1',model:'balanced',finishTime:null,boostCharge:0,boostTimer:0,boostCooldown:0}}
let v=body();for(let i=0;i<120*3;i++)updateBoost(v,1/120);
check(v.boostCharge>.99&&v.boostTimer===0,'clean sustained drift charges without activating mid-corner');
v.angle=0;v.steer=0;updateBoost(v,1/120);check(v.boostTimer>.6&&v.boostTimer<=.65&&v.boostCooldown===4,'corner exit automatically triggers bounded burst');
const boosted={...v},plain={...v,boostTimer:0,boostCooldown:0};
for(let i=0;i<120;i++){moveVehicle(boosted,0,1/120,true);updateBoost(boosted,1/120);moveVehicle(plain,0,1/120,true);updateBoost(plain,1/120)}
check(boosted.vx>plain.vx&&boosted.vx<plain.vx*1.06,'boost gives a small real speed advantage');
check(boosted.boostTimer===0&&boosted.boostCooldown>2,'burst expires and cooldown persists');
boosted.angle=.4;boosted.steer=.6;for(let i=0;i<120;i++)updateBoost(boosted,1/120);check(boosted.boostCharge===0,'cooldown prevents chaining charge');
for(const mutate of [v=>v.angle=0,v=>v.vx=40,v=>v.angle=1.2,v=>v.y=ROAD/2-10]){const b=body();mutate(b);for(let i=0;i<360;i++)updateBoost(b,1/120);check(b.boostCharge===0,'straight, slow, spinning or wall-scraping cars cannot farm boost')}
v=body();v.boostCharge=1;v.boostTimer=.5;impact(v,100);check(v.boostCharge===0&&v.boostTimer===0,'impact cancels boost');
v=body();v.wrecked=true;v.boostTimer=.5;updateBoost(v,1/120);check(v.boostTimer===0,'wreck cannot boost');
raceType='friend';carCount=2;selectTrack(fixture.id);mode='running';car.boostTimer=.5;car.boostCooldown=4;opponent.boostCharge=.65;updateHUD();
check(car.boostTimer===.5&&opponent.boostTimer===0&&opponent.boostCharge===.65,'boost states remain independent for both players');
pause();step(1);check(car.boostTimer===.5&&opponent.boostCharge===.65,'pause freezes both boost states');pause();reset();
check(racers.every(v=>v.boostTimer===0&&v.boostCharge===0&&v.boostCooldown===0),'restart clears boost in all racers');
console.log('PASS clean drift charge, automatic exit, limited speed gain/duration, cooldown, farming and collision protection');
raceType='ghost';carChoices.p1='balanced';selectTrack('foundry');
check(racers.length===1&&opponent===car,'time trial contains exactly one physical racer');
check($('car-count-group').hidden&&$('difficulty-group').hidden&&$('rival-style-group').hidden,'race-only settings hidden in time trial');
check(!personalGhost&&ghostStatus().includes('SET A LAP'),'first visit explains how to create a ghost');
windowEvents.keydown({key:'ArrowRight',repeat:false,target:{tagName:'CANVAS'},preventDefault(){}});check(controls.right,'arrow steering works in ghost mode');clearControls();
mode='running';car.driver='ai';
for(let i=0;i<120*180&&car.total<circuitLength;i++){
 elapsed+=1/120;updateRacer(car,1/120);progress=car.total;recordGhost(1/120);updateBoost(car,1/120);
}
check(car.total>=circuitLength&&!car.wrecked,'real simulated lap completes with boost');car.driver='p1';saveGhostLap(elapsed);
check(personalGhost&&personalGhost.samples.length>100&&ghostPersisted,'completed lap saves sampled replay');
const savedKey=ghostKey(),savedTime=personalGhost.time,savedData=localStorage.getItem(savedKey);
loadPersonalGhost();check(personalGhost?.time===savedTime,'saved replay reloads with its time');
const midpoint=personalGhost.samples[Math.floor(personalGhost.samples.length/2)];elapsed=midpoint[0]+.5;lapStart=0;progress=midpoint[4];
check(ghostStatus().includes('BEHIND PB')&&!ghostStatus().includes('NaN'),'lap delta compares matching progress');
const pose=ghostPose();check(pose&&Number.isFinite(pose.x)&&Number.isFinite(pose.angle),'replay interpolates pose');
const beforeTime=personalGhost.time;saveGhostLap(beforeTime+1);check(personalGhost.time===beforeTime,'slower lap does not overwrite PB');
startGhostLap();check(lapSamples[0][4]===0,'new lap resets sample progress');
car.x=pose.x;car.y=pose.y;car.vx=300;car.vy=0;updateDrafts(1/120);bumpCars();check(car.draft===0&&racers.length===1,'ghost cannot collide or provide draft');
selectCar('p1','agile');check(!personalGhost,'replays isolated by car');selectCar('p1','balanced');check(personalGhost?.time===savedTime,'original car reloads its own PB');
selectTrack('monza');check(!personalGhost,'replays isolated by track');selectTrack('foundry');
localStorage.setItem(savedKey,'{bad json');loadPersonalGhost();check(personalGhost===null,'corrupt replay ignored');
localStorage.setItem(savedKey,savedData);loadPersonalGhost();
const bad=JSON.parse(savedData);bad.samples[1][0]=-1;localStorage.setItem(savedKey,JSON.stringify(bad));loadPersonalGhost();check(!personalGhost,'invalid replay timing ignored');
localStorage.setItem(savedKey,savedData);loadPersonalGhost();
// A storage failure keeps the new PB usable for the current session.
lapSamples=personalGhost.samples.map(s=>[s[0]*.98,...s.slice(1)]);const originalSet=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota')};
saveGhostLap(savedTime*.98);check(personalGhost.time<savedTime&&!ghostPersisted,'quota failure keeps in-memory PB');localStorage.setItem=originalSet;
reset();check(lapSamples.length===1&&lapSamples[0][4]===0&&car.boostCharge===0,'restart clears recording and boost');
const ghostBeforeWreck=personalGhost;car.wrecked=true;saveGhostLap(4);check(personalGhost===ghostBeforeWreck,'wrecked lap cannot replace a valid PB');car.wrecked=false;
mode='running';const frozenSamples=lapSamples.length;pause();step(1);check(lapSamples.length===frozenSamples,'pause freezes recording');pause();
finish();check(mode==='finished'&&playerFinished,'ghost session has a working finish path');
raceType='ai';selectTrack('foundry');check(racers.length===carCount&&!$('car-count-group').hidden,'switching back restores normal racing');
console.log('PASS real-lap ghost recording, playback, delta, keyboard, isolation, persistence, corrupt data, quota handling, pause, restart and mode switches');
`,context);
