const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
for(const type of ['ai','friend','derby'])for(const people of (type==='ai'?[1]:type==='friend'?[2,3,4]:[1,2,3,4])){
 raceType=type;localPlayers=type==='friend'?people:2;derbyPlayers=type==='derby'?people:1;
 for(const count of [Math.max(people,2),20]){
  if(type==='derby')derbyCars=count;else carCount=count;
  for(const definition of tracks){
   selectTrack(definition.id);
   check(racers.length===count&&humanRacers().length===people,'selected field and player count');
   check(racers.filter(v=>v.driver==='ai').length===count-people,'remaining cars are AI');
   check(new Set(racers.map(v=>v.color)).size===count,'every racer has a distinct color');
   check(new Set(racers.map(v=>v.total)).size===count,'grid slots stay unique');
   for(let i=0;i<count;i++)for(let j=0;j<i;j++)check(!carContact(racers[i],racers[j]),'no grid overlap on '+definition.id+' '+type+' '+people+'/'+count);
  }
 }
}
console.log('PASS up to twenty cars and four humans on every track in racing and derby');
raceType='friend';localPlayers=2;carCount=2;selectTrack('foundry');selectHumanCount(4);check(carCount===4&&humanCount()===4,'field grows to fit four people');selectCarCount(2);check(carCount===4,'cannot select fewer cars than humans');selectCarCount(20);
check(localStorage.getItem('slipstream-local-players')==='4','human count preference saved');
for(const d of HUMAN_DRIVERS)selectSetup(d,'grid',20);
check(new Set(humanRacers().map(v=>v.total)).size===4,'occupied grid slots swap across all humans');
for(const d of HUMAN_DRIVERS)resetSetup(d);
selectCar('p3','drift');selectSetup('p3','hp',500);selectCar('p4','agile');selectSetup('p4','hp',200);
check(racers[2].model==='drift'&&racers[3].model==='agile'&&setupFor(racers[2]).hp===500&&setupFor(racers[3]).hp===200,'P3 and P4 have independent cars and power');
const key=(event,value)=>windowEvents[event]({key:value,repeat:false,target:{tagName:'CANVAS'},preventDefault(){}});
key('keydown','a');key('keydown','ArrowRight');key('keydown','j');key('keydown','n');
check(controls.left&&friendControls.right&&extraControls.p3.left&&extraControls.p4.right,'all four keyboard pairs held simultaneously');
mode='running';const angles=humanRacers().map(v=>v.angle);step(1/120);
check(car.angle<angles[0]&&opponent.angle>angles[1]&&racers[2].angle<angles[2]&&racers[3].angle>angles[3],'all humans actually steer independently');
key('keyup','j');check(!extraControls.p3.left&&controls.left&&friendControls.right&&extraControls.p4.right,'releasing one player leaves other inputs intact');pause();check(Object.values(playerInputs).every(v=>!v.left&&!v.right),'pause clears every player input');pause();
const third=racers[2],fourth=racers[3];Object.assign(third,{vx:200,vy:0,total:circuitLength*1.3,damage:.25});Object.assign(fourth,{vx:300,vy:0,total:circuitLength*2.3,damage:.75});updateHUD();
check($('p3-speed').textContent==='120'&&$('p4-speed').textContent==='180','independent extra speedometers');
check($('p3-lap').html.startsWith('02')&&$('p4-lap').html.startsWith('03'),'independent extra laps');
check($('p3-damage').textContent==='BODY 75%'&&$('p4-damage').textContent==='BODY 25%','independent extra body condition');
check($('controls-label').textContent.includes('P3 J / L')&&$('controls-label').textContent.includes('P4 V / N'),'four-player hints visible');
const rects=viewRects();check(rects.length===4&&rects.every(r=>r.w===viewport.w/2&&r.h===viewport.h/2),'four equal quadrants');
check(cameras.length===4&&cameras.every((c,i)=>c.racer===racers[i]),'camera assigned to each human');
const oldX=cameras[2].x;third.x+=900;updateCameras(2);check(cameras[2].x>oldX+800,'third camera follows its own driver');draw();
finish(3);check(mode==='finished'&&third.finishTime!==null&&!playerFinished,'third player can finish');begin();mode='running';
const p4=racers[3];Object.assign(p4,{total:3*circuitLength-1,lastS:circuitLength-2,x:points[0].x,y:points[0].y,angle:carStartAngle(),vx:Math.cos(carStartAngle())*120,vy:Math.sin(carStartAngle())*120});updateRacer(p4,1/120);
check(mode==='finished'&&p4.finishTime!==null,'fourth player can finish through lap tracking');
begin();mode='running';for(const v of humanRacers().slice(0,3)){v.damage=.99;v.damageCooldown=0;damageCar(v,400)}check(!checkWreckResult(),'surviving fourth player keeps race alive');
const survivor=racers[3];survivor.damage=.99;survivor.damageCooldown=0;damageCar(survivor,400);check(checkWreckResult()&&mode==='finished','all four wrecks produce DNF');
console.log('PASS four controls/setups/HUDs/cameras, grid swaps, player-three/four finishes and wreck survival');
raceType='derby';derbyPlayers=4;derbyCars=20;difficulty='expert';selectTrack('scrapyard');mode='running';
for(const v of humanRacers()){damageCar(v,1000);check(Math.abs(v.damage-.056)<1e-10&&!v.wrecked,'all derby humans receive fivefold durability')}
for(let i=0;i<120*30&&mode==='running';i++){
 step(1/120);check(racers.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.spin)&&Math.hypot(v.vx,v.vy)<3000),'twenty-car physics stays stable');
 check(humanRacers().every(v=>v.damage>=.056-1e-10&&v.damage<=1),'party damage persists without healing');check(particles.length<=160&&marks.length<=4000,'party effects remain capped');
}
draw();begin();mode='running';for(const v of racers.filter(v=>v.driver==='ai')){v.damage=.99;v.damageCooldown=0;damageCar(v,400)}step(1/120);check(mode==='finished','clearing all AI completes multiplayer derby');
derbyCars=4;selectTrack('foundry');mode='running';step(1/120);check(mode==='running','human-only derby does not finish immediately');
for(const v of humanRacers().slice(0,3)){v.damage=.99;v.damageCooldown=0;damageCar(v,1000)}
check(!checkWreckResult()&&mode==='running','last surviving derby human continues');
updateHUD();check($('p1-damage').textContent==='WRECKED · DNF','derby wreck displayed');
const derbySurvivor=racers[3];derbySurvivor.damage=.99;derbySurvivor.damageCooldown=0;damageCar(derbySurvivor,1000);
check(checkWreckResult()&&mode==='finished','all derby humans wrecked ends in DNF');
for(const driver of ['p2','p3','p4']){
 begin();mode='running';const finisher=racers.find(v=>v.driver===driver);
 Object.assign(finisher,{total:3*circuitLength-1,lastS:circuitLength-2,x:points[0].x,y:points[0].y,angle:carStartAngle(),vx:Math.cos(carStartAngle())*120,vy:Math.sin(carStartAngle())*120});updateRacer(finisher,1/120);
 check(mode==='finished'&&finisher.finishTime!==null,'every local derby human can finish three laps');
}
derbyCars=20;selectTrack('foundry');mode='running';car.damage=.99;damageCar(car,1000);
for(const v of racers.filter(v=>v.driver==='ai')){v.damage=.99;damageCar(v,1000)}
step(1/120);check(mode==='finished'&&!playerFinished&&humanRacers().some(v=>!v.wrecked&&v.finishTime!==null),'all-bot elimination awards a surviving human');
raceType='ghost';selectTrack('foundry');check(racers.length===1&&humanCount()===1&&viewRects().length===1,'ghost mode remains solo');
raceType='friend';localPlayers=3;carCount=20;selectTrack('foundry');check(viewRects().length===3&&cameras.length===3&&!$('p3-stats').hidden&&$('p4-stats').hidden,'three-player layout works');
console.log('PASS twenty-car party derby stability, durability, elimination and lap finishes, three-player layout and solo ghost isolation');
`,context);
