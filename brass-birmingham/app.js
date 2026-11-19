import {configure,F,TYPES,ZH,cityName,cardName,createGame,current,legalActions,applyAction,publicView,nextTile,tileData,tileLocation,actionLabel,income,clone,estimateEraScore} from './engine.js?v=0.7';
import {selectAI} from './ai.js?v=0.7';
import {Room} from './room.js';
import {createDirectFlow} from './direct-flow.js?v=0.7';
import {boardPieces,routePieces,playerReserve} from './table-pieces.js?v=0.7';

const $=s=>document.querySelector(s),esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#e8bd55','#c284e6','#eb8678','#b3c7d1'],COLOR_NAMES=['yellow','purple','red','gray'];
const STEM={cottonMill:'cotton',coalMine:'coal',ironWorks:'iron',manufacturer:'manufacture',pottery:'pottery',brewery:'beer'};
let state=null,view=null,seat=0,mode='local',room=null,layout,actions=[],cardIndex=0,selectedType='build',selectedLocation=null,aiTimer=null,aiBusy=false,lobby=null,waiting=false;
let choiceAction=null,choiceSeat=0,saveAvailable=false,matSeat=null;
const SAVE='brass-night-save-v1';
const modal=$('#modal');
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showDialog(title,content){$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;if(!modal.open)modal.showModal();}
$('#modal-close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});
function tileUrl(type,level,flipped=false,owner=seat){return `assets/tiles/tile-${COLOR_NAMES[owner]}-${STEM[type]}-${level}${flipped?'-flipped':''}.webp`;}
function cardUrl(c){let key=c.kind==='location'?c.loc.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()):c.kind==='wildLocation'?'wild-location':c.kind==='wildIndustry'?'wild-industry':c.types.length>1?'cotton-manufacture':({ironWorks:'iron',coalMine:'coal',cottonMill:'cotton-manufacture',manufacturer:'cotton-manufacture',brewery:'brewery',pottery:'pottery'}[c.types[0]]);return `assets/cards/card-${key}.webp`;}
function assetFallback(e){e.target.style.opacity='.2';}
document.addEventListener('error',assetFallback,true);
function save(){if(!state)return;try{localStorage.setItem(SAVE,JSON.stringify(state));saveAvailable=true;}catch{toast('本地存档空间不足，请导出存档。');}}
function myTurn(){return view&&!view.gameOver&&current(view)===seat&&!view.players[seat].ai;}
function startLocal(n){room?.destroy();room=null;mode='local';seat=0;matSeat=null;state=createGame([name(),...Array.from({length:n-1},(_,i)=>'规则 AI '+(i+1))],[false,...Array(n-1).fill(true)]);selectedType='build';selectedLocation=null;cardIndex=0;modal.close();update();directFlow.reset();}
function name(){return $('#player-name')?.value?.trim()||$('#player-count').parentElement.previousElementSibling.querySelector('input').value.trim()||'你';}
function count(){return Number($('#player-count').value);}
function update(){
 if(mode!=='guest'){
  view=publicView(state,seat);actions=state.gameOver?[]:legalActions(state,current(state),{allCards:true});save();
  if(mode==='host')for(let s of room.seats)if(s.seat!==0)room.send(s.seat,'snapshot',{state:publicView(state,s.seat),actions:current(state)===s.seat?actions:[],seat:s.seat});
 }
 render();scheduleAI();
}
function render(){
 if(!view)return;$('#lobby-screen')?.remove();$('.lobby').hidden=true;$('main').hidden=false;$('.game-status').hidden=false;
 const p=view.players[seat];if(!p)return;cardIndex=Math.min(cardIndex,Math.max(0,p.hand.length-1));
 $('#round-label').textContent=`第 ${view.round} 轮 · 牌库 ${view.deckCount}张`;$('#round-label').previousElementSibling.textContent=view.era==='canal'?'运河时代 1770–1830':'铁路时代 1830–1870';
 $('#turn-label').textContent=view.gameOver?'对局结束':view.phase==='liquidation'?`${view.players[current(view)].name} 需要变卖产业支付收入欠款`:`${view.players[current(view)].name} 的回合 · 第 ${view.used+1}/${view.era==='canal'&&view.round===1?1:2} 次行动`;
 const estimate=estimateEraScore(view);
 $('#players').innerHTML=view.players.map(p=>`<article class="player ${!view.gameOver&&current(view)===p.id?'active':''}" style="--owner:${COLORS[p.id]}"><b>${esc(p.name)} ${p.id===seat?'<span class="you">你</span>':''}</b><span>${p.vp} VP</span><div class="score-estimate" data-player="${p.id}" title="若本时代现在结束：已得 ${p.vp} + 产业 ${estimate[p.id].industry} + 连接 ${estimate[p.id].links}。计分轨道仅在时代结束时结算。"><strong>预估 ${p.vp+estimate[p.id].industry+estimate[p.id].links} VP</strong><span>已得 ${p.vp} · 待计 ${estimate[p.id].industry+estimate[p.id].links}</span><small>产业 +${estimate[p.id].industry} / 连接 +${estimate[p.id].links}</small></div><div class="stats"><span>现金 £${p.money}</span><span>收入 ${income(p.income)>=0?'+':''}${income(p.income)}</span><span>手牌 ${p.handCount}</span><span>${p.ai?'规则 AI':mode==='local'?'玩家':'在线玩家'}</span></div></article>`).join('');
 $('#market-state').innerHTML=`<span>煤 ${view.coal}/14</span><span>铁 ${view.iron}/10</span><span>商人啤酒 ${view.merchants.filter(m=>m.beer).length}</span>`;
 $('#hand-count').textContent=`${p.hand.length}张 · 确定目标后选择弃牌`;
 $('#hand').innerHTML=p.hand.map((c,i)=>`<button class="card ${cardIndex===i?'selected':''}" data-card="${i}" aria-pressed="${cardIndex===i}" title="${esc(cardName(c))}"><img src="${cardUrl(c)}" alt="${esc(cardName(c))}"><span>${esc(cardName(c))}</span></button>`).join('');
 $('#hand').querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{cardIndex=Number(b.dataset.card);selectedLocation=null;render();});
 const names={build:'建造',network:'铺路',develop:'研发',sell:'出售',loan:'贷款',scout:'侦察',pass:'跳过'};
 $('#action-buttons').innerHTML=Object.entries(names).map(([t,label])=>`<button data-type="${t}" ${!myTurn()||waiting?'disabled':''} class="${selectedType===t?'selected':''}">${label}</button>`).join('');
 $('#action-buttons').querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedType=b.dataset.type;selectedLocation=null;render();openActions(selectedType);});
 $('#action-hint').textContent=view.gameOver?'已完成两时代计分。':!myTurn()?(view.players[current(view)].ai?'规则 AI 正在思考…':'等待其他玩家行动。'):view.phase==='liquidation'?'点击自己的产业，变卖以补足欠款。':'请选择行动，地图和玩家面板会高亮合法目标。';
 $('#ai-hint').disabled=!myTurn()||waiting||mode==='guest';$('#ai-hint').title=mode==='guest'?'联机客人使用相同行动提示，AI建议由房主计算':'';
 $('#log').innerHTML=[...view.log].reverse().slice(0,35).map(t=>`<li>${esc(t)}</li>`).join('');
 renderBoard();renderMat();directFlow.paint();if(view.gameOver&&render.endShown!==view.rev){render.endShown=view.rev;showResults();}
}
function slots(loc){return layout.slots[loc]||[];}
function renderBoard(){
 let html='';for(let [loc,city]of Object.entries({...F.cities,...Object.fromEntries(Object.keys(F.farms).map(k=>[k,{slots:[['brewery']]}]))}))slots(loc).forEach(([x,y],i)=>{
  let key=loc+':'+i,t=view.board[key],label=t?`${cityName(loc)} ${view.players[t.owner].name} ${ZH[t.type]}${t.level}级${t.flipped?'（已翻面）':''}`:`${cityName(loc)} ${city.slots[i]?.map(t=>ZH[t]).join('/')} 空位`;
  html+=`<button class="slot" style="left:${x*100}%;top:${y*100}%;${t?'border:2px solid '+COLORS[t.owner]:''}" data-loc="${loc}" data-slot="${i}" title="${esc(label)}" aria-label="${esc(label)}">${t?`<img style="width:100%;height:100%" src="${tileUrl(t.type,t.level,t.flipped,t.owner)}" alt="">${t.resource?`<span class="industry-resources ${t.type==='brewery'?'beer':''}">${Array.from({length:t.resource},()=>t.type==='brewery'?'<img src="assets/pieces/piece-beer.webp" alt="啤酒">':`<i class="industry-cube ${t.type==='coalMine'?'coal':'iron'}"></i>`).join('')}</span><span class="resource-count">${t.resource}</span>`:''}`:''}</button>`;
 });
 for(let m of view.merchants){let siblings=view.merchants.filter(x=>x.loc===m.loc),idx=siblings.indexOf(m),pos=layout.merchants[m.loc]?.[idx],beer=layout.merchantBeer[m.loc]?.[idx];if(!pos)continue;
  let label=m.buys==='blank'?'空白商人':m.buys==='any'?'接收全部商品':ZH[m.buys];let stem={blank:'2_nothing',any:'2_manufacturecottonpottery',cottonMill:'2_cotton',manufacturer:'2_manufacture',pottery:'3_pottery'}[m.buys];
  html+=`<button class="merchant-tile" style="left:${pos[0]*100}%;top:${pos[1]*100}%" data-merchant="${m.id}" title="${cityName(m.loc)}：${label}${m.beer?'，有啤酒':''}" aria-label="${cityName(m.loc)}${label}"><img src="assets/pieces/piece-merchant-${stem}.webp" alt="${label}"></button>`;
  if(m.beer&&beer)html+=`<img class="merchant-beer" style="left:${beer[0]*100}%;top:${beer[1]*100}%" src="assets/pieces/piece-beer.webp" alt="${cityName(m.loc)}商人啤酒">`;
 }
 for(let pile of layout.decks){let qty=pile.kind==='draw'?view.deckCount:view.wild[pile.kind==='wildLocation'?'location':'industry'];let label=pile.kind==='draw'?'抽牌堆':pile.kind==='wildLocation'?'万能地点牌':'万能产业牌',url=pile.kind==='draw'?'assets/cards/piece-card-back.webp':cardUrl({kind:pile.kind});
  html+=`<button class="board-pile ${qty?'':'pile-empty'}" data-pile="${pile.kind}" style="left:${pile.center[0]*100}%;top:${pile.center[1]*100}%;width:${pile.size[0]*100}%;height:${pile.size[1]*100}%" title="${label}：${qty}张" aria-label="${label}：${qty}张">${qty?`<img src="${url}" alt="${label}">`:''}<span>${label} ${qty}</span></button>`;
 }
 for(let resource of ['coal','iron']){let positions=layout.markets[resource],empty=positions.length-view[resource];for(let i=0;i<positions.length;i++){let [x,y]=positions[i];html+=`<span class="market-cube ${resource} ${i>=empty?'filled':'empty'}" style="left:${x*100}%;top:${y*100}%" title="${resource==='coal'?'煤':'铁'}市场 £${Math.floor(i/2)+1} ${i>=empty?'有货':'空位'}"></span>`;}}
 html+=boardPieces(view,layout)+routePieces(view,layout,F.connections);
 $('#board-tokens').innerHTML=html;
 $('#board-tokens').querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{let loc=b.dataset.loc,i=Number(b.dataset.slot),t=view.board[loc+':'+i];if(view.phase==='liquidation'){if(myTurn()&&t?.owner===seat)confirmAction({type:'liquidate',key:loc+':'+i});return;}if(myTurn()){selectedLocation=loc;openActions(selectedType==='sell'&&t?.owner===seat?'sell':'build',loc,i);}else if(t)toast(`${view.players[t.owner].name} · ${ZH[t.type]} ${t.level}级 · ${t.flipped?'已翻面':'未翻面'}${t.resource?' · 资源'+t.resource:''}`);});
 $('#board-tokens').querySelectorAll('[data-merchant]').forEach(b=>b.onclick=()=>{let m=view.merchants.find(m=>m.id===Number(b.dataset.merchant));toast(`${cityName(m.loc)}：${m.buys==='blank'?'不收商品':m.buys==='any'?'接收所有商品':'接收'+ZH[m.buys]}，${m.beer?'有商人啤酒':'没有商人啤酒'}`);});
 $('#board-tokens').querySelectorAll('[data-pile]').forEach(b=>b.onclick=()=>{if(b.dataset.pile!=='draw'&&myTurn())directFlow.begin('scout');else toast(b.title);});
 $('#route-layer').innerHTML='';
 $('#board-tokens').querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{if(myTurn())openActions('network',null,null,b.dataset.route);else toast(b.title);});
}
function renderMat(){
 let id=matSeat!==null&&view.players[matSeat]?matSeat:seat,p=view.players[id];
 $('#mat-player').innerHTML=view.players.map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${esc(p.name)}${p.id===seat?'（你）':''}</option>`).join('');
 $('#mat-player').onchange=e=>{matSeat=Number(e.target.value);renderMat();directFlow.paint();};
 let html='';for(let type of TYPES)for(let d of F.industries[type]){let [x,y]=layout.playerMat.slots[type][d.level-1],count=p.stacks[type].filter(n=>n===d.level).length,isNext=nextTile(view,id,type)?.level===d.level&&count>0;
  html+=`<button class="mat-tile ${count?'':'depleted'} ${isNext?'next-tile':''}" data-mat-type="${type}" data-level="${d.level}" data-count="${count}" style="left:${x*100}%;top:${y*100}%;--owner:${COLORS[id]}" title="${esc(p.name)} ${ZH[type]} ${d.level}级，剩余${count}块；建造 £${d.cost}${d.costCoal?' 煤'+d.costCoal:''}${d.costIron?' 铁'+d.costIron:''}；${d.vp}VP，收入+${d.income}" aria-label="${ZH[type]}${d.level}级剩余${count}块">${count?`${Array.from({length:count-1},(_,i)=>`<img class="mat-under" style="--depth:${count-1-i}" src="${tileUrl(type,d.level,false,id)}" alt="">`).join('')}<img src="${tileUrl(type,d.level,false,id)}" alt="">`:''}<span class="mat-count">${count}</span>${isNext?'<span class="mat-next">下一块</span>':''}</button>`;
 }
 $('#mat-tokens').innerHTML=html;
 $('#player-reserve').innerHTML=playerReserve(p,view.era);
 $('#mat-tokens').querySelectorAll('button').forEach(b=>b.onclick=()=>{let type=b.dataset.matType;if(id===seat&&myTurn()&&Number(b.dataset.level)===nextTile(view,id,type)?.level)openActions('build',null,null,null,type);else toast(b.title);});
 $('#mat-stacks').innerHTML=TYPES.map(type=>{let d=nextTile(view,id,type),n=p.stacks[type].length;return `<div class="stack-summary"><strong>${ZH[type]}</strong><span>${d?`下一块 ${d.level}级 · 共余${n}块`:'已用完'}</span></div>`;}).join('');
}
function available(type,loc=null,slot=null,edge=null){
 return actions.filter(a=>a.type===type&&(a.type!=='build'||a.card===cardIndex)&&(!loc||a.type==='build'&&a.loc===loc&&(slot===null||a.slot===slot)||a.type==='sell'&&a.sales.some(x=>tileLocation(x.key)===loc))&&(!edge||a.edges.includes(edge)));
}
function openActions(type,loc=null,slot=null,edge=null,industry=null){
 if(!myTurn())return;let list=available(view.phase==='liquidation'?'liquidate':type,loc,slot,edge).filter(a=>!industry||a.industry===industry);
 if(!list.length){toast(type==='build'?'这里没有匹配当前手牌、网络、时代与资源条件的建造。请选择其他手牌或产业位。':'当前没有合法的此类行动。');return;}
 if(['loan','pass','scout'].includes(type)){let a={...list[0],card:cardIndex};if(type==='scout'){scoutDialog(a);return;}confirmAction(a);return;}
 showDialog(({build:'建造产业',network:'铺设连接',develop:'研发产业',sell:'出售商品',liquidate:'支付欠款'})[type]||'选择行动',`<p class="modal-note">使用：${esc(cardName(view.players[seat].hand[cardIndex]||{kind:'wildLocation'}))}。${type==='develop'?'研发可移除1至2块，组合按顺序执行。':type==='network'?'单铁路 £5；双铁路 £15，另耗2煤和1啤酒。':type==='sell'?'可选择单个产业，或自行组合多个产业在同一行动出售。':''}</p><div class="option-list">${list.map((a,i)=>`<button data-option="${i}">${esc(actionLabel(a))}${a.type==='sell'?`<small>售往 ${cityName(view.merchants.find(m=>m.id===a.sales[0].merchant).loc)}</small>`:''}${a.type==='build'?`<small>基础 £${nextTile(view,seat,a.industry).cost}，另支付所需市场资源费用</small>`:''}</button>`).join('')}</div>${type==='sell'?'<button id="multi-sell" class="wide" style="margin-top:15px">组合出售多个产业</button>':''}`);
 $('#modal-content').querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>{let a=clone(list[Number(b.dataset.option)]);if(a.type!=='build'&&a.type!=='liquidate')a.card=cardIndex;confirmAction(a);});if($('#multi-sell'))$('#multi-sell').onclick=multiSell;
}
function multiSell(){let list=available('sell'),keys=[...new Set(list.flatMap(a=>a.sales.map(x=>x.key)))];showDialog('组合出售',`<p class="modal-note">勾选产业并为每个产业选择商人。所需啤酒会按顺序结算。</p>${keys.map((key,i)=>`<div class="form-row"><label><input type="checkbox" data-sale="${i}"> ${cityName(tileLocation(key))} ${ZH[view.board[key].type]}</label><select data-sale-merchant="${i}">${list.filter(a=>a.sales[0].key===key).map(a=>`<option value="${a.sales[0].merchant}">${cityName(view.merchants.find(m=>m.id===a.sales[0].merchant).loc)}</option>`).join('')}</select></div>`).join('')}<button id="sell-confirm" class="primary wide">确认出售</button>`);$('#sell-confirm').onclick=()=>{let sales=keys.flatMap((key,i)=>$(`[data-sale="${i}"]`).checked?[{key,merchant:Number($(`[data-sale-merchant="${i}"]`).value)}]:[]);if(!sales.length){toast('至少选择一个产业');return;}submit({type:'sell',card:cardIndex,sales});};}
function scoutDialog(a){showDialog('侦察：额外弃两张牌',`<p class="modal-note">本次行动共弃3张牌，换取两张万能牌。</p>${view.players[seat].hand.map((c,i)=>i===cardIndex?'':`<label class="choice-card"><input type="checkbox" value="${i}" name="scout">${esc(cardName(c))}</label>`).join('')}<button id="scout-confirm" class="primary wide">确认侦察</button>`);$('#scout-confirm').onclick=()=>{let extra=[...document.querySelectorAll('[name=scout]:checked')].map(x=>Number(x.value));if(extra.length!==2){toast('请选择额外两张手牌');return;}submit({...a,extra});};}
function confirmAction(a){showDialog('确认行动',`<p>${esc(actionLabel(a))}</p><p class="modal-note">${a.type==='pass'?'跳过也会弃1张牌。':a.type==='liquidate'?'产业将从棋盘移除，获得其建造现金成本的一半（向下取整）。':'本次行动使用选中的手牌；提交前会核对所有资源和费用。'}</p><button id="confirm-action" class="primary wide">确认执行</button>`);$('#confirm-action').onclick=()=>submit(a);}
function submit(a){
 if(waiting)return;if(mode==='guest'){try{waiting=true;room.command(view.rev,a);modal.close();render();}catch(e){waiting=false;toast(e.message);}return;}
 execute(seat,a);
}
function execute(id,a){
 let result=applyAction(state,id,a,{auto:state.players[id]?.ai});
 if(!result.ok){if(result.choice){if(id===seat)choiceDialog(a,result.choice);else room?.send(id,'choice',{action:a,choice:result.choice});}else if(id===seat){toast(result.error);directFlow.failed();}else room?.error(id,result.error);return;}
 state=result.state;cardIndex=0;selectedLocation=null;if(id===seat)modal.close();update();
}
function choiceDialog(a,choice){modal.close();waiting=false;directFlow.requestChoice(a,choice);}
function scheduleAI(){
 clearTimeout(aiTimer);if(mode==='guest'||!state||state.gameOver||!state.players[current(state)].ai)return;
 aiTimer=setTimeout(()=>{if(aiBusy)return;aiBusy=true;try{let id=current(state),a=selectAI(state,id);if(a)execute(id,a);else toast('AI没有找到行动，请导出存档反馈。');}catch(e){toast('AI执行失败：'+e.message);}finally{aiBusy=false;scheduleAI();}},550);
}
function showResults(){showDialog('两时代结算',`<p>${view.winners.map(id=>esc(view.players[id].name)).join('、')} 获胜</p><div class="option-list">${[...view.players].sort((a,b)=>b.vp-a.vp).map(p=>`<p>${esc(p.name)}：${p.vp} VP · 收入${income(p.income)} · £${p.money}</p>`).join('')}</div><p class="modal-note">${view.scores.map(s=>(s.era==='canal'?'运河':'铁路')+'：'+s.points.map((p,i)=>view.players[i].name+' 产业'+p.industry+' / 连接'+p.links).join('，')).join('<br>')}</p>`);}
function help(){showDialog('玩法与测试说明',`<div class="help-content"><p>夜间棋盘、2–4人、运河与铁路两个时代。得分最高者获胜。</p><h3>操作顺序</h3><p>先选择行动，再点击地图或玩家面板高亮目标；确定目标后，在悬浮手牌框选择弃牌。研发直接点击玩家面板，连接直接点击线路，销售直接点击产业、商人和啤酒来源。只有建造要求对应地点牌或产业牌；其他行动可弃任意牌。每次行动弃1张，首轮每人1次，其后2次；回合结束补到8张。</p><h3>运输与资源</h3><p>煤必须从相连且最近的煤矿取用，没有相连煤矿时须接通任意商人地点才能从市场购买。铁无需运输，先取棋盘铁厂，再买市场。自己的啤酒无需连接，对手啤酒须连接；商人啤酒只能用于向该商人出售。</p><h3>六种行动</h3><p>建造最低级产业；铺路扩展网络；研发移除1–2块并耗铁；出售相连商人收购的商品并耗啤酒；贷款£30、收入下降3级；侦察弃3张换2张万能牌。也可弃牌跳过。</p><h3>时代结算</h3><p>产业翻面立即提升收入，时代结束按翻面产业和连接计分。运河后移除所有一级产业及运河；二级以上保留。铁路时代每条铁路耗煤，双铁路另需啤酒。最终轮不领取收入。</p><h3>联机测试</h3><p>房主创建房间，将8位房间码或邀请链接发给朋友。2–4人均可，未入座的位置可由规则AI补齐。房主需要保持页面开启。断线客人用原浏览器标签重连；房主离线后对局不能继续同步。</p><p>使用 WebRTC 与公共 PeerJS 信令服务，部分校园网、公司网或严格 NAT 可能无法直连。测试版由房主裁判；不含账号、排名和反作弊服务。AI是启发式规则AI，可完成两时代对局。</p><p><a href="rules.pdf" target="_blank" rel="noopener">打开官方英文规则</a></p></div>`);}
async function host(){
 try{room?.destroy();room=new Room(roomEvent);mode='host';state=null;view=null;seat=0;showDialog('正在创建房间','<p class="modal-note">正在连接房间服务…</p>');await room.create(name(),count());}catch(e){toast(e.message);showDialog('房间连接失败',`<p class="error">${esc(e.message)}</p><p class="modal-note">可以关闭后使用本地规则 AI 对战。</p>`);}
}
function joinDialog(code=''){showDialog('加入房间',`<p class="modal-note">输入朋友分享的8位房间码。房主需要保持页面开启。</p><div class="form-row"><input id="room-input" maxlength="8" value="${esc(code)}" placeholder="8位房间码" aria-label="房间码"><button id="join-confirm" class="primary">加入</button></div>`);$('#join-confirm').onclick=async()=>{let c=$('#room-input').value;try{room?.destroy();room=new Room(roomEvent);mode='guest';state=null;view=null;showDialog('正在加入','<p>正在连接房主…</p>');await room.join(c,name());}catch(e){toast(e.message);joinDialog(c);}};}
function roomEvent(type,data){
 if(type==='lobby'){lobby=data;if(!data.started)renderLobby();else if(view)render();}
 if(type==='seat'){seat=data;}
 if(type==='snapshot'){view=data.state;seat=data.seat;actions=data.actions;waiting=false;choiceAction=null;$('#connection-status').textContent='联机房间 '+room.code;if(modal.open&&['联机房间','正在加入','确认行动'].includes($('#modal-title').textContent)||modal.open&&$('#modal-title').textContent.startsWith('选择'))modal.close();render();}
 if(type==='choice'){waiting=false;choiceDialog(data.action,data.choice);}
 if(type==='action'){
  if(!state||data.rev!==state.rev){room.error(data.seat,'对局已更新，请使用最新局面重新行动');if(state)room.send(data.seat,'snapshot',{state:publicView(state,data.seat),actions:current(state)===data.seat?actions:[],seat:data.seat});return;}
  execute(data.seat,data.action);
 }
 if(type==='reconnect'&&state)room.send(data,'snapshot',{state:publicView(state,data),actions:current(state)===data?actions:[],seat:data});
 if(type==='error'){waiting=false;toast(data);directFlow.failed();if(view)render();}
 if(type==='status'){$('#connection-status').textContent=data;toast(data);}
}
function renderLobby(){
 if(!lobby)return;$('#connection-status').textContent='联机房间 '+lobby.code;let invite=location.origin+location.pathname+'?room='+lobby.code;
 showDialog('联机房间',`<div class="room-code">${esc(lobby.code)}</div><p class="modal-note">分享房间码邀请朋友。总计${lobby.count}人，空位可由规则AI补齐。</p><ul class="room-seats">${Array.from({length:lobby.count},(_,i)=>{let s=lobby.seats.find(s=>s.seat===i);return `<li style="color:${COLORS[i]}">${i+1}号位：${s?esc(s.name)+(s.online?' · 已连接':' · 离线'):'等待加入 / 开始时由 AI 补位'}</li>`;}).join('')}</ul><button id="copy-invite" class="wide">复制邀请链接</button>${room.isHost?'<button id="room-start" class="primary wide">开始对局（空位由 AI 补齐）</button>':'<p class="modal-note">等待房主开始。请保持此页面开启。</p>'}`);
 $('#copy-invite').onclick=()=>navigator.clipboard.writeText(invite).then(()=>toast('邀请链接已复制'),()=>toast(invite));
 if($('#room-start'))$('#room-start').onclick=()=>{if(lobby.seats.some(s=>!s.online)){toast('请等待离线玩家重连后开始');return;}let names=[],ai=[];for(let i=0;i<lobby.count;i++){let s=lobby.seats.find(s=>s.seat===i);names.push(s?s.name:'规则 AI '+(i+1));ai.push(!s);}state=createGame(names,ai);seat=0;mode='host';room.started=true;room.broadcastLobby();modal.close();update();};
}
function menu(){showDialog('对局菜单',`<div class="option-list">${view?'<button id="export-btn">导出对局存档</button>':''}${mode==='guest'?'<button id="reconnect-btn">重新连接房主</button>':''}${view?.gameOver?'<button id="results-btn">查看最终结算</button>':''}<button id="back-btn">返回开局界面</button></div><p class="modal-note">本地及房主对局自动存档。联机客人不保存其他玩家的手牌。</p>`);if($('#export-btn'))$('#export-btn').onclick=()=>{let data=mode==='guest'?view:state,blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='brass-night-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('存档已导出');};if($('#reconnect-btn'))$('#reconnect-btn').onclick=()=>{room.connect();modal.close();};if($('#results-btn'))$('#results-btn').onclick=showResults;$('#back-btn').onclick=()=>{clearTimeout(aiTimer);room?.destroy();room=null;state=null;view=null;directFlow.reset();mode='local';$('main').hidden=true;$('.lobby').hidden=false;$('#connection-status').textContent='本地对局';$('#resume-btn').hidden=!saveAvailable;modal.close();};}
$('#ai-start').onclick=()=>startLocal(count());$('#host-btn').onclick=host;$('#join-btn').onclick=()=>joinDialog();$('#help-btn').onclick=help;$('#menu-btn').onclick=menu;
$('#zoom-btn').onclick=()=>{document.body.classList.toggle('board-focus');$('#zoom-btn').textContent=document.body.classList.contains('board-focus')?'返回同屏布局':'放大棋盘';};
$('#mat-preview').onclick=()=>showDialog('夜间玩家面板','<img class="modal-image" src="assets/player-mat-night.webp?v=0.2" alt="完整夜间玩家面板"><p class="modal-note">实际剩余板块以对局下方产业面板为准。</p>');
$('#ai-hint').onclick=()=>{if(!state||!myTurn())return;toast('正在计算建议…');setTimeout(()=>{let a=selectAI(state,seat);if(a){showDialog('规则 AI 建议',`<p>${esc(actionLabel(a))}</p><p class="modal-note">按可得分产业、收入、运输网络与现金评估；建议不保证最优。</p><button id="use-hint" class="primary wide">采用建议</button>`);$('#use-hint').onclick=()=>{cardIndex=a.card||0;submit(a);};}},20);};
$('#resume-btn').onclick=()=>{try{let s=JSON.parse(localStorage.getItem(SAVE));if(s.version!==1||!s.players||!s.deck)throw Error('存档格式不支持');state=s;mode='local';room?.destroy();room=null;seat=0;for(let p of state.players)if(p.id!==seat&&!p.ai)p.ai=true;update();}catch(e){toast(e.message);}};
async function init(){
 $('main').hidden=true;$('#ai-start').disabled=true;try{let [f,l]=await Promise.all([fetch('facts.json').then(r=>r.json()),fetch('layout.json?v=0.7').then(r=>r.json())]);configure(f);layout=l;$('#ai-start').disabled=false;saveAvailable=!!localStorage.getItem(SAVE);$('#resume-btn').hidden=!saveAvailable;let code=new URLSearchParams(location.search).get('room');if(code)joinDialog(code);}catch(e){toast('加载游戏失败，请刷新：'+e.message);}
}
document.querySelector('.sidebar').appendChild($('#flow-bar'));
const directFlow=createDirectFlow({view:()=>view,seat:()=>seat,myTurn,actions:()=>actions,submit,showMyMat:()=>{matSeat=seat;renderMat();}});
$('#hand-toggle').onclick=()=>{let panel=$('#hand-float');panel.classList.toggle('collapsed');$('#hand-toggle').textContent=panel.classList.contains('collapsed')?'展开手牌':'收起手牌';};
init();
