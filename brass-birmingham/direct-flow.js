import {createSalePlan} from './sale-plan.js?v=0.49';
import {cityName,ZH,nextTile,tileLocation,previewSales} from './engine.js?v=0.49';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createDirectFlow(api){
 let draft=null,stage='idle',variants=[],resource=null,salePlan=null,lastRevision=null,selectedCard=null,previousSoleDiscard=null,industryChoice=null;
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 function reset(){industryChoice=null;draft=null;variants=[];stage='idle';resource=null;salePlan=null;selectedCard=null;previousSoleDiscard=null;paint();}
 function bar(text,options=[],finish=false){
  api.hint?.(text);$('#flow-text').textContent=text;$('#flow-options').innerHTML=options.map((o,i)=>`<button data-flow-option="${i}">${esc(o.label)}</button>`).join('');
  all('[data-flow-option]').forEach(b=>b.onclick=options[+b.dataset.flowOption].click);
  $('#flow-finish').hidden=!finish;$('#flow-cancel').hidden=stage==='idle';
 }
 function begin(type){
  if(!api.myTurn()||api.view().turnPending)return;industryChoice=null;api.showMyMat();draft={type};stage='target';resource=null;variants=[];selectedCard=null;previousSoleDiscard=null;
  if(type==='develop')draft.industries=[];
  if(type==='network')draft.edges=[];
  if(type==='sell'){draft.sales=[];salePlan=createSalePlan(api.view(),api.seat());}
  if(['loan','pass','scout'].includes(type)){draft.extra=[];discard();return;}
  paint();if(type==='develop')$('#mat-board').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function candidates(type=draft?.type){return api.actions().filter(a=>a.type===type);}
 function buildCandidates(){return candidates('build').filter(a=>selectedCard===null||a.card===selectedCard);}
 function prefix(list,field){let selected=draft[field];return list.filter(a=>selected.every((x,i)=>a[field][i]===x));}
 function discard(){
  stage='discard';paint();
 }
 function targetReady(){
  if(!draft||!['target','discard'].includes(stage))return false;
  if(draft.type==='network')return draft.edges.length>0&&prefix(candidates(),'edges').some(a=>a.edges.length===draft.edges.length);
  if(draft.type==='develop')return draft.industries.length>0&&prefix(candidates(),'industries').some(a=>a.industries.length===draft.industries.length);
  if(draft.type==='sell')return draft.sales.length>0;
  return stage==='discard';
 }
 function canConfirm(){return targetReady()&&(draft.type==='scout'?draft.extra.length===3:selectedCard!==null);}
 function eligibleDiscards(){
  if(!api.myTurn()||!draft||!['target','discard','industry'].includes(stage))return [];
  const indices=api.view().players[api.seat()].hand.map((_,i)=>i);
  if(draft.type!=='build')return indices;
  const builds=stage==='discard'?variants:candidates('build');
  return indices.filter(i=>builds.some(a=>a.card===i));
 }
 function finish(){
  if(stage==='resource'){
   if(resource?.selected){if(draft.type==='sell')finishSale(draft);else send(draft);}
   return;
  }
  if(!canConfirm())return;
  if(draft.type==='scout'){let [card,...extra]=draft.extra;send({...draft,card,extra});}
  else if(draft.type==='sell')finishSale({...draft,card:selectedCard});
  else send({...draft,card:selectedCard});
 }
 function finishSale(action){
  const result=previewSales(api.view(),api.seat(),action.sales,action.choices);
  if(result.choice)requestChoice(action,result.choice);else send(action);
 }
 function send(a){stage='waiting';draft=a;paint();api.submit(a);}
 function chooseCard(index){
  if(!eligibleDiscards().includes(index))return;
  if(draft.type==='scout'){draft.extra=draft.extra.includes(index)?draft.extra.filter(i=>i!==index):[...draft.extra,index].slice(-3);paint();return;}
  selectedCard=selectedCard===index?null:index;paint();
 }
 function buildSlot(loc,slot){return $(`[data-loc="${loc}"][data-slot="${slot}"]`);}
 function positionIndustryPicker(){
  const picker=$('#industry-picker');
  if(!industryChoice||picker.hidden)return;
  const anchor=buildSlot(industryChoice.loc,industryChoice.slot)?.getBoundingClientRect?.();
  if(!anchor)return;
  const viewport=document.documentElement;
  const boardViewport=document.body.classList.contains('board-focus')?$('.board-column')?.getBoundingClientRect():null;
  const visibleTop=Math.max(0,boardViewport?.top??0),visibleBottom=Math.min(viewport.clientHeight,boardViewport?.bottom??viewport.clientHeight);
  picker.style.visibility=anchor.bottom>visibleTop&&anchor.top<visibleBottom&&anchor.right>0&&anchor.left<viewport.clientWidth?'visible':'hidden';
  const width=picker.offsetWidth,height=picker.offsetHeight,gap=8;
  const maxX=viewport.clientWidth-width-gap,maxY=viewport.clientHeight-height-gap;
  const above=anchor.top-height-gap;
  picker.style.left=`${Math.max(gap,Math.min(maxX,anchor.left+(anchor.width-width)/2))}px`;
  picker.style.top=`${Math.max(gap,Math.min(maxY,above>=gap?above:anchor.bottom+gap))}px`;
 }
 function dismissIndustry(){
  if(stage!=='industry'||!industryChoice)return false;
  const {loc,slot}=industryChoice;
  industryChoice=null;stage='target';paint();buildSlot(loc,slot)?.focus();return true;
 }
 document.addEventListener('scroll',positionIndustryPicker,true);
 document.defaultView?.addEventListener('resize',positionIndustryPicker);
 function selectBuild(loc,slot){
  if(!buildCandidates().some(a=>a.loc===loc&&a.slot===slot))return;
  const pick=industry=>{
   industryChoice=null;draft={type:'build',loc,slot,industry};
   variants=candidates('build').filter(a=>a.loc===loc&&a.slot===slot&&a.industry===industry);discard();
   $('[data-card].discard-picked,[data-card].discard-allowed')?.focus();
  };
  industryChoice={loc,slot,pick};stage='industry';paint();
  $('#industry-picker [data-industry-option]')?.focus();
 }
 function paintIndustryPicker(){
  const picker=$('#industry-picker'),{loc,slot,pick}=industryChoice;
  const builds=buildCandidates();
  const types=[...new Set(builds.filter(a=>a.loc===loc&&a.slot===slot).map(a=>a.industry))];
  if(!types.length){dismissIndustry();return;}
  const anchor=buildSlot(loc,slot);
  for(const candidate of builds){
   const target=buildSlot(candidate.loc,candidate.slot);
   if(target&&target!==anchor){mark(target);target.onclick=()=>selectBuild(candidate.loc,candidate.slot);}
  }
  mark(anchor,true);if(anchor)anchor.onclick=dismissIndustry;
  picker.setAttribute('aria-label',`${cityName(loc)}可建产业`);
  picker.innerHTML=types.map(type=>{
   const level=nextTile(api.view(),api.seat(),type)?.level;
   const image=api.industryImage?.(type,level);
   const label=`${ZH[type]}${level?` ${level}级`:''}`;
   return `<button type="button" data-industry-option="${type}" title="${esc(label)}">${image?`<img src="${esc(image)}" alt="">`:''}<span>${esc(label)}</span></button>`;
  }).join('');
  picker.querySelectorAll('button').forEach(button=>button.onclick=()=>pick(button.dataset.industryOption));
  picker.hidden=false;positionIndustryPicker();
  bar(selectedCard===null?'选择产业和弃牌。':'选择要建造的产业。');
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
  const picker=$('#industry-picker');if(picker)picker.hidden=true;
  all('.flow-target,.flow-selected').forEach(e=>e.classList.remove('flow-target','flow-selected'));
  all('[data-sale-beer]').forEach(e=>e.removeAttribute('data-sale-beer'));
  all('[data-develop-order]').forEach(e=>e.removeAttribute('data-develop-order'));
  let v=api.view();$('#hand-float').hidden=!v;$('#flow-bar').hidden=!v;
  if(!v){api.hint?.('');return;}
  if(lastRevision!==v.rev){industryChoice=null;draft=null;variants=[];resource=null;stage='idle';selectedCard=null;previousSoleDiscard=null;lastRevision=v.rev;}
  all('[data-loc],[data-route],[data-merchant],[data-mat-type]').forEach(e=>e.onclick=()=>{});
  all('[data-loc],[data-route]').forEach(el=>el.onclick=()=>{
   if(!api.myTurn()){api.explain?.(el,{});return;}
   if(v.turnPending){api.explain?.(el,{reason:'可撤回行动，或点击结束回合。'});return;}
   const isRoute=el.dataset.route!==undefined,type=isRoute?'network':'build';
   if(stage==='idle'){begin(type);el.onclick();return;}
   if(!isRoute&&draft?.type==='build'&&selectedCard!==null&&candidates('build').some(a=>a.loc===el.dataset.loc&&a.slot===+el.dataset.slot)){
    api.explain?.(el,{reason:'所选弃牌不支持在此建造。'});return;
   }
   if(draft?.type!==type||!['target','discard'].includes(stage)){api.explain?.(el,{...(isRoute?{route:el.dataset.route}:{loc:el.dataset.loc,slot:+el.dataset.slot})},[]);return;}
   api.explain?.(el,isRoute?{route:el.dataset.route}:{loc:el.dataset.loc,slot:+el.dataset.slot},draft?.edges||[]);
  });
  if(v.phase==='liquidation'&&api.myTurn()){for(let [key,t] of Object.entries(v.board))if(t.owner===api.seat()){let el=$(`[data-loc="${tileLocation(key)}"][data-slot="${key.split(':')[1]}"]`);mark(el);if(el)el.onclick=()=>send({type:'liquidate',key});}bar('点击自己的高亮产业，变卖以支付收入欠款。');return;}
  const sale=draft?.type==='sell'&&stage==='target'?salePlan.snapshot():null;
  if(sale){draft.sales=sale.action?.sales??[];draft.choices=sale.action?.choices??[];}
  const eligible=eligibleDiscards();
  if(!eligible.includes(selectedCard))selectedCard=null;
  const soleDiscard=targetReady()&&eligible.length===1&&draft.type!=='scout'?eligible[0]:null;
  if(soleDiscard!==null&&soleDiscard!==previousSoleDiscard)selectedCard=soleDiscard;
  previousSoleDiscard=soleDiscard;
  all('[data-card]').forEach(b=>{const i=+b.dataset.card,allowed=eligible.includes(i);b.classList.toggle('discard-allowed',allowed);const picked=allowed&&(draft.type==='scout'?draft.extra.includes(i):selectedCard===i);b.classList.toggle('discard-picked',picked);b.setAttribute('aria-pressed',String(picked));b.classList.remove('selected');b.onclick=()=>chooseCard(i);});
  all('#action-buttons [data-type]').forEach(b=>{b.classList.toggle('selected',draft?.type===b.dataset.type);b.disabled=!api.myTurn()||!candidates(b.dataset.type).length;b.classList.toggle('action-ready',stage==='idle'&&v.phase==='play'&&!v.gameOver&&api.myTurn()&&!b.disabled);b.onclick=()=>begin(b.dataset.type);});
  $('#flow-cancel').onclick=reset;$('#flow-finish').onclick=finish;
  if(!api.myTurn()){bar(v.gameOver?'对局已结束':`等候${v.players[v.order[v.turn]]?.name??'其他玩家'}${v.turnPending?'结束回合':'行动'}。`);return;}
  if(v.turnPending){bar('可撤回行动，或点击结束回合。');return;}
  if(stage==='idle'){bar('先选择行动。');return;}
  if(stage==='waiting'){bar('正在提交行动…');return;}
  if(stage==='industry'){paintIndustryPicker();return;}
  $('#flow-finish').textContent=draft?.type==='scout'?'确认侦察':draft?.type==='sell'?'确认出售':'确认执行';
  if(stage==='discard'){
   let n=draft.type==='scout'?draft.extra.length:(selectedCard===null?0:1);
   if(draft.type==='build'){
    for(const a of buildCandidates()){
     const el=buildSlot(a.loc,a.slot);mark(el,a.loc===draft.loc&&a.slot===draft.slot);
     if(el)el.onclick=()=>selectBuild(a.loc,a.slot);
    }
   }
   const prompt=draft.type==='scout'&&n<3?`还需选择 ${3-n} 张弃牌。`:canConfirm()?`点击${$('#flow-finish').textContent}。`:'选择一张弃牌。';
   bar(prompt,[],canConfirm());return;
  }
  if(stage==='resource'){
   const free=resource.choice.kind.includes('免费研发');
   if(draft.type==='sell')$('#flow-finish').textContent='确认奖励';
   const prompt=resource.selected?`点击${$('#flow-finish').textContent}。`:free?'免费研发：选择一块高亮板块，或放弃奖励。':`选择${resource.choice.kind}。`;
   bar(prompt,resource.choice.options.filter(o=>!free||o.id==='skip').map(o=>({label:o.label,click:()=>pickResource(o.id)})),!!resource.selected);
   for(let o of resource.choice.options){let el=resourceElement(o);mark(el,resource.selected===o.id);if(el)el.onclick=()=>pickResource(o.id);}
   return;
  }
  $('#flow-finish').textContent=draft?.type==='sell'?'确认出售':'确认执行';
  if(draft.type==='build'){
   for(const a of buildCandidates()){const el=buildSlot(a.loc,a.slot);mark(el);if(el)el.onclick=()=>selectBuild(a.loc,a.slot);}
   bar(selectedCard===null?'选择建造位置和弃牌。':'选择高亮的建造位置。');
  }
  if(draft.type==='network'){
   let list=prefix(candidates(),'edges');for(let a of list){let key=a.edges[draft.edges.length],el=key?$(`[data-route="${key}"]`):null;mark(el);if(el)el.onclick=()=>selectRoute(key);}
   for(let key of draft.edges){let el=$(`[data-route="${key}"]`);mark(el,true);if(el)el.onclick=()=>selectRoute(key);}
   bar(canConfirm()?'点击确认执行。':!targetReady()?(selectedCard===null?'选择线路和弃牌。':'选择要铺设的线路。'):'选择一张弃牌。',[],canConfirm());
  }
  if(draft.type==='develop'){
   const list=prefix(candidates(),'industries'),p=v.players[api.seat()];
   const onOwnMat=!$('#hand')||Number($('#hand').dataset.player)===api.seat();
   if(onOwnMat){
    const removed=new Map();
    draft.industries.forEach((type,i)=>{
     const offset=removed.get(type)??0,level=p.stacks[type][offset];removed.set(type,offset+1);
     const el=resourceElement({id:type,level});if(!el)return;
     el.dataset.developOrder=[el.dataset.developOrder,i+1].filter(Boolean).join(' · ');
     el.onclick=()=>{draft.industries.splice(i);paint();};
    });
    for(const type of new Set(list.map(a=>a.industries[draft.industries.length]).filter(Boolean))){
     const level=p.stacks[type][removed.get(type)??0],el=resourceElement({id:type,level});
     mark(el);if(el)el.onclick=()=>selectDevelop(type,level);
    }
   }
   bar(canConfirm()?'点击确认执行。':!targetReady()?(selectedCard===null?'选择研发板块和弃牌。':'选择要研发的板块。'):'选择一张弃牌。',[],canConfirm());
  }
  if(sale){
   const available=new Set(sale.available),selected=new Set(sale.industries);
   for(const el of all('[data-loc]')){
    const key=`${el.dataset.loc}:${el.dataset.slot}`;
    if(available.has(key)||selected.has(key)){mark(el,selected.has(key));el.onclick=()=>{salePlan.toggleIndustry(key);paint();};}
    else if(v.board[key])el.onclick=()=>api.explain?.(el,{reason:salePlan.blockedReason(key)});
   }
   for(const source of sale.sources){
    const el=resourceElement(source);mark(el,source.picked>0);
    if(el){
     if(source.picked)el.dataset.saleBeer=`${source.picked}/${source.total}`;
     el.onclick=()=>{salePlan.cycleBeer(source.id);paint();};
    }
   }
   const names=sale.industries.map(key=>`${cityName(tileLocation(key))}${ZH[v.board[key].type]}`);
   const label=names.length>0&&names.length<=2?`（${names.join('、')}）`:'';
   const summary=`已选 ${selected.size} 个产业${label} · 啤酒已选 ${sale.picked} / 所需 ${sale.required} 桶`;
   let prompt=selected.size?'调整酒源。':'选择待售产业。';
   if(sale.action)prompt=selectedCard===null?'选择一张弃牌。':'点击确认出售。';
   else if(selected.size&&sale.picked<sale.required)prompt=`还需选择 ${sale.required-sale.picked} 桶啤酒。`;
   else if(selected.size&&sale.picked===sale.required)prompt='调整不匹配的酒源。';
   bar(`${summary} · ${prompt}`,[],canConfirm());
  }
 }
 return {begin,paint,reset,requestChoice,dismissIndustry,failed:()=>{stage='target';resource=null;paint();}};
}
