/* Slipstream: fixed-step physics; velocity is independent of the car's heading. */
'use strict';
const $=id=>document.getElementById(id),canvas=$('track'),ctx=canvas.getContext('2d');
const TAU=Math.PI*2,UNITS_PER_METRE=6,KMH_PER_UNIT=3.6/UNITS_PER_METRE;
const ACCELERATION=150,DRAG=.29,TOP_SPEED=ACCELERATION/DRAG;
const TRACK_LENGTH_SCALE=.7,TRACK_WIDTH_SCALE=2;
const controls={left:false,right:false},friendControls={left:false,right:false},touchControls={left:false,right:false};
const heldKeys=new Set();
let raceType='ai',difficulty='standard',carCount=2,derbyStart=5,localPlayers=2,derbyPlayers=1,derbyCars=10;
const HUMAN_DRIVERS=['p1','p2','p3','p4'];
const humanCount=()=>raceType==='friend'?localPlayers:raceType==='derby'?derbyPlayers:1;
const isHuman=v=>HUMAN_DRIVERS.includes(v.driver);
const durabilityChoices=['default','0.5','1','2','3','5','10'];
const durabilitySettings={players:'default',ai:'default'};
function groupDurability(group){return durabilitySettings[group]==='default'?(group==='players'&&raceType==='derby'?5:1):Number(durabilitySettings[group])}
function selectDurability(group,value){
 if(!Object.hasOwn(durabilitySettings,group))return;
 durabilitySettings[group]=durabilityChoices.includes(String(value))?String(value):'default';
 try{localStorage.setItem('slipstream-durability',JSON.stringify(durabilitySettings))}catch{}
 selectTrack(track.id);
}
function durabilityKey(){
 const players=groupDurability('players'),ai=groupDurability('ai');
 return(players===(raceType==='derby'?5:1)?'':'-body'+players)+(raceType!=='ghost'&&ai!==1?'-ai-body'+ai:'');
}
const humanRacers=()=>racers.filter(isHuman);
const extraControls={p3:{left:false,right:false},p4:{left:false,right:false}};
const playerInputs={p1:controls,p2:friendControls,...extraControls};
const keyLabels={p1:'A / D',p2:'← / →',p3:'J / L',p4:'V / N'};
const derbyGrids={p2:6,p3:7,p4:8};
const fieldCount=()=>raceType==='ghost'?1:raceType==='derby'?derbyCars:carCount;
const racerColors=['#d4fb71','#ff9b66','#73d9ee','#c6a0ff','#ff718e','#f1cf69','#6b9aff','#75d9b4','#e59ade','#f0ece0','#d69552','#599dc7','#9fb967','#b878b6','#bdbe78','#65bfc4','#d67982','#a1a0d4','#c8b393','#879d8c'];
const carModels={
 balanced:{name:'Apex',description:'Flow · smooth, predictable drifts · balanced transitions',accel:1,drag:1,grip:1,steering:1,response:10,driftGrip:1,recoveryGrip:1},
 agile:{name:'Spark',description:'Flick · fast drift entry and catches · needs small inputs',accel:1,drag:1,grip:1,steering:1,response:14,driftGrip:.93,recoveryGrip:1.16},
 drift:{name:'Comet',description:'Sweep · carries long slides · plan direction changes early',accel:1,drag:1,grip:1,steering:1.02,response:8,driftGrip:.99,recoveryGrip:.92}
};
const carChoices={p1:'balanced',p2:'balanced',p3:'balanced',p4:'balanced'};
const modelFor=v=>carModels[v.model]||carModels.balanced;
const FACTORY_SETUP={hp:300};
const setups=Object.fromEntries(HUMAN_DRIVERS.map((driver,i)=>[driver,{...FACTORY_SETUP,grid:i+1}]));
const setupFor=v=>setups[v.driver]||FACTORY_SETUP;
const driverNumber=driver=>HUMAN_DRIVERS.indexOf(driver)+1;
const activeDrivers=()=>HUMAN_DRIVERS.slice(0,humanCount());
const chosenGrid=driver=>raceType==='derby'?(driver==='p1'?derbyStart:derbyGrids[driver]):setups[driver].grid;
function setGrid(driver,slot){if(raceType==='derby'){if(driver==='p1')derbyStart=slot;else derbyGrids[driver]=slot}else setups[driver].grid=slot}
function sanitizeSetup(value,driver){
 const number=(key,fallback,min,max,step)=>{const n=Number(value?.[key]);return Number.isFinite(n)&&n!==0?clamp(Math.round(n/step)*step,min,max):fallback};
 return{hp:number('hp',300,100,600,10),grid:number('grid',driverNumber(driver),1,20,1)};
}
function saveSetups(){try{localStorage.setItem('slipstream-setups',JSON.stringify(setups));localStorage.setItem('slipstream-derby-grid',String(derbyStart));localStorage.setItem('slipstream-derby-grids',JSON.stringify({p1:derbyStart,...derbyGrids}))}catch{}}
function normalizeGrid(){
 if(raceType==='ghost')return;
 const before=JSON.stringify([setups,derbyStart,derbyGrids]),limit=fieldCount(),used=new Set();
 for(const driver of HUMAN_DRIVERS)if(raceType!=='derby')setups[driver].grid=clamp(setups[driver].grid,1,limit);
 for(const driver of activeDrivers()){
  let slot=clamp(chosenGrid(driver),1,limit);if(used.has(slot))slot=Array.from({length:limit},(_,i)=>i+1).find(n=>!used.has(n));
  setGrid(driver,slot);used.add(slot);
 }
 if(before!==JSON.stringify([setups,derbyStart,derbyGrids]))saveSetups();
}
function selectSetup(driver,field,value){
 if(!Object.hasOwn(setups,driver)||!['hp','grid'].includes(field))return;
 const previous=chosenGrid(driver);
 if(field==='grid'){
  const slot=clamp(Math.round(Number(value)||driverNumber(driver)),1,fieldCount());
  const other=activeDrivers().find(d=>d!==driver&&chosenGrid(d)===slot);if(other)setGrid(other,previous);setGrid(driver,slot);
 }else setups[driver]=sanitizeSetup({...setups[driver],hp:value},driver);
 normalizeGrid();saveSetups();selectTrack(track.id);
}
function resetSetup(driver){
 if(!Object.hasOwn(setups,driver))return;
 const previous=chosenGrid(driver),desired=clamp(raceType==='derby'?driverNumber(driver)+4:driverNumber(driver),1,fieldCount());
 setups[driver].hp=300;const other=activeDrivers().find(d=>d!==driver&&chosenGrid(d)===desired);if(other)setGrid(other,previous);setGrid(driver,desired);
 normalizeGrid();saveSetups();selectTrack(track.id);
}
function gridSlots(count){
 if(raceType==='ghost')return[0];
 const slots=activeDrivers().map(driver=>chosenGrid(driver)-1);
 for(let slot=0;slot<count;slot++)if(!slots.includes(slot))slots.push(slot);return slots;
}
function selectHumanCount(value){
 const count=clamp(Math.round(Number(value)||2),raceType==='friend'?2:1,4);
 if(raceType==='derby')derbyPlayers=count;else localPlayers=count;
 if(raceType==='derby')derbyCars=Math.max(derbyCars,count);else carCount=Math.max(carCount,count);
 try{localStorage.setItem('slipstream-local-players',String(localPlayers));localStorage.setItem('slipstream-derby-players',String(derbyPlayers));localStorage.setItem('slipstream-cars',String(carCount));localStorage.setItem('slipstream-derby-cars',String(derbyCars))}catch{}
 selectTrack(track.id);
}
let rivalStyle='mixed';
const rivalStyles={
 racer:{label:'Racer',clearance:46,lane:68,passGap:60,horizon:1},
 cautious:{label:'Cautious',clearance:60,lane:78,passGap:76,horizon:1.15},
 aggressive:{label:'Aggressive',clearance:36,lane:58,passGap:46,horizon:.95}
};
const styleFor=v=>rivalStyles[v.personality]||rivalStyles.racer;
function selectRivalStyle(value){rivalStyle=Object.hasOwn(rivalStyles,value)?value:'mixed';try{localStorage.setItem('slipstream-rival-style',rivalStyle)}catch{}selectTrack(track.id)}
function selectCar(driver,value){
 if(!Object.hasOwn(carChoices,driver))return;
 carChoices[driver]=Object.hasOwn(carModels,value)?value:'balanced';
 try{localStorage.setItem('slipstream-car-choices',JSON.stringify(carChoices))}catch{}
 selectTrack(track.id);
}
function selectCarCount(value){const count=clamp(Math.round(Number(value)||2),Math.max(2,humanCount()),20);if(raceType==='derby')derbyCars=count;else carCount=count;try{localStorage.setItem(raceType==='derby'?'slipstream-derby-cars':'slipstream-cars',String(count))}catch{}selectTrack(track.id)}
const aiLevels={
 beginner:{label:'Beginner',pace:.68,straightAngle:.10,reaction:.10,reactionSpread:.05,wobble:.18,mistakeEvery:5,mistakeSpread:3,duration:.65,durationSpread:.25,strength:.7,description:'A forgiving rival with slower reactions and regular mistakes.'},
 standard:{label:'Standard',pace:.82,straightAngle:.06,reaction:.055,reactionSpread:.025,wobble:.09,mistakeEvery:9,mistakeSpread:5,duration:.4,durationSpread:.2,strength:.45,lookaheadBase:90,lookaheadSpeed:.35,steerGain:3,slipComp:.7,description:'Competitive drifting with occasional missed lines and slower corrections.'},
 advanced:{label:'Advanced',pace:.94,straightAngle:.018,reaction:.018,reactionSpread:.012,wobble:.025,mistakeEvery:22,mistakeSpread:10,duration:.2,durationSpread:.12,strength:.25,lookaheadBase:125,lookaheadSpeed:.45,steerGain:3.6,slipComp:.8,racingLine:.04,trafficBlend:6.5,description:'Near full pace, fast corrections, and rare small mistakes.'},
 expert:{label:'Expert',pace:1,straightAngle:0,reaction:0,reactionSpread:0,wobble:0,mistakeEvery:Infinity,mistakeSpread:0,duration:0,durationSpread:0,strength:0,lookaheadBase:160,lookaheadSpeed:.5,steerGain:4.2,slipComp:.9,racingLine:.08,trafficBlend:8,description:'Maximum precision: full power, optimized corner lines, instant corrections, and no deliberate mistakes.'}
};
function selectDifficulty(value){difficulty=Object.hasOwn(aiLevels,value)?value:'standard';try{localStorage.setItem('slipstream-difficulty',difficulty)}catch{}selectTrack(track.id)}
function clearControls(){heldKeys.clear();for(const input of [...Object.values(playerInputs),touchControls])input.left=input.right=false}
function syncControls(){
 controls.left=touchControls.left||heldKeys.has('a')||(humanCount()===1&&heldKeys.has('arrowleft'));controls.right=touchControls.right||heldKeys.has('d')||(humanCount()===1&&heldKeys.has('arrowright'));
 friendControls.left=humanCount()>1&&heldKeys.has('arrowleft');friendControls.right=humanCount()>1&&heldKeys.has('arrowright');
 extraControls.p3.left=humanCount()>2&&heldKeys.has('j');extraControls.p3.right=humanCount()>2&&heldKeys.has('l');
 extraControls.p4.left=humanCount()>3&&heldKeys.has('v');extraControls.p4.right=humanCount()>3&&heldKeys.has('n');
}
const rivalName=()=>raceType==='friend'?'PLAYER 2':'RIVAL';
const tracks=[
 {id:'foundry',name:'The Foundry',subtitle:'Industrial grid · right angles and doglegs',kind:'arcade',theme:'industrial',width:130,ground:'#282a29',asphalt:'#3c4141',curb:'#dd9c54',nodes:[[400,400],[1600,400],[1950,700],[1800,1100],[1100,1100],[1100,1800],[1900,1800],[2100,2300],[1700,2700],[600,2700],[300,2400],[300,1600],[650,1400],[650,1000],[300,800]]},
 {id:'velocity',name:'Velocity Ring',subtitle:'Superspeedway oval · long sweeping banks',kind:'arcade',theme:'speedway',width:170,ground:'#272e36',asphalt:'#3d4650',curb:'#c75e64',nodes:[[700,400],[2100,400],[2800,800],[3100,1800],[2600,2700],[1400,3000],[400,2500],[150,1600],[300,800]]},
 {id:'tidal',name:'Tidal Run',subtitle:'Coastal ribbon · linked S-bends',kind:'arcade',theme:'coast',width:132,ground:'#536d59',asphalt:'#414c48',curb:'#e0cf96',nodes:[[400,500],[1100,200],[1800,550],[1900,1200],[2500,1500],[2900,2200],[2600,3000],[2000,3300],[1500,2800],[1800,2100],[1300,1700],[600,1800],[200,1300]]},
 {id:'switchback',name:'Switchback',subtitle:'Mountain switchbacks · three tight hairpins',kind:'arcade',theme:'alpine',width:120,ground:'#3d4440',asphalt:'#414442',curb:'#cfb388',nodes:[[400,400],[1800,400],[2100,700],[1900,1000],[700,1000],[400,1300],[700,1600],[1900,1600],[2200,1900],[1900,2200],[700,2200],[400,2500],[600,2900],[2700,2900],[3000,2200],[3000,500],[2600,100],[700,100]]},
 {id:'scrapyard',name:'Scrapyard Bowl',subtitle:'Derby course · extra-wide bowls and a sweeping pinch',kind:'arcade',theme:'industrial',width:190,ground:'#302b27',asphalt:'#48413b',curb:'#e3aa50',nodes:[[600,300],[2000,300],[3400,300],[3900,900],[3700,1800],[3000,2200],[2100,1800],[1200,2200],[300,1900],[-100,1100],[0,600]]},
 ...(window.SLIPSTREAM_CIRCUITS||[])
];
for(const t of tracks)t.flowRemix=true;
let track=tracks[0],ROAD=track.width*TRACK_WIDTH_SCALE,points=[],lengths=[],circuitLength=0;
let trackBounds={minX:0,minY:0,maxX:1,maxY:1},segmentGrid=new Map(),worldPath=null;
const GRID_SIZE=240;
function measureRoute(route){
 const distances=[0];let total=0;
 for(let i=0;i<route.length;i++){const a=route[i],b=route[(i+1)%route.length];total+=Math.hypot(b.x-a.x,b.y-a.y);distances.push(total)}
 return{distances,total};
}
function routeSample(route,metric,s){
 s=((s%metric.total)+metric.total)%metric.total;let lo=0,hi=route.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(metric.distances[mid]<=s)lo=mid;else hi=mid-1}
 const a=route[lo],b=route[(lo+1)%route.length],t=(s-metric.distances[lo])/(metric.distances[lo+1]-metric.distances[lo]);
 return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
