(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./usernames.js'));else root.SlipstreamRoom=factory(root.SlipstreamUsernames)})(typeof globalThis==='object'?globalThis:this,function(usernames){
 'use strict';
 const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(20)),n=>n.toString(16).padStart(2,'0')).join('');
 const bound=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Math.round(Number(n)))):fallback;
 const colors=['#d4fb71','#ff9b66','#73d9ee','#c6a0ff'];
 return function createRoom({engine,send,invite,code,now=()=>performance.now()}){
  const members=[],connections=new Map();let phase='lobby',round=0,seq=0,error='',config={...engine.settings(),raceType:'friend',carCount:10};
  const players=()=>members.map((m,i)=>({id:m.id,driver:'p'+(i+1),name:m.name,ready:m.ready,connected:!!m.connection,car:m.car,hp:m.hp,grid:m.grid,color:colors[i],host:m.host}));
  const message=(id,data)=>send(id,data);
  const broadcast=data=>{for(const m of members)if(m.connection)message(m.connection,data)};
  const snapshot=()=>({type:'state',round,seq:++seq,at:now(),...engine.snapshot()});
  const lobby=()=>({type:'lobby',phase,round,config,players:players(),joinUrls:[invite],roomCode:code,online:true,error});
  const publish=()=>broadcast(lobby());
  const prepare=()=>{if(members.length)config=engine.configure(config,players())};
  function reject(connection,text,close=false,kind=''){
   message(connection,{type:'error',message:text,kind});
   if(close)message(connection,{type:'transport-close',code:1008});
  }
  function receive(connection,data){
   if(!data||typeof data!=='object'||Array.isArray(data))return;
   let channel=connections.get(connection);
   if(!channel){channel={start:now(),messages:0,member:null};connections.set(connection,channel)}
   if(now()-channel.start>1000){channel.start=now();channel.messages=0}
   if(++channel.messages>150){message(connection,{type:'transport-close',code:1008});return}
   if(data.type==='join'&&!channel.member){
    let m=members.find(p=>p.resume===data.resume&&typeof data.resume==='string');
    if(m){
     if(m.host&&connection!=='host'){reject(connection,'The host session cannot be used by a guest.',true);return}
     if(m.connection&&m.connection!==connection)message(m.connection,{type:'transport-close',code:4001});
     m.connection=connection;
    }else{
     if(phase!=='lobby'){reject(connection,'A race is in progress. Join after the host returns to the lobby.',true);return}
     if(members.length>=4){reject(connection,'This room already has four players.',true);return}
     const nameError=usernames.error(data.name,members);if(nameError){reject(connection,nameError,true,'username');return}
     if(connection!=='host'&&!members.some(p=>p.host)){reject(connection,'The host is still opening the room. Try again.',true);return}
     m={id:token(),resume:token(),connection,host:connection==='host',name:usernames.normalize(data.name),ready:false,car:'balanced',hp:300,grid:0,input:{},inputSeq:0,lastInput:now()};
     if(m.host)members.unshift(m);else members.push(m);
    }
    channel.member=m;m.lastInput=now();m.input={};
    message(connection,{type:'welcome',id:m.id,resume:m.resume,host:m.host,inputSeq:m.inputSeq});
    if(phase==='lobby')prepare();if(members.every(p=>p.connection))error='';publish();if(phase==='race')message(connection,snapshot());return;
   }
   const m=channel.member;if(!m||m.connection!==connection)return;
   if(data.type==='input'){
    if(Number.isSafeInteger(data.seq)&&data.seq>m.inputSeq){m.inputSeq=data.seq;m.input={left:data.left===true,right:data.right===true};m.lastInput=now()}return;
   }
   if(data.type==='player'&&phase==='lobby'){
    m.ready=false;const nameError=usernames.error(data.name,members,m.id);if(nameError){reject(connection,nameError,false,'username');publish();return}
    m.name=usernames.normalize(data.name);m.car=['balanced','agile','drift'].includes(data.car)?data.car:'balanced';
    m.hp=bound(Number(data.hp)/10,10,60,30)*10;m.grid=bound(data.grid,0,20,0);prepare();publish();return;
   }
   if(data.type==='ready'&&phase==='lobby'){m.ready=data.ready===true;publish();return}
   if(!m.host){if(['start','pause','config','lobby'].includes(data.type))reject(connection,'Only the host controls race settings.');return}
   if(data.type==='config'&&phase==='lobby'&&data.config&&typeof data.config==='object'){
    const c=data.config;config={trackId:String(c.trackId||config.trackId).slice(0,40),raceType:c.raceType==='derby'?'derby':'friend',difficulty:String(c.difficulty||config.difficulty).slice(0,20),carCount:bound(c.carCount,2,20,10),rivalStyle:String(c.rivalStyle||'mixed').slice(0,20),durability:c.durability};
    for(const p of members)p.ready=false;prepare();publish();return;
   }
   if(data.type==='start'&&phase==='lobby'){
    if(members.length<2||members.some(p=>!p.connection||!p.ready)){reject(connection,'At least two players must join and everyone must be ready.');return}
    prepare();round++;seq=0;phase='race';error='';for(const p of members){p.input={};p.lastInput=now()}
    engine.start();publish();broadcast(snapshot());return;
   }
   if(data.type==='pause'&&phase==='race'){
    if(members.some(p=>!p.connection)){reject(connection,'Wait for disconnected players, or return to the lobby.');return}
    engine.pause(engine.snapshot().mode!=='paused');error='';broadcast(snapshot());publish();return;
   }
   if(data.type==='lobby'){
    phase='lobby';error='';for(let i=members.length-1;i>=0;i--)if(!members[i].connection&&!members[i].host)members.splice(i,1);
    for(const p of members)p.ready=false;prepare();publish();
   }
  }
  function disconnect(connection){
   const channel=connections.get(connection);connections.delete(connection);const m=channel?.member;if(!m||m.connection!==connection)return;
   m.connection=null;m.input={};m.ready=false;
   if(phase==='race'){engine.pause(true);error=m.name+' disconnected. Waiting for them to rejoin.';broadcast(snapshot())}
   publish();
  }
  return {receive,disconnect,
   tick(dt){if(phase!=='race')return;const inputs={};members.forEach((m,i)=>inputs['p'+(i+1)]=now()-m.lastInput<350?m.input:{});engine.advance(dt,inputs)},
   emitState(){if(phase==='race')broadcast(snapshot())},
   visibility(hidden){if(hidden&&phase==='race'){engine.pause(true);error='The host switched away. Return to the game and press pause to resume.';broadcast(snapshot());publish()}},
   lobby,snapshot
  };
 };
});
