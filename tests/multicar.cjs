const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);
vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
for(const type of ['ai','friend'])for(const count of [2,3,4,5]){
 raceType=type;selectCarCount(count);
 check(racers.length===count,'selected total car count');
 check(racers.filter(v=>v.driver==='ai').length===count-(type==='friend'?2:1),'correct number of AI drivers');
 check($('difficulty-group').hidden===(type==='friend'&&count===2),'AI difficulty available with mixed human/AI field');
 check($('position').html.includes('/ 0'+count),'HUD uses selected field size');
 for(const definition of tracks){
  selectTrack(definition.id);
  for(let i=0;i<count;i++){
   check(racers[i].total===-72*i,'staggered longitudinal spacing');
   for(let j=0;j<i;j++)check(!carContact(racers[i],racers[j]),'no grid overlaps on '+track.id);
  }
  begin();const positions=racers.map(v=>[v.x,v.y]);step(.5);
  check(racers.every((v,i)=>v.x===positions[i][0]&&v.y===positions[i][1]),'entire grid waits for countdown');
 }
 begin();mode='running';for(let i=0;i<120*8;i++)step(1/120);
 check(racers.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.spin)),'all field bodies remain finite');
 check(racers.filter(v=>v.driver==='ai').every(v=>v.total>0),'all AI leave the grid');
 const translations=[];miniCtx.translate=(x,y)=>translations.push([x,y]);drawMinimap();delete miniCtx.translate;
 check(racers.every(v=>translations.some(p=>p[0]===v.x&&p[1]===v.y)),'every racer appears on minimap');
 draw();
}
selectCarCount(100);check(carCount===20,'maximum twenty');selectCarCount('invalid');check(carCount===2,'invalid count defaults to two');
console.log('PASS 2–5 car fields, solo/friend mixed grids on all circuits, countdown, rendering and minimap');
const fixture={id:'collision-test',name:'Collision test',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[20000,0],[20000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';selectTrack(fixture.id);
const body=(x,y,angle=0,vx=0,vy=0)=>({x,y,angle,vx,vy,spin:0,steer:0,finishTime:null,driver:'p2'});
const energy=v=>.5*(v.vx*v.vx+v.vy*v.vy+v.spin*v.spin/INVERSE_INERTIA);
let a=body(1000,0,0,400),b=body(1030,0,0,80);const momentum=a.vx+b.vx,before=energy(a)+energy(b);
resolveCars(a,b);
check(a.vx<400&&b.vx>80,'rear impact exchanges speed');
check(Math.abs(a.vx+b.vx-momentum)<1e-7,'collision conserves linear momentum');
check(energy(a)+energy(b)<=before+.001,'collision does not add energy');
check(Math.abs(a.spin)<.001&&Math.abs(b.spin)<.001,'centered rear impact does not spin cars');
check((carContact(a,b)?.depth||0)<.03,'car shapes separate');
a=body(1000,0,0,300,80);b=body(1018,14,0,240,0);const sideswipeBefore=energy(a)+energy(b);resolveCars(a,b);
check(Math.abs(a.spin)+Math.abs(b.spin)>.01,'offset sideswipe creates rotation');
check(energy(a)+energy(b)<=sideswipeBefore+.001,'sideswipe dissipates energy');
a=body(1000,0,Math.PI/4,400,0);b=body(1020,0,-Math.PI/4,-400,0);const headOnBefore=energy(a)+energy(b);resolveCars(a,b);
check(energy(a)+energy(b)<=headOnBefore+.001,'angled head-on hit dissipates energy');
a=body(1000,0);b=body(1000,17);check(!carContact(a,b),'nearby parallel cars do not falsely collide like circles');
for(let i=0;i<20;i++)resolveCars(a,b);check(a.vx===0&&b.vx===0,'resting cars do not gain velocity');
let grazing=body(1000,ROAD/2-6,0,400,35);resolveWall(grazing);
check(grazing.vx>370,'wall glance preserves tangential momentum');
let frontal=body(1000,ROAD/2-6,Math.PI/2,0,400);resolveWall(frontal);
check(Math.abs(frontal.vy)<100,'head-on wall hit loses speed');
let corner=body(1000,ROAD/2-13,.6,0,250);resolveWall(corner);
check(Math.abs(corner.spin)>.1,'nose wall clip rotates chassis');
// Repeated high speed integrations must detect collision before cars pass through.
car=body(1000,0,0,500);opponent=body(1060,0,Math.PI,-500);racers=[car,opponent];
for(let i=0;i<12;i++){for(const v of racers){v.x+=v.vx/120;v.y+=v.vy/120}bumpCars()}
check(car.x<opponent.x&&car.vx<500&&opponent.vx>-500,'high speed head-on contact does not tunnel');
// A pack resting against a wall must settle without large impulses or escape.
racers=Array.from({length:5},(_,i)=>body(1000+i*8,ROAD/2-5-i*3,0,100,80));car=racers[0];opponent=racers[1];
for(let i=0;i<120;i++){
 for(const v of racers){v.x+=v.vx/120;v.y+=v.vy/120;v.angle+=v.spin/120;v.spin*=.98}
 bumpCars();
 check(racers.every(v=>Number.isFinite(v.x)&&Math.hypot(v.vx,v.vy)<200),'pileup remains stable');
}
for(const v of racers)for(const offset of [-9,0,9])check(nearest(v.x+Math.cos(v.angle)*offset,v.y+Math.sin(v.angle)*offset).d<=ROAD/2-7.9,'whole chassis stays within walls');
for(let i=0;i<5;i++)for(let j=0;j<i;j++)check((carContact(racers[i],racers[j])?.depth||0)<.15,'pileup separates');
tracks.pop();selectCarCount(5);raceType='friend';selectTrack('foundry');
// Ranking counts AI positions; the human gap stays mirrored between P1 and P2.
progress=200;opponent.total=260;racers[2].total=400;racers[3].total=100;racers[4].total=0;updateHUD();
check($('position').html.startsWith('03')&&$('p2-position').html.startsWith('02'),'positions include AI in friend race');
check($('p1-gap').textContent==='10 M BEHIND'&&$('p2-gap').textContent==='10 M AHEAD','human gap stays symmetric in five-car race');
console.log('PASS momentum, energy, car-shaped contact, rotation, glancing/frontal walls, high-speed contacts, pileups and mixed standings');
// Drive a complete five-car race through the actual AI controllers and contact solver.
raceType='ai';difficulty='standard';selectTrack('foundry');mode='running';car.driver='ai';
for(let i=0;i<120*600&&racers.some(v=>v.finishTime===null);i++){
 elapsed+=1/120;for(const v of racers)updateRacer(v,1/120);bumpCars();
}
check(racers.every(v=>v.finishTime!==null),'all five cars can complete three laps in traffic');
console.log('PASS five-car full race:',racers.map(v=>Math.round(v.finishTime)));

`,context);