function uniformRoute(route){
 const metric=measureRoute(route),count=Math.ceil(metric.total/16);
 return Array.from({length:count},(_,i)=>routeSample(route,metric,i*metric.total/count));
}
function routeClearance(route,width){
 const metric=measureRoute(route),separation=width+20,cells=new Map();
 for(let i=0;i<route.length;i++){
  const p=route[i],gx=Math.floor(p.x/separation),gy=Math.floor(p.y/separation),s=metric.distances[i];
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const j of cells.get(x+','+y)||[]){const ds=Math.abs(s-metric.distances[j]);if(Math.min(ds,metric.total-ds)>width*2&&Math.hypot(p.x-route[j].x,p.y-route[j].y)<separation)return false}
  const key=gx+','+gy;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
 return true;
}
function remixForDrifting(raw,width){
 let base,expansion=1;
 // Open tight infields enough to support the wider road without merging branches.
 for(const factor of [1,1.12,1.25,1.4,1.6,1.85]){
  base=uniformRoute(raw.map(p=>({x:p.x*factor,y:p.y*factor})));expansion=factor;
  if(routeClearance(base,width))break;
 }
 if(!routeClearance(base,width))throw Error('Track cannot fit widened roads: '+track.id);
 const metric=measureRoute(base),step=metric.total/base.length;
 const headings=base.map((p,i)=>{const a=routeSample(base,metric,i*step-70),b=routeSample(base,metric,i*step+70);return Math.atan2(b.y-a.y,b.x-a.x)});
 const eligible=headings.map((a,i)=>{const before=headings[(i-5+base.length)%base.length],after=headings[(i+5)%base.length];return Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)))<.4});
 const breakIndex=Math.max(0,eligible.indexOf(false)),runs=[];let start=-1,count=0;
 for(let k=0;k<=base.length;k++){
  const i=(breakIndex+1+k)%base.length;
  if(k<base.length&&eligible[i]){if(start<0)start=i;count++}
  else if(start>=0){if(count*step>Math.max(650,Math.sqrt(width*.9*4800)))runs.push({start:start*step,length:Math.min(metric.total,count*step)});start=-1;count=0}
 }
 let result=base.map(p=>({...p})),addedBends=0,links=0;const flowSections=[];
 for(const run of runs){
  const waves=Math.max(1,Math.floor(run.length/Math.max(1150,Math.sqrt(width*.9*4800)))),wavelength=run.length/waves;
  const amplitude=Math.min(width*1.12,wavelength*wavelength/4800);
  for(const strength of [1,.9,.85]){
   const candidate=result.map((p,i)=>{
    const ds=(i*step-run.start+metric.total)%metric.total;if(ds>run.length)return{...p};
    const t=ds/run.length,envelope=Math.sin(Math.PI*t)**2;
    const offset=Math.sin(t*Math.PI*2*waves)*envelope*amplitude*strength;
    return{x:p.x-Math.sin(headings[i])*offset,y:p.y+Math.cos(headings[i])*offset};
   });
   if(routeClearance(candidate,width)){result=candidate;addedBends+=waves*2;links++;flowSections.push({length:run.length,waves,amplitude:amplitude*strength});break}
  }
 }
 return{route:result,stats:{addedBends,links,expansion,flowSections,baseLength:measureRoute(raw).total,remixedLength:measureRoute(result).total}};
}
function buildTrack(){
 let raw=[];const nodes=track.kind==='gp'&&track.driftNodes?track.driftNodes:track.nodes;
 if(track.polyline){for(const [x,y] of nodes)raw.push({x,y})}
 else for(let i=0;i<nodes.length;i++)for(let j=0;j<32;j++){
  const p=nodes[(i+nodes.length-1)%nodes.length],a=nodes[i],b=nodes[(i+1)%nodes.length],c=nodes[(i+2)%nodes.length],t=j/32;
  const f=k=>.5*((2*a[k])+(-p[k]+b[k])*t+(2*p[k]-5*a[k]+4*b[k]-c[k])*t*t+(-p[k]+3*a[k]-3*b[k]+c[k])*t*t*t);
  raw.push({x:f(0),y:f(1)});
 }
 for(const p of raw){p.x*=TRACK_LENGTH_SCALE;p.y*=TRACK_LENGTH_SCALE}
 if(track.flowRemix){const remix=remixForDrifting(raw,track.width*TRACK_WIDTH_SCALE);raw=remix.route;track.remixStats=remix.stats}
 points=[];lengths=[0];circuitLength=0;ROAD=track.width*TRACK_WIDTH_SCALE;segmentGrid=new Map();
 // Preserve every mapped corner; subdivide straights for stable spatial queries.
 for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/18));for(let j=0;j<n;j++)points.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n})}
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];circuitLength+=Math.hypot(b.x-a.x,b.y-a.y);lengths.push(circuitLength);
  const pad=ROAD*.6;
  for(let x=Math.floor((Math.min(a.x,b.x)-pad)/GRID_SIZE);x<=Math.floor((Math.max(a.x,b.x)+pad)/GRID_SIZE);x++)for(let y=Math.floor((Math.min(a.y,b.y)-pad)/GRID_SIZE);y<=Math.floor((Math.max(a.y,b.y)+pad)/GRID_SIZE);y++){const key=x+','+y;if(!segmentGrid.has(key))segmentGrid.set(key,[]);segmentGrid.get(key).push(i)}
 }
 trackBounds={minX:Math.min(...points.map(p=>p.x))-ROAD,minY:Math.min(...points.map(p=>p.y))-ROAD,maxX:Math.max(...points.map(p=>p.x))+ROAD,maxY:Math.max(...points.map(p=>p.y))+ROAD};
 worldPath=typeof Path2D==='function'?new Path2D():null;
 if(worldPath){points.forEach((p,i)=>i?worldPath.lineTo(p.x,p.y):worldPath.moveTo(p.x,p.y));worldPath.closePath()}
}
buildTrack();
function nearest(x,y){
 let bestSquared=Infinity,bestX=0,bestY=0,bestDX=0,bestDY=0,bestS=0;const gx=Math.floor(x/GRID_SIZE),gy=Math.floor(y/GRID_SIZE);
 let candidates=segmentGrid.get(gx+','+gy);
 if(!candidates){const nearby=new Set();for(let ix=gx-1;ix<=gx+1;ix++)for(let iy=gy-1;iy<=gy+1;iy++)for(const i of segmentGrid.get(ix+','+iy)||[])nearby.add(i);candidates=nearby.size?nearby:points.keys()}
 for(const i of candidates){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l)),px=a.x+t*dx,py=a.y+t*dy,d=(x-px)**2+(y-py)**2;if(d<bestSquared){bestSquared=d;bestX=px;bestY=py;bestDX=dx;bestDY=dy;bestS=lengths[i]+Math.sqrt(l)*t}}
 return{d:Math.sqrt(bestSquared),x:bestX,y:bestY,dx:bestDX,dy:bestDY,s:bestS};
}
// Share exact centre queries until either the car or circuit changes.
function vehicleNear(v){
 const cache=v.nearCache;
 if(cache&&cache.x===v.x&&cache.y===v.y&&cache.route===points)return cache.value;
 const value=nearest(v.x,v.y);v.nearCache={x:v.x,y:v.y,route:points,value};return value;
}
let bestLap=0;
const tuningSuffix=()=>setups.p1.hp===300?'':`-${setups.p1.hp}hp`;
const bestKey=()=>`${raceType==='derby'?'slipstream-derby-v1':'slipstream-v9'}-best-${track.id}-${carChoices.p1}${tuningSuffix()}${durabilityKey()}`;
const ghostKey=()=>`slipstream-ghost-v1-${track.id}-${carChoices.p1}${tuningSuffix()}${durabilityKey()}`;
let personalGhost=null,lapSamples=[],recordClock=0,ghostImproved=false,ghostPersisted=false;
function loadPersonalGhost(){
 personalGhost=null;ghostPersisted=false;
 try{
  const data=JSON.parse(localStorage.getItem(ghostKey())||'null');
  if(!data||!Number.isFinite(data.time)||!Number.isFinite(data.length)||data.time<3||data.time>1200||Math.abs(data.length-circuitLength)>1||!Array.isArray(data.samples)||data.samples.length<10||data.samples.length>12002)return;
  let previousTime=-1,previousProgress=-1;
  for(const sample of data.samples){
   if(!Array.isArray(sample)||sample.length!==5||!sample.every(Number.isFinite)||sample[0]<previousTime||sample[0]<0||sample[0]>data.time+.001||sample[4]<previousProgress||sample[4]<0||sample[4]>circuitLength+1||Math.abs(sample[1])>1e7||Math.abs(sample[2])>1e7)return;
   previousTime=sample[0];previousProgress=sample[4];
  }
  if(data.samples[0][0]!==0||data.samples[0][4]!==0||Math.abs(previousTime-data.time)>.01||previousProgress<circuitLength-1)return;
  personalGhost=data;ghostPersisted=true;
 }catch{}
}
function ghostSample(t,s){return[+t.toFixed(3),+car.x.toFixed(1),+car.y.toFixed(1),+car.angle.toFixed(4),+Math.max(lapSamples.at(-1)?.[4]||0,s).toFixed(1)]}
function startGhostLap(){recordClock=0;lapSamples=[];if(raceType==='ghost')lapSamples.push(ghostSample(0,0))}
function recordGhost(dt){
 if(raceType!=='ghost'||car.wrecked)return;
 recordClock+=dt;
 if(recordClock>=.1&&lapSamples.length<12001){recordClock%=.1;lapSamples.push(ghostSample(elapsed-lapStart,Math.min(progress,circuitLength)))}
}
function saveGhostLap(time){
 if(raceType!=='ghost'||car.wrecked||time<3||time>1200||lapSamples.length<10||lapSamples.length>=12001||personalGhost&&time>=personalGhost.time)return;
 const data={time,length:circuitLength,samples:[...lapSamples,ghostSample(time,circuitLength)]};
 personalGhost=data;ghostImproved=true;bestLap=time;
 ghostPersisted=false;try{localStorage.setItem(ghostKey(),JSON.stringify(data));ghostPersisted=true}catch{flash('PB SET · STORAGE FULL; GHOST AVAILABLE THIS SESSION')}
}
function ghostPose(){
 if(raceType!=='ghost'||!personalGhost)return null;
 const samples=personalGhost.samples,t=Math.min(elapsed-lapStart,personalGhost.time);
 let lo=0,hi=samples.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(samples[mid][0]<=t)lo=mid;else hi=mid-1}
 const a=samples[lo],b=samples[Math.min(lo+1,samples.length-1)],weight=b[0]>a[0]?clamp((t-a[0])/(b[0]-a[0]),0,1):0;
 return{x:a[1]+(b[1]-a[1])*weight,y:a[2]+(b[2]-a[2])*weight,angle:a[3]+angleDifference(b[3],a[3])*weight,damage:0,model:carChoices.p1};
}
function ghostStatus(){
 if(!personalGhost)return'SET A LAP TO RECORD YOUR GHOST';
 const samples=personalGhost.samples,s=clamp(progress,0,circuitLength);let lo=0,hi=samples.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(samples[mid][4]<=s)lo=mid;else hi=mid-1}
 const a=samples[lo],b=samples[Math.min(lo+1,samples.length-1)],weight=b[4]>a[4]?clamp((s-a[4])/(b[4]-a[4]),0,1):0;
 const delta=elapsed-lapStart-(a[0]+(b[0]-a[0])*weight);
 return`${Math.abs(delta).toFixed(2)} S ${delta>0?'BEHIND PB':'AHEAD OF PB'}`;
}
const startMarkup=document.querySelector('.start-card').innerHTML;
function selectTrack(id){
 if(raceType==='friend')carCount=Math.max(carCount,humanCount());if(raceType==='derby')derbyCars=Math.max(derbyCars,humanCount());
 normalizeGrid();
 track=tracks.find(t=>t.id===id)||tracks[0];buildTrack();bestLap=0;
 try{bestLap=Number(localStorage.getItem(bestKey()))||0;localStorage.setItem('slipstream-track',track.id)}catch{}
 loadPersonalGhost();if(raceType==='ghost')bestLap=personalGhost?.time||0;
 mode='ready';reset();$('countdown').textContent='';$('pause').textContent='Ⅱ';
 if(gain)gain.gain.setTargetAtTime(0,audio.currentTime,.05);
 $('track-select').value=track.id;$('track-subtitle').textContent=`${track.kind==='gp'?'Grand Prix · drift edition':track.subtitle} · ${(circuitLength/UNITS_PER_METRE/1000).toFixed(3)} km`;resetCameras();
 $('track-name').textContent=track.name.toUpperCase();
 if($('track-select').options)for(const option of $('track-select').options){const entry=tracks.find(t=>t.id===option.value);if(entry?.remixStats)option.textContent=`${entry.name} · ${(entry.remixStats.remixedLength/UNITS_PER_METRE/1000).toFixed(3)} km`}
 $('overlay').classList.add('hidden');document.querySelector('.start-card').innerHTML=startMarkup;$('start').onclick=begin;
 $('launch-race').innerHTML='Start race <span aria-hidden="true">→</span>';
 $('start-hint').textContent=raceType==='friend'?'P1: A / D · P2: ← / →':'← → OR A / D TO STEER';
 $('controls-label').textContent=raceType==='friend'?'P1: A / D · P2: ← / →':'← / → OR A / D';
 const people=humanCount(),timeTrial=raceType==='ghost',hasAI=fieldCount()>people;
 const modeName={ai:'Solo vs AI',friend:'Local multiplayer',ghost:'Personal best chase',derby:'Derby'}[raceType];
 $('mode-help').textContent={ai:'Three laps against the AI. Beginner is a good place to start.',friend:'Share one keyboard. Each player has their own controls and view. First human to finish three laps ends the race.',ghost:'Drive alone and chase your best lap. Finish a lap to record your first ghost.',derby:'Finish three laps or wreck all the AI. Expect harder hits and longer spins.'}[raceType];
 $('setup-summary').textContent=track.name+' · '+fieldCount()+(fieldCount()===1?' car':' cars')+' · '+modeName;
 $('car-count').value=String(raceType==='derby'?derbyCars:carCount);$('car-count').disabled=timeTrial;$('car-count-group').hidden=timeTrial;
 if($('car-count').options)for(const option of $('car-count').options)option.disabled=Number(option.value)<people;
 $('human-count-group').hidden=raceType!=='friend'&&raceType!=='derby';$('human-count').value=String(people);
 if($('human-count').options)for(const option of $('human-count').options)option.disabled=raceType==='friend'&&option.value==='1';
 $('difficulty-group').hidden=!hasAI;$('difficulty').disabled=!hasAI;$('difficulty').value=difficulty;
 $('rival-style-group').hidden=!hasAI||raceType==='derby';$('rival-style').value=rivalStyle;
 $('player-durability').value=durabilitySettings.players;$('ai-durability').value=durabilitySettings.ai;
 $('ai-durability-group').hidden=!hasAI;$('ai-durability').disabled=!hasAI;
 $('race-shell').classList.toggle('multiplayer',people>1);
 for(const number of [3,4])$('race-shell').classList.toggle('players-'+number,people===number);
 for(let i=1;i<4;i++)$(HUMAN_DRIVERS[i]+'-stats').hidden=i>=people;
 $('p1-gap').hidden=people===1;$('race-details').hidden=people>1;
 $('p1-name').textContent=people>1?'PLAYER 1':'YOU';$('lap-label').textContent='LAP';
 $('start-description').textContent=people>1?people+' players on one keyboard. Three laps. First human finisher ends the race.':aiLevels[difficulty].description+' Three laps to take the win.';
 updateDrivingLabels();
 if(raceType==='derby')$('start-description').textContent=fieldCount()+'-car derby. Players: '+groupDurability('players')+'× durability'+(hasAI?' · AI: '+groupDurability('ai')+'×':'')+'. Every car can wreck. Finish three laps'+(hasAI?' or wreck all '+(fieldCount()-people)+' AI rivals':'')+'. Compact grid, aggressive drivers, heavy contact.';
 else if(timeTrial)$('start-description').textContent=(personalGhost?'Your personal best: '+timeString(personalGhost.time)+'.':'Set your first personal-best lap to create a ghost.')+' Three laps, no traffic.';
 else $('start-description').textContent+=' '+carCount+' cars · staggered grid.';
 resize();
}
let playerFinished=false;
let racers=[],car,opponent,mode='ready',elapsed=0,lap=1,lapStart=0,score=0,chain=0,chainIdle=0,lastS=0,progress=0,collisionCooldown=0,toastTime=0,count=0,shake=0;
let marks=[],particles=[],sliding=false,soundOn=false,audio,gain,engineVoices=[],inFrame=false,renderAlpha=1;
function renderPose(v){const a=renderAlpha;return{x:(v.previousX??v.x)*(1-a)+v.x*a,y:(v.previousY??v.y)*(1-a)+v.y*a,angle:v.angle-angleDifference(v.angle,v.previousAngle??v.angle)*(1-a)}}
function driftState(v){
 const speed=Math.hypot(v.vx,v.vy),angle=speed>1?angleDifference(v.angle,Math.atan2(v.vy,v.vx)):0;
 return{speed,angle,active:speed>80&&Math.abs(angle)>.19&&Math.abs(angle)<1.5};
}
function cancelBoost(v){v.boostCharge=0;v.boostTimer=0;v.boostWindow=0;v.boostCooldown=Math.max(v.boostCooldown||0,2.5)}
function updateBoost(v,dt){
 v.boostTimer=Math.max(0,(v.boostTimer||0)-dt);v.boostCooldown=Math.max(0,(v.boostCooldown||0)-dt);
 if(v.wrecked||v.finishTime!==null){v.boostCharge=0;v.boostTimer=0;return}
 if((v.hitStun||0)>0){cancelBoost(v);return}
 if(v.boostCooldown>0)return;
 const drift=driftState(v),clean=drift.active&&drift.speed>100&&Math.abs(drift.angle)<.85&&vehicleNear(v).d<ROAD/2-22;
 if(clean){v.boostCharge=Math.min(1,(v.boostCharge||0)+dt*.35);v.boostWindow=.9;return}
 v.boostWindow=Math.max(0,(v.boostWindow||0)-dt);
 if(v.boostWindow>0&&(v.boostCharge||0)>=.3&&Math.abs(drift.angle)<.14&&Math.abs(v.steer)<.38){
  v.boostTimer=.35+.3*v.boostCharge;v.boostCooldown=4;v.boostCharge=0;v.boostWindow=0;
 }else if(v.boostWindow===0)v.boostCharge=0;
}
// Every car emits effects from real lateral velocity, at a bounded rate.
function updateTireEffects(v,dt){
 const drift=driftState(v);v.drifting=drift.active;
 v.tireTimer=Math.max(0,(v.tireTimer||0)-dt);
 if(!drift.active||v.finishTime!==null||v.wrecked){v.tireTimer=0;return}
 if(v.tireTimer>0)return;
 v.tireTimer=1/30;
 const fx=Math.cos(v.angle),fy=Math.sin(v.angle),rx=-fy,ry=fx;
 for(const side of [-1,1]){
  const x=v.x-fx*10+rx*side*6,y=v.y-fy*10+ry*side*6;
  marks.push({x,y,angle:Math.atan2(v.vy,v.vx),length:clamp(drift.speed/30,5,20),life:1});
  if(particles.length<160)particles.push({x,y,vx:-v.vx*.08,vy:-v.vy*.08,life:.6,max:.6,spark:false});
 }
}
function setText(id,value){const el=$(id),text=String(value);if(el.textContent!==text)el.textContent=text}
function setHTML(id,value){const el=$(id);if(el.innerHTML!==value)el.innerHTML=value}
function setWidth(id,value){const el=$(id);if(el.style.width!==value)el.style.width=value}
const timeString=t=>{const n=Math.floor(t*1000);return `${String(Math.floor(n/60000)).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(n%1000).padStart(3,'0')}`};
function sampleTrack(s){
 s=((s%circuitLength)+circuitLength)%circuitLength;
 let lo=0,hi=points.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(lengths[mid]<=s)lo=mid;else hi=mid-1}
 const a=points[lo],b=points[(lo+1)%points.length],t=(s-lengths[lo])/(lengths[lo+1]-lengths[lo]);
 return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function playerDistance(){return car?.wrecked?car.wreckDistance:playerFinished?3*circuitLength:(lap-1)*circuitLength+progress}
