const fs=require('fs'),vm=require('vm');
const windowEvents={};
const elements=new Map();const element=(id)=>({textContent:'',style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,force){if(force===undefined)force=!this.values.has(n);force?this.values.add(n):this.values.delete(n)}},addEventListener(){},setAttribute(){},getBoundingClientRect(){if(id==='minimap'){const friend=elements.get('race-shell')?.classList.values.has('multiplayer');return{width:friend?180:200,height:friend?150:180}}return{width:1300,height:650}},getContext(){return new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{}})},set innerHTML(v){this.html=v}});

let seed=42;const testMath=Object.create(Math);testMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context={console,Math:testMath,Number,String,document:{getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelector(){return element()},addEventListener(){}},window:{addEventListener(name,fn){windowEvents[name]=fn},devicePixelRatio:1},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},windowEvents};
context.document.getElementById('track').getContext=()=>new Proxy({}, {get:()=>()=>{}});vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/data/circuits.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/game.js'),'utf8'),context);
vm.runInContext(`
function check(x,msg){if(!x)throw Error(track.id+': '+msg)}
for(const definition of tracks){
 selectTrack(definition.id);check(mode==='ready'&&lap===1&&score===0,'selection resets race');check(nearest(car.x,car.y).d<20,'spawn on circuit');
 check($('track-select').value===track.id,'selection reflected in UI');
 begin();for(let i=0;i<400;i++)step(1/120);check(mode==='running','countdown');
 for(let i=0;i<100;i++)step(1/120);check(Math.hypot(car.vx,car.vy)>100,'faster acceleration');
 reset();mode='running';car.vx=Math.cos(car.angle)*400;car.vy=Math.sin(car.angle)*400;step(1/120);check(Math.hypot(car.vx,car.vy)>400,'higher top speed');
 reset();mode='running';controls.right=true;const a=car.angle;for(let i=0;i<60;i++)step(1/120);check(car.angle>a+.2,'right steering');controls.right=false;controls.left=true;const b=car.angle;for(let i=0;i<120;i++)step(1/120);check(car.angle<b-.2,'left steering');
 reset();mode='running';const p=points[50],q=points[51],angle=Math.atan2(q.y-p.y,q.x-p.x),nx=-Math.sin(angle),ny=Math.cos(angle),side=nearest(p.x+nx*ROAD/2,p.y+ny*ROAD/2).d>=nearest(p.x-nx*ROAD/2,p.y-ny*ROAD/2).d?1:-1;car.x=p.x+nx*side*(ROAD/2);car.y=p.y+ny*side*(ROAD/2);car.vx=nx*side*180;car.vy=ny*side*180;step(1/120);check(Math.hypot(car.vx,car.vy)<120,'wall scrubs speed');check(nearest(car.x,car.y).d<=ROAD/2-7.9,'wall containment');
 reset();mode='running';const fx=Math.cos(car.angle),fy=Math.sin(car.angle);car.vx=fx*200-fy*65;car.vy=fy*200+fx*65;step(1/120);check(score>0,'drift scoring');pause();const t=elapsed;step(1);check(elapsed===t&&mode==='paused','pause');pause();
 for(let j=0;j<3;j++){progress=circuitLength-1;lastS=circuitLength-2;car.x=points[0].x;car.y=points[0].y;car.angle=carStartAngle();car.vx=Math.cos(car.angle)*120;car.vy=Math.sin(car.angle)*120;elapsed+=10;step(1/120)}check(mode==='finished','three laps finish');check(bestLap>0,'lap record');
 let clearance=Infinity;for(let i=0;i<points.length;i+=4)for(let j=i+4;j<points.length;j+=4){const ds=lengths[j]-lengths[i];if(Math.min(ds,circuitLength-ds)>ROAD*2)clearance=Math.min(clearance,Math.hypot(points[j].x-points[i].x,points[j].y-points[i].y))}check(clearance>ROAD+5,'track edges do not overlap');
 draw();console.log('PASS gameplay and geometry:',track.name);
}

for(const definition of tracks){
 selectTrack(definition.id);
 check(ROAD===track.width*2,'every road is doubled from the original width');
 check(track.remixStats.addedBends>=2,'each layout gains extra linked corners');
 check(track.remixStats.flowSections.every(s=>s.amplitude>=ROAD*.75),'added corners are large enough to require real steering');
 const turning=route=>route.reduce((sum,p,i)=>{const a=route[(i-1+route.length)%route.length],b=route[(i+1)%route.length];return sum+Math.abs(Math.atan2((p.x-a.x)*(b.y-p.y)-(p.y-a.y)*(b.x-p.x),(p.x-a.x)*(b.x-p.x)+(p.y-a.y)*(b.y-p.y)))},0);
 const remixedTurning=turning(points);track.flowRemix=false;buildTrack();const baselineTurning=turning(points);track.flowRemix=true;buildTrack();
 check(remixedTurning>baselineTurning*1.05,'remixed route contains more actual turning');
 console.log('PASS wider flow route:',track.id,track.remixStats.addedBends,'extra bends');
 if(track.kind==='gp'){
  check(Math.abs(track.remixStats.baseLength/UNITS_PER_METRE-track.driftStats.adaptedLength*.7/6)<.05,'GP drift lap distance matches adapted geometry');
  check(track.driftStats.straightAfter<track.driftStats.straightBefore*.8,'GP straight distance is substantially reduced');
  check(track.driftStats.longestAfter<track.driftStats.longestBefore*.8,'longest straights are shortened');
  check(1-track.driftStats.straightAfter/track.driftStats.adaptedLength>1-track.driftStats.straightBefore/track.driftStats.originalLength,'corners account for more of the GP lap');
  check(track.driftNodes.length===track.nodes.length,'GP corner sequence is retained');
  const straightIds=new Set(track.driftStats.straightSegments);
  for(let i=0;i<track.nodes.length;i++){const j=(i+1)%track.nodes.length,a=track.nodes[i],b=track.nodes[j],c=track.driftNodes[i],d=track.driftNodes[j];if(!straightIds.has(i)&&(track.driftAdaptation!=='southern-sector'||Math.max(a[1],b[1])<=3800))check(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-Math.hypot(d[0]-c[0],d[1]-c[1]))<.004,'corner arcs retain their segment lengths')}
 }
 const mt=minimapTransform();
 for(const point of points){const x=point.x*mt.scale+mt.ox,y=point.y*mt.scale+mt.oy;check(x>=0&&x<=mt.w&&y>=24&&y<=mt.h,'minimap contains the complete circuit')}
 // Verify the spatial index against an exhaustive nearest-segment calculation.
 for(let j=0;j<points.length;j+=Math.max(1,Math.floor(points.length/12))){
  const p=points[j],x=p.x+20,y=p.y-15;let distance=Infinity;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy))}
  check(Math.abs(nearest(x,y).d-distance)<.001,'indexed nearest query preserves collision accuracy');
 }
}
raceType='ai';selectTrack('monza');
check(mini.width/viewport.dpr===200&&mini.height/viewport.dpr===180,'solo minimap backing matches displayed size');
raceType='friend';selectTrack('monza');
check(mini.width/viewport.dpr===180&&mini.height/viewport.dpr===150,'mode switch resizes minimap without stretching');
const mapVertices=[],translations=[];
miniCtx.moveTo=(x,y)=>mapVertices.push([x,y]);miniCtx.lineTo=(x,y)=>mapVertices.push([x,y]);miniCtx.translate=(x,y)=>translations.push([x,y]);
drawMinimap();
check(mapVertices.length>=points.length,'minimap draws the playable route');
for(let i=0;i<points.length;i++)check(mapVertices[i][0]===points[i].x&&mapVertices[i][1]===points[i].y,'minimap exactly matches final road vertices');
check(translations.some(([x,y])=>x===car.x&&y===car.y)&&translations.some(([x,y])=>x===opponent.x&&y===opponent.y),'minimap markers use actual car positions');
delete miniCtx.moveTo;delete miniCtx.lineTo;delete miniCtx.translate;
console.log('PASS exact minimap route, live markers, and correct size after mode changes');
resize();resetCameras();
const original=cameras[0].x;car.x+=1000;opponent.x-=1000;car.vx=100;opponent.vx=-100;
for(let i=0;i<120;i++)updateCameras(1/60);
check(cameras[0].x>original+900&&cameras[1].x<original-900,'split cameras independently follow the two cars');
check(Math.abs(cameras[0].zoom-cameras[1].zoom)<.001,'both split views have equal FOV');
check(cameras[0].zoom>.5,'camera stays zoomed in on full-size circuit');draw();begin();check(Math.abs(cameras[0].x-car.x)<.001,'restart snaps the camera to the grid');
raceType='ai';selectTrack('foundry');
console.log('PASS shortened GP lap distances, wider roads, full minimap bounds, indexed collisions, camera follow and equal split-screen FOV');
check(TOP_SPEED>500,'top speed increased');selectTrack('not-a-track');check(track.id==='foundry','invalid saved selection fallback');
// Isolate straight-line steering from random mistakes and ordinary racing-line noise.
const straightTest={id:'straight-test',name:'Straight test',kind:'arcade',theme:'park',polyline:true,width:100,ground:'#222b24',curb:'#fff',nodes:[[0,0],[20000,0],[20000,3000],[0,3000]]};
tracks.push(straightTest);const correctionRanges=[];
for(const levelName of Object.keys(aiLevels)){
 difficulty=levelName;selectTrack('straight-test');mode='running';
 const level=aiLevels[levelName],originalWobble=level.wobble;level.wobble=0;
 Object.assign(opponent,{x:1000,y:0,angle:0,vx:350,vy:0,steer:0,total:1000,lastS:1000});
 Object.assign(opponent.ai,{straightPhase:.5,nextMistake:Infinity});
 let minAngle=Infinity,maxAngle=-Infinity,positive=false,negative=false;
 for(let i=0;i<120*10;i++){
  elapsed+=1/120;updateOpponent(1/120);
  if(i>120){minAngle=Math.min(minAngle,opponent.angle);maxAngle=Math.max(maxAngle,opponent.angle);positive||=opponent.steer>.001;negative||=opponent.steer<-.001}
  check(nearest(opponent.x,opponent.y).d<ROAD/2-10,'straight corrections remain within the lane');
 }
 if(levelName==='expert')check(maxAngle-minAngle<.00001,'Expert holds a clean straight without deliberate weaving');
 else{check(positive&&negative,'lower levels correct steering in both directions on straights');check(maxAngle-minAngle>.002,'lower levels retain heading variation')}
 correctionRanges.push(maxAngle-minAngle);level.wobble=originalWobble;
}
for(let i=1;i<correctionRanges.length;i++)check(correctionRanges[i]<correctionRanges[i-1],'straight-line adjustments decrease with difficulty');
console.log('PASS lower-level straight corrections and precise Expert heading:',correctionRanges);
tracks.pop();difficulty='standard';selectTrack('foundry');
const engineFixture={id:'engine-test',name:'Engine test',kind:'arcade',theme:'park',polyline:true,width:200,ground:'#222',curb:'#fff',nodes:[[0,0],[50000,0],[50000,3000],[0,3000]]};
tracks.push(engineFixture);const measuredSpeeds=[];
for(const levelName of Object.keys(aiLevels)){
 difficulty=levelName;raceType='ai';selectTrack('engine-test');
 const npc={x:1000,y:0,angle:0,vx:0,vy:0,steer:0,ai:{recovery:0,mistakeTime:0,reaction:0}};
 for(let i=0;i<120*20;i++)moveVehicle(npc,0,1/120,false);
 check(Math.abs(npc.vx-TOP_SPEED*aiLevels[levelName].pace)<3,'AI acceleration and top speed follow the easier pace');
 measuredSpeeds.push(npc.vx);
}
for(let i=1;i<measuredSpeeds.length;i++)check(measuredSpeeds[i]>measuredSpeeds[i-1],'AI pace increases by difficulty');
raceType='friend';selectTrack('engine-test');const human={x:1000,y:0,angle:0,vx:0,vy:0,steer:0};
for(let i=0;i<120*20;i++)moveVehicle(human,0,1/120,false);
check(Math.abs(human.vx-TOP_SPEED)<3,'Player 2 keeps full engine power');
tracks.pop();raceType='ai';difficulty='standard';selectTrack('foundry');
console.log('PASS easier AI engine pace and unchanged two-player power');
const levelMetrics=[];
for(const levelName of Object.keys(aiLevels)){
 selectDifficulty(levelName);let totalTime=0,totalMistakes=0;const trackTimes={};
 check($('difficulty').value===levelName,'difficulty reflected in UI');
 for(const definition of tracks){
 selectTrack(definition.id);begin();const gridX=opponent.x,gridY=opponent.y;
 step(1/120);check(opponent.x===gridX&&opponent.y===gridY,'opponent waits for countdown');
 mode='running';step(1/120);pause();const frozen=opponent.total;step(1);check(opponent.total===frozen,'pause freezes opponent');pause();
 let raceWallHits=0;const savedImpact=impact;impact=(v,speed)=>{if(v===opponent&&speed>35)raceWallHits++;savedImpact(v,speed)};
 for(let i=0;i<120*Math.max(120,circuitLength/(90*aiLevels[difficulty].pace)*3)&&opponent.finishTime===null;i++){
  elapsed+=1/120;updateOpponent(1/120);
  check(Number.isFinite(opponent.x)&&nearest(opponent.x,opponent.y).d<=ROAD/2-7.9,'opponent stays on track');
 }
 impact=savedImpact;if(difficulty==='expert')check(raceWallHits===0,'Expert completes this circuit without wall impacts');
 totalTime+=opponent.finishTime;totalMistakes+=opponent.ai.mistakes;trackTimes[track.id]=opponent.finishTime;
 check(difficulty==='expert'?opponent.ai.mistakes===0:opponent.ai.mistakes>0,'Expert has no deliberate mistakes; lower levels retain them');
 check(opponent.finishTime!==null&&opponent.total>=3*circuitLength,'opponent completes three genuine laps');
 check(nearest(opponent.x,opponent.y).s<10,'AI finishes by crossing the start line');
 updateHUD();check($('position').html.startsWith('02'),'opponent winner leads HUD');
 finish();check(playerFinished,'player finish recorded');
 begin();check(opponent.finishTime===null&&opponent.total===-72&&!playerFinished,'restart resets both racers');
 mode='running';lap=3;progress=circuitLength;opponent.total=2.9*circuitLength;finish();check($('position').html.startsWith('01'),'player winner leads HUD');
 selectTrack(definition.id);mode='running';const f=Math.cos(car.angle),g=Math.sin(car.angle);
 opponent.x=car.x+f*24;opponent.y=car.y+g*24;opponent.vx=opponent.vy=0;car.vx=f*200;car.vy=g*200;bumpCars();
 check(Math.hypot(car.x-opponent.x,car.y-opponent.y)>=24.9,'bump separates cars');check(Math.hypot(car.vx,car.vy)<200,'bump exchanges momentum');
 console.log('PASS',difficulty,'opponent full race, countdown/pause, results, restart, bumps:',track.name);
}

 levelMetrics.push({level:levelName,seconds:totalTime/tracks.length,mistakes:totalMistakes/tracks.length,trackTimes});
}
console.log('Level averages:',levelMetrics.map(({trackTimes,...summary})=>summary));
for(let i=1;i<levelMetrics.length;i++){check(levelMetrics[i].mistakes<levelMetrics[i-1].mistakes,'higher levels make fewer mistakes');check(levelMetrics[i].seconds<levelMetrics[i-1].seconds,'higher levels improve average race pace')}
for(const definition of tracks)for(let i=1;i<levelMetrics.length;i++)check(levelMetrics[i].trackTimes[definition.id]<levelMetrics[i-1].trackTimes[definition.id],'each higher difficulty is faster on '+definition.id);
selectDifficulty('invalid');check(difficulty==='standard'&&mode==='ready','invalid level falls back to Standard');
raceType='friend';selectTrack('monza');
check($('difficulty-group').hidden&&$('difficulty').disabled,'difficulty hidden in friend mode');
check(opponent.total===-72&&opponent.finishTime===null,'friend starts on staggered grid');
check(!$('p2-stats').hidden&&!$('p1-gap').hidden&&$('race-details').hidden,'equal friend HUD replaces solo-only stats');
car.vx=80;car.vy=0;opponent.vx=200;opponent.vy=0;lap=2;progress=240;opponent.total=circuitLength+180;updateHUD();
check(Number($('speed').textContent)===48&&Number($('p2-speed').textContent)===120,'each speedometer reads its own car');
check(parseFloat($('p2-speedbar').style.width)>parseFloat($('speedbar').style.width),'independent speed bars');
check($('lap').html.startsWith('02')&&$('p2-lap').html.startsWith('02'),'equal lap display formats');
check($('p1-gap').textContent==='10 M AHEAD'&&$('p2-gap').textContent==='10 M BEHIND','gap mirrors from each player perspective');
check($('position').html.startsWith('01')&&$('p2-position').html.startsWith('02'),'positions are complementary');
opponent.total=circuitLength+400;updateHUD();
check($('p1-gap').textContent==='27 M BEHIND'&&$('p2-gap').textContent==='27 M AHEAD','both gaps reverse when P2 leads');
check($('position').html.startsWith('02')&&$('p2-position').html.startsWith('01'),'both positions reverse');
lap=3;progress=10;opponent.total=circuitLength-20;updateHUD();
const lappedGap=Math.round((circuitLength+30)/UNITS_PER_METRE);
check($('lap').html.startsWith('03')&&$('p2-lap').html.startsWith('01'),'each player has independent lap count');
check($('p1-gap').textContent===lappedGap+' M AHEAD'&&$('p2-gap').textContent===lappedGap+' M BEHIND','gap includes whole laps');
opponent.total=playerDistance();updateHUD();check($('p1-gap').textContent==='LEVEL'&&$('p2-gap').textContent==='LEVEL','side by side gap');
reset();check(Number($('speed').textContent)===0&&Number($('p2-speed').textContent)===0&&$('lap').html.startsWith('01')&&$('p2-lap').html.startsWith('01'),'reset restores both player HUDs');
console.log('PASS symmetric two-player speeds, bars, laps, positions, lap-aware gaps and reset');

check(Math.hypot(car.x-opponent.x,car.y-opponent.y)>=29,'separate start lanes');
const key=(type,key)=>windowEvents[type]({key,target:{tagName:'BODY'},repeat:false,preventDefault(){}});
key('keydown','ArrowRight');check(friendControls.right&&!controls.right,'arrows control only P2');
key('keydown','a');check(controls.left&&friendControls.right,'simultaneous independent controls');
mode='running';const p1Angle=car.angle,p2Angle=opponent.angle;
for(let i=0;i<60;i++)step(1/120);
check(car.angle<p1Angle&&opponent.angle>p2Angle,'both players turn independently');
check(opponent.ai.mistakes===0,'no AI mistakes in friend mode');
key('keyup','a');check(!controls.left&&friendControls.right,'P1 release preserves P2 key');
key('keyup','ArrowRight');check(!friendControls.right,'P2 release');
key('keydown','d');key('keydown','ArrowLeft');pause();check(!controls.right&&!friendControls.left&&heldKeys.size===0,'pause clears both players');pause();
key('keydown','a');key('keydown','ArrowRight');windowEvents.blur();check(!controls.left&&!friendControls.right&&mode==='paused','blur clears both players');
for(const definition of tracks){
 selectTrack(definition.id);mode='running';
 opponent.total=3*circuitLength-1;opponent.lastS=circuitLength-2;
 opponent.x=points[0].x;opponent.y=points[0].y;opponent.angle=carStartAngle();opponent.vx=Math.cos(opponent.angle)*120;opponent.vy=Math.sin(opponent.angle)*120;
 step(1/120);check(mode==='finished'&&opponent.finishTime!==null&&!playerFinished,'P2 first wins immediately');check($('position').html.startsWith('02'),'P2 victory position');
 begin();check(opponent.total===-72&&heldKeys.size===0,'friend restart resets grid and keys');
 mode='running';lap=3;progress=circuitLength-1;lastS=circuitLength-2;
 car.x=points[0].x;car.y=points[0].y;car.angle=carStartAngle();car.vx=Math.cos(car.angle)*120;car.vy=Math.sin(car.angle)*120;
 // Keep the other player away from the finish-line crossing.
 const behind=sampleTrack(-100);opponent.x=behind.x;opponent.y=behind.y;opponent.lastS=circuitLength-100;opponent.total=circuitLength-100;
 step(1/120);check(mode==='finished'&&playerFinished&&opponent.finishTime===null,'P1 can win friend race');draw();
 console.log('PASS friend controls, restart and both winners:',track.name);
}
raceType='ai';selectTrack('foundry');check(!$('difficulty-group').hidden&&!$('difficulty').disabled,'difficulty restored in solo mode');check($('p2-stats').hidden&&$('p1-gap').hidden&&!$('race-details').hidden,'solo HUD restored');key('keydown','ArrowLeft');key('keydown','a');key('keyup','a');check(controls.left&&!friendControls.left,'solo arrow key survives releasing A');key('keyup','ArrowLeft');


`,context);
