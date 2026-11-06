'use strict';
(()=>{
 const ui=id=>document.getElementById(id);let session=null,loading=null;
 if(window.SLIPSTREAM_LAN){ui('online-panel').hidden=true;return}
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const makeCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%32]).join('');
 const readCode=value=>{let raw=value.trim();try{if(raw.includes('://'))raw=new URLSearchParams(new URL(raw).hash.slice(1)).get('room')||''}catch{}return raw.toUpperCase().replace(/[\s-]/g,'')};
 function status(text){ui('online-status').textContent=text}
 function busy(value){ui('online-host').disabled=value;ui('online-join').disabled=value}
 function loadPeer(){
  if(window.Peer)return Promise.resolve();
  if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/peerjs.min.js',document.baseURI);script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(Error('The connection library could not load. Refresh and try again.'))};document.head.append(script)});
  return loading;
 }
 class Socket {
  constructor(send,close){this.readyState=0;this.deliver=send;this.stop=close}
  open(){if(this.readyState!==0)return;this.readyState=1;this.onopen?.({})}
  send(raw){if(this.readyState===1)this.deliver(raw)}
  message(data){if(this.readyState===1)this.onmessage?.({data:JSON.stringify(data)})}
  close(code=1000){if(this.readyState===3)return;this.readyState=3;this.stop?.();this.onclose?.({code})}
 }
 async function start(host,requested){
  if(session)return;
  if(location.protocol==='file:'){status('Open the published GitHub Pages game to host or join online.');return}
  if(!window.RTCPeerConnection||!window.Worker){status('Use a current version of Chrome or Safari to host a room.');return}
  const username=await window.SlipstreamProfile.ensure();if(!username)return;
  const code=host?makeCode():readCode(requested||ui('online-code').value);
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){status('Enter the host’s 8-character room code or paste their invite link.');ui('online-code').focus();return}
  busy(true);status(host?'Creating your room…':'Finding room '+code+'…');
  try{
   await loadPeer();
   const peer=new Peer(host?'slipstream-'+code:undefined,{debug:0,...window.SLIPSTREAM_PEER_OPTIONS});
   const invite=new URL(location.href);invite.hash='room='+code;invite.search='';
   const current={peer,code,host,worker:null,channels:new Map(),socket:null,closed:false,ready:false};session=current;
   const shutdown=()=>{if(current.closed)return;current.closed=true;current.worker?.terminate();for(const c of current.channels.values())c.close();peer.destroy()};
   function deliver(to,data){
    const socket=current.socket;
    if(to==='host'){
     if(data.type==='transport-close')socket?.close(data.code);else socket?.message(data);
    }else{
     const channel=current.channels.get(to);if(!channel?.open)return;
     if((channel.dataChannel?.bufferedAmount||0)>256*1024)return;
     channel.send(JSON.stringify(data));if(data.type==='transport-close')setTimeout(()=>channel.close(),60);
    }
   }
   if(host){
    current.worker=new Worker(new URL('online-worker.js?v=1',document.baseURI));
    current.worker.onmessage=event=>{if(event.data.type==='worker-ready'){current.ready=true;current.socket?.open()}else deliver(event.data.to,event.data.data)};
    current.worker.onerror=()=>{
     if(current.closed)return;
     if(current.socket){if(current.socket.readyState===0)current.socket.readyState=1;current.socket.message({type:'error',message:'The race simulation stopped. Leave the room and host again.'});current.socket.close(1008)}
     else{session=null;busy(false);status('The race engine could not start. Refresh the website and try again.')}
     shutdown();
    };
    current.worker.postMessage({type:'init',code,invite:invite.href});
    peer.on('connection',channel=>{
     if(channel.metadata?.game!=='slipstream-v1'||current.channels.size>=12){channel.close();return}
     const key=channel.peer+'/'+channel.connectionId;let count=0,since=performance.now(),joinTimer;current.channels.set(key,channel);
     channel.on('open',()=>{joinTimer=setTimeout(()=>channel.close(),5000)});
     channel.on('data',raw=>{
      if(performance.now()-since>1000){since=performance.now();count=0}
      if(++count>150||typeof raw!=='string'||raw.length>16384){channel.close();return}
      let data;try{data=JSON.parse(raw)}catch{return}
      if(data.type==='join')clearTimeout(joinTimer);
      current.worker.postMessage({type:'message',connection:key,data});
     });
     channel.on('close',()=>{clearTimeout(joinTimer);current.channels.delete(key);current.worker?.postMessage({type:'disconnect',connection:key})});
     channel.on('error',()=>channel.close());
    });
   }
   const transport={online:true,code,
    open(){
     let socket;
     if(host){
      socket=new Socket(raw=>{let data;try{data=JSON.parse(raw)}catch{return}current.worker.postMessage({type:'message',connection:'host',data})},()=>{});
      current.socket=socket;if(current.ready)queueMicrotask(()=>socket.open());
     }else{
      const channel=peer.connect('slipstream-'+code,{serialization:'json',reliable:true,metadata:{game:'slipstream-v1'}});
      if(!channel){socket=new Socket(()=>{},()=>{});current.socket=socket;queueMicrotask(()=>socket.close(1006));return socket}
      socket=new Socket(raw=>channel.open&&channel.send(raw),()=>channel.close());current.socket=socket;
      const timeout=setTimeout(()=>{if(socket.readyState===0){socket.readyState=1;socket.message({type:'error',message:'Could not connect. Check the room code and internet access. Some guest Wi-Fi networks block direct connections.'});socket.close(1008)}},15000);
      channel.on('open',()=>{clearTimeout(timeout);socket.open()});
      channel.on('data',raw=>{let data;try{data=JSON.parse(raw)}catch{return}if(data.type==='transport-close')socket.close(data.code);else socket.message(data)});
      channel.on('close',()=>{clearTimeout(timeout);socket.close(1006)});channel.on('error',()=>socket.close(1006));
     }
     return socket;
    },
    leave(){shutdown();const url=new URL(location.href);url.hash='';location.replace(url.href)},
    connectionError:'Connection lost. Keep the host’s game tab open and check your internet connection.'
   };
   let opened=false,signalRetries=0;
   const openTimeout=setTimeout(()=>{if(!opened&&!current.closed){shutdown();session=null;busy(false);status('The connection service could not be reached. Check your internet connection and try again.')}},15000);
   peer.on('open',async()=>{
    signalRetries=0;
    if(current.closed||opened)return;opened=true;clearTimeout(openTimeout);
    if(host){history.replaceState(null,'',invite.href);try{sessionStorage.setItem('slipstream-host-code',code)}catch{}}
    await window.startSlipstreamLobby(transport);
   });
   peer.on('error',error=>{
    if(!opened){clearTimeout(openTimeout);shutdown();session=null;busy(false);status(error.type==='unavailable-id'?'That room code was already in use. Click Host race again.':'The online connection service could not be reached. Check your internet access and retry.')}
    else if(!host&&error.type==='peer-unavailable'){
     const s=current.socket;if(s?.readyState===0)s.readyState=1;
     s?.message({type:'error',message:'Room not found. Check the code and ask the host to keep their game tab open.'});s?.close(1008);
    }
   });
   peer.on('disconnected',()=>{setTimeout(()=>{if(!current.closed&&!peer.destroyed&&peer.disconnected)try{peer.reconnect()}catch{}},Math.min(5000,500*2**Math.min(signalRetries++,4)))});
   document.addEventListener('visibilitychange',()=>{if(host&&!current.closed)current.worker.postMessage({type:'visibility',hidden:document.hidden})});
   window.addEventListener('pagehide',shutdown);
  }catch(error){session?.worker?.terminate();session?.peer?.destroy();session=null;busy(false);status(error.message||'Could not create the room. Try again.')}
 }
 ui('online-host').onclick=()=>start(true);
 ui('online-join').onclick=()=>start(false);
 ui('online-code').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();start(false)}});
 const code=new URLSearchParams(location.hash.slice(1)).get('room');
 if(code){
  ui('online-code').value=readCode(code);let wasHost=false;try{wasHost=sessionStorage.getItem('slipstream-host-code')===readCode(code)}catch{}
  if(wasHost)status('Your previous hosted room ended. Click Host race to create a new room.');else start(false,code);
 }
 window.SlipstreamOnline={host:()=>start(true),join:code=>start(false,code)};
})();