function updateDrivingLabels(){
 const people=humanCount();
 $('controls-label').textContent=people>1?activeDrivers().map(d=>d.toUpperCase()+' '+keyLabels[d]).join(' | '):'A/D or ←/→';
 $('setup-controls').textContent=$('controls-label').textContent;
 const hint=$('start-hint');if(hint)hint.textContent=$('controls-label').textContent;
 for(const driver of HUMAN_DRIVERS){
  $(driver+'-keys').textContent=driver==='p1'&&people===1?'A / D or ← / →':keyLabels[driver];
  $(driver+'-car-setting').hidden=driverNumber(driver)>people;
  $(driver+'-car').value=carChoices[driver];$(driver+'-car-description').textContent={balanced:'Balanced slides and predictable recovery.',agile:'Quick direction changes. Use small inputs.',drift:'Long slides. Plan direction changes early.'}[carChoices[driver]];
  $(driver+'-hp').value=String(setups[driver].hp);$(driver+'-grid').value=String(chosenGrid(driver));$(driver+'-grid-setting').hidden=raceType==='ghost';
  if($(driver+'-grid').options)for(const option of $(driver+'-grid').options)option.disabled=Number(option.value)>fieldCount();
 }
}
// Compute every wake before moving any car, so drafting is independent of update order.
function updateDrafts(dt){
 const state=racers.map(v=>({v,s:vehicleNear(v).s,speed:Math.hypot(v.vx,v.vy)}));
 const strengths=state.map(({v,s,speed})=>{
  if(v.finishTime!==null||v.wrecked||speed<100)return 0;
  let best=0;
  for(const target of state){
   const lead=target.v;if(lead===v||lead.finishTime!==null||lead.wrecked||target.speed<100)continue;
   if((lead.x-v.x)**2+(lead.y-v.y)**2>240*240+24*24||Math.abs(angleDifference(v.angle,lead.angle))>.35)continue;
   const fx=lead.vx/target.speed,fy=lead.vy/target.speed,dx=lead.x-v.x,dy=lead.y-v.y;
   const ahead=dx*fx+dy*fy,side=Math.abs(dx*fy-dy*fx);
   if(ahead<44||ahead>240||side>24)continue;
   const along=(target.s-s+circuitLength)%circuitLength;
   if(Math.abs(along-ahead)>35+ahead*.2)continue;
   const alignment=(v.vx*fx+v.vy*fy)/speed;if(alignment<.94)continue;
   best=Math.max(best,(1-side/24)*Math.min(1,(240-ahead)/110));
  }
  return best;
 });
 state.forEach(({v},i)=>{const target=strengths[i];v.draft=(v.draft||0)+(target-(v.draft||0))*(1-Math.exp(-dt*(target>(v.draft||0)?3:10)))});
}
function updateEngineAudio(){
 if(!gain)return;
 const active=mode==='running'&&soundOn;
 gain.gain.setTargetAtTime(active?.025:0,audio.currentTime,.025);
 engineVoices.forEach((voice,i)=>{
  const v=racers.find(v=>v.driver===HUMAN_DRIVERS[i])||car,volume=v.wrecked||i>=humanCount()?0:.7*Math.min(1,2/humanCount());
  const speed=Math.hypot(v.vx,v.vy);
  voice.osc.frequency.setTargetAtTime(40+speed*.45,audio.currentTime,.025);
  voice.gain.gain.setTargetAtTime(volume,audio.currentTime,.02);
  if(voice.pan)voice.pan.pan.setTargetAtTime(humanCount()>1&&i<humanCount()?-.65+1.3*i/(humanCount()-1):0,audio.currentTime,.05);
 });
}
function toggleSound(){
 soundOn=!soundOn;
 if(soundOn&&!audio){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){soundOn=false;flash('ENGINE AUDIO UNAVAILABLE');return}
  audio=new Audio();gain=audio.createGain();gain.gain.value=0;gain.connect(audio.destination);
  engineVoices=Array.from({length:4},()=>{
   const voice={osc:audio.createOscillator(),gain:audio.createGain(),pan:audio.createStereoPanner?.()};
   voice.osc.type='sawtooth';voice.gain.gain.value=0;voice.osc.connect(voice.gain);
   if(voice.pan){voice.gain.connect(voice.pan);voice.pan.connect(gain)}else voice.gain.connect(gain);
   voice.osc.start();return voice;
  });
 }
 if(audio){audio.resume();updateEngineAudio()}
 $('sound').textContent=soundOn?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',soundOn?'Disable sound':'Enable sound');
}

