const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
check(setupVisible&&mode==='ready','setup visible on first visit');
check($('overlay').classList.values.has('hidden'),'track preview unobstructed during setup');
check(typeof $('launch-race').onclick==='function'&&typeof $('toggle-setup').onclick==='function','start and setup controls connected');
for(const type of ['ai','friend','ghost','derby']){
 raceType=type;if(type==='friend')localPlayers=4;if(type==='derby'){derbyPlayers=4;derbyCars=20}
 selectTrack('scrapyard');
 check($('mode-help').textContent.length>20&&$('setup-summary').textContent.includes(track.name),'mode explanation and summary update');
 for(const driver of activeDrivers())check(!$(driver+'-car-setting').hidden&&$(driver+'-hp').value==='300','every active player has visible car and tuning controls');
 check($('setup-controls').textContent===$('controls-label').textContent,'setup shows correct steering keys');
 if(humanCount()===4)check($('setup-controls').textContent.includes('P4 V / N'),'all four control pairs explained');
 setSetupVisible(true);$('launch-race').onclick();
 check(mode==='countdown'&&!setupVisible&&$('app').classList.values.has('setup-hidden'),'one start action opens driving view');
 check($('toggle-setup').textContent==='Show setup','return to setup remains explicit');
 for(let i=0;i<400;i++)step(1/120);
 check(mode==='running','race begins from sidebar');
 $('toggle-setup').onclick();
 check(mode==='paused'&&setupVisible&&!$('app').classList.values.has('setup-hidden'),'returning to setup pauses race and reveals options');
 $('toggle-setup').onclick();
 check(mode==='paused'&&!setupVisible,'hiding setup does not silently resume');
 pause();check(mode==='running','pause button resumes explicitly');
 setSetupVisible(true);selectDifficulty('beginner');
 check(mode==='ready'&&setupVisible,'changing a setting resets to ready without hiding setup');
 check($('launch-race').html.includes('Start race'),'start action resets after setting change');
}
raceType='friend';localPlayers=4;carCount=20;selectTrack('scrapyard');mode='running';finish(4);
check(mode==='finished'&&!$('overlay').classList.values.has('hidden'),'results remain visible');
setSetupVisible(true);$('launch-race').onclick();check(mode==='countdown'&&!setupVisible,'restart from setup works after results');
setSetupVisible(true);check(mode==='ready'&&count===0&&$('countdown').textContent==='','opening setup during countdown cancels the start');
console.log('PASS visible setup, mode help, all-player controls, one-action start, driving view, pause/edit/resume and results restart');
`,context);
