const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
function hit(v,severity=400,wall=false){v.damageCooldown=0;v.wallDamageCooldown=0;damageCar(v,severity,v.x,v.y,wall)}
for(const type of ['ai','friend','ghost','derby']){
 raceType=type;selectTrack('scrapyard');
 check(groupDurability('players')===(type==='derby'?5:1)&&groupDurability('ai')===1,'mode defaults preserved');
 const originalKey=bestKey();
 selectDurability('players','2');selectDurability('ai','0.5');
 check(bestKey()!==originalKey,'custom durability gets separate records');
 check($('ai-durability-group').hidden===(racers.every(v=>v.driver!=='ai')),'AI setting visibility follows field');
 for(const wall of [false,true]){
  reset();
  const human=car,bot=racers.find(v=>v.driver==='ai');
  hit(human,400,wall);check(Math.abs(human.damage-.14)<1e-10,'player multiplier applies to car and wall damage in every mode');
  if(bot){hit(bot,400,wall);check(Math.abs(bot.damage-.56)<1e-10,'AI multiplier independent of player health')}
  const amount=human.damage;damageCar(human,400,human.x,human.y,wall);check(human.damage===amount,'solver burst protection preserved');
 }
 selectDurability('players','default');selectDurability('ai','default');
 check(bestKey()===originalKey,'restoring defaults restores records');
}
raceType='derby';derbyPlayers=4;derbyCars=20;selectTrack('scrapyard');
selectDurability('players','10');selectDurability('ai','3');mode='running';
for(const v of humanRacers()){hit(v);check(Math.abs(v.damage-.028)<1e-10,'all four humans use selected durability')}
for(const v of racers.filter(v=>v.driver==='ai')){hit(v);check(Math.abs(v.damage-.28/3)<1e-10,'all AI use selected durability')}
for(const v of humanRacers())for(let i=0;i<40&&!v.wrecked;i++)hit(v);
check(humanRacers().every(v=>v.wrecked)&&checkWreckResult(),'even maximum durability eventually wrecks and produces DNF');
selectDurability('players','0.5');check(mode==='ready'&&racers.every(v=>!v.wrecked&&v.damage===0),'settings restart and repair the field');
selectDurability('players','Infinity');selectDurability('ai','0');check(groupDurability('players')===5&&groupDurability('ai')===1,'invalid selections safely restore mode defaults');
raceType='ghost';selectTrack('scrapyard');const ghostRecordKey=ghostKey();selectDurability('ai','10');check(ghostKey()===ghostRecordKey,'unused AI setting does not split solo ghost records');
selectDurability('players','3');check(ghostKey()!==ghostRecordKey,'human durability separates ghost records');
selectDurability('ai','2');
check(JSON.parse(localStorage.getItem('slipstream-durability')).players==='3','durability preference saved');
console.log('PASS durability defaults, both damage sources, independent groups, all humans/bots, finite wrecks, restart, validation and record isolation');
`,context);

function reload(){
 const fresh={console,Math:testMath,Number,String,document:context.document,window:context.window,localStorage:context.localStorage,requestAnimationFrame(){}};
 vm.createContext(fresh);
 vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),fresh);
 vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),fresh);
 return fresh;
}
vm.runInContext("if(durabilitySettings.players!=='3'||durabilitySettings.ai!=='2'||$('player-durability').value!=='3')throw Error('saved durability not restored')",reload());
context.localStorage.setItem('slipstream-durability','{"players":"Infinity","ai":"0"}');
vm.runInContext("if(durabilitySettings.players!=='default'||durabilitySettings.ai!=='default')throw Error('corrupt values accepted')",reload());
context.localStorage.setItem('slipstream-durability','invalid json');
vm.runInContext("if(durabilitySettings.players!=='default'||durabilitySettings.ai!=='default')throw Error('invalid JSON accepted')",reload());
console.log('PASS reloaded preferences, invalid stored values and corrupt JSON');
