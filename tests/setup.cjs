const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
const fixture={id:'setup-test',name:'Setup test',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[100000,0],[100000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';difficulty='expert';selectTrack(fixture.id);
const body=driver=>({x:1000,y:0,angle:0,vx:0,vy:0,steer:0,spin:0,driver,model:'balanced',finishTime:null});
const launches=[];const terminals=[];
for(const hp of [100,300,600]){
 selectSetup('p1','hp',hp);const v=body('p1');for(let i=0;i<120;i++)moveVehicle(v,0,1/120,true);launches.push(v.vx);
 for(let i=0;i<120*59;i++)moveVehicle(v,0,1/120,true);terminals.push(v.vx);
}
check(launches[0]<launches[1]&&launches[1]<launches[2],'horsepower changes acceleration');
check(terminals[0]<terminals[1]&&terminals[1]<terminals[2],'higher horsepower increases attainable speed without a separate cap');
check(terminals[2]*KMH_PER_UNIT>600,'high power can exceed former 400 km/h limit');
check(Math.abs(terminals[2]-TOP_SPEED*2)<3,'speed settles from thrust and drag');
selectSetup('p1','hp',600);const ai=body('ai');for(let i=0;i<120*20;i++)moveVehicle(ai,0,1/120,false);check(Math.abs(ai.vx-TOP_SPEED)<3,'personal tuning leaves AI power/speed unchanged');
raceType='friend';selectTrack(fixture.id);selectSetup('p2','hp',100);
const p1=body('p1'),p2=body('p2');for(let i=0;i<120;i++){moveVehicle(p1,0,1/120,true);moveVehicle(p2,0,1/120,false)}check(p1.vx>p2.vx*2,'local players tune independently');
const saved=JSON.parse(localStorage.getItem('slipstream-setups'));check(saved.p1.hp===600&&saved.p2.hp===100,'both settings persist');
check(sanitizeSetup({hp:'bad',topSpeed:Infinity,grid:-4},'p1').hp===300,'invalid power defaults safely');
selectSetup('p1','hp',99999);check(setups.p1.hp===600,'power clamped to max');check(!Object.hasOwn(sanitizeSetup({hp:400,topSpeed:120,grid:1},'p1'),'topSpeed'),'legacy speed preference is ignored');
console.log('PASS horsepower acceleration and uncapped speed, drag, AI isolation, both drivers, persistence and bounds');
resetSetup('p1');resetSetup('p2');
for(const type of ['ai','friend'])for(let count=2;count<=5;count++){
 raceType=type;selectCarCount(count);
 for(let slot=1;slot<=count;slot++){
  selectSetup('p1','grid',slot);
  check(car.total===-(slot-1)*72&&playerDistance()===car.total,'P1 grid and progress match selection');
  check(standings().indexOf(car)===slot-1,'starting standings reflect chosen position');
  check(new Set(racers.map(v=>v.total)).size===count,'all grid slots unique');
  for(let i=0;i<count;i++)for(let j=0;j<i;j++)check(!carContact(racers[i],racers[j]),'staggered starts have no overlap');
  if(type==='friend')for(let other=1;other<=count;other++){
   selectSetup('p2','grid',other);check(opponent.total===-(other-1)*72,'P2 receives selected slot');
   check(setups.p1.grid!==setups.p2.grid&&new Set(racers.map(v=>v.total)).size===count,'occupied slots swap safely');
  }
 }
}
raceType='friend';selectCarCount(5);selectSetup('p1','grid',5);selectSetup('p2','grid',4);selectCarCount(2);
check(setups.p1.grid<=2&&setups.p2.grid<=2&&setups.p1.grid!==setups.p2.grid,'shrinking field clamps and separates slots');
check(JSON.parse(localStorage.getItem('slipstream-setups')).p1.grid<=2,'clamped grid persisted');
resetSetup('p1');resetSetup('p2');selectSetup('p1','grid',2);check(setups.p2.grid===1,'occupied human slot swaps');resetSetup('p2');check(setups.p2.grid===2&&setups.p1.grid===1,'factory reset also swaps occupied slot');
raceType='ai';selectCarCount(5);selectSetup('p1','grid',5);mode='running';
check(progress===-288,'rear start has negative progress');
car.x=points[0].x;car.y=points[0].y;car.angle=carStartAngle();car.vx=Math.cos(car.angle)*80;car.vy=Math.sin(car.angle)*80;step(1/120);
check(lap===1&&progress<5&&progress>=0,'crossing start from rear grid does not award a lap');
console.log('PASS all grid sizes/modes, unique slots, occupied-slot swaps, rankings, field shrink and lap tracking');
raceType='ghost';selectTrack(fixture.id);check(racers.length===1&&car.total===0&&progress===0&&$('p1-grid-setting').hidden,'personal best always starts on the line');
const originalGhostKey=ghostKey(),originalBestKey=bestKey();selectSetup('p1','hp',400);check(ghostKey()!==originalGhostKey&&bestKey()!==originalBestKey,'power isolates PB and lap records');
resetSetup('p1');
check(ghostKey()===originalGhostKey&&bestKey()===originalBestKey,'factory tuning restores original record namespace');
check(setups.p1.hp===300&&!Object.hasOwn(setups.p1,'topSpeed'),'factory restores horsepower without a speed setting');
draw();console.log('PASS setup-specific records, ghost start, factory defaults and rendering');
`,context);