// Human racers share full power. AI difficulty reduces engine power; steering and walls stay physical.
function moveVehicle(v,steer,dt,player){
 if((v.damage||0)>=1&&!v.wrecked)wreckCar(v);
 if(v.wrecked){v.vx=v.vy=v.spin=v.steer=0;return vehicleNear(v)}
 const model=modelFor(v);
 const damage=clamp(v.damage||0,0,1);
 v.damageCooldown=Math.max(0,(v.damageCooldown||0)-dt);v.wallDamageCooldown=Math.max(0,(v.wallDamageCooldown||0)-dt);v.hitStun=Math.max(0,(v.hitStun||0)-dt);
 const control=(1-damage*.15)*(v.hitStun>0?(raceType==='derby'?.35:.5):1);
 v.steer+=(steer-v.steer)*Math.min(1,dt*(model.response||10)*control);
 const speed=Math.hypot(v.vx,v.vy);
 v.spin=(v.spin||0)*Math.exp(-dt*(v.hitStun>0?(raceType==='derby'?.45:.9):(raceType==='derby'?1.8:3)));v.angle+=v.spin*dt;
 v.angle+=v.steer*(.75+Math.min(speed/240,1)*1.85)*model.steering*dt;
 const fx=Math.cos(v.angle),fy=Math.sin(v.angle),rx=-fy,ry=fx;
 const forward=v.vx*fx+v.vy*fy,lateral=v.vx*rx+v.vy*ry;
 // Grip while turning controls entry; grip on release controls catching the slide.
 const turn=Math.abs(v.steer),tireGrip=(model.recoveryGrip??1)+((model.driftGrip??1)-(model.recoveryGrip??1))*turn;
 const grip=(2.8-turn*1.35)*model.grip*tireGrip;
 const enginePower=(v.driver==='ai'||(!v.driver&&!player&&raceType==='ai'))?aiLevels[difficulty].pace*(v.ai?.trafficThrottle??1):1;
 const power=setupFor(v).hp/300;
 const vForward=forward+(ACCELERATION*enginePower*model.accel*power*(1-damage*.18)*(v.boostTimer>0?1.18:1)-Math.max(0,forward)*DRAG*model.drag*(1+damage*.12)*(1-.20*(v.draft||0)))*dt;
 const vLateral=lateral*Math.exp(-grip*dt);
 v.vx=fx*vForward+rx*vLateral;v.vy=fy*vForward+ry*vLateral;
 v.x+=v.vx*dt;v.y+=v.vy*dt;
 resolveWall(v);
 return vehicleNear(v);
}
// Unit mass bodies, with lighter arcade yaw inertia for pronounced offset-hit spins.
const INVERSE_INERTIA=12/(34*34+16*16)*1.65;
const collisionInertia=()=>INVERSE_INERTIA*(raceType==='derby'?1.9:1);
function applyImpulse(v,ix,iy,rx,ry){v.vx+=ix;v.vy+=iy;const limit=raceType==='derby'?14:9;v.spin=clamp((v.spin||0)+(rx*iy-ry*ix)*collisionInertia(),-limit,limit)}
function wreckCar(v){
 if(v.wrecked||v.finishTime!==null&&v.finishTime!==undefined)return;
 v.wreckDistance=v===car?playerDistance():v.total||0;v.wrecked=true;v.damage=1;
 v.vx=v.vy=v.spin=v.steer=v.draft=0;v.drifting=false;
 cancelBoost(v);
 if(v.ai){v.ai.steer=0;v.ai.passOffset=0;v.ai.passTarget=null}
 if(v===car)bank();
 flash((v.label||'CAR')+' WRECKED / OUT OF THE RACE');
}
function damageCar(v,severity,x=v.x,y=v.y,wall=false){
 if(v.wrecked||v.finishTime!==null&&v.finishTime!==undefined)return;
 if(severity<55)return;
 v.hitStun=Math.max(v.hitStun||0,clamp((severity-45)/650,.04,raceType==='derby'?.75:.48));
 const cooldownKey=wall?'wallDamageCooldown':'damageCooldown',peakKey=wall?'wallDamagePeak':'damagePeak';
 const peak=v[cooldownKey]>0?v[peakKey]||0:0;
 const amount=s=>clamp((s-70)/700,0,.28);
 // Durability changes damage taken; shoves, spins and hit stun retain their strength.
 const durability=groupDurability(isHuman(v)?'players':'ai');
 const added=Math.max(0,amount(severity)-amount(peak))/durability;
 if(added>0){
  v.damage=clamp((v.damage||0)+added,0,1);
  const dx=x-v.x,dy=y-v.y;
  v.dentX=clamp(dx*Math.cos(v.angle)+dy*Math.sin(v.angle),-15,15);
  v.dentY=clamp(-dx*Math.sin(v.angle)+dy*Math.cos(v.angle),-6,6);
 }
 v[peakKey]=Math.max(peak,severity);v[cooldownKey]=.18;
 if(v.damage>=1)wreckCar(v);
}
function impact(v,speed){
 if(speed<35)return;
 cancelBoost(v);
 if(v.driver==='ai'&&v.ai){v.ai.recovery=1.6;v.ai.mistakeTime=0;v.ai.reaction=0}
 if(v!==car)return;
 bank();if(collisionCooldown>0)return;
 collisionCooldown=.25;shake=Math.min(7,speed/45);flash('CONTACT / KEEP IT MOVING');
 for(let i=0;i<8&&particles.length<160;i++)particles.push({x:v.x,y:v.y,vx:(Math.random()-.5)*160,vy:(Math.random()-.5)*160,life:.35,max:.35,spark:true});
}
function resolveWall(v){
 if(v.wrecked)return;
 // Distance to a route is Lipschitz: an entire 17-unit capsule fits when its
 // centre has 18 units of clearance. Skip expensive nose/tail queries here.
 if(vehicleNear(v).d<ROAD/2-18)return;
 // Three overlapping circles form a rounded chassis; nose and tail can clip walls.
 const inverseInertia=collisionInertia();
 const fx=Math.cos(v.angle),fy=Math.sin(v.angle),radius=8,limit=ROAD/2-radius;
 for(let pass=0;pass<3;pass++)for(const offset of [-9,0,9]){
  const px=v.x+fx*offset,py=v.y+fy*offset,n=nearest(px,py);
  if(n.d<=limit||n.d<.001)continue;
  const nx=(px-n.x)/n.d,ny=(py-n.y)/n.d,depth=n.d-limit;
  v.x-=nx*depth;v.y-=ny*depth;
  const rx=fx*offset+nx*radius,ry=fy*offset+ny*radius;
  const outward=(v.vx-(v.spin||0)*ry)*nx+(v.vy+(v.spin||0)*rx)*ny;
  if(outward<=0)continue;
  const arm=rx*ny-ry*nx,j=outward*(raceType==='derby'?1.3:1.12)/(1+arm*arm*inverseInertia);
  applyImpulse(v,-nx*j,-ny*j,rx,ry);
  const tx=-ny,ty=nx,slip=(v.vx-(v.spin||0)*ry)*tx+(v.vy+(v.spin||0)*rx)*ty;
  const tangentArm=rx*ty-ry*tx,friction=clamp(-slip/(1+tangentArm*tangentArm*inverseInertia),-j*.18,j*.18);
  applyImpulse(v,tx*friction,ty*friction,rx,ry);damageCar(v,outward,px,py,true);impact(v,outward);
 }
}
function carContact(a,b){
 const dx=b.x-a.x,dy=b.y-a.y;if(dx*dx+dy*dy>40*40)return null;
 const ax={x:Math.cos(a.angle),y:Math.sin(a.angle)},ay={x:-ax.y,y:ax.x};
 const bx={x:Math.cos(b.angle),y:Math.sin(b.angle)},by={x:-bx.y,y:bx.x};
 const dot=(u,v)=>u.x*v.x+u.y*v.y;
 const extent=(x,y,n)=>17*Math.abs(dot(x,n))+8*Math.abs(dot(y,n));
 let depth=Infinity,normal;
 for(const n of [ax,ay,bx,by]){
  const distance=dx*n.x+dy*n.y,overlap=extent(ax,ay,n)+extent(bx,by,n)-Math.abs(distance);
  if(overlap<=0)return null;
  if(overlap<depth){depth=overlap;const sign=distance<0?-1:1;normal={x:n.x*sign,y:n.y*sign}}
 }
 const n=normal,t={x:-n.y,y:n.x};
 // Midpoint of the overlapping face span gives a stable contact without corner bias.
 const an=a.x*n.x+a.y*n.y,bn=b.x*n.x+b.y*n.y;
 const at=a.x*t.x+a.y*t.y,bt=b.x*t.x+b.y*t.y;
 const ae=extent(ax,ay,t),be=extent(bx,by,t);
 const along=(Math.max(at-ae,bt-be)+Math.min(at+ae,bt+be))*.5;
 const across=(an+extent(ax,ay,n)+bn-extent(bx,by,n))*.5;
 return{nx:n.x,ny:n.y,depth,x:n.x*across+t.x*along,y:n.y*across+t.y*along};
}
function resolveCars(a,b){
 if(a.wrecked||b.wrecked)return false;
 const inverseInertia=collisionInertia();
 const c=carContact(a,b);if(!c)return false;
 const {nx,ny}=c,arx=c.x-a.x,ary=c.y-a.y,brx=c.x-b.x,bry=c.y-b.y;
 const correction=Math.max(0,c.depth-.02)*.5;
 a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
 const relative=(tx,ty)=>(b.vx-(b.spin||0)*bry-a.vx+(a.spin||0)*ary)*tx+(b.vy+(b.spin||0)*brx-a.vy-(a.spin||0)*arx)*ty;
 const closing=relative(nx,ny);if(closing>=0)return true;
 if(closing<-12){cancelBoost(a);cancelBoost(b)}
 const effective=(tx,ty)=>2+((arx*ty-ary*tx)**2+(brx*ty-bry*tx)**2)*inverseInertia;
 // More restitution transfers a firm shove while retaining equal-and-opposite momentum.
 const restitution=raceType==='derby'?.55:-closing>90?.32:.12;
 const j=-closing*(1+restitution)/effective(nx,ny);
 applyImpulse(a,-nx*j,-ny*j,arx,ary);applyImpulse(b,nx*j,ny*j,brx,bry);
 const tx=-ny,ty=nx,f=clamp(-relative(tx,ty)/effective(tx,ty),-j*.25,j*.25);
 applyImpulse(a,-tx*f,-ty*f,arx,ary);applyImpulse(b,tx*f,ty*f,brx,bry);
 damageCar(a,-closing*.85,c.x,c.y);damageCar(b,-closing*.85,c.x,c.y);
 impact(a,-closing);impact(b,-closing);return true;
}
// Plan in circuit coordinates so a car on a nearby switchback is not a blocker.
function planTraffic(v,near,speed){
 const ai=v.ai,style=styleFor(v),horizon=clamp((140+speed*.85)*style.horizon,160,480),traffic=[];
 const angle=sampleTrack(near.s).angle,fx=Math.cos(angle),fy=Math.sin(angle);
 const offset=-(v.x-near.x)*fy+(v.y-near.y)*fx,forward=v.vx*fx+v.vy*fy;
 if(!ai.trafficStarted){ai.passOffset=ai.trafficOffset=clamp(offset,-ROAD/2+38,ROAD/2-38);ai.trafficStarted=true}
 for(const other of racers){
  if(other===v||other.finishTime!==null||other.wrecked||Math.hypot(other.x-v.x,other.y-v.y)>horizon+80)continue;
  const on=vehicleNear(other);let ahead=on.s-near.s;
  if(ahead>circuitLength/2)ahead-=circuitLength;if(ahead<-circuitLength/2)ahead+=circuitLength;
  if(ahead<-180||ahead>horizon)continue;
  const heading=sampleTrack(on.s).angle,tx=Math.cos(heading),ty=Math.sin(heading);
  const yaw=angleDifference(other.angle,heading);
  traffic.push({other,ahead,forward:other.vx*tx+other.vy*ty,offset:-(other.x-on.x)*ty+(other.y-on.y)*tx,
   lateral:-other.vx*ty+other.vy*tx,halfWidth:8*Math.abs(Math.cos(yaw))+17*Math.abs(Math.sin(yaw))});
 }
 const inLane=t=>Math.abs(t.offset-offset)<style.clearance-2;
 const blocker=traffic.filter(t=>t.ahead>-25&&t.ahead<60+Math.max(0,forward-t.forward)*1.4&&inLane(t)).sort((a,b)=>a.ahead-b.ahead)[0];
 const nearby=traffic.some(t=>Math.abs(t.ahead)<180);
 ai.trafficNearby=nearby;
 ai.trafficCrowded=traffic.some(t=>Math.abs(t.ahead)<100&&Math.abs(t.offset-offset)<70);
 ai.blockerDistance=blocker?blocker.ahead:Infinity;ai.trafficThrottle=1;
 if(blocker){
  const limit=ROAD/2-38,lane=Math.min(style.lane,ROAD*.29),previous=ai.passOffset||0;
  const candidates=[previous,-lane,lane,-limit,limit,clamp(blocker.offset-style.passGap,-limit,limit),clamp(blocker.offset+style.passGap,-limit,limit)];
  const passing=traffic.find(t=>t.other===ai.passTarget&&t.ahead>-65),passSide=passing?Math.sign(previous-passing.offset):0;
  let best=previous,bestCost=Infinity;
  for(const candidate of candidates){
   let cost=Math.abs(candidate-offset)*.12+Math.abs(candidate)*.02;
   if(Math.abs(candidate-previous)<1&&ai.passHold>0)cost-=8;
   if(passSide&&(candidate-passing.offset)*passSide<10)cost+=100;
   for(const t of traffic){
    const closing=forward-t.forward,meeting=t.ahead-closing*.6;
    if(t.ahead<-55&&meeting<-55)continue;
    const proximity=clamp(1-Math.max(0,t.ahead)/horizon,.15,1);
    const predicted=t.offset+clamp(t.lateral,-60,60)*.2;
    cost+=Math.max(0,Math.max(style.clearance,20+t.halfWidth)-Math.abs(candidate-predicted))*proximity*6;
    // Never sweep across an alongside car or a faster car arriving from behind.
    if((Math.abs(t.ahead)<55||t.ahead<0&&meeting>-55)&&(t.offset-offset)*(t.offset-candidate)<0)cost+=250;
   }
   if(cost<bestCost){bestCost=cost;best=candidate}
  }
  ai.passOffset=best;ai.passHold=.7;ai.passTarget=blocker.other;
  // Ease off only while the current corridor is occupied. Engine drag creates
  // room to merge; an open passing lane immediately restores full power.
  if(!(raceType==='derby'&&ai.derbyAttack>0)&&blocker.ahead>0&&Math.abs(blocker.offset-offset)<24+blocker.halfWidth){
   const targetSpeed=Math.max(90,blocker.forward+Math.max(0,blocker.ahead-48)*1.5);
   if(forward>targetSpeed)ai.trafficThrottle=clamp((DRAG*targetSpeed+(targetSpeed-forward)*1.8)/(ACCELERATION*aiLevels[difficulty].pace),0,1);
  }
 }else if(nearby){
  // Keep separate lanes through a pack instead of all merging onto the centre.
  if(traffic.some(t=>t.other===ai.passTarget&&t.ahead>-55&&t.ahead<90))ai.passHold=.3;
  else if(ai.passHold<=0){
   const clear=traffic.every(t=>{
    const ahead=t.ahead-(forward-t.forward)*.6,clearance=18+t.halfWidth;
    if(ahead>-45&&ahead<65&&Math.abs(t.offset)<clearance)return false;
    return Math.abs(t.ahead)>=55||(t.offset-offset)*t.offset>=0;
   });
   if(clear){ai.passOffset*=.85;if(Math.abs(ai.passOffset)<2){ai.passOffset=0;ai.passTarget=null}}
  }
 }else if(ai.passHold<=0){ai.passOffset=0;ai.passTarget=null}
}
// Derby rivals make short, deliberate rear-quarter attacks, then return to racing.
function derbyAim(v,near,speed){
 if(raceType!=='derby'||speed<90||v.ai.recovery>0)return null;
 const ai=v.ai;
 if(ai.derbyCooldown<=0){
  let best=null,bestCost=Infinity;
  for(const other of racers){
   if(other===v||other.wrecked||other.finishTime!==null||Math.hypot(other.x-v.x,other.y-v.y)>230||Math.abs(angleDifference(other.angle,v.angle))>1.1)continue;
   const ahead=(vehicleNear(other).s-near.s+circuitLength)%circuitLength;
   if(ahead<22||ahead>210)continue;
   const cost=ahead-(isHuman(other)?20:0);if(cost<bestCost){best=other;bestCost=cost}
  }
  if(best){ai.derbyTarget=best;ai.derbyAttack=1.1;ai.derbyCooldown=3}
 }
 const other=ai.derbyTarget;
 if(ai.derbyAttack<=0||!other||other.wrecked||other.finishTime!==null)return null;
 const ahead=(vehicleNear(other).s-near.s+circuitLength)%circuitLength;
 if(ahead<15||ahead>230||Math.hypot(other.x-v.x,other.y-v.y)>250)return null;
 const fx=Math.cos(other.angle),fy=Math.sin(other.angle),side=Math.sign(-(v.x-other.x)*fy+(v.y-other.y)*fx)||1;
 return{x:other.x-fx*8-fy*side*10,y:other.y-fy*8+fx*side*10};
}
function updateRacer(v,dt){
 if(v.finishTime!==null||v.wrecked)return;
 const input=playerInputs[v.driver]||friendControls;let steer=Number(input.right)-Number(input.left);
 if(v.driver==='ai'){
  const ai=v.ai,level=aiLevels[difficulty];
  if(raceType==='derby'){ai.derbyAttack=Math.max(0,(ai.derbyAttack||0)-dt);ai.derbyCooldown=Math.max(0,(ai.derbyCooldown||0)-dt)}
  ai.passHold=Math.max(0,(ai.passHold||0)-dt);
  ai.trafficTimer=Math.max(0,(ai.trafficTimer||0)-dt);
  ai.trafficOffset=(ai.trafficOffset||0)+((ai.passOffset||0)-(ai.trafficOffset||0))*(1-Math.exp(-dt*(level.trafficBlend||5)));
  ai.straightClock+=dt;ai.recovery=Math.max(0,ai.recovery-dt);ai.reaction-=dt;ai.nextMistake-=dt;
  if(ai.nextMistake<=0&&ai.mistakeTime<=0&&ai.recovery===0){
   ai.mistakeTime=level.duration+Math.random()*level.durationSpread;ai.mistakeType=Math.floor(Math.random()*3);
   ai.mistakeSign=Math.random()<.5?-1:1;ai.nextMistake=level.mistakeEvery+Math.random()*level.mistakeSpread;ai.mistakes++;
  }
  if(ai.reaction<=0||(ai.recovery>0&&Math.hypot(v.vx,v.vy)<45)){
   ai.reaction=level.reaction+Math.random()*level.reactionSpread;
   const near=vehicleNear(v),speed=Math.hypot(v.vx,v.vy);
   // Lane planning can run at 16 Hz while steering still reacts every physics step.
   if(ai.trafficTimer<=0){planTraffic(v,near,speed);ai.trafficTimer=.06}
   // Long-range aiming is for settled racing; close targets recover a spun car.
   const settled=speed>100&&Math.abs(v.spin||0)<.6;
   let lookahead=Math.min((settled?level.lookaheadBase??65:65)+speed*(settled?level.lookaheadSpeed??.3:.3),ROAD*1.8);
   if(ai.passHold>0){
    const tangent=sampleTrack(near.s).angle;
    const bend=Math.max(Math.abs(angleDifference(sampleTrack(near.s+lookahead*.5).angle,tangent)),Math.abs(angleDifference(sampleTrack(near.s+lookahead).angle,tangent)));
    // Lane changes need a closer aim on straights; bends still need anticipation.
    if(bend<.25)lookahead=Math.min(lookahead,65+speed*.3);
   }
   const target=sampleTrack(near.s+lookahead);
   // A wandering racing line and delayed decisions replace perfect-frame aim.
   ai.lineOffset=ai.recovery>0?0:ai.lineOffset*.6+(Math.random()-.5)*ROAD*level.wobble*(ai.passHold>0||ai.trafficNearby?.2:1);
   // Retain the chosen passing side through contact recovery and until clear.
   // Use the inside of a bend to shorten the line; traffic keeps its chosen lane.
   const cornerLine=ai.passHold<=0&&ai.recovery===0?clamp(angleDifference(target.angle,sampleTrack(near.s).angle)*ROAD*(level.racingLine||0),-ROAD*.20,ROAD*.20):0;
   const laneOffset=clamp(ai.lineOffset+(ai.trafficOffset||0)+cornerLine,-ROAD/2+38,ROAD/2-38);
   target.x-=Math.sin(target.angle)*laneOffset;target.y+=Math.cos(target.angle)*laneOffset;
   const attack=derbyAim(v,near,speed);if(attack){target.x=attack.x;target.y=attack.y}
   const direction=Math.atan2(target.y-v.y,target.x-v.x);
   const velocityAngle=speed>25?Math.atan2(v.vy,v.vx):v.angle;
   // Smooth aiming error forces small left/right corrections even on a perfect straight.
   // Fade it out before bends and during recovery so it does not interfere with cornering.
   const tangent=sampleTrack(near.s).angle;
   const straightness=clamp(1-Math.abs(angleDifference(target.angle,tangent))/.22,0,1);
   const phase=ai.straightClock*1.4+ai.straightPhase;
   const headingBias=(Math.sin(phase)*.7+Math.sin(phase*2.13+.8)*.3)*level.straightAngle;
   const straightError=ai.recovery===0&&speed>40?headingBias*straightness*(ai.trafficNearby?.35:1):0;
   // Initiate a small extra yaw into corners, then countersteer as slip grows.
   // The offset fades near walls, in traffic, and while recovering from contact.
   const bend=angleDifference(target.angle,tangent),slip=angleDifference(v.angle,velocityAngle);
   const driftRoom=clamp((ROAD*.34-near.d)/(ROAD*.18),0,1);
   const driftIntent=settled&&ai.recovery===0&&ai.passHold<=0?clamp(bend*.22,-.12,.12)*clamp((speed-85)/100,0,1)*driftRoom:0;
   const driftAim=driftIntent*clamp(1-Math.abs(slip)/.65,0,1);
   const countersteer=Math.sign(slip)*clamp((Math.abs(slip)-.65)*.3,0,.16);
   ai.driftAim=driftAim;
   const desired=direction+(speed>40?clamp(angleDifference(direction,velocityAngle)*(settled?level.slipComp??.65:.65),-.65,.65):0)+straightError+driftAim-countersteer;
   const headingError=angleDifference(direction,v.angle);
   if(speed<45&&Math.abs(headingError)>1.8&&!ai.turnRecovery)ai.turnRecovery=Math.sign(headingError);
   // A locked low-speed turn must release once rolling, or it can circle indefinitely.
   if(Math.abs(headingError)<.8||speed>80)ai.turnRecovery=0;
   ai.steer=ai.turnRecovery||clamp(angleDifference(desired,v.angle)*(settled?level.steerGain??2.8:2.8)-(v.spin||0)*.55,-1,1);
  }
  steer=ai.steer;
  if(ai.mistakeTime>0){
   ai.mistakeTime=Math.max(0,ai.mistakeTime-dt);
   const strength=level.strength*(ai.trafficCrowded?.4:1);
   if(ai.mistakeType===0)steer*=1-strength; // Late turn-in.
   else if(ai.mistakeType===1)steer=clamp(steer+(Math.sign(steer)||ai.mistakeSign)*strength,-1,1);
   else steer=clamp(steer+ai.mistakeSign*strength,-1,1); // A correction in the wrong direction.
  }
 }
 const next=moveVehicle(v,steer,dt,false);
 if(v.wrecked)return;
 let ds=next.s-v.lastS;if(ds>circuitLength/2)ds-=circuitLength;if(ds<-circuitLength/2)ds+=circuitLength;
 if(Math.abs(ds)<ROAD*2)v.total+=ds;v.lastS=next.s;
 if((raceType!=='derby'||isHuman(v))&&v.total>=3*circuitLength){v.finishTime=elapsed;if(isHuman(v))finish(driverNumber(v.driver));else flash(v.label+' FINISHED / BRING IT HOME')}
}

