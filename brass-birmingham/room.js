// PeerJS handles encrypted WebRTC data channels; only signaling uses PeerServer.
export class Room{
 constructor(onEvent){this.event=onEvent;this.peer=null;this.clients=new Map();this.seats=[];this.isHost=false;this.seat=0;this.started=false;this.code='';this.closed=false;}
 async create(name,count){
  this.isHost=true;this.count=count;this.code=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();this.seats=[{seat:0,name,online:true}];
  await this.open('brassnight-'+this.code);this.peer.on('connection',conn=>this.accept(conn));this.event('lobby',this.lobby());return this.code;
 }
 open(id){return new Promise((resolve,reject)=>{
  if(!globalThis.Peer){reject(Error('联机组件未加载；仍可进行本地 AI 对局'));return;}
  this.peer=id?new Peer(id,{debug:0}):new Peer({debug:0});let timer=setTimeout(()=>reject(Error('连接房间服务超时，请检查网络后重试')),18000);
  this.peer.on('open',()=>{clearTimeout(timer);resolve();});this.peer.on('error',e=>{clearTimeout(timer);let message=e.type==='peer-unavailable'?'房间不存在或房主已离线':e.type==='network'?'联机服务连接失败，请检查网络':('联机连接失败：'+e.type);this.event('error',message);reject(Error(message));});
  this.peer.on('disconnected',()=>{if(!this.closed){this.event('status','信令连接中断，正在重连');this.peer.reconnect();}});
 });}
 async join(code,name){
  code=code.trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(code))throw Error('请输入8位房间码');this.code=code;this.isHost=false;this.name=name;
  this.token=sessionStorage.getItem('brass-seat-'+code)||crypto.randomUUID();sessionStorage.setItem('brass-seat-'+code,this.token);
  await this.open();this.connect();
 }
 connect(){
  let conn=this.peer.connect('brassnight-'+this.code,{reliable:true,serialization:'json'});this.host=conn;
  let timer=setTimeout(()=>{if(!conn.open)this.event('error','无法直连房主，请确认双方网络允许 WebRTC。');},15000);
  conn.on('open',()=>{clearTimeout(timer);conn.send({kind:'join',name:this.name,token:this.token});});
  conn.on('data',m=>{if(!m||typeof m!=='object')return;if(m.kind==='welcome'){this.seat=m.seat;this.event('seat',m.seat);}else if(m.kind==='lobby')this.event('lobby',m.data);else if(m.kind==='snapshot'){this.started=true;this.event('snapshot',m.data);}else if(m.kind==='choice')this.event('choice',m.data);else if(m.kind==='error')this.event('error',m.message);});
  conn.on('close',()=>{clearTimeout(timer);if(!this.closed)this.event('status','与房主连接断开，点击对局菜单重新连接');});conn.on('error',()=>this.event('error','与房主连接失败'));
 }
 accept(conn){
  let seat=null,joined=false;let timer=setTimeout(()=>{if(!joined)conn.close();},12000);
  conn.on('data',m=>{
   if(!m||typeof m!=='object')return;
   if(m.kind==='join'&&!joined){
    if(typeof m.token!=='string'||m.token.length>100||typeof m.name!=='string'){conn.close();return;}
    let existing=this.seats.find(s=>s.token===m.token);
    if(existing){seat=existing.seat;let previous=this.clients.get(seat);if(previous&&previous!==conn)previous.close();existing.online=true;}
    else{
     if(this.started||this.seats.length>=this.count){conn.send({kind:'error',message:this.started?'对局已经开始，只能由原玩家重连':'房间已满'});setTimeout(()=>conn.close(),300);return;}
     seat=this.seats.length;this.seats.push({seat,name:m.name.slice(0,18)||'玩家'+(seat+1),token:m.token,online:true});
    }
    joined=true;clearTimeout(timer);this.clients.set(seat,conn);conn.send({kind:'welcome',seat});this.broadcastLobby();this.event('reconnect',seat);
   }else if(joined&&m.kind==='action'&&Number.isInteger(m.rev)&&m.action&&JSON.stringify(m.action).length<16000)this.event('action',{seat,rev:m.rev,action:m.action});
  });
  conn.on('close',()=>{clearTimeout(timer);if(seat!==null&&this.clients.get(seat)===conn){this.clients.delete(seat);let s=this.seats.find(s=>s.seat===seat);if(s)s.online=false;this.broadcastLobby();}});
  conn.on('error',()=>{});
 }
 lobby(){return {code:this.code,count:this.count,seats:this.seats.map(({token,...s})=>s),started:this.started};}
 broadcastLobby(){let data=this.lobby();for(let conn of this.clients.values())if(conn.open)conn.send({kind:'lobby',data});this.event('lobby',data);}
 send(seat,kind,data){let conn=this.clients.get(seat);if(conn?.open)conn.send({kind,data});}
 error(seat,message){let conn=this.clients.get(seat);if(conn?.open)conn.send({kind:'error',message});}
 command(rev,action){if(!this.host?.open)throw Error('尚未连接到房主');this.host.send({kind:'action',rev,action});}
 destroy(){this.closed=true;this.peer?.destroy();}
}
