const net=require('net'),fs=require('fs');const sp=(process.env.XDG_RUNTIME_DIR||'/tmp')+'/discord-ipc-0';try{fs.unlinkSync(sp)}catch(e){}
const enc=(op,d)=>{const j=Buffer.from(JSON.stringify(d));const h=Buffer.alloc(8);h.writeInt32LE(op,0);h.writeInt32LE(j.length,4);return Buffer.concat([h,j]);};
const users=[{id:'111111111111111111',username:'timo'},{id:'222222222222222222',username:'lea',global_name:'Léa'},{id:'333333333333333333',username:'max'},{id:'444444444444444444',username:'sam'}];
net.createServer(s=>{let buf=Buffer.alloc(0);
 s.on('data',d=>{buf=Buffer.concat([buf,d]);while(buf.length>=8){const op=buf.readInt32LE(0),len=buf.readInt32LE(4);if(buf.length<8+len)break;const m=JSON.parse(buf.slice(8,8+len));buf=buf.slice(8+len);
  if(op===0){s.write(enc(1,{cmd:'DISPATCH',evt:'READY',data:{user:users[0]}}));continue;}
  const reply=(data)=>s.write(enc(1,{cmd:m.cmd,nonce:m.nonce,data}));
  if(m.cmd==='AUTHENTICATE')reply({user:users[0]});
  else if(m.cmd==='GET_SELECTED_VOICE_CHANNEL')reply({id:'99',name:'Général',voice_states:users.map((u,i)=>({user:u,voice_state:{self_mute:i===3,self_stream:i===2}}))});
  else reply({});
  if(m.cmd==='SUBSCRIBE'&&m.evt==='VOICE_CHANNEL_EFFECT_SEND'){setInterval(()=>s.write(enc(1,{cmd:'DISPATCH',evt:'VOICE_CHANNEL_EFFECT_SEND',data:{channel_id:'99',user_id:'222222222222222222',emoji:{name:'🔥',id:null},sound_id:Math.random()<0.5?'7':null}})),1500);}
 }});
 const iv=setInterval(()=>{const u=users[Math.floor(Math.random()*3)];s.write(enc(1,{cmd:'DISPATCH',evt:Math.random()<0.5?'SPEAKING_START':'SPEAKING_STOP',data:{user_id:u.id}}));},700);
 s.on('close',()=>clearInterval(iv)); s.on('error',()=>{});
}).listen(sp,()=>console.log('mock up'));
