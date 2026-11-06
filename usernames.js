(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlipstreamUsernames=api})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const normalize=value=>typeof value==='string'?value.trim():'';
 const valid=value=>/^[A-Za-z0-9_]{3,16}$/.test(normalize(value));
 function error(value,players=[],except=null){
  const name=normalize(value);
  if(!valid(name))return 'Use 3–16 letters, numbers or underscores.';
  if(players.some(p=>p.id!==except&&p.name.toLowerCase()===name.toLowerCase()))return 'That username is already in this room. Choose another.';
  return '';
 }
 return {normalize,valid,error};
});
