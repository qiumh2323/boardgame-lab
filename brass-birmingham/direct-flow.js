import {cardName,cityName,ZH,nextTile,tileLocation,actionLabel} from './engine.js?v=0.9';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createDirectFlow(api){
 let draft=null,stage='idle',variants=[],resource=null,pendingSale=null,lastRevision=null;
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 function reset(){draft=null;variants=[];stage='idle';resource=null;pendingSale=null;paint();}
 function bar(text,options=[],finish=false){
  $('#flow-text').textContent=text;$('#flow-options').innerHTML=options.map((o,i)=>`<button data-flow-option="${i}">${esc(o.label)}</button>`).join('');
  all('[data-flow-option]').forEach(b=>b.onclick=options[+b.dataset.flowOption].click);
  $('#flow-finish').hidden=!finish;$('#flow-cancel').hidden=stage==='idle';
 }
 function begin(type){
  if(!api.myTurn())return;draft={type};stage='target';resource=null;pendingSale=null;variants=[];
  if(type==='develop'){draft.industries=[];api.showMyMat();}
  if(type==='network')draft.edges=[];
  if(type==='sell')draft.sales=[];
  if(['loan','pass','scout'].includes(type)){draft.extra=[];discard();return;}
  paint();if(type==='develop')$('#mat-board').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function candidates(type=draft?.type){return api.actions().filter(a=>a.type===type);}
 function prefix(list,field){let selected=draft[field];return list.filter(a=>selected.every((x,i)=>a[field][i]===x));}
 function discard(){
  stage='discard';paint();$('#hand-float').classList.remove('collapsed');$('#hand-toggle').textContent='收起手牌';
 }
 function finish(){
  if(!draft)return;
  if(stage==='discard'){if(draft.type==='scout'&&draft.extra.length===3){let [card,...extra]=draft.extra;send({...draft,card,extra});}return;}
  if(draft.type==='network'){variants=prefix(candidates(),'edges').filter(a=>a.edges.length===draft.edges.length);if(!variants.length)return;}
  if(draft.type==='develop'){variants=prefix(candidates(),'industries').filter(a=>a.industries.length===draft.industries.length);if(!variants.length)return;}
  if(draft.type==='sell'&&!draft.sales.length)return;
  discard();
 }
 function send(a){stage='waiting';draft=a;paint();api.submit(a);}
 function chooseCard(index){
  if(stage!=='discard')return;
  if(draft.type==='scout'){draft.extra=draft.extra.includes(index)?draft.extra.filter(i=>i!==index):[...draft.extra,index].slice(-3);paint();return;}
  if(draft.type==='build'&&!variants.some(a=>a.card===index))return;
  send({...draft,card:index});
 }
 function selectBuild(loc,slot){
  let list=candidates('build').filter(a=>a.loc===loc&&a.slot===slot),types=[...new Set(list.map(a=>a.industry))];if(!list.length)return;
  const pick=industry=>{draft={type:'build',loc,slot,industry};variants=list.filter(a=>a.industry===industry);discard();};
  if(types.length===1)pick(types[0]);else{stage='industry';bar(`${cityName(loc)}：选择要建造的产业`,types.map(t=>({label:ZH[t],click:()=>pick(t)})));}
 }
 function selectRoute(key){
  if(draft.edges.at(-1)===key){draft.edges.pop();paint();return;}
  let list=prefix(candidates('network'),'edges');if(!list.some(a=>a.edges[draft.edges.length]===key))return;
  draft.edges.push(key);paint();
 }
 function selectDevelop(type,level){
  let list=prefix(candidates('develop'),'industries'),p=api.view().players[api.seat()],removed=draft.industries.filter(t=>t===type).length;
  if(p.stacks[type][removed]!==level||!list.some(a=>a.industries[draft.industries.length]===type))return;
  draft.industries.push(type);paint();
 }
 function selectSale(key){
  let selected=draft.sales.findIndex(s=>s.key===key);if(selected>=0){draft.sales.splice(selected,1);paint();return;}
  let options=candidates('sell').filter(a=>a.sales.length===1&&a.sales[0].key===key).map(a=>a.sales[0]);if(!options.length)return;
  pendingSale={key,options};stage='merchant';paint();
 }
 function selectMerchant(id){
  if(resource){pickResource('merchant:'+id);return;}
  let sale=pendingSale?.options.find(s=>s.merchant===id);if(!sale)return;
  draft.sales.push({...sale});pendingSale=null;stage='target';paint();
 }
 function pickResource(id){
  let option=resource?.choice.options.find(o=>o.id===id);if(!option)return;
  let a=structuredClone(resource.action);a.choices=a.choices||[];a.choices[resource.choice.index]=id;resource=null;send(a);
 }
 function requestChoice(action,choice){draft=action;resource={action:structuredClone(action),choice};stage='resource';if(choice.options.some(o=>!o.id.includes(':')&&o.id!=='skip'))api.showMyMat();paint();}
 function mark(el,selected=false){el?.classList.add(selected?'flow-selected':'flow-target');}
 function paint(){
  if(!$('#flow-bar'))return;
  all('.flow-target,.flow-selected').forEach(e=>e.classList.remove('flow-target','flow-selected'));
  let v=api.view();$('#hand-float').hidden=!v;$('#flow-bar').hidden=!v;
  if(!v)return;
  if(lastRevision!==v.rev){draft=null;variants=[];resource=null;pendingSale=null;stage='idle';lastRevision=v.rev;}
  all('[data-loc],[data-route],[data-merchant],[data-mat-type]').forEach(e=>e.onclick=()=>{});
  if(v.phase==='liquidation'&&api.myTurn()){for(let [key,t] of Object.entries(v.board))if(t.owner===api.seat()){let el=$(`[data-loc="${tileLocation(key)}"][data-slot="${key.split(':')[1]}"]`);mark(el);if(el)el.onclick=()=>send({type:'liquidate',key});}bar('点击自己的高亮产业，变卖以支付收入欠款。');return;}
  all('[data-card]').forEach(b=>{let i=+b.dataset.card,allowed=stage==='discard'&&(draft.type!=='build'||variants.some(a=>a.card===i));b.classList.toggle('discard-allowed',allowed);b.classList.toggle('discard-picked',draft?.type==='scout'&&draft.extra?.includes(i));b.classList.remove('selected');b.onclick=()=>chooseCard(i);});
  all('#action-buttons [data-type]').forEach(b=>{b.classList.toggle('selected',draft?.type===b.dataset.type);b.disabled=!api.myTurn()||!candidates(b.dataset.type).length;b.onclick=()=>begin(b.dataset.type);});
  $('#flow-cancel').onclick=reset;$('#flow-finish').onclick=finish;
  if(!api.myTurn()){bar(v.gameOver?'对局已结束':'等待其他玩家行动');return;}
  if(stage==='idle'){bar('先选择行动，再点击地图或玩家面板上的高亮目标。');return;}
  if(stage==='waiting'){bar('正在核对行动与资源…');return;}
  if(stage==='industry')return;
  if(stage==='discard'){
   $('#flow-finish').textContent='确认弃掉这3张牌';
   let n=draft.type==='scout'?draft.extra.length:1;
   bar(draft.type==='scout'?`在悬浮手牌框选择3张弃牌（已选${n}张）`:`${actionLabel(draft)} · 请在悬浮手牌框选择${draft.type==='build'?'高亮的匹配':'一张'}弃牌`,[],draft.type==='scout'&&n===3);return;
  }
  if(stage==='resource'){
   bar(`直接点击高亮的${resource.choice.kind}；选择尚未扣费。`,resource.choice.options.map(o=>({label:o.label,click:()=>pickResource(o.id)})));
   for(let o of resource.choice.options){let el=o.id.startsWith('merchant:')?$(`[data-merchant="${o.id.split(':')[1]}"]`):o.id.includes(':')?$(`[data-loc="${tileLocation(o.id)}"][data-slot="${o.id.split(':')[1]}"]`):$(`[data-mat-type="${o.id}"]`);mark(el);if(el)el.onclick=()=>pickResource(o.id);}
   return;
  }
  if(stage==='merchant'){
   bar('点击地图上高亮的收购商人',pendingSale.options.map(s=>({label:cityName(v.merchants.find(m=>m.id===s.merchant).loc),click:()=>selectMerchant(s.merchant)})));
   for(let s of pendingSale.options){let el=$(`[data-merchant="${s.merchant}"]`);mark(el);if(el)el.onclick=()=>selectMerchant(s.merchant);}return;
  }
  $('#flow-finish').textContent='完成选择，选择弃牌';
  if(draft.type==='build'){
   for(let a of candidates()){let el=$(`[data-loc="${a.loc}"][data-slot="${a.slot}"]`);mark(el);if(el)el.onclick=()=>selectBuild(a.loc,a.slot);}
   bar('已根据全部手牌、网络与资源高亮可建造产业位。点击位置，再选产业和弃牌。');
  }
  if(draft.type==='network'){
   let list=prefix(candidates(),'edges');for(let a of list){let key=a.edges[draft.edges.length],el=key?$(`[data-route="${key}"]`):null;mark(el);if(el)el.onclick=()=>selectRoute(key);}
   for(let key of draft.edges){let el=$(`[data-route="${key}"]`);mark(el,true);if(el)el.onclick=()=>selectRoute(key);}
   bar(`点击高亮线路${v.era==='rail'?'，可依次选择1或2条铁路':''}。已选${draft.edges.length}条。`,[],list.some(a=>a.edges.length===draft.edges.length)&&draft.edges.length>0);
  }
  if(draft.type==='develop'){
   let list=prefix(candidates(),'industries'),p=v.players[api.seat()];for(let type of new Set(list.map(a=>a.industries[draft.industries.length]).filter(Boolean))){let level=p.stacks[type][draft.industries.filter(t=>t===type).length],el=$(`[data-mat-type="${type}"][data-level="${level}"]`);mark(el);if(el)el.onclick=()=>selectDevelop(type,level);}
   bar(`在自己的玩家面板点击高亮板块，最多研发2块。已选：${draft.industries.map(t=>ZH[t]).join('、')||'无'}`,[],draft.industries.length>0);
  }
  if(draft.type==='sell'){
   for(let a of candidates()){for(let s of a.sales){let el=$(`[data-loc="${tileLocation(s.key)}"][data-slot="${s.key.split(':')[1]}"]`);mark(el,draft.sales.some(t=>t.key===s.key));if(el)el.onclick=()=>selectSale(s.key);}}
   bar(`点击高亮的未翻面产业，再选择商人。已选${draft.sales.length}个；完成后选弃牌和啤酒。`,[],draft.sales.length>0);
  }
 }
 return {begin,paint,reset,requestChoice,failed:()=>{stage='target';resource=null;paint();}};
}