function updateOpponent(dt){updateRacer(opponent,dt)}

function bumpCars(){
 const active=racers.filter(v=>v.finishTime===null&&!v.wrecked);
 // Revisit contacts so packs and cars pinned against a wall settle together.
 for(let pass=0;pass<5;pass++){
  let touching=false;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)touching=resolveCars(active[i],active[j])||touching;
  if(!touching)break;
  for(const v of active)resolveWall(v);
 }
}
function reset(){
 playerFinished=false;elapsed=0;lap=1;lapStart=0;score=0;chain=0;chainIdle=0;progress=0;lastS=0;collisionCooldown=0;marks=[];particles=[];sliding=false;clearControls();shake=0;
 const count=fieldCount(),slots=gridSlots(count);
 racers=Array.from({length:count},(_,i)=>{
  const slot=slots[i],startDistance=-slot*(raceType==='derby'?52:72),grid=sampleTrack(startDistance),offset=slot===0?0:(slot%2?1:-1)*Math.min(32,ROAD*.17);
  return{x:grid.x-Math.sin(grid.angle)*offset,y:grid.y+Math.cos(grid.angle)*offset,vx:0,vy:0,spin:0,angle:grid.angle,steer:0,draft:0,drifting:false,tireTimer:0,damage:0,damageCooldown:0,damagePeak:0,wallDamageCooldown:0,wallDamagePeak:0,hitStun:0,dentX:0,dentY:0,smokeTimer:0,model:i<humanCount()?carChoices[HUMAN_DRIVERS[i]]:'balanced',
   personality:raceType==='derby'?'aggressive':rivalStyle==='mixed'?['racer','cautious','aggressive'][(Math.max(1,i)-1)%3]:rivalStyle,boostCharge:0,boostTimer:0,boostCooldown:0,boostWindow:0,
   driver:i<humanCount()?HUMAN_DRIVERS[i]:'ai',color:racerColors[i],label:i<humanCount()?(humanCount()>1?'P'+(i+1):'YOU'):`AI ${i-humanCount()+1}`,
   total:startDistance,lastS:((startDistance%circuitLength)+circuitLength)%circuitLength,finishTime:null,wrecked:false,wreckDistance:0,
   ai:{derbyAttack:0,derbyCooldown:i*.12,derbyTarget:null,passOffset:0,trafficOffset:0,passHold:0,trafficTimer:0,trafficStarted:false,trafficThrottle:1,blockerDistance:Infinity,straightClock:0,straightPhase:Math.random()*TAU,turnRecovery:0,recovery:0,reaction:0,steer:0,lineOffset:0,nextMistake:aiLevels[difficulty].mistakeEvery*.65+Math.random()*aiLevels[difficulty].mistakeSpread,mistakeTime:0,mistakeType:0,mistakeSign:1,mistakes:0}};
 });
 car=racers[0];opponent=racers[1]||car;ghostImproved=false;startGhostLap();
 progress=car.total;lastS=car.lastS;
 $('drift').classList.remove('active');$('toast').textContent='';$('best').textContent=bestLap?timeString(bestLap):'— — : — —';updateHUD();
}
function raceDistance(v){return v.wrecked?v.wreckDistance:v===car?playerDistance():v.finishTime!==null?3*circuitLength:v.total}
function standings(){return [...racers].sort((a,b)=>{
 if(a.wrecked||b.wrecked){if(!a.wrecked)return -1;if(!b.wrecked)return 1;return b.wreckDistance-a.wreckDistance}
 if(a.finishTime!==null||b.finishTime!==null){if(a.finishTime===null)return 1;if(b.finishTime===null)return -1;return a.finishTime-b.finishTime}
 return raceDistance(b)-raceDistance(a);
})}
let setupVisible=true;
function setSetupVisible(visible){
 setupVisible=visible;
 $('app').classList.toggle('setup-hidden',!visible);
 $('toggle-setup').setAttribute('aria-expanded',String(visible));
 $('toggle-setup').textContent=visible?'Hide setup':'Show setup';
 if(visible&&mode==='running')pause();
 if(visible&&mode==='countdown'){mode='ready';count=0;$('countdown').textContent='';$('launch-race').innerHTML='Start race <span aria-hidden="true">→</span>'}
 resize();
}
function begin(){reset();resetCameras();mode='countdown';count=3.2;setSetupVisible(false);$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';$('launch-race').innerHTML='Restart race <span aria-hidden="true">→</span>';canvas.focus?.({preventScroll:true})}
function flash(t){$('toast').textContent=t;toastTime=1.8}
function updateHUD(){
 for(const [driver,v] of [['p1',car],['p2',opponent],...humanRacers().slice(2).map(v=>[v.driver,v])]){
  setText(driver+'-damage',v.wrecked?'WRECKED · DNF':`BODY ${Math.max(1,Math.ceil((1-(v.damage||0))*100))}%`);
  $(driver+'-damage').classList.toggle('damaged',(v.damage||0)>.5);
  const indicator=$(driver+'-draft');const hidden=(v.draft||0)<.08;if(indicator.hidden!==hidden)indicator.hidden=hidden;
  setText(driver+'-draft',`DRAFT −${Math.round((v.draft||0)*20)}% DRAG`);
 }
 const speed=Math.hypot(car.vx,car.vy),p2Speed=Math.hypot(opponent.vx,opponent.vy);
 setText('speed',Math.round(speed*KMH_PER_UNIT));
 setText('p2-speed',Math.round(p2Speed*KMH_PER_UNIT));
 setWidth('speedbar',`${Math.min(100,speed/(TOP_SPEED*modelFor(car).accel/modelFor(car).drag*setupFor(car).hp/300)*100)}%`);
 setWidth('p2-speedbar',`${Math.min(100,p2Speed/(TOP_SPEED*modelFor(opponent).accel/modelFor(opponent).drag*setupFor(opponent).hp/300)*100)}%`);
 setText('time',timeString(elapsed));
 const lapMarkup=n=>`${String(n).padStart(2,'0')} <small>/ 03</small>`;
 setHTML('lap',lapMarkup(lap));
 setHTML('p2-lap',lapMarkup(Math.min(3,Math.floor(Math.max(0,opponent.total)/circuitLength)+1)));
 setText('score',String(Math.floor(score)).padStart(5,'0'));setText('chain','+'+Math.floor(chain));
 const p1Distance=playerDistance(),p2Distance=opponent.finishTime!==null?3*circuitLength:opponent.total;
 const ahead=opponent.finishTime!==null||p2Distance>p1Distance;
 const order=standings(),denominator=String(racers.length).padStart(2,'0');
 setHTML('position',`${String(order.indexOf(car)+1).padStart(2,'0')} <small>/ ${denominator}</small>`);
 setHTML('p2-position',`${String(order.indexOf(opponent)+1).padStart(2,'0')} <small>/ ${denominator}</small>`);
 const difference=p1Distance-p2Distance,gap=Math.round(Math.abs(difference)/UNITS_PER_METRE);
 setText('p1-gap',car.wrecked?'OUT OF RACE':opponent.wrecked?'P2 WRECKED':gap===0?'LEVEL':`${gap} M ${difference>0?'AHEAD':'BEHIND'}`);
 setText('p2-gap',opponent.wrecked?'OUT OF RACE':car.wrecked?'P1 WRECKED':gap===0?'LEVEL':`${gap} M ${difference>0?'BEHIND':'AHEAD'}`);
 if(humanCount()>2){
  const leader=order[0];
  for(const v of humanRacers()){
   const d=v.driver,speed=Math.hypot(v.vx,v.vy),index=order.indexOf(v);
   if(d==='p3'||d==='p4'){
    setText(d+'-speed',Math.round(speed*KMH_PER_UNIT));setWidth(d+'-speedbar',`${Math.min(100,speed/(TOP_SPEED*modelFor(v).accel/modelFor(v).drag*setupFor(v).hp/300)*100)}%`);
    setHTML(d+'-lap',lapMarkup(Math.min(3,Math.floor(Math.max(0,v.total)/circuitLength)+1)));setHTML(d+'-position',`${String(index+1).padStart(2,'0')} <small>/ ${denominator}</small>`);
   }
   const gap=Math.round(Math.max(0,raceDistance(leader)-raceDistance(v))/UNITS_PER_METRE);
   setText(d+'-gap',v.wrecked?'OUT OF RACE':v===leader?'LEADING':gap+' M TO '+leader.label);
  }
 }
 if(raceType==='derby'){setText('rival-status',racers.some(v=>v.driver==='ai')?`${racers.filter(v=>v.driver==='ai'&&!v.wrecked).length} RIVALS LEFT · ${racers.length}-CAR DERBY`:'HUMAN DERBY · FIRST TO THREE LAPS');return}
 if(raceType==='ghost'){setText('rival-status',ghostStatus());return}
 const rival=order.find(v=>v!==car)||car,rivalGap=Math.round(Math.abs(raceDistance(rival)-p1Distance)/UNITS_PER_METRE);
 setText('rival-status',rival.wrecked?`${rival.label} WRECKED · DNF`:carCount>2?`${rival.label} ${rivalGap} M ${raceDistance(rival)>p1Distance?'AHEAD':'BEHIND'}`:opponent.finishTime!==null?`${rivalName()} FINISHED`:`${rivalName()} ${gap} M ${ahead?'AHEAD':'BEHIND'}`);
}

function bank(){chain=0;chainIdle=0}
function checkWreckResult(){
 const humans=humanRacers();
 if(!humans.length||!humans.every(v=>v.wrecked))return false;
 mode='finished';clearControls();updateHUD();if(gain)gain.gain.setTargetAtTime(0,audio.currentTime,.05);
 $('overlay').classList.remove('hidden');
 document.querySelector('.start-card').innerHTML=`<h2>${humanCount()>1?'All players':'You'}<br><em>wrecked.</em></h2><p>DNF · OUT OF THE RACE<br>RACE TIME &nbsp; ${timeString(elapsed)}</p><button id="again" class="primary">REPAIR &amp; RACE AGAIN <span>↗</span></button><div class="start-hint">${$('controls-label').textContent}</div>`;
 $('again').onclick=begin;return true;
}
function finish(winner=1){
 const finisher=racers.find(v=>v.driver===HUMAN_DRIVERS[winner-1]);if(!finisher||finisher.wrecked)return;
 playerFinished=winner===1;finisher.finishTime=elapsed;updateHUD();mode='finished';clearControls();
 if(gain)gain.gain.setTargetAtTime(0,audio.currentTime,.05);
 const friend=humanCount()>1,won=standings()[0]===car;
 const place=standings().indexOf(finisher)+1;
 if(raceType==='derby'){
  const wrecks=racers.filter(v=>v.driver==='ai'&&v.wrecked).length;
  $('overlay').classList.remove('hidden');document.querySelector('.start-card').innerHTML=`<h2>${humanCount()>1?'Player '+winner:'Derby'}<br><em>${humanCount()>1?'wins.':'complete.'}</em></h2><p>RIVALS WRECKED &nbsp; ${wrecks} / ${racers.filter(v=>v.driver==='ai').length}<br>RACE TIME &nbsp; ${timeString(elapsed)}</p><button id="again" class="primary">MORE CHAOS <span>↗</span></button>`;$('again').onclick=begin;return;
 }
 if(raceType==='ghost'){
  $('overlay').classList.remove('hidden');document.querySelector('.start-card').innerHTML=`<h2>${ghostImproved?'New personal<br><em>best.</em>':'Personal best<br><em>chase.</em>'}</h2><p>BEST LAP &nbsp; ${bestLap?timeString(bestLap):'—'}<br>${!personalGhost?'No valid ghost lap recorded.':ghostPersisted?'Ghost saved for this circuit and car.':'Ghost kept this session; browser storage is full.'}</p><button id="again" class="primary">CHASE IT AGAIN <span>↗</span></button>`;$('again').onclick=begin;return;
 }
 const title=raceType==='ghost'?(ghostImproved?'New personal<br><em>best.</em>':'Personal best<br><em>chase.</em>'):friend?`Player ${winner}<br><em>finishes #${place}.</em>`:(won?'You take<br><em>the win.</em>':'Chase the<br><em>next one.</em>');
 $('overlay').classList.remove('hidden');document.querySelector('.start-card').innerHTML=`<h2>${title}</h2><p>${friend?'FINISH TIME':'RACE TIME'} &nbsp; ${timeString(elapsed)}<br>${friend?`FIELD POSITION &nbsp; ${place} / ${racers.length}`:`POSITION &nbsp; ${place} / ${racers.length}<br>DRIFT POINTS &nbsp; ${Math.floor(score).toLocaleString()}<br>BEST LAP &nbsp; ${bestLap?timeString(bestLap):'—'}`}</p><button id="again" class="primary">${friend?'RACE AGAIN':'CHASE IT AGAIN'} <span>↗</span></button><div class="start-hint">${$('controls-label').textContent}</div>`;$('again').onclick=begin;
}

function step(dt){
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').textContent=''}
 if(mode==='countdown'){count-=dt;$('countdown').textContent=count>.2?Math.ceil(count-.2):'GO';if(count<=0){mode='running';$('countdown').textContent=''}return}
 if(mode!=='running')return;
 for(const v of racers){v.previousX=v.x;v.previousY=v.y;v.previousAngle=v.angle}
 elapsed+=dt;collisionCooldown=Math.max(0,collisionCooldown-dt);shake*=.87;
 updateDrafts(dt);
 for(const v of racers.slice(1)){updateRacer(v,dt);if(mode!=='running')return;}
 moveVehicle(car,Number(controls.right)-Number(controls.left),dt,true);bumpCars();
 if(checkWreckResult())return;
 if(raceType==='derby'&&racers.some(v=>v.driver==='ai')&&racers.filter(v=>v.driver==='ai').every(v=>v.wrecked)){const leader=standings().find(v=>isHuman(v)&&!v.wrecked);finish(driverNumber(leader.driver));return}
 const near=vehicleNear(car);
 const fx=Math.cos(car.angle),fy=Math.sin(car.angle),rx=-fy,ry=fx;
 let speed=Math.hypot(car.vx,car.vy);
 let ds=near.s-lastS;if(ds>circuitLength/2)ds-=circuitLength;if(ds<-circuitLength/2)ds+=circuitLength;
 if(!car.wrecked&&Math.abs(ds)<ROAD*2)progress+=ds;lastS=near.s;
 recordGhost(dt);
 if(!car.wrecked&&progress>=circuitLength){
  const lapTime=elapsed-lapStart;saveGhostLap(lapTime);progress-=circuitLength;lapStart=elapsed;startGhostLap();
  if(raceType!=='ghost'&&(!bestLap||lapTime<bestLap)){bestLap=lapTime;try{localStorage.setItem(bestKey(),String(bestLap))}catch{}}
  setText('best',bestLap?timeString(bestLap):'—');
  if(lap===3){finish();return}else{lap++;flash('LAP '+(lap-1)+' / '+timeString(lapTime))}
 }

 speed=Math.hypot(car.vx,car.vy);const slip=Math.abs(Math.atan2(car.vx*rx+car.vy*ry,car.vx*fx+car.vy*fy));
 sliding=speed>80&&slip>.19&&slip<1.5&&collisionCooldown===0;
 if(sliding){const earned=slip*speed*dt*.22;chain+=earned;score+=earned;chainIdle=0}
 else{chainIdle+=dt;if(chainIdle>.65)bank()}
 for(const v of racers){
  updateBoost(v,dt);
  updateTireEffects(v,dt);
  v.smokeTimer=Math.max(0,(v.smokeTimer||0)-dt);
  if(v.finishTime===null&&(v.damage||0)>.55&&v.smokeTimer===0&&particles.length<160){
   particles.push({x:v.x+Math.cos(v.angle)*10,y:v.y+Math.sin(v.angle)*10,vx:-v.vx*.08,vy:-v.vy*.08-12,life:.7,max:.7,spark:false,damage:true});v.smokeTimer=.12;
  }
 }
 $('drift').classList.toggle('active',sliding||chain>0);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);if(marks.length>4000)marks.splice(0,marks.length-4000);
 if(!inFrame){updateEngineAudio();updateHUD()}
}
const mini=$('minimap'),miniCtx=mini.getContext('2d');
let viewport={w:0,h:0,dpr:1},cameras=[];
function viewRects(){
 const count=humanCount(),columns=count===1?1:2,rows=count>2?2:1,w=viewport.w/columns,h=viewport.h/rows;
 return Array.from({length:count},(_,i)=>({x:i%columns*w,y:Math.floor(i/columns)*h,w,h}));
}
function resetCameras(){if(!car||!opponent)return;const subjects=humanRacers();if(!subjects.length)subjects.push(car);if(subjects.length===1)subjects.push(opponent);cameras=subjects.map(v=>({x:v.x,y:v.y,zoom:1,racer:v}))}
function resize(){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);viewport={w:r.width,h:r.height,dpr};
 const mr=mini.getBoundingClientRect();mini.width=Math.round(mr.width*dpr);mini.height=Math.round(mr.height*dpr);
}
function updateCameras(dt){
 const rects=viewRects();
 for(let i=0;i<cameras.length;i++){
  const c=cameras[i],v=c.racer,pose=renderPose(v),speed=Math.hypot(v.vx,v.vy),rect=rects[i]||rects[0];
  const available=Math.min(rect.w,rect.h*1.5);
  const zoom=Math.min(.98-speed/TOP_SPEED*.14,Math.max(.3,(available-20)/350));
  const weight=1-Math.exp(-dt*6);c.x+=(pose.x+v.vx*.32-c.x)*weight;c.y+=(pose.y+v.vy*.32-c.y)*weight;c.zoom+=(zoom-c.zoom)*weight;
 }
}

