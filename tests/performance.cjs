const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);

vm.runInContext(`
function check(x,msg){if(!x)throw Error(msg)}
let queryCount=0;const originalNearest=nearest;nearest=function(x,y){queryCount++;return originalNearest(x,y)};
const v={x:car.x,y:car.y};const first=vehicleNear(v);vehicleNear(v);check(queryCount===1,'exact location reuses query');
v.x+=1;vehicleNear(v);check(queryCount===2,'motion invalidates query');
selectTrack('monza');const before=queryCount;vehicleNear(v);check(queryCount===before+1,'track changes invalidate query');
for(let i=0;i<200;i++){
 const p=points[i%points.length],x=p.x+Math.sin(i)*ROAD*.5,y=p.y+Math.cos(i)*ROAD*.5;
 const actual=nearest(x,y);let squared=Infinity;
 for(let j=0;j<points.length;j++){
  const a=points[j],b=points[(j+1)%points.length],dx=b.x-a.x,dy=b.y-a.y;
  const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);
  squared=Math.min(squared,(x-a.x-t*dx)**2+(y-a.y-t*dy)**2);
 }
 check(Math.abs(actual.d-Math.sqrt(squared))<.001,'query retains exhaustive collision accuracy');
}
console.log('PASS exact query reuse, motion/track invalidation, and exhaustive road-distance accuracy');
let htmlWrites=0,textWrites=0;
for(const id of ['lap','p2-lap','position','p2-position','time','speed','score']){
 const el=$(id),prop=['lap','p2-lap','position','p2-position'].includes(id)?'innerHTML':'textContent';let value=el[prop];
 Object.defineProperty(el,prop,{get(){return value},set(v){value=v;prop==='innerHTML'?htmlWrites++:textWrites++},configurable:true});
}
updateHUD();htmlWrites=0;textWrites=0;for(let i=0;i<100;i++)updateHUD();
check(htmlWrites===0&&textWrites===0,'unchanged HUD does not rebuild text or lap markup');
let strokes=0,segments=0;ctx.stroke=()=>strokes++;ctx.moveTo=()=>segments++;
marks=Array.from({length:4000},()=>({x:1e7,y:1e7,angle:0}));
marks.push({x:cameras[0].x,y:cameras[0].y,angle:0});
draw();check(strokes<30&&segments<500,'skids are batched and offscreen marks culled');
console.log('PASS unchanged HUD writes avoided and 4000 offscreen skids culled/batched');
const fixture={id:'frame-test',name:'Frame test',kind:'arcade',theme:'park',polyline:true,width:130,ground:'#222',curb:'#fff',nodes:[[0,0],[50000,0],[50000,4000],[0,4000]]};
tracks.push(fixture);raceType='ai';selectTrack(fixture.id);mode='running';opponent.finishTime=0;
car.x=1000;car.y=0;car.angle=0;car.vx=300;car.vy=0;
let hudCalls=0;const originalHUD=updateHUD;updateHUD=()=>{hudCalls++;originalHUD()};
const rendered=[];draw=()=>{const x=car.x;rendered.push(renderPose(car).x);check(car.x===x,'render pose never mutates physics')};
previous=null;accumulator=0;for(let i=0;i<120;i++)frame(i*1000/144);
for(let i=3;i<rendered.length;i++)check(rendered[i]>rendered[i-1],'144 Hz rendering moves between fixed simulation steps');
check(hudCalls===120,'one HUD update per rendered frame');
const time=elapsed,calls=hudCalls;frame(10000);check(elapsed-time<=.050001,'long hitch has bounded catch-up');check(hudCalls===calls+1,'catch-up steps do not repeat HUD work');
const pose=renderPose({x:2,y:4,angle:0,previousX:0,previousY:0,previousAngle:0});check(pose.x===2&&pose.y===4,'standalone drawing uses current physics');
renderAlpha=.5;const turn=renderPose({x:0,y:0,angle:-Math.PI+.1,previousAngle:Math.PI-.1});check(Math.abs(Math.cos(turn.angle)+1)<.001,'angle interpolation crosses wrap by shortest path');renderAlpha=1;
console.log('PASS interpolated 144 Hz motion, bounded catch-up, unchanged physics and per-frame HUD');
`,context);
