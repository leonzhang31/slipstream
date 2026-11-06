/* Same-Wi-Fi lobby. Only enabled by the local hosting server. */
'use strict';
window.startSlipstreamLobby=async function(transport=null){
 if(window.SlipstreamLAN?.active)return;
 if(window.SlipstreamProfile&&!await window.SlipstreamProfile.ensure())return;
 if(window.SlipstreamLAN?.active)return;
 const ui=id=>document.getElementById(id),game=window.SlipstreamGame;
 const fragment=new URLSearchParams(transport?'':location.hash.slice(1));
 const storageKey=transport?'slipstream-browser-room-'+transport.code:'slipstream-lan-'+location.host;
 let saved={};try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}')}catch{}
 const joining=fragment.has('join'),hosting=fragment.has('host');
 const credentials={host:joining?'':fragment.get('host')||saved.host||'',room:fragment.get('join')||saved.room||'',
  resume:joining?(saved.room===fragment.get('join')&&!saved.host?saved.resume||'':''):hosting&&saved.host!==fragment.get('host')?'':saved.resume||''};
 if(fragment.has('host')||fragment.has('join'))history.replaceState(null,'',location.pathname);
 let ws,id=null,isHost=false,roster=[],phase='lobby',sequence=0,retry=0,stopped=false;
 let snapshots=[],lastSeq=-1,round=-1,lastInput=0,lastConfig='',applying=false,connected=false,configTimer;
 const net={active:true,online:!!transport,frame,start,togglePause,returnToLobby};window.SlipstreamLAN=net;
 ui('app').classList.add('lan-session');ui('lan-panel').hidden=false;
 try{ui('lan-name').value=localStorage.getItem('slipstream-driver-name')||'Driver'}catch{ui('lan-name').value='Driver'}
 if(window.SlipstreamProfile?.username)ui('lan-name').value=window.SlipstreamProfile.username;
 ui('lan-name').maxLength=16;ui('lan-name').pattern='[A-Za-z0-9_]{3,16}';
 ui('lan-leave').hidden=!transport;ui('lan-leave').onclick=()=>transport?.leave();
 if(transport){
  ui('lan-title').textContent='Online room · '+transport.code;
  ui('lan-invite-help').textContent='Up to 4 players · host and join from your browser';
  ui('lan-connection-help').textContent='Keep the host’s game tab open. Internet access is needed to connect. Some guest or school networks block direct peer connections.';
 }
 function status(text){ui('lan-status').textContent=text}
 function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(credentials))}catch{}}
 function send(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
 function myPlayer(){return roster.find(p=>p.id===id)}
 function lockSettings(){
  ui('race-shell').classList.remove('multiplayer','players-3','players-4');
  ui('setup-summary').textContent=ui('setup-summary').textContent.replace(/Local multiplayer|Online multiplayer|LAN multiplayer/,transport?'Online multiplayer':'LAN multiplayer');
  ui('mode-help').textContent=ui('race-mode').value==='derby'?'Finish three laps or wreck all the AI. Each friend plays on their own computer.':'Three laps, one car per computer. First human finisher ends the race.';
  for(const el of document.querySelectorAll('#race-setup select, #race-setup input'))el.disabled=!isHost||phase!=='lobby';
  ui('human-count-group').hidden=true;ui('launch-race').hidden=true;ui('setup-launch').hidden=true;
  for(const option of ui('race-mode').options){option.hidden=!['friend','derby'].includes(option.value);if(option.value==='friend')option.textContent=transport?'Online race':'LAN race'}
  ui('lan-start').hidden=!isHost;ui('lan-lobby').hidden=!isHost||phase==='lobby'&&roster.every(p=>p.connected);
  ui('lan-lobby').textContent=phase==='lobby'?'Remove disconnected players':'Return to lobby';
  ui('lan-ready').disabled=!connected||phase!=='lobby';
  ui('profile-button').disabled=connected&&phase!=='lobby';
  for(const el of document.querySelectorAll('.lan-personal input, .lan-personal select'))el.disabled=phase!=='lobby'||!connected;
 }
 function start(){
  if(!isHost){status('Choose Ready. The host starts the race.');return}
  if(phase!=='lobby'){status('Return to the lobby to start another race.');return}
  send({type:'start'});
 }
 function togglePause(){if(isHost&&phase==='race')send({type:'pause'});else if(phase==='race')status('The host controls the shared pause.')}
 function returnToLobby(){if(isHost)send({type:'lobby'});setSetupVisible(true)}
 function playerSettings(){
  const name=ui('lan-name').value;
  if(window.SlipstreamProfile&&name!==window.SlipstreamProfile.username){
   if(!window.SlipstreamProfile.set(name)){ui('lan-name').setCustomValidity('Use 3–16 letters, numbers or underscores.');ui('lan-name').reportValidity();return}
   return;
  }
  ui('lan-name').setCustomValidity('');
  try{localStorage.setItem('slipstream-driver-name',ui('lan-name').value)}catch{}
  send({type:'player',name:ui('lan-name').value,car:ui('lan-car').value,hp:Number(ui('lan-hp').value),grid:Number(ui('lan-grid').value)});
 }
 function receiveLobby(data){
  const previousPhase=phase;phase=data.phase;roster=data.players;
  const mine=myPlayer();if(!mine)return;
  for(const [key,value] of [['name',mine.name],['car',mine.car],['hp',mine.hp],['grid',mine.grid]])if(document.activeElement!==ui('lan-'+key))ui('lan-'+key).value=String(value);
  document.querySelector('.player-one').style.setProperty('--player-color',mine.color);
  game.setDriver(mine.driver);
  const key=JSON.stringify([data.config,data.players.map(p=>[p.id,p.name,p.car,p.hp,p.grid]),phase]);
  if(key!==lastConfig){
   applying=true;try{game.configure(data.config,data.players)}finally{applying=false}
   lastConfig=key;snapshots=[];resetCameras();resize();
  }
  if(phase==='lobby'&&previousPhase!=='lobby')setSetupVisible(true);
  const list=ui('lan-players');list.replaceChildren();
  for(const player of roster){
   const row=document.createElement('li'),name=document.createElement('span'),state=document.createElement('span');
   row.style.setProperty('--driver',player.color);name.textContent=player.name+(player.id===id?' (you)':'')+(player.host?' · host':'');
   state.textContent=!player.connected?'Disconnected':player.ready?'Ready':'Choosing car';row.append(name,state);list.append(row);
  }
  ui('lan-ready').textContent=mine.ready?'Not ready':'Ready';ui('lan-ready').setAttribute('aria-pressed',String(mine.ready));
  ui('lan-start').disabled=roster.length<2||roster.some(p=>!p.connected||!p.ready)||phase!=='lobby';
  ui('lan-link').value=data.joinUrls[0]||'';
  ui('lan-copy').disabled=!data.joinUrls.length;
  const links=ui('lan-other-links');links.replaceChildren();
  for(const value of data.joinUrls.slice(1)){const p=document.createElement('div');p.textContent=value;links.append(p)}
  ui('lan-network-help').hidden=!!data.joinUrls.length;
  if(!data.joinUrls.length)status('No Wi-Fi address found. Connect the host to Wi-Fi and restart the launcher.');
  else if(data.error)status(data.error);
  else if(phase==='lobby')status(roster.length<2?'Share the join link. Waiting for a friend.':isHost?'Choose your settings. Start when everyone is ready.':'Choose your car and click Ready.');
  else status('Race connected · '+roster.length+' players. '+(isHost?'You control pause and restart.':'A / D or arrows to steer.'));
  lockSettings();
 }
 function connect(){
  status(retry?'Reconnecting to the host…':transport?'Connecting to the room…':'Connecting to the local host…');
  ws=transport?transport.open():new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/lan');
  ws.onopen=()=>send({type:'join',...credentials,name:ui('lan-name').value});
  ws.onmessage=event=>{
   let data;try{data=JSON.parse(event.data)}catch{return}
   if(data.type==='welcome'){
    id=data.id;isHost=data.host;credentials.resume=data.resume;sequence=Math.max(sequence,data.inputSeq||0);save();retry=0;connected=true;status('Connected');
   }else if(data.type==='lobby')receiveLobby(data);
   else if(data.type==='state'){
    if(data.round!==round){round=data.round;lastSeq=-1;snapshots=[]}
    if(data.seq<=lastSeq)return;lastSeq=data.seq;
    snapshots.push({at:performance.now(),data});if(snapshots.length>8)snapshots.shift();
    game.receive(data);lockSettings();
   }else if(data.type==='error'){status(data.message);ui('lan-panel').classList.add('has-message');if(data.kind==='username')window.SlipstreamProfile?.open(data.message)}
  };
  ws.onerror=()=>status(transport?.connectionError||'Cannot reach the host. Check that the hosting window is open and both Macs are on the same Wi-Fi.');
  ws.onclose=event=>{
   connected=false;clearControls();lockSettings();snapshots=[];
   if(event.code===1008||event.code===4001){stopped=true;ui('lan-reconnect').hidden=false;if(event.code===4001)status('This player is connected in another tab. Use that tab, or click Try again to reconnect here.');return}
   if(!stopped){status('Connection lost. Reconnecting…');setTimeout(connect,Math.min(5000,700+retry++*500))}
  };
 }
 function input(force=false){
  const now=performance.now();if(!connected||!force&&now-lastInput<30)return;lastInput=now;
  send({type:'input',seq:++sequence,left:controls.left,right:controls.right});
 }
 function frame(now,dt){
  input();if(!snapshots.length)return;
  const latest=snapshots[snapshots.length-1],renderAt=now-65;
  let a=snapshots[0],b=latest;
  for(let i=1;i<snapshots.length;i++)if(snapshots[i].at>=renderAt){a=snapshots[i-1];b=snapshots[i];break}
  const weight=b.at>a.at?Math.max(0,Math.min(1,(renderAt-a.at)/(b.at-a.at))):1;
  // Local movement uses the newest state; other cars are interpolated for jitter.
  const display={...b.data,racers:b.data.racers.map((v,i)=>v.driver===myPlayer()?.driver?latest.data.racers[i]:v)};
  game.render(a.data,display,weight,latest.data.mode==='running'?Math.min(.05,Math.max(0,(now-latest.at)/1000)):0,dt);
 }
 function flushConfig(){if(!configTimer)return;clearTimeout(configTimer);configTimer=null;send({type:'config',config:game.settings()})}
 ui('lan-ready').onclick=()=>{flushConfig();send({type:'ready',ready:!myPlayer()?.ready})};
 ui('lan-reconnect').onclick=()=>{stopped=false;ui('lan-reconnect').hidden=true;connect()};
 ui('lan-start').onclick=start;ui('lan-lobby').onclick=returnToLobby;
 for(const key of ['name','car','hp','grid'])ui('lan-'+key).addEventListener('change',playerSettings);
 ui('lan-copy').onclick=async()=>{
  const field=ui('lan-link');field.focus();field.select();
  try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(field.value);else if(!document.execCommand('copy'))throw Error();status(transport?'Invite link copied. Send it to your friends.':'Join link copied. Send it to friends on your Wi-Fi.')}
  catch{status('The link is selected. Press Command-C to copy it.')}
 };
 document.addEventListener('change',event=>{
  if(applying||!isHost||phase!=='lobby'||!event.target.closest('#race-setup'))return;
  clearTimeout(configTimer);configTimer=setTimeout(()=>{configTimer=null;send({type:'config',config:game.settings()})},80);
 });
 window.addEventListener('blur',()=>{clearControls();input(true)});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearControls();input(true)}});
 window.addEventListener('pagehide',()=>{clearControls();input(true)});
 window.addEventListener('slipstream-username',()=>{
  ui('lan-name').value=window.SlipstreamProfile.username;
  if(connected&&phase==='lobby')playerSettings();
  else if(!connected&&ws?.readyState===3){stopped=false;ui('lan-reconnect').hidden=true;connect()}
 });
 save();lockSettings();connect();
};
if(window.SLIPSTREAM_LAN){
 window.startSlipstreamLobby();
 window.addEventListener('slipstream-username',()=>{if(!window.SlipstreamLAN?.active)window.startSlipstreamLobby()});
}