function strokeRoad(color,width,dash=[]){
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
 if(worldPath)ctx.stroke(worldPath);else{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke()}
}
const sceneryHash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
function drawScenery(c,w,h){
 const left=c.x-w/c.zoom/2-250,right=c.x+w/c.zoom/2+250,top=c.y-h/c.zoom/2-250,bottom=c.y+h/c.zoom/2+250;
 const theme=track.theme||'park';
 if(theme==='coast'){
  ctx.fillStyle='#274f5e';ctx.beginPath();ctx.moveTo(trackBounds.minX-1500,trackBounds.minY-1500);ctx.lineTo(300,trackBounds.minY-1500);
  for(let y=trackBounds.minY-1500;y<trackBounds.maxY+1500;y+=120)ctx.lineTo(120+Math.sin(y/420)*110,y);
  ctx.lineTo(trackBounds.minX-1500,trackBounds.maxY+1500);ctx.closePath();ctx.fill();
 }
 if(theme==='alpine'){
  ctx.strokeStyle='#a8b09c18';ctx.lineWidth=3;
  for(let y=Math.floor(top/160)*160;y<bottom;y+=160){ctx.beginPath();for(let x=left;x<=right;x+=70){const yy=y+Math.sin(x/240+y/110)*35;x===left?ctx.moveTo(x,yy):ctx.lineTo(x,yy)}ctx.stroke()}
 }
 for(let ix=Math.floor(left/240);ix<=Math.ceil(right/240);ix++)for(let iy=Math.floor(top/240);iy<=Math.ceil(bottom/240);iy++){
  const hash=sceneryHash(ix,iy),x=ix*240+hash*100,y=iy*240+sceneryHash(iy,ix+5)*100;
  if(theme==='industrial'){
   if(hash<.45)continue;ctx.fillStyle='#161e1b';ctx.fillRect(x+9,y+9,130,90);ctx.fillStyle='#46504b';ctx.fillRect(x,y,130,90);ctx.strokeStyle='#78816c';ctx.lineWidth=2;for(let z=15;z<130;z+=22){ctx.beginPath();ctx.moveTo(x+z,y);ctx.lineTo(x+z,y+90);ctx.stroke()}
  }else if(theme==='speedway'){
   if(hash<.65)continue;ctx.fillStyle=hash>.82?'#8e4d4c':'#536b81';ctx.fillRect(x,y,150,45);ctx.strokeStyle='#adb2a770';ctx.lineWidth=2;for(let n=8;n<45;n+=8){ctx.beginPath();ctx.moveTo(x,y+n);ctx.lineTo(x+150,y+n);ctx.stroke()}
  }else{
   if(theme==='coast'&&x<220)continue;ctx.fillStyle=theme==='alpine'?'#818b7b':hash>.45?'#334f35':'#3c603c';ctx.beginPath();ctx.arc(x,y,18+hash*26,0,TAU);ctx.fill();ctx.fillStyle=theme==='alpine'?'#b1b4a0':'#5c77504d';ctx.beginPath();ctx.arc(x-7,y-8,12+hash*12,0,TAU);ctx.fill();
  }
 }
}
function drawWorld(c,w,h){
 ctx.lineJoin='round';ctx.lineCap='round';
 strokeRoad('#141e18',ROAD+34);strokeRoad('#aab099',ROAD+12);strokeRoad(track.curb,ROAD+7,[16,16]);strokeRoad(track.asphalt||'#3c443e',ROAD-2);strokeRoad('#c5c8a025',1,[18,35]);ctx.setLineDash([]);
 ctx.save();ctx.translate(points[0].x,points[0].y);ctx.rotate(carStartAngle());for(let x=0;x<4;x++)for(let y=0;y<10;y++){ctx.fillStyle=(x+y)%2?'#303a31':'#e3e6d3';ctx.fillRect(x*5-10,(y-5)*ROAD/10,5,ROAD/10)}ctx.restore();
 const halfW=w/c.zoom/2+30,halfH=h/c.zoom/2+30;
 ctx.strokeStyle='#10181188';ctx.lineWidth=3;ctx.beginPath();for(const m of marks){if(Math.abs(m.x-c.x)>halfW||Math.abs(m.y-c.y)>halfH)continue;ctx.moveTo(m.x,m.y);ctx.lineTo(m.x-Math.cos(m.angle)*(m.length||5),m.y-Math.sin(m.angle)*(m.length||5))}ctx.stroke();
 for(const p of particles){ctx.globalAlpha=p.life/p.max*(p.spark?1:p.damage?.55:.25);ctx.fillStyle=p.spark?'#ffe5a2':p.damage?'#171b1a':'#b3c0a8';ctx.beginPath();ctx.arc(p.x,p.y,p.spark?2:4+(1-p.life/p.max)*10,0,TAU);ctx.fill()}ctx.globalAlpha=1;
 const ghost=ghostPose();if(ghost){ctx.save();ctx.globalAlpha=.28;drawCar(ghost,'#e4f7ff','PB GHOST');ctx.restore()}
 for(let i=racers.length-1;i>=0;i--){const v=racers[i];if(Math.abs(v.x-c.x)<=halfW+50&&Math.abs(v.y-c.y)<=halfH+50)drawCar(v,v.color,v.label)}
}
function draw(){
 const {w,h,dpr}=viewport;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const rects=viewRects();
 for(let i=0;i<rects.length;i++){
  const c=cameras[i],r=rects[i];if(!c)continue;const shakeAmount=c.racer===car?shake:0;
  ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle=track.ground;ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.translate(r.x+r.w/2+(Math.random()-.5)*shakeAmount,r.y+r.h/2+(Math.random()-.5)*shakeAmount);ctx.scale(c.zoom,c.zoom);ctx.translate(-c.x,-c.y);drawScenery(c,r.w,r.h);drawWorld(c,r.w,r.h);ctx.restore();
  if(rects.length>1){ctx.fillStyle=c.racer.color;ctx.font='bold 10px monospace';ctx.fillText(c.racer.driver.toUpperCase()+' · '+keyLabels[c.racer.driver],r.x+12,r.y+21)}
 }
 if(rects.length>1){ctx.fillStyle='#d6dcc459';ctx.fillRect(w/2-1,0,2,h);if(rects.length>2)ctx.fillRect(0,h/2-1,w,2)}
 drawMinimap();
}

