/* Shared adapter for the authoritative LAN server and browser clients. */
'use strict';
(()=>{
 const stateFields=['x','y','vx','vy','angle','spin','steer','damage','wrecked','wreckDistance','finishTime','driver','color','label','model','draft','drifting','boostTimer','hitStun','personality','dentX','dentY'];
 let networkDriver='p1',lastNetworkMode=null,resumeMode='running',networkMembers=[];
 const api={
  settings(){return {trackId:track.id,raceType,difficulty,carCount:fieldCount(),rivalStyle,durability:{...durabilitySettings}}},
  configure(config,members){
   raceType=config.raceType==='derby'?'derby':'friend';localPlayers=derbyPlayers=members.length;
   carCount=derbyCars=clamp(Math.round(Number(config.carCount)||10),Math.max(2,members.length),20);
   difficulty=Object.hasOwn(aiLevels,config.difficulty)?config.difficulty:'standard';
   rivalStyle=config.rivalStyle==='mixed'||Object.hasOwn(rivalStyles,config.rivalStyle)?config.rivalStyle:'mixed';
   for(const group of ['players','ai'])durabilitySettings[group]=durabilityChoices.includes(config.durability?.[group])?config.durability[group]:'default';
   members.forEach((member,i)=>{
    const driver=HUMAN_DRIVERS[i];carChoices[driver]=Object.hasOwn(carModels,member.car)?member.car:'balanced';
    const grid=member.grid||i+(raceType==='derby'?5:1);
    setups[driver]=sanitizeSetup({hp:member.hp,grid},driver);setGrid(driver,grid);
   });
   selectTrack(config.trackId);$('race-mode').value=raceType;members.forEach((member,i)=>racers[i].label=member.name);
   lastNetworkMode=null;networkMembers=members.map(m=>({name:m.name}));
   return api.settings();
  },
  start(){begin();networkMembers.forEach((member,i)=>racers[i].label=member.name)},
  advance(dt,inputs){
   for(const driver of HUMAN_DRIVERS){const value=inputs[driver]||{};playerInputs[driver].left=value.left===true;playerInputs[driver].right=value.right===true}
   inFrame=true;try{step(dt)}finally{inFrame=false}
  },
  pause(value){
   if(value&&(mode==='running'||mode==='countdown')){resumeMode=mode;mode='paused';clearControls()}
   else if(!value&&mode==='paused')mode=resumeMode;
  },
  snapshot(){return {mode,count,elapsed,lap,lapStart,progress,lastS,score,chain,playerFinished,
   racers:racers.map(v=>{const result={total:raceDistance(v)};for(const key of stateFields)result[key]=v[key]??null;return result})}},
  setDriver(driver){networkDriver=driver},
  vehicle(){return racers.find(v=>v.driver===networkDriver)||car},
  receive(state){
   mode=state.mode;count=state.count;elapsed=state.elapsed;lap=state.lap;lapStart=state.lapStart;
   progress=state.progress;lastS=state.lastS;score=state.score;chain=state.chain;playerFinished=state.playerFinished;
   racers=state.racers.map((value,i)=>Object.assign(racers[i]||{ai:{}},value));car=racers[0];opponent=racers[1]||car;
   if(!cameras.length||cameras[0].racer?.driver!==networkDriver)resetCameras();
   if(mode!==lastNetworkMode){
    if(mode==='countdown'||mode==='running')setSetupVisible(false);
    if(mode==='finished'){
     const winner=standings().find(v=>isHuman(v)&&v.finishTime!==null);
     document.querySelector('.start-card').innerHTML='<h2>Race complete.</h2><p id="lan-result"></p><button id="again" class="primary">Back to lobby</button>';
     $('lan-result').textContent=winner?winner.label+' finishes first among the players.':'All players wrecked. No finisher.';
     $('again').onclick=()=>window.SlipstreamLAN.returnToLobby();$('overlay').classList.remove('hidden');
    }else $('overlay').classList.add('hidden');
    lastNetworkMode=mode;
   }
   $('countdown').textContent=mode==='paused'?'PAUSED':mode==='countdown'?(count>.2?Math.ceil(count-.2):'GO'):'';
  },
  render(a,b,weight,extra,dt){
   for(let i=0;i<racers.length;i++){
    const v=racers[i],from=a.racers[i]||b.racers[i],to=b.racers[i];if(!to)continue;
    const own=v.driver===networkDriver;
    v.x=own?to.x+to.vx*extra:from.x+(to.x-from.x)*weight;
    v.y=own?to.y+to.vy*extra:from.y+(to.y-from.y)*weight;
    v.angle=own?to.angle+(to.spin||0)*extra:from.angle+angleDifference(to.angle,from.angle)*weight;
    v.previousX=v.x;v.previousY=v.y;v.previousAngle=v.angle;
    if(mode==='running')updateTireEffects(v,dt);
   }
   for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}
   particles=particles.filter(p=>p.life>0);if(marks.length>4000)marks.splice(0,marks.length-4000);
  },
  hud(){
   const v=api.vehicle();if(!v)return;
   const order=standings(),place=order.indexOf(v),speed=Math.hypot(v.vx,v.vy);
   setText('p1-name',v.label+' · YOU');setText('p1-keys','A / D or ← / →');setText('speed',Math.round(speed*KMH_PER_UNIT));
   setWidth('speedbar',Math.min(100,speed/TOP_SPEED*100)+'%');
   setHTML('lap',String(Math.min(3,Math.max(1,Math.floor(Math.max(0,v.total)/circuitLength)+1))).padStart(2,'0')+' <small>/ 03</small>');
   setHTML('position',String(place+1).padStart(2,'0')+' <small>/ '+String(racers.length).padStart(2,'0')+'</small>');
   setText('time',timeString(elapsed));setText('p1-damage',v.wrecked?'WRECKED · DNF':'BODY '+Math.max(1,Math.ceil((1-v.damage)*100))+'%');
   $('p1-damage').classList.toggle('damaged',v.damage>.5);$('p1-draft').hidden=(v.draft||0)<.08;
   setText('p1-draft','DRAFT');$('p1-gap').hidden=false;
   const ahead=order[place-1];setText('p1-gap',v.wrecked?'OUT OF THE RACE':ahead?Math.round(Math.max(0,raceDistance(ahead)-raceDistance(v))/UNITS_PER_METRE)+' M TO '+ahead.label:'LEADING');
   setText('rival-status',raceType==='derby'?racers.filter(r=>r.driver==='ai'&&!r.wrecked).length+' AI RIVALS LEFT':(window.SlipstreamLAN?.online?'ONLINE RACE':'LAN RACE')+' · '+humanCount()+' PLAYERS');
   setText('controls-label','A / D or ← / →');$('pause').textContent=mode==='paused'?'▶':'Ⅱ';
   for(let i=1;i<4;i++)$(HUMAN_DRIVERS[i]+'-stats').hidden=true;
   $('race-details').hidden=false;
  }
 };
 window.SlipstreamGame=api;
})();
