const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
const fixture={id:'features-test',name:'Features test',kind:'arcade',theme:'park',polyline:true,width:130,ground:'#222',curb:'#fff',nodes:[[0,0],[50000,0],[50000,4000],[0,4000]]};
tracks.push(fixture);raceType='friend';selectTrack(fixture.id);
for(const type of ['ai','friend'])for(const count of [2,5])for(const id of Object.keys(carModels)){
 raceType=type;carCount=count;selectCar('p1',id);selectCar('p2','drift');
 check(car.model===id,'P1 selection in every mode');
 check(opponent.model===(type==='friend'?'drift':'balanced'),'independent P2 and baseline AI');
 check(racers.filter(v=>v.driver==='ai').every(v=>v.model==='balanced'),'AI difficulty preserves its baseline car');
 check($('p2-car-setting').hidden===(type!=='friend'),'P2 selector visibility');
 check(mode==='ready','changing car resets safely');
}
selectCar('p1','invalid');check(car.model==='balanced','invalid selection defaults safely');
check(JSON.parse(localStorage.getItem('slipstream-car-choices')).p2==='drift','choices persisted');
const firstKey=bestKey();selectCar('p1','agile');check(bestKey()!==firstKey,'car records independent');
function body(model='balanced'){return {x:1000,y:0,angle:0,vx:0,vy:0,steer:0,spin:0,driver:'p1',model,draft:0,finishTime:null}}
const cars=Object.keys(carModels).map(id=>body(id));
for(let i=0;i<120;i++)for(const v of cars)moveVehicle(v,0,1/120,true);
check(cars.every(v=>Math.abs(v.vx-cars[0].vx)<.001),'equal launch acceleration across drift styles');
for(let i=0;i<120*25;i++)for(const v of cars)moveVehicle(v,0,1/120,true);
check(cars.every(v=>Math.abs(v.vx-cars[0].vx)<.001),'equal top speeds across drift styles');
const slides=Object.keys(carModels).map(id=>Object.assign(body(id),{vx:200,vy:70}));
for(const v of slides)moveVehicle(v,1,1/120,true);
const lateral=v=>Math.abs(-v.vx*Math.sin(v.angle)+v.vy*Math.cos(v.angle));
check(lateral(slides[2])>lateral(slides[0])&&lateral(slides[0])>lateral(slides[1]),'Comet retains more drift than Apex and Spark');
const entries=Object.keys(carModels).map(id=>Object.assign(body(id),{vx:220}));
for(let i=0;i<12;i++)for(const v of entries)moveVehicle(v,1,1/120,true);
check(entries[1].steer>entries[0].steer&&entries[0].steer>entries[2].steer,'Spark flicks into a drift faster; Comet transitions deliberately');
const catches=Object.keys(carModels).map(id=>Object.assign(body(id),{vx:200,vy:80}));
for(let i=0;i<48;i++)for(const v of catches)moveVehicle(v,0,1/120,true);
check(catches[1].vy<catches[0].vy&&catches[0].vy<catches[2].vy,'Spark catches a slide faster; Comet carries it longer');
for(const id of Object.keys(carModels)){
 const v=Object.assign(body(id),{vx:220});for(let i=0;i<90;i++)moveVehicle(v,1,1/120,true);
 check(driftState(v).active,id+' sustains a physical drift');
}
console.log('PASS selections, persistence, model records, equal straight pace, drift entries, sustained slides and catches');
function pair(){
 car=Object.assign(body(),{vx:300});opponent=Object.assign(body(),{x:1100,vx:300,driver:'ai'});racers=[car,opponent];
}
pair();for(let i=0;i<120;i++)updateDrafts(1/120);
check(car.draft>.9&&opponent.draft===0,'only trailing car drafts');
updateHUD();check(!$('p1-draft').hidden&&$('p2-draft').hidden,'independent draft HUD');
const draftCar=Object.assign({},car),plainCar=Object.assign({},car,{draft:0});
moveVehicle(draftCar,0,1/120,true);moveVehicle(plainCar,0,1/120,true);check(draftCar.vx>plainCar.vx,'draft physically increases speed');
opponent.y=60;for(let i=0;i<60;i++)updateDrafts(1/120);check(car.draft<.01,'pulling out loses wake');
for(const mutate of [()=>opponent.angle=Math.PI,()=>opponent.vx=0,()=>opponent.finishTime=2,()=>opponent.x=1400,()=>opponent.x=1020,()=>car.vx=0]){
 pair();mutate();for(let i=0;i<120;i++)updateDrafts(1/120);check(car.draft===0,'no draft behind invalid target');
}
pair();racers.reverse();for(let i=0;i<120;i++)updateDrafts(1/120);check(car.draft>.9,'order independent');
raceType='friend';carChoices.p1='agile';carChoices.p2='drift';selectTrack(fixture.id);mode='running';
car.draft=.8;pause();const snapshot=car.draft;step(1);check(car.draft===snapshot,'pause freezes draft');pause();reset();check(racers.every(v=>v.draft===0),'reset clears wakes');
check(car.model==='agile'&&opponent.model==='drift','reset retains car choices');
console.log('PASS drafting gain, wake geometry, speed/direction checks, HUD, order, pause and reset');
// Close parallel sections must not create a wake across intervening corners.
const folded={id:'folded-test',name:'Folded',kind:'arcade',theme:'park',polyline:true,width:10,ground:'#222',curb:'#fff',nodes:[[0,0],[2000,0],[2000,500],[0,500],[0,10],[2000,10],[2000,1000],[-500,1000],[-500,-500],[0,-500]]};
tracks.push(folded);selectTrack(folded.id);pair();opponent.y=7;updateDrafts(1);check(car.draft===0,'parallel route sections rejected');
console.log('PASS route-aware wake rejection');
`,context);
