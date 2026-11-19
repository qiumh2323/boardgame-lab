import {createSalePlan} from './sale-plan.js?v=0.28';
import {cardName,cityName,ZH,nextTile,tileLocation,actionLabel} from './engine.js?v=0.28';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createDirectFlow(api){
 let draft=null,stage='idle',variants=[],resource=null,salePlan=null,lastRevision=null,selectedCard=null;
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 function reset(){draft=null;variants=[];stage='idle';resource=null;salePlan=null;selectedCard=null;paint();}
 function bar(text,options=[],finish=false){
  api.hint?.(text);$('#flow-text').textContent=text;$('#flow-options').innerHTML=options.map((o,i)=>`<button data-flow-option="${i}">${esc(o.label)}</button>`).join('');
  all('[data-flow-option]').forEach(b=>b.onclick=options[+b.dataset.flowOption].click);
  $('#flow-finish').hidden=!finish;$('#flow-cancel').hidden=stage==='idle';
 }
 function begin(type){
  if(!api.myTurn())return;api.showMyMat();draft={type};stage='target';resource=null;variants=[];selectedCard=null;
  if(type==='develop')draft.industries=[];
  if(type==='network')draft.edges=[];
  if(type==='sell'){draft.sales=[];salePlan=createSalePlan(api.view(),api.seat());}
  if(['loan','pass','scout'].includes(type)){draft.extra=[];discard();return;}
  paint();if(type==='develop')$('#mat-board').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function candidates(type=draft?.type){return api.actions().filter(a=>a.type===type);}
 function prefix(list,field){let selected=draft[field];return list.filter(a=>selected.every((x,i)=>a[field][i]===x));}
 function discard(){
  stage='discard';paint();
 }
 function targetReady(){
  if(!draft||!['target','discard'].includes(stage))return false;
  if(draft.type==='network')return draft.edges.length>0&&prefix(candidates(),'edges').some(a=>a.edges.length===draft.edges.length);
  if(draft.type==='develop')return draft.industries.length>0&&prefix(candidates(),'industries').some(a=>a.industries.length===draft.industries.length);
  if(draft.type==='sell')return draft.sales.length>0&&!salePlan?.snapshot().pending;
  return stage==='discard';
 }
 function canConfirm(){return targetReady()&&(draft.type==='scout'?draft.extra.length===3:selectedCard!==null);}
 function finish(){
  if(stage==='resource'){if(resource?.selected)send(draft);return;}
  if(!canConfirm())return;
  if(draft.type==='scout'){let [card,...extra]=draft.extra;send({...draft,card,extra});}
  else send({...draft,card:selectedCard});
 }
 function send(a){stage='waiting';draft=a;paint();api.submit(a);}
 function chooseCard(index){
  if(!targetReady())return;
  if(draft.type==='scout'){draft.extra=draft.extra.includes(index)?draft.extra.filter(i=>i!==index):[...draft.extra,index].slice(-3);paint();return;}
  if(draft.type==='build'&&!variants.some(a=>a.card===index))return;
  selectedCard=selectedCard===index?null:index;paint();
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
 function syncSale(){
  const plan=salePlan.snapshot();draft.sales=plan.sales;draft.choices=plan.choices;stage=plan.pending?'sale-resource':'target';
  if(plan.kind?.includes('免费研发'))api.showMyMat();paint();
 }
 function selectSale(key){salePlan.append(key);syncSale();}
 function selectSaleResource(id){salePlan.choose(id);syncSale();}
 function resourceElement(option){
  if(option.id==='skip')return null;
  if(option.id.startsWith('merchant:'))return $(`[data-merchant="${option.id.split(':')[1]}"]`);
  if(option.id.includes(':'))return $(`[data-loc="${tileLocation(option.id)}"][data-slot="${option.id.split(':')[1]}"]`);
  const level=option.level??api.view().players[api.seat()].stacks[option.id]?.[0];
  return $(`[data-mat-type="${option.id}"][data-level="${level}"]`);
 }
 function pickResource(id){
  let option=resource?.choice.options.find(o=>o.id===id);if(!option)return;
  let a=structuredClone(resource.action);a.choices=a.choices||[];a.choices[resource.choice.index]=id;resource.selected=id;draft=a;paint();
 }
 function requestChoice(action,choice){draft=action;resource={action:structuredClone(action),choice};stage='resource';if(choice.options.some(o=>!o.id.includes(':')&&o.id!=='skip'))api.showMyMat();paint();}
 function mark(el,selected=false){el?.classList.add(selected?'flow-selected':'flow-target');}
 function paint(){
  if(!$('#flow-bar'))return;
  all('.flow-target,.flow-selected').forEach(e=>e.classList.remove('flow-target','flow-selected'));
  let v=api.view();$('#hand-float').hidden=!v;$('#flow-bar').hidden=!v;
  if(!v){api.hint?.('');return;}
  if(lastRevision!==v.rev){draft=null;variants=[];resource=null;stage='idle';selectedCard=null;lastRevision=v.rev;}
  all('[data-loc],[data-route],[data-merchant],[data-mat-type]').forEach(e=>e.onclick=()=>{});
  all('[data-loc],[data-route]').forEach(el=>el.onclick=()=>{
   if(!api.myTurn()){api.explain?.(el,{});return;}
   const isRoute=el.dataset.route!==undefined,type=isRoute?'network':'build';
   if(stage==='idle'){begin(type);el.onclick();return;}
   if(draft?.type!==type||!['target','discard'].includes(stage)){api.explain?.(el,{...(isRoute?{route:el.dataset.route}:{loc:el.dataset.loc,slot:+el.dataset.slot})},[]);return;}
   api.explain?.(el,isRoute?{route:el.dataset.route}:{loc:el.dataset.loc,slot:+el.dataset.slot},draft?.edges||[]);
  });
  if(v.phase==='liquidation'&&api.myTurn()){for(let [key,t] of Object.entries(v.board))if(t.owner===api.seat()){let el=$(`[data-loc="${tileLocation(key)}"][data-slot="${key.split(':')[1]}"]`);mark(el);if(el)el.onclick=()=>send({type:'liquidate',key});}bar('点击自己的高亮产业，变卖以支付收入欠款。');return;}
  if(!targetReady())selectedCard=null;
  all('[data-card]').forEach(b=>{let i=+b.dataset.card,allowed=targetReady()&&(draft.type!=='build'||variants.some(a=>a.card===i));b.classList.toggle('discard-allowed',allowed);const picked=targetReady()&&(draft?.type==='scout'?!!draft.extra?.includes(i):selectedCard===i);b.classList.toggle('discard-picked',picked);b.setAttribute('aria-pressed',String(picked));b.classList.remove('selected');b.onclick=()=>chooseCard(i);});
  all('#action-buttons [data-type]').forEach(b=>{b.classList.toggle('selected',draft?.type===b.dataset.type);b.disabled=!api.myTurn()||!candidates(b.dataset.type).length;b.classList.toggle('action-ready',stage==='idle'&&v.phase==='play'&&!v.gameOver&&api.myTurn()&&!b.disabled);b.onclick=()=>begin(b.dataset.type);});
  $('#flow-cancel').onclick=reset;$('#flow-finish').onclick=finish;
  if(!api.myTurn()){bar(v.gameOver?'对局已结束':'等待其他玩家行动');return;}
  if(stage==='idle'){bar('先选择行动，再点击地图或玩家面板上的高亮目标。');return;}
  if(stage==='waiting'){bar('正在核对行动与资源…');return;}
  if(stage==='industry')return;
  $('#flow-finish').textContent=draft?.type==='scout'?'确认侦察':draft?.type==='sell'?'确认出售':'确认执行';
  if(stage==='discard'){
   let n=draft.type==='scout'?draft.extra.length:(selectedCard===null?0:1);
   bar(draft.type==='scout'?`选择3张弃牌（已选${n}张），再点确认。`:`${actionLabel(draft)} · ${n?'已选择弃牌，可更换；点击确认执行。':'请选择一张'+(draft.type==='build'?'高亮的匹配':'')+'弃牌，再点确认。'}`,[],canConfirm());return;
  }
  if(stage==='resource'){
   const free=resource.choice.kind.includes('免费研发');
   bar(free?'免费研发：直接点击玩家面板上高亮的板块，再确认。':`选择${resource.choice.kind}，再点击确认执行；尚未扣费。`,resource.choice.options.filter(o=>!free||o.id==='skip').map(o=>({label:o.label,click:()=>pickResource(o.id)})),!!resource.selected);
   for(let o of resource.choice.options){let el=resourceElement(o);mark(el,resource.selected===o.id);if(el)el.onclick=()=>pickResource(o.id);}
   return;
  }
  if(stage==='sale-resource'){
   const plan=salePlan.snapshot(),free=plan.kind?.includes('免费研发');
   bar(`${cityName(tileLocation(plan.pending))} · ${free?'商人奖励：点击玩家面板上高亮的板块免费研发。':'点击高亮的啤酒来源；选齐后可继续选择下一个待售产业。'}`,plan.options.filter(o=>o.id==='skip').map(o=>({label:o.label,click:()=>selectSaleResource(o.id)})));
   const industry=$(`[data-loc="${tileLocation(plan.pending)}"][data-slot="${plan.pending.split(':')[1]}"]`);mark(industry,true);if(industry)industry.onclick=()=>{salePlan.cancelPending();syncSale();};
   for(const o of plan.options){const el=resourceElement(o);mark(el);if(el)el.onclick=()=>selectSaleResource(o.id);}
   return;
  }
  $('#flow-finish').textContent=draft?.type==='sell'?'确认出售':'确认执行';
  if(draft.type==='build'){
   for(let a of candidates()){let el=$(`[data-loc="${a.loc}"][data-slot="${a.slot}"]`);mark(el);if(el)el.onclick=()=>selectBuild(a.loc,a.slot);}
   bar('已根据全部手牌、网络与资源高亮可建造产业位。点击位置，再选产业和弃牌。');
  }
  if(draft.type==='network'){
   let list=prefix(candidates(),'edges');for(let a of list){let key=a.edges[draft.edges.length],el=key?$(`[data-route="${key}"]`):null;mark(el);if(el)el.onclick=()=>selectRoute(key);}
   for(let key of draft.edges){let el=$(`[data-route="${key}"]`);mark(el,true);if(el)el.onclick=()=>selectRoute(key);}
   bar(`点击高亮线路${v.era==='rail'?'，可依次选择1或2条铁路':''}。已选${draft.edges.length}条；选择弃牌后点确认。`,[],canConfirm());
  }
  if(draft.type==='develop'){
   let list=prefix(candidates(),'industries'),p=v.players[api.seat()];for(let type of new Set(list.map(a=>a.industries[draft.industries.length]).filter(Boolean))){let level=p.stacks[type][draft.industries.filter(t=>t===type).length],el=$(`[data-mat-type="${type}"][data-level="${level}"]`);mark(el);if(el)el.onclick=()=>selectDevelop(type,level);}
   bar(`在自己的玩家面板点击高亮板块，最多研发2块；选择弃牌后点确认。已选：${draft.industries.map(t=>ZH[t]).join('、')||'无'}`,[],canConfirm());
  }
  if(draft.type==='sell'){
   const plan=salePlan.snapshot();
   for(const key of [...salePlan.available(),...plan.sales.map(s=>s.key)]){const el=$(`[data-loc="${tileLocation(key)}"][data-slot="${key.split(':')[1]}"]`);mark(el,plan.sales.some(s=>s.key===key));if(el)el.onclick=()=>selectSale(key);}
   bar(`已选择${draft.sales.length}个产业。点击高亮产业，再选啤酒来源，重复即可继续出售；最后选一张弃牌，确认出售。${draft.sales.length?'点击已选产业可撤回该项及后续选择。':''}`,[],canConfirm());
  }
 }
 return {begin,paint,reset,requestChoice,failed:()=>{stage='target';resource=null;paint();}};
}