function minimapTransform(){
 const {dpr}=viewport,w=mini.width/dpr,h=mini.height/dpr,pad=12;
 const bw=trackBounds.maxX-trackBounds.minX,bh=trackBounds.maxY-trackBounds.minY;
 const scale=Math.min((w-pad*2)/bw,(h-48)/bh);
 return{w,h,scale,ox:(w-bw*scale)/2-trackBounds.minX*scale,oy:26+(h-48-bh*scale)/2-trackBounds.minY*scale};
}
function drawMinimap(){
 const m=minimapTransform(),c=miniCtx;
 c.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);c.clearRect(0,0,m.w,m.h);
 c.fillStyle='#142019f2';c.fillRect(0,0,m.w,m.h);c.font='8px monospace';c.fillStyle='#c3cfb8';c.fillText(`${(circuitLength/UNITS_PER_METRE/1000).toFixed(2)} KM`,10,14);c.fillText('N ↑',m.w-27,14);
 c.save();c.beginPath();c.rect(5,22,m.w-10,m.h-43);c.clip();
 c.translate(m.ox,m.oy);c.scale(m.scale,m.scale);c.lineJoin='round';c.lineCap='round';
 // The same final path and playable width drive the road, collisions, and minimap.
 const mapPath=()=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath()};
 const stroke=(color,width)=>{c.strokeStyle=color;c.lineWidth=width;if(worldPath)c.stroke(worldPath);else{mapPath();c.stroke()}};
 stroke('#bcc9ac',Math.max(ROAD+20,3/m.scale));stroke('#51614c',Math.max(ROAD-8,1.5/m.scale));
 const rects=viewRects();for(let i=0;i<rects.length;i++){const camera=cameras[i],r=rects[i];c.strokeStyle=camera.racer.color+'66';c.lineWidth=.8/m.scale;c.strokeRect(camera.x-r.w/camera.zoom/2,camera.y-r.h/camera.zoom/2,r.w/camera.zoom,r.h/camera.zoom)}
 c.save();c.translate(points[0].x,points[0].y);c.rotate(carStartAngle());c.fillStyle='#fff4d4';c.fillRect(-1.2/m.scale,-ROAD/2,2.4/m.scale,ROAD);c.restore();
 for(const v of [...racers].reverse()){
  const pose=renderPose(v);
  c.save();c.translate(pose.x,pose.y);c.rotate(pose.angle);c.beginPath();c.moveTo(5/m.scale,0);c.lineTo(-3/m.scale,-3/m.scale);c.lineTo(-3/m.scale,3/m.scale);c.closePath();c.fillStyle=v.color;c.fill();c.strokeStyle='#142019';c.lineWidth=.8/m.scale;c.stroke();c.restore();
 }
 const ghost=ghostPose();if(ghost){c.save();c.translate(ghost.x,ghost.y);c.rotate(ghost.angle);c.globalAlpha=.6;c.fillStyle='#e4f7ff';c.beginPath();c.moveTo(5/m.scale,0);c.lineTo(-3/m.scale,-3/m.scale);c.lineTo(-3/m.scale,3/m.scale);c.closePath();c.fill();c.restore()}
 c.restore();c.font='8px monospace';c.fillStyle='#d4fb71';c.fillText(humanCount()>1?'P1':'YOU',10,m.h-8);c.fillStyle='#ff9b66';c.fillText(humanCount()>2?'P1–P'+humanCount():humanCount()===2?'P2':raceType==='ghost'?'PB':'AI',m.w-24,m.h-8);
}

