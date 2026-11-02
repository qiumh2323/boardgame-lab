import {analyticsSite} from './analytics-config.js?v=2';
const difficulties={simple:'blue',medium:'green',hard:'red'};
export function sanitizeCounterData(data){const clean={...data};delete clean.q;return clean;}
export function analyticsEvent(name,difficulty){
 if(!['open_game','difficulty_selected','game_started','game_completed'].includes(name))return null;
 const suffix=difficulties[difficulty];
 if(name!=='open_game'&&!suffix)return null;
 return {path:'pokemon-'+name+(suffix?'-'+suffix:''),title:({open_game:'点击开始游戏',difficulty_selected:'选择难度',game_started:'实际开始对局',game_completed:'完整结束对局'})[name]+(suffix?' · '+suffix:''),event:true,no_session:true,referrer:''};
}
export function createAnalytics({site,host,pathname,referrer='',navigator={},load}){
 const allowed=host==='qiumh2323.github.io'&&pathname.startsWith('/boardgame-lab/');
 const enabled=allowed&&/^https:\/\/[a-z0-9][a-z0-9-]*\.goatcounter\.com\/?$/.test(site)&&navigator.doNotTrack!=='1'&&!navigator.globalPrivacyControl;
 let sender=null,failed=false;const queue=[];
 const send=item=>{if(!enabled||failed)return;try{if(sender)sender(item);else if(queue.length<32)queue.push(item);}catch{/* Analytics must never interrupt play. */}};
 if(enabled){
  let source='';try{source=new URL(referrer).origin;}catch{}
  send({path:pathname,title:pathname.endsWith('game.html')?'宝可梦璀璨宝石':'桌游实验室首页',referrer:source,event:false});
  Promise.resolve().then(()=>load(site.replace(/\/$/,'')+'/count')).then(count=>{sender=count;for(const item of queue.splice(0)){try{sender(item);}catch{}}}).catch(()=>{failed=true;queue.length=0;});
 }
 return {enabled,track(name,difficulty){const item=analyticsEvent(name,difficulty);if(item)send(item);}};
}
function loadCounter(endpoint){return new Promise((resolve,reject)=>{
 window.goatcounter={no_onload:true,no_events:true,endpoint};
 const script=document.createElement('script');script.src='https://gc.zgo.at/count.js';script.async=true;script.referrerPolicy='no-referrer';
 const timeout=setTimeout(()=>reject(Error('analytics timeout')),8000);
 script.onload=()=>{clearTimeout(timeout);if(typeof window.goatcounter?.count!=='function'||typeof window.goatcounter?.get_data!=='function')return reject(Error('analytics unavailable'));const original=window.goatcounter.get_data;window.goatcounter.get_data=vars=>sanitizeCounterData(original(vars));resolve(data=>window.goatcounter.count(data));};
 script.onerror=()=>{clearTimeout(timeout);reject(Error('analytics blocked'));};document.head.append(script);
});}
const analytics=typeof window==='undefined'?null:createAnalytics({site:analyticsSite,host:location.hostname,pathname:location.pathname,referrer:document.referrer,navigator:window.navigator,load:loadCounter});
export function track(name,difficulty){analytics?.track(name,difficulty);}
