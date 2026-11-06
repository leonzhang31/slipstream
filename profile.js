'use strict';
(()=>{
 const rules=window.SlipstreamUsernames,button=document.getElementById('profile-button'),dialog=document.getElementById('profile-dialog');
 const input=document.getElementById('profile-name'),form=document.getElementById('profile-form'),hint=document.getElementById('profile-error');
 let username='',pending=[];
 try{const saved=localStorage.getItem('slipstream-username')||localStorage.getItem('slipstream-driver-name');if(rules.valid(saved))username=rules.normalize(saved)}catch{}
 function label(){button.textContent=username?'@'+username:'Set username'}
 function set(value){
  const error=rules.error(value);if(error){hint.textContent=error;return false}
  username=rules.normalize(value);
  try{localStorage.setItem('slipstream-username',username);localStorage.setItem('slipstream-driver-name',username)}catch{}
  label();window.dispatchEvent(new CustomEvent('slipstream-username',{detail:username}));return true;
 }
 function open(message=''){hint.textContent=typeof message==='string'?message:'';input.value=username;if(!dialog.open)dialog.showModal();input.focus();input.select()}
 function ensure(){return username?Promise.resolve(username):new Promise(resolve=>{pending.push(resolve);open()})}
 form.addEventListener('submit',event=>{event.preventDefault();if(set(input.value))dialog.close('saved')});
 dialog.addEventListener('close',()=>{for(const resolve of pending)resolve(dialog.returnValue==='saved'?username:null);pending=[]});
 document.getElementById('profile-cancel').onclick=()=>dialog.close('cancel');button.onclick=open;
 window.SlipstreamProfile={get username(){return username},set,ensure,open};label();
})();