function drawCar(v,color,label){
 const pose=renderPose(v);
 if(v.driver==='ai')label+=` [${styleFor(v).label[0]}]`;
 if(v.wrecked){color='#777c72';label+=' · WRECK'}

 if((v.draft||0)>.08){
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(Math.atan2(v.vy,v.vx));ctx.strokeStyle=color;ctx.globalAlpha=v.draft*.65;ctx.lineWidth=1.5;
  for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-22,side*11);ctx.lineTo(-22-36*v.draft,side*14);ctx.stroke()}ctx.restore();
 }
 ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);ctx.shadowColor='#0009';ctx.shadowBlur=10;ctx.shadowOffsetY=5;ctx.fillStyle='#0b130d';ctx.fillRect(-12,-10,25,20);ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-17,-8,34,16,4);ctx.fill();ctx.fillStyle='#263d32';ctx.fillRect(-7,-6,13,12);ctx.fillStyle='#5f7950';ctx.fillRect(-2,-6,2,12);ctx.fillStyle='#ecf7d1';ctx.fillRect(13,-7,3,4);ctx.fillRect(13,3,3,4);ctx.fillStyle='#ef775b';ctx.fillRect(-17,-7,2,4);ctx.fillRect(-17,3,2,4);ctx.fillStyle='#151e16';ctx.fillRect(-17,-11,3,22);ctx.restore();
 ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);ctx.fillStyle='#f1f5d7';
 if(v.model==='agile'){ctx.fillRect(-10,-5,3,10);ctx.fillRect(-5,-5,2,10)}
 if(v.model==='drift'){ctx.fillRect(-12,-9,3,18);ctx.fillRect(6,-2,8,4)}ctx.restore();
 if((v.damage||0)>.02){
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
  ctx.fillStyle='#242b27';ctx.globalAlpha=.4+v.damage*.5;
  ctx.fillRect((v.dentX||0)-4,(v.dentY||0)-2,5+v.damage*5,4);
  ctx.strokeStyle='#d5d9bf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-3,2);ctx.lineTo(3,-3);ctx.stroke();
  if(v.damage>.4){ctx.strokeStyle='#142019';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-6);ctx.lineTo(11,-1);ctx.lineTo(6,5);ctx.stroke()}ctx.restore();
 }
 if((v.damage||0)>.02){ctx.fillStyle='#121a16';ctx.fillRect(pose.x-12,pose.y-19,24,3);ctx.fillStyle=v.damage>.55?'#ff8972':color;ctx.fillRect(pose.x-12,pose.y-19,24*(1-v.damage),3)}
 ctx.fillStyle=color;ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(label,pose.x,pose.y-23);ctx.textAlign='left';
}

function carStartAngle(){return Math.atan2(points[1].y-points[0].y,points[1].x-points[0].x)}
function pause(){if(mode==='running'){mode='paused';$('countdown').textContent='PAUSED';$('pause').textContent='▶';clearControls()}else if(mode==='paused'){mode='running';$('countdown').textContent='';$('pause').textContent='Ⅱ'}if(gain&&mode!=='running')gain.gain.setTargetAtTime(0,audio.currentTime,.05)}
window.addEventListener('keydown',e=>{
 if(['SELECT','INPUT','TEXTAREA'].includes(e.target?.tagName))return;
 const k=e.key.toLowerCase();if(e.target?.tagName==='BUTTON'&&(k===' '||k==='enter'))return;
 if(['arrowleft','arrowright','a','d','j','l','v','n',' '].includes(k))e.preventDefault();
 heldKeys.add(k);syncControls();
 if(!e.repeat&&(k==='escape'||k==='p'))pause();if(!e.repeat&&k==='r')begin();
 if(!e.repeat&&(k==='enter'||k===' ')&&(mode==='ready'||mode==='finished'))begin();
});
window.addEventListener('keyup',e=>{heldKeys.delete(e.key.toLowerCase());syncControls()});
window.addEventListener('blur',()=>{clearControls();if(mode==='running')pause()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearControls();if(mode==='running')pause()}});
for(const side of ['left','right']){const b=$(side);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touchControls[side]=true;syncControls()});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{touchControls[side]=false;syncControls()})}
$('start').onclick=begin;$('restart').onclick=begin;$('pause').onclick=pause;
$('sound').onclick=toggleSound;
 $('toggle-setup').onclick=()=>setSetupVisible(!setupVisible);
 $('launch-race').onclick=begin;
for(const driver of HUMAN_DRIVERS)$(driver+'-car').addEventListener('change',e=>{selectCar(driver,e.target.value);e.target.blur()});
for(const driver of HUMAN_DRIVERS){
 for(const [id,field] of [['hp','hp'],['grid','grid']])$(driver+'-'+id).addEventListener('change',e=>{selectSetup(driver,field,e.target.value);e.target.blur()});
 $(driver+'-factory').onclick=()=>resetSetup(driver);
}
let previous=null,accumulator=0;
function frame(t){
 const frameDt=previous===null?0:Math.max(0,Math.min((t-previous)/1000,.05));previous=t;accumulator+=frameDt;
 inFrame=true;try{while(accumulator>=1/120){step(1/120);accumulator-=1/120}}finally{inFrame=false}
 updateEngineAudio();updateHUD();renderAlpha=mode==='running'?accumulator*120:1;
 updateCameras(frameDt);draw();renderAlpha=1;requestAnimationFrame(frame);
}
$('human-count').addEventListener('change',e=>{selectHumanCount(e.target.value);e.target.blur()});
$('car-count').addEventListener('change',e=>{selectCarCount(e.target.value);e.target.blur()});
$('rival-style').addEventListener('change',e=>{selectRivalStyle(e.target.value);e.target.blur()});
for(const [id,group] of [['player-durability','players'],['ai-durability','ai']])$(id).addEventListener('change',e=>{selectDurability(group,e.target.value);e.target.blur()});
 $('difficulty').addEventListener('change',e=>{selectDifficulty(e.target.value);e.target.blur()});
$('race-mode').addEventListener('change',e=>{raceType=['friend','ghost','derby'].includes(e.target.value)?e.target.value:'ai';try{localStorage.setItem('slipstream-mode',raceType)}catch{}selectTrack(track.id);e.target.blur()});
$('track-select').addEventListener('change',e=>{selectTrack(e.target.value);e.target.blur()});
let savedTrack='foundry';try{savedTrack=localStorage.getItem('slipstream-track')||savedTrack}catch{}
try{const savedMode=localStorage.getItem('slipstream-mode');if(['friend','ghost','derby'].includes(savedMode))raceType=savedMode}catch{}$('race-mode').value=raceType;
try{const saved=localStorage.getItem('slipstream-difficulty');if(Object.hasOwn(aiLevels,saved))difficulty=saved}catch{}
try{const saved=JSON.parse(localStorage.getItem('slipstream-durability')||'{}');for(const group of ['players','ai'])if(durabilityChoices.includes(saved?.[group]))durabilitySettings[group]=saved[group]}catch{}
try{carCount=clamp(Math.round(Number(localStorage.getItem('slipstream-cars'))||2),2,20)}catch{}
try{const saved=JSON.parse(localStorage.getItem('slipstream-car-choices')||'{}');for(const driver of HUMAN_DRIVERS)if(Object.hasOwn(carModels,saved?.[driver]))carChoices[driver]=saved[driver]}catch{}
try{const style=localStorage.getItem('slipstream-rival-style');if(style==='mixed'||Object.hasOwn(rivalStyles,style))rivalStyle=style}catch{}
try{const saved=JSON.parse(localStorage.getItem('slipstream-setups')||'{}');for(const driver of HUMAN_DRIVERS)setups[driver]=sanitizeSetup(saved?.[driver],driver)}catch{}
try{
 localPlayers=clamp(Math.round(Number(localStorage.getItem('slipstream-local-players'))||2),2,4);derbyPlayers=clamp(Math.round(Number(localStorage.getItem('slipstream-derby-players'))||1),1,4);
 derbyCars=clamp(Math.round(Number(localStorage.getItem('slipstream-derby-cars'))||10),Math.max(2,derbyPlayers),20);
 derbyStart=clamp(Math.round(Number(localStorage.getItem('slipstream-derby-grid'))||5),1,20);
 const grids=JSON.parse(localStorage.getItem('slipstream-derby-grids')||'{}');for(const d of ['p2','p3','p4'])if(Number.isFinite(grids[d]))derbyGrids[d]=clamp(Math.round(grids[d]),1,20);
}catch{}
 window.addEventListener('resize',resize);selectTrack(savedTrack);resize();requestAnimationFrame(frame);
