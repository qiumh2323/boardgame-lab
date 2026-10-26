import {DemoGame, cells, key, cards} from './demo.mjs?v=20261007-stork-corrected';
import {maps, bonusNames} from './maps.mjs';
import {chooseDecision,applyDecision} from './ai_policy.mjs';
import {collectComputerPickups} from './pickup_events.mjs';
const $ = s => document.querySelector(s);
function askConfirm(message){return new Promise(resolve=>{const dialog=$('#lab-confirm');$('#lab-confirm-message').textContent=message;let done=false;const finish=value=>{if(done)return;done=true;dialog.close();resolve(value);};$('#lab-confirm-no').onclick=()=>finish(false);$('#lab-confirm-yes').onclick=()=>finish(true);dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();});}
import {label, tileName, describe} from './zh.mjs';
import {availableSupportMarkers, endTurnOpportunities} from './turn_opportunities.mjs';
import {refillKeyframes} from './market_visuals.mjs';
import {scorePlayer} from './scoring.mjs';
import {createMatchRecord,appendMatchEvent,saveMatchRecord,listMatchRecords,
  deleteMatchRecord,replayStates,exportMatchRecord,clearMatchRecords,restoreClearedMatchRecords,
  flushMatchRecords,hasPendingMatchWrites} from './match_records.mjs?v=20261007-durable-records';
const upgradeConditions = ['支持至少 1 项保护目标','放置至少 2 个项目','3 个同类栖息地图标相连','拥有至少 4 种动物图标'];
const iconGroups = [['动物',['predator','herbivore','bird','reptile','primate','pet']],['大洲',['africa','asia','europe','americas','australia']],['栖息地与版块',['rock','water','forest','building','project']]];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function scoringText(s) {
  if (!s) return '—';
  if (s.type === 'fixed') return `${s.points} 分`;
  if (s.type === 'per-hand-tile') return `每张剩余手牌 ${s.multiplier} 分`;
  if (s.attribute === 'open') return `每个${s.connected ? '连通的' : ''}开放区域 ${s.multiplier} 分`;
  if (s.type === 'pet-set') return Object.entries(s.table).map(([n,p]) => `${n} 只宠物：${p} 分`).join('；');
  if (s.type === 'per-adjacent-icon') return `每个相邻${s.attribute === 'different' ? '不同图标' : label(s.attribute)} ${s.multiplier} 分`;
  return `每个${s.connected ? '连通的' : ''}${label(s.attribute)}图标 ${s.multiplier} 分`;
}
const habitat = t => t.kind === 'animal' ? t.habitats?.[0] || 'forest' : t.kind;
const art = id => `assets/tiles/${String(id).padStart(3, '0')}.webp`;
let game, catalog, selected = null, action = null, upgradeCondition = null, viewing = 0, timer = null, toastTimer, history = [], scoreDialogShown = false;
let aiRequestToken=0,aiFailed=false,aiPickupStatusTimer,finishReminderArmed=false;
let matchMode='menu',localSeat=0,aiSimulations=0,currentRecord=null;
let room=null,roomPollTimer=null,onlineSyncing=false;
let replayMode=false,currentReplay=null,replayIndex=0,replayTimer=null;
const isLocalTurn=()=>game&&game.current===localSeat;
const playerLabel=seat=>seat===localSeat?'你':matchMode==='local'?'电脑':'对手';
const mapSideLabel=sides=>Array.isArray(sides)?(sides[0]===sides[1]?`${sides[0]} 面（双方相同）`:`玩家 1：${sides[0]} 面 · 玩家 2：${sides[1]} 面`):`${sides} 面`;
function resolveMapChoice(choice){
  if(choice==='RANDOM_SAME'){const side=Math.random()<.5?'A':'B';return[side,side];}
  if(choice==='RANDOM_INDEPENDENT')return[Math.random()<.5?'A':'B',Math.random()<.5?'A':'B'];
  return[choice,choice];
}
const latestActionLabel=(before,after)=>after.logs?.[0]!==before.logs?.[0]?after.logs[0]:`${playerLabel(before.current)}完成了${label(before.phase)}`;
function persistRecord(){
  if(!currentRecord)return Promise.resolve();
  return saveMatchRecord(currentRecord).catch(error=>{
    $('#match-notice').textContent=`回放保存异常：${error.message}。请勿关闭页面。`;
    toast(`对局记录保存失败：${error.message}`);
    throw error;
  });
}
function recordState(before,after,{kind='action',label:description=null,decision=null,search=null,actor=before.current}={}){
  if(!currentRecord||replayMode||JSON.stringify(before)===JSON.stringify(after))return;
  appendMatchEvent(currentRecord,{actor,kind,label:description||latestActionLabel(before,after),decision,search,state:after});
  return persistRecord();
}
function stopTimers(){clearTimeout(timer);clearTimeout(aiPickupStatusTimer);clearInterval(roomPollTimer);clearInterval(replayTimer);timer=null;roomPollTimer=null;replayTimer=null;}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
function showPickup(pickups) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  pickups.forEach(({id,from},index) => {
    const target=[...document.querySelectorAll('#hand [data-id]')].find(tile=>tile.dataset.id===id);
    if (!target) return;
    target.classList.add('just-picked');
    setTimeout(()=>target.classList.remove('just-picked'),900);
    if (reduced || !from) return;
    const end=target.getBoundingClientRect(),flight=document.createElement('img');
    flight.className='pickup-flight';flight.src=art(id);flight.alt='';
    flight.style.left=`${from.left+from.width/2-28}px`;
    flight.style.top=`${from.top+from.height/2-28}px`;
    document.body.append(flight);
    flight.animate([
      {transform:'translate(0,0) scale(.75)',opacity:.95},
      {transform:`translate(${end.left+end.width/2-from.left-from.width/2}px,${end.top+end.height/2-from.top-from.height/2}px) scale(1.2)`,opacity:0}
    ],{duration:520,delay:index*75,easing:'ease-out'}).finished.then(()=>flight.remove(),()=>flight.remove());
  });
}
function showComputerPickups(pickups, origins, token) {
  if (!pickups.length) return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const status=$('#ai-pickup-status');
  pickups.forEach((pickup,index)=>setTimeout(()=>{
    if(token!==aiRequestToken)return;
    const source=pickup.source==='market'?'展示区':'牌库';
    const privateDraw=pickup.source==='deck';
    const name=privateDraw?'一张背面版块':tileName(game.tiles[pickup.id]);
    status.hidden=false;
    status.innerHTML=`<img src="${privateDraw?'assets/open-area.webp':art(pickup.id)}" alt=""><span>电脑从${source}拿取了<strong>${esc(name)}</strong></span>`;
    clearTimeout(aiPickupStatusTimer);
    aiPickupStatusTimer=setTimeout(()=>{status.hidden=true;},3300);
    const target=viewing===1 ? $('#hand') : $('#ai-map');
    target.classList.add('ai-pickup-arrived');
    setTimeout(()=>target.classList.remove('ai-pickup-arrived'),900);
    if(reduced)return;
    const origin=pickup.source==='market' ? origins.market[pickup.index]||origins.deck : origins.deck;
    const destination=target.getBoundingClientRect();
    if(!origin)return;
    const visibleX=x=>Math.max(35,Math.min(innerWidth-35,x));
    const visibleY=y=>Math.max(35,Math.min(innerHeight-35,y));
    const x=visibleX(origin.left+origin.width/2),y=visibleY(origin.top+origin.height/2);
    const endX=visibleX(destination.left+destination.width/2),endY=visibleY(destination.top+destination.height/2);
    const flight=document.createElement('img');
    flight.className='pickup-flight ai-pickup-flight';flight.src=privateDraw?'assets/open-area.webp':art(pickup.id);flight.alt='';
    flight.style.left=`${x-28}px`;flight.style.top=`${y-28}px`;document.body.append(flight);
    flight.animate([{transform:'translate(0,0) scale(.8)',opacity:1},{transform:`translate(${endX-x}px,${endY-y}px) scale(1.18)`,opacity:0}],{duration:700,easing:'ease-out'}).finished.then(()=>flight.remove(),()=>flight.remove());
  },index*520));
}
function marketLayout() {
  return new Map([...document.querySelectorAll('#market [data-id]')].map(tile=>[tile.dataset.id,tile.getBoundingClientRect()]));
}
function animateMarketChange(previousMarket, previousLayout) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const previousIds=new Set(previousMarket.filter(Boolean).map(String));
  let refillIndex=0;
  [...document.querySelectorAll('#market [data-id]')].forEach((tile,index)=>{
    const id=tile.dataset.id,from=previousLayout.get(id),to=tile.getBoundingClientRect();
    if(from){
      const x=from.left-to.left,y=from.top-to.top;
      if(Math.abs(x)>1||Math.abs(y)>1) tile.animate([
        {transform:`translate(${x}px,${y}px)`,zIndex:6,boxShadow:'0 8px 24px #203a3030'},
        {transform:'translate(0,0)',zIndex:1,boxShadow:'0 0 0 transparent'}
      ],{duration:430,delay:index*28,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'});
    } else if(!previousIds.has(id)) {
      tile.animate(refillKeyframes(getComputedStyle(tile).opacity),
        {duration:380,delay:240+refillIndex++*110,easing:'cubic-bezier(.2,.75,.25,1)',fill:'backwards'});
    }
  });
}
function attempt(fn, record = true) {
  if(replayMode||onlineSyncing)return false;
  finishReminderArmed=false;
  const before=game.snapshot(), ui={selected,action,upgradeCondition,viewing};
  const previousMarketLayout=marketLayout();
  try {
    fn();
    const after=game.snapshot();
    const gained=before.current===localSeat ? after.players[localSeat].hand.filter(id=>!before.players[localSeat].hand.includes(id)) : [];
    const pickups=gained.map(id=>({id,from:(before.market.includes(id)
      ? [...document.querySelectorAll('#market [data-id]')].find(tile=>tile.dataset.id===id)
      : $('#deck-count'))?.getBoundingClientRect()}));
    if (record && before.current===localSeat && JSON.stringify(before)!==JSON.stringify(after)) {
      history.push({state:before,ui});
      if (history.length>80) history.shift();
    }
    if(record)recordState(before,after)?.catch(()=>{});
    render(); animateMarketChange(before.market,previousMarketLayout);
    if (pickups.length) showPickup(pickups);
    if(record&&matchMode==='online')pushOnlineState(before,after);
    return true;
  } catch (e) {
    game.restore(before); ({selected,action,upgradeCondition,viewing}=ui);
    render(); toast(e.message);
    return false;
  }
}
function tileHTML(id, index, source) {
  const slot=source==='market'?String(index+1).padStart(2,'0'):'';
  if (!id) return `<div class="tile unavailable empty-hand" data-slot="${slot}">已拿取</div>`;
  const t=game.tiles[id];
  const placementPlayable=game.canPlay(id,action)&&game.spaces(id).length>0;
  const marketChoiceActive=source==='market'&&viewing===game.current&&(game.phase==='draft'||game.phase==='action'&&action==='projects'||game.phase==='second-project'||game.phase==='bonus'&&['market','building','animal'].includes(game.pendingBonus)||game.phase==='effect'&&game.pendingEffect.type==='market');
  const marketEligible=source==='market'&&(game.phase==='draft'&&index<game.reachable()||game.phase==='action'&&action==='projects'||game.phase==='second-project'||game.phase==='bonus'&&(game.pendingBonus==='market'||game.pendingBonus==='building'&&t.kind==='building'||game.pendingBonus==='animal'&&t.kind==='animal')||game.phase==='effect'&&game.pendingEffect.type==='market'&&game.marketEffectEligible(id,game.pendingEffect.kind));
  const available=source!=='ai-hand'&&viewing===localSeat&&game.current===localSeat&&!replayMode&&!onlineSyncing&&(source==='market'
    ? marketEligible
    : source==='reveal'
      ? game.phase==='effect'&&game.pendingEffect.type==='choose-animal'&&t.kind==='animal'
      : placementPlayable||game.phase==='effect'&&(['pouch','statue-discard'].includes(game.pendingEffect.type)||game.pendingEffect.type==='open-cost'&&Boolean(game.pendingEffect.selectedTarget)));
  const handChoiceActive=game.phase==='action'&&Boolean(action)||game.phase==='second-animal'||game.phase==='building';
  const visuallyUnavailable=source==='hand'
    ? handChoiceActive&&!available
    : source==='market' ? marketChoiceActive&&!marketEligible : !available;
  const discard = source === 'hand' && game.current === localSeat && game.phase === 'building' && game.player.hand.length > 6 && !replayMode ? `<button class="discard-tile" data-discard="${id}" aria-label="弃置 ${esc(tileName(t))}">弃置</button>` : '';
  const required=source==='hand'&&game.current===localSeat&&t.kind==='project'?game.effectiveLevel(t):t.level;
  return `<article class="tile ${habitat(t)} ${available ? 'selectable' : ''} ${visuallyUnavailable ? 'unavailable' : ''} ${source==='hand'&&selected === id ? 'selected' : ''}" data-id="${id}" data-source="${source}" data-index="${index}" data-slot="${slot}" tabindex="0" role="button" aria-label="${esc(tileName(t))}，${label(t.kind)}，等级 ${t.level}${required<t.level?`，当前需 ${required}强度`:''}"><div class="tile-top"><span>${label(t.kind)} · ${t.level ? `等级 ${t.level}${required<t.level?` · 需${required}强度`:''}` : '额外放置'}</span><span>#${id}</span></div><button class="info" data-detail="${id}" aria-label="查看 ${esc(tileName(t))} 详情">ⓘ</button>${discard}<div class="tile-art"><img src="${art(id)}" alt="${esc(tileName(t))}" loading="lazy"></div><div class="tile-name">${esc(tileName(t))}</div>${source === 'market' ? `<div class="tile-position"><span>0${index + 1}</span><span>${available ? '可拿取 ↗' : '展示位'}</span></div>` : ''}</article>`;
}
function hiddenHandTile(index) {
  return `<article class="tile hand-back" aria-label="电脑手牌第 ${index+1} 张，牌面未公开"><img src="assets/open-area.webp" alt="版块背面"><span>未知版块 ${index+1}</span></article>`;
}
function render() {
  const roomReady=matchMode!=='online'||(room?.players||0)>=2;
  const human = game.current === localSeat && !replayMode && !onlineSyncing && roomReady, active = human && game.phase !== 'ended';
  $('#round').textContent = String(Math.max(1,game.turn)).padStart(2, '0');
  $('#turn').textContent = game.phase === 'ended' ? '对局结束' : human ? '你的回合' : replayMode?'回放中':matchMode==='online'?'等待对手…':'电脑思考中…';
  $('#market').innerHTML = game.market.map((id, i) => tileHTML(id, i, 'market')).join('');
  const marketTile=$('#market .tile');
  if(marketTile) document.documentElement.style.setProperty('--market-tile-width',`${marketTile.getBoundingClientRect().width}px`);
  const viewPlayer=game.players[viewing],shownHand=viewPlayer.hand;
  const viewingOpponent=viewing!==localSeat;
  $('#hand-title').textContent=viewingOpponent?(matchMode==='local'?'电脑手牌':'对手手牌'):'我的手牌';
  $('#hand-hint').textContent=viewingOpponent?'对方手牌仅显示背面与数量':'点击版块选择；点击右上角 ⓘ 查看大图';
  $('#hand').innerHTML = shownHand.length ? viewingOpponent ? shownHand.map((_,i)=>hiddenHandTile(i)).join('') : shownHand.map((id,i)=>tileHTML(id,i,'hand')).join('') : `<div class="empty-hand">${viewingOpponent?'对方当前没有手牌':'你的保护区，从第一张版块开始。'}<small>${viewingOpponent?'对方拿牌后会显示在这里':'在上方展示区选择一张可拿取的版块'}</small></div>`;
  $('#hand-count').textContent = `${shownHand.length} / 6`;
  const upgrades=game.availableUpgrades(viewPlayer);
  if (viewing===localSeat&&!upgrades.includes(upgradeCondition)) upgradeCondition=null;
  const canUpgrade=viewing===localSeat&&human&&game.phase==='building'&&upgradeCondition!==null&&viewPlayer.cards.some(c=>!viewPlayer.upgraded.includes(c));
  const actionUsable=viewing===localSeat&&active&&(game.phase==='action'||game.phase==='bonus'&&game.pendingBonus==='shift'||game.phase==='effect'&&game.pendingEffect.type==='shift');
  $('#actions').innerHTML = viewPlayer.cards.map((c, i) => {const upgraded=viewPlayer.upgraded.includes(c),strength=i+1+(upgraded?1:0),upgradeTarget=canUpgrade&&!upgraded;return `<button class="action-card ${viewing===localSeat&&action===c ? 'active' : ''} ${upgradeTarget?'upgrade-ready':''}" data-action="${c}" ${actionUsable||upgradeTarget?'':'disabled'} aria-label="${label(c)}行动，强度 ${strength}${upgraded?'，已升级':''}${upgradeTarget?'，点击升级':''}"><img src="assets/action-${c}${upgraded?'-II':''}.webp" alt="${label(c)}行动牌" loading="lazy"></button>`;}).join('');
  const counts=game.iconCounts(viewPlayer);
  const viewMap=game.mapFor(viewing),viewMapSide=game.mapSideFor(viewing);
  const liveScore=scorePlayer(viewPlayer,game.tiles,viewMap);
  $('#live-score').innerHTML=`<span>${viewingOpponent?(matchMode==='local'?'电脑':'对手'):'我的'}实时计分</span><strong>${liveScore.total}</strong><small>动物 ${liveScore.animalPoints} · 建筑 ${liveScore.buildingPoints} · 项目 ${liveScore.projectPoints} · 目标 ${liveScore.achievements}</small>`;
  $('#icon-inventory-title').textContent=viewingOpponent?(matchMode==='local'?'电脑的标记':'对手的标记'):'我的标记';
  $('#icon-inventory').innerHTML=iconGroups.map(([group,keys])=>`<div class="icon-group"><strong>${group}</strong><div>${keys.map(name=>{const count=counts[name]||0;return `<span class="icon-count ${count?'has-icon':'no-icon'}" title="${label(name)}图标 ${count} 个" aria-label="${label(name)}图标 ${count} 个"><img src="assets/objective-icons/${name}.webp?v=20260923-ux8" alt=""><span class="icon-count-tooltip">${label(name)}：${count} 个</span></span>`;}).join('')}</div></div>`).join('');
  $('#objective-owner').textContent=viewingOpponent?'对方的目标状态':'我的目标状态';
  $('#objectives').innerHTML = game.objectives.map(o => {const achieved=viewPlayer.achievements[o.objective_id],have=counts[o.icon]||0;const choices=new Set(viewing===localSeat&&human&&game.phase==='building'?availableSupportMarkers(game,viewPlayer,o):[]);const progress=achieved?'':`<div class="objective-progress" role="group" aria-label="当前拥有 ${have} 个${esc(label(o.icon))}图标">${Array.from({length:5},(_,i)=>{const n=i+1,spend=Math.max(0,n-have),points=({2:5,3:7,4:10,5:14})[n];return choices.has(n)?`<button data-objective="${o.objective_id}" data-marker="${n}" class="${i<have?'filled':''}" title="支持至 ${n} 个图标，获得 ${points} 分${spend?`，消耗 ${spend} 个保护标记`:'，无需消耗保护标记'}" aria-label="支持至 ${n} 个图标，获得 ${points} 分${spend?`，消耗 ${spend} 个保护标记`:''}">${n}</button>`:`<i class="${i<have?'filled':''}"></i>`;}).join('')}</div>`;return `<div class="objective"><img class="objective-icon" src="assets/objective-icons/${o.icon}.webp?v=20260922-ux4" alt="${esc(label(o.icon))}图标"><div><span>${label(o.icon)}</span>${progress}</div><small class="objective-status ${achieved?'done':''}">${achieved ? `已支持 ${achieved} 图标` : `${Math.min(have,5)} / 5`}</small></div>`;}).join('');
  const unupgraded=cards.filter(c=>!viewPlayer.upgraded.includes(c));
  $('#upgrade-options').innerHTML=`<div class="upgrade-heading"><strong>${viewingOpponent?'对方':'我的'}行动牌升级</strong><span>${canUpgrade ? '已选条件：点击上方高亮的行动牌完成升级' : viewingOpponent?'查看对方未使用的升级条件':'先点击已完成的升级条件牌，再点击上方行动牌'}</span></div><div class="upgrade-conditions">${upgradeConditions.flatMap((name,i)=>{if(viewPlayer.upgradeUsed.includes(i))return [];const ready=upgrades.includes(i),chosen=canUpgrade&&upgradeCondition===i;return [`<button type="button" class="upgrade-condition ${ready?'met':'pending'} ${chosen?'active':''}" data-upgrade-condition="${i}" ${viewing===localSeat&&human&&game.phase==='building'&&ready&&unupgraded.length?'':'disabled'} aria-pressed="${chosen}"><img src="assets/upgrade-conditions/${i+1}.webp" alt=""><span class="upgrade-condition-copy"><b>${name}</b><small>${ready?'✓ 已完成':'○ 未完成'}</small></span></button>`];}).join('')||'<span class="upgrade-empty">四项升级条件均已使用</span>'}</div><p class="upgrade-instruction">${viewingOpponent ? `已升级：${viewPlayer.upgraded.map(label).join('、')||'暂无'}` : !unupgraded.length?'所有行动牌均已升级':canUpgrade?'选择上方带金色边框的行动牌':'每张条件牌只能使用一次，升级后会从这里移除。'}</p>`;
  const prompts = {draft:`01 / 拿取版块 · 项目强度 ${game.reachable()}，可拿取前 ${game.reachable()} 个展示位。`,action:action ? `02 / ${label(action)}行动 · 选择可用手牌放置，或${action === 'projects' ? '从展示区拿取一张' : '抽取两张'}版块。` : '02 / 使用行动 · 先选择下方一张行动牌。','second-project':'升级项目行动 · 可从展示区再拿取一张，或点击完成行动。','second-animal':`升级动物行动 · 可再放置一只${label(game.followup?.card)}动物；剩余强度 ${game.followup?.remaining ?? 0}。`,building:game.player.hand.length > 6 ? '03 / 整理手牌 · 可先放置建筑、支持目标或升级行动；点击「弃置」按钮，将手牌减至六张。' : '03 / 行动完成 · 可放置建筑、支持一个保护目标、升级符合条件的行动，或结束回合。',ended:'对局结束 · 查看终局分数。'};
  const bonusOrigin=game.pendingBonusSource||'地图放置奖励';
  prompts.bonus = game.pendingBonus === 'market' ? `${bonusOrigin} · 从展示区任选一张版块，不受项目强度限制。` : game.pendingBonus === 'building' ? `${bonusOrigin} · 从展示区精选一座建筑。` : game.pendingBonus === 'animal' ? `${bonusOrigin} · 从展示区精选一只动物。` : `${bonusOrigin} · 当前行动已经完成，请选择一张行动牌移至强度 1。`;
  const effect = game.pendingEffect;
  const effectOrigin=effect?.origin||'版块效果';
  prompts.effect = effect?.type === 'statue-discard' ? `雕像的打出条件 · 点击手牌选择弃置；还需弃置 ${effect.remaining} 张，不能跳过。` : effect?.type === 'open-cost' ? effect.selectedTarget ? `放置条件 · 已选择开放区域位置；再点击 1 张手牌，还需放置 ${effect.targets.length} 个。` : `放置条件 · 需要 ${effect.targets.length} 个开放区域；先点击金色格，再选择作为开放区域的手牌。` : effect?.type === 'market' ? `${effectOrigin} · 从展示区选择符合条件的版块。` : effect?.type === 'choose-animal' ? `${effectOrigin} · 从展示出的三张版块中保留一张动物，其余弃置。` : effect?.type === 'pouch' ? `${effectOrigin} · 点击手牌弃置并获得育儿袋标记；还可弃 ${effect.remaining} 张。` : effect?.type === 'shift' ? `${effectOrigin} · 当前行动已经完成，请选择一张行动牌移至强度 1。` : effect?.type === 'open-area' ? `${effectOrigin} · 点击地图亮起的空格放置开放区域；还可放 ${effect.remaining} 个。` : effect?.type === 'relocate' ? effect.source ? `${effectOrigin} · 点击亮起的空格，将选中的版块移过去。` : `${effectOrigin} · 点击地图上要移动的版块，再选新位置。` : '';
  const promptText=viewingOpponent ? '正在查看对方保护区；切回「我的保护区」继续操作。' : replayMode?`回放步骤 ${replayIndex} / ${replayStates(currentReplay).length-1}`:human || game.phase === 'ended' ? prompts[game.phase] : matchMode==='online'?'等待对手完成当前步骤…':'电脑正在巡护保护区…';
  const phaseTips={draft:'从展示区最左侧开始计算可拿取范围。点击高亮版块完成拿取。',action:action?`当前已选择${label(action)}行动。点击可用手牌进行选择，再点击地图上亮起的六角格。`:'先点击一张行动牌；牌面数字就是本次行动的可用强度。','second-project':'升级后的项目行动可以额外拿取一张，也可以点击“完成行动”跳过。','second-animal':'第二只动物必须匹配本次行动的栖息地，等级不能超过剩余强度。',building:game.player.hand.length>6?'先用“弃置”把手牌减到六张；建筑、目标支持和行动升级仍可在此阶段完成。':'检查可放置建筑、保护目标和升级条件；全部处理完后点击“结束回合”。',bonus:'按提示点击展示区版块或行动牌；不想使用时可点击“放弃奖励”。',effect:'当前必须先完成卡牌效果。页面上可操作的版块、行动牌或地图格已经高亮。',ended:'对局已经结束，可打开积分明细查看动物、建筑、项目等分类得分。'};
  const promptTip=viewingOpponent?'对方手牌只显示牌背，但可以查看其地图、标记、目标状态和行动牌升级情况。':replayMode?'使用上方回放控制条逐步检查双方决策。':human||game.phase==='ended'?phaseTips[game.phase]:matchMode==='online'?'对手提交操作后页面会自动同步。':'电脑会自动完成拿牌、行动和回合结算，请稍候。';
  const opportunities=endTurnOpportunities(game);
  const remaining=[opportunities.objectives.length?`可支持保护目标：${opportunities.objectives.map(o=>label(o.icon)).join('、')}`:'',opportunities.upgrades.length?`可使用 ${opportunities.upgrades.length} 项行动牌升级条件`:''].filter(Boolean);
  const opportunityHint=viewing===localSeat&&human&&game.phase==='building'&&remaining.length?`<span class="opportunity-hint">${finishReminderArmed?'结束前请确认：':'本回合可执行：'}${esc(remaining.join('；'))}</span>`:'';
  $('#action-prompt').innerHTML=`<span class="prompt-copy"><span class="step-copy">${esc(promptText||'请完成当前步骤。')}</span>${opportunityHint}</span><span class="step-help" tabindex="0" role="button" aria-label="查看当前步骤说明">?</span><span class="step-tooltip" role="tooltip">${esc(promptTip||'请点击当前高亮的区域继续。')}</span>`;
  $('#result').hidden = game.phase !== 'ended';
  $('#result').innerHTML = game.scores ? `<h2>${outcome()}</h2><div>你 ${game.scores[localSeat].total} 分 · ${matchMode==='local'?'电脑':'对手'} ${game.scores[1-localSeat].total} 分</div><button id="show-score" class="primary">查看积分明细</button>` : '';
  $('#effect-choices').hidden = !(human && effect?.type === 'choose-animal');
  $('#effect-choices').innerHTML = effect?.type === 'choose-animal' ? effect.revealed.map((id,i) => tileHTML(id,i,'reveal')).join('') : '';
  $('#skip-bonus').hidden = !(viewing===localSeat && human && (game.phase === 'bonus' || (game.phase === 'effect' && !['open-cost','statue-discard'].includes(effect.type))));
  $('#skip-bonus').textContent = game.phase === 'effect' ? '跳过当前效果' : '放弃奖励';
  const canComplete=viewing===localSeat && active && ['second-project','second-animal'].includes(game.phase);
  $('#complete-action').hidden = !canComplete;
  $('#complete-action').textContent = game.phase === 'second-project' ? '放弃精选' : '跳过打出第二只动物';
  const canDraw=viewing===localSeat && active && game.phase === 'action' && action && action !== 'projects';
  $('#draw').hidden = !canDraw;
  $('#draw').disabled = !canDraw;
  $('#finish').disabled = !(viewing===localSeat && active && game.phase === 'building' && game.player.hand.length <= 6);
  $('#finish-reminder').hidden=true;
  $('#finish-reminder').textContent='';
  $('#finish').textContent=finishReminderArmed&&remaining.length?'仍要结束回合 →':'结束回合 →';
  $('#undo').disabled = matchMode==='online'||replayMode||!history.length;
  $('#retry-ai').hidden = !(matchMode==='local'&&aiFailed && game.current===1 && game.phase!=='ended');
  $('#log').innerHTML = game.logs.slice(0, 50).map(s => `<li>${esc(s)}</li>`).join('');
  $('#my-map').classList.toggle('active', viewing === localSeat); $('#ai-map').classList.toggle('active', viewing !== localSeat);
  const mapPlayer=game.players[viewing];
  const mapTiles=Object.values(mapPlayer.placed).map(id=>game.tiles[id]);
  const mapKinds={animal:0,project:0,building:0};
  mapTiles.forEach(tile=>mapKinds[tile.kind]++);
  $('#map-count').textContent = `${viewing===localSeat?'我的':matchMode==='local'?'电脑':'对手'}版块 ${mapTiles.length} 张 · 手牌 ${mapPlayer.hand.length} 张 · 动物 ${mapKinds.animal} · 项目 ${mapKinds.project} · 建筑 ${mapKinds.building} · 开放区域 ${Object.keys(mapPlayer.openAreas).length} · 预印开放区 ${viewMap.openAreas.length}`;
  $('#map-side-label').textContent = `${viewMapSide} 面 · 固定方向`;
  $('#map-select').value=viewMapSide;
  renderMap();
  renderReleaseTargets();
  if (game.phase==='ended' && game.scores && !scoreDialogShown && !replayMode) {scoreDialogShown=true;showScore();}
}
function outcome() {
  const human=game.scores[localSeat],opponent=game.scores[1-localSeat];
  const opponentName=matchMode==='local'?'电脑':'对手';
  return human.total===opponent.total ? human.animals===opponent.animals ? '平局' : human.animals>opponent.animals ? '你获胜' : `${opponentName}获胜` : human.total>opponent.total ? '你获胜' : `${opponentName}获胜`;
}
function showScore() {
  if (!game.scores) return;
  const human=game.scores[localSeat],ai=game.scores[1-localSeat],opponentName=matchMode==='local'?'电脑':'对手';
  const rows=[['行动回合',null],['动物分','animalPoints'],['建筑分','buildingPoints'],['项目分','projectPoints'],['保护目标','achievements'],['剩余标记','markers'],['开放区域','openAreas'],['终局标记','endBonus']];
  $('#score-content').innerHTML=`<div class="eyebrow">终局结算</div><h2>${outcome()}</h2><div class="score-totals"><div>你 <strong>${human.total}</strong> 分</div><div>${opponentName} <strong>${ai.total}</strong> 分</div></div><table class="score-table"><thead><tr><th>得分来源</th><th>你</th><th>${opponentName}</th></tr></thead><tbody>${rows.map(([name,field])=>`<tr><th>${name}</th><td>${field?human[field]??0:game.players[localSeat].turns||0}</td><td>${field?ai[field]??0:game.players[1-localSeat].turns||0}</td></tr>`).join('')}</tbody><tfoot><tr><th>总分</th><td>${human.total}</td><td>${ai.total}</td></tr></tfoot></table><p class="score-note">动物分包含宠物群计分；同分时比较保护区内动物数量（你 ${human.animals} 只，${opponentName} ${ai.animals} 只）。</p>`;
  if (!$('#score-dialog').open) $('#score-dialog').showModal();
}
function releaseCells() {
  return game.current===localSeat && viewing===localSeat && selected && game.canPlay(selected,action) && /^release 1 Animal/.test(game.tiles[selected].placement_requirement||'') ? game.spaces(selected) : [];
}
function renderReleaseTargets() {
  const active=game.current===localSeat && viewing===localSeat && selected && game.canPlay(selected,action) && /^release 1 Animal/.test(game.tiles[selected].placement_requirement||'')&&!replayMode;
  const choices=active?releaseCells():[];
  $('#release-targets').hidden=!active;
  $('#release-targets').innerHTML=active?`<strong>选择要放归的动物</strong><span>可点击地图上金色标记，或在这里直接选择</span><div class="release-list">${choices.length?choices.map(coord=>{const id=game.players[localSeat].placed[key(coord)];return `<button data-release-cell="${key(coord)}"><img src="${art(id)}" alt=""><span>${esc(tileName(game.tiles[id]))}<small>地图位置 ${coord[0]}, ${coord[1]}</small></span><b>放归 ↗</b></button>`;}).join(''):'当前没有符合图标的可放归动物'}</div>`:'';
}
function renderMap() {
  // Both source scans are normalized to this single 1195×800 grid on export.
  const geometry = {originX:600, stepX:160, evenY:116, oddY:206, stepY:181.5, halfW:106, halfH:92};
  const center = (q, r) => {
    const last = {[-3]:4,[-2]:4,[-1]:3,[0]:3,[1]:2,[2]:2,[3]:1}[q];
    return [geometry.originX + geometry.stepX * q, (q % 2 ? geometry.oddY : geometry.evenY) + (last - r) * geometry.stepY];
  };
  const effect = game.current === localSeat && viewing === localSeat && game.phase === 'effect' && !replayMode ? game.pendingEffect : null;
  const releasing=Boolean(game.current===localSeat && viewing===localSeat && selected && game.canPlay(selected,action) && /^release 1 Animal/.test(game.tiles[selected].placement_requirement||'')&&!replayMode);
  const valid = effect?.type === 'open-cost' ? effect.targets.map(key) : effect?.type === 'open-area' ? game.spaces().map(key) : effect?.type === 'relocate' && effect.source ? game.relocationSpaces(effect.source).map(key) : game.current === localSeat && viewing === localSeat && selected && game.canPlay(selected, action) && !replayMode ? game.spaces(selected).map(key) : [];
  const viewMap=game.mapFor(viewing),viewMapSide=game.mapSideFor(viewing);
  $('#board').innerHTML = `<image href="assets/map-${viewMapSide}.webp?v=20260920-4" x="0" y="0" width="1195" height="800" preserveAspectRatio="none"/>` + cells.map(([q,r]) => {
    const [x,y] = center(q,r), id = game.players[viewing].placed[key([q,r])], t = id && game.tiles[id], placedOpen = game.players[viewing].openAreas[key([q,r])];
    const points = Array.from({length:6}, (_,i) => `${x+geometry.halfW*Math.cos(i*Math.PI/3)},${y+geometry.halfH*2/Math.sqrt(3)*Math.sin(i*Math.PI/3)}`).join(' ');
    const ready = valid.includes(key([q,r])), open = viewMap.openAreas.some(c => key(c) === key([q,r]));
    const openCostTarget = effect?.type === 'open-cost' && ready;
    const chosenOpenTarget = openCostTarget && effect.selectedTarget && key(effect.selectedTarget) === key([q,r]);
    const bonus = !t && viewMap.bonuses[key([q,r])];
    const river = viewMap.riverCells.some(c => key(c) === key([q,r]));
    const caption = t ? tileName(t) : placedOpen ? '已放置开放区域' : open ? '预印开放区域' : bonus ? bonusNames[bonus] : '';
    const movable = effect?.type === 'relocate' && !effect.source && (id || placedOpen) && game.relocationSpaces(key([q,r])).length;
    return `<g data-cell="${q},${r}" tabindex="0" role="button" aria-label="${esc(caption || `空格 ${q},${r}`)}${ready ? releasing?'，可放归':openCostTarget?'，可放置开放区域':'，可放置' : ''}${movable ? '，可移动' : ''}"><title>${esc(caption || '空格')}${river ? ' · 临河格' : ''}${open ? ' · 不可覆盖，也不提供放置邻接' : ''}</title>${t || placedOpen ? `<image href="${t ? art(id) : 'assets/open-area.webp?v=20260920-4'}" x="${x-geometry.halfW}" y="${y-geometry.halfH}" width="${geometry.halfW*2}" height="${geometry.halfH*2}" preserveAspectRatio="none" pointer-events="none"/>` : ''}<polygon class="hex ${ready ? 'ready' : ''} ${openCostTarget?'open-cost-target':''} ${chosenOpenTarget?'chosen-open-target':''} ${ready&&releasing?'release-target':''} ${movable ? 'movable' : ''} ${river ? 'river-space' : ''} ${open ? 'printed-open' : ''} ${bonus ? 'bonus-space' : ''} ${t ? `occupied ${habitat(t)}` : ''}" points="${points}"/>${ready || movable ? `<text x="${x}" y="${y+(releasing&&ready?5:9)}" text-anchor="middle" font-size="${releasing&&ready?23:openCostTarget?21:32}" font-weight="700" fill="${releasing&&ready?'#683c08':openCostTarget?'#7c5317':'#315747'}" stroke="${releasing&&ready||openCostTarget?'#fff8df':'none'}" stroke-width="${releasing&&ready||openCostTarget?4:0}" paint-order="stroke" pointer-events="none">${movable ? '↗' : releasing ? '放归' : chosenOpenTarget ? '已选' : openCostTarget ? '开放' : '+'}</text>` : ''}</g>`;
  }).join('') + [['保护标记',game.players[viewing].conservation,113],['育儿袋标记',game.players[viewing].pouch,161]].map(([name,count,x])=>`<g class="map-marker" tabindex="0" role="img" aria-label="${name} ${count} 个" transform="translate(${x} 710)"><title>${name}：${count} 个</title><circle class="marker-hit" r="23"/><circle class="marker-badge" cx="12" cy="29" r="15"/><text class="marker-badge-text" x="12" y="34" text-anchor="middle">${count}</text><g class="marker-popover"><rect x="-43" y="-62" width="91" height="27" rx="7"/><text x="2" y="-44" text-anchor="middle">${name} × ${count}</text></g></g>`).join('');
}
function detail(id, fromHand=false) {
  const t = game.tiles[id];
  const fields = [['栖息地',(t.habitats || []).map(label).join(' / ') || '—'],['图标',Object.entries(t.icons || {}).map(([k,v]) => `${label(k)} × ${v}`).join(' · ')],['开放区域', (t.open_area_edges || []).map(label).join(' / ') || '无'],['放置条件',t.placement_requirement ? describe(t.placement_requirement) : '无额外印刷条件'],['即时效果',describe(t.immediate_effect)],['持续效果',describe(t.ongoing_effect)],['卡面计分',scoringText(t.scoring)],['标记奖励',t.marker_reward?.type ? (t.marker_reward.type === 'pouch' ? '育儿袋标记' : '保护标记') : '无']];
  const usable=fromHand&&viewing===localSeat&&game.current===localSeat&&!replayMode&&(game.canPlay(id,action)||game.phase==='effect'&&(['pouch','statue-discard'].includes(game.pendingEffect?.type)||game.pendingEffect?.type==='open-cost'&&Boolean(game.pendingEffect.selectedTarget)));
  // Every card detail uses the same large preview. `fromHand` only controls
  // whether the dialog can also select the card for play.
  $('#detail').classList.add('hand-preview');
  $('#detail-content').innerHTML = `<div class="eyebrow">版块 #${id} · ${label(t.kind)}</div><img class="detail-art" src="${art(id)}" alt="${esc(tileName(t))}"><h2>${esc(tileName(t))}</h2><p>等级 ${t.level || '—'} ${t.sex ? `· ${t.sex === 'male' ? '雄性' : '雌性'}` : ''}</p>${usable?`<button class="primary preview-select" data-preview-select="${id}">${game.phase==='effect'?'用于当前效果':'选择此版块并放置'}</button>`:''}<dl>${fields.map(([k,v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  $('#detail').showModal();
}
document.addEventListener('click', event => {
  const previewSelect=event.target.closest('[data-preview-select]'); if(previewSelect){const id=previewSelect.dataset.previewSelect;$('#detail').close();return attempt(()=>{if(game.phase==='effect'&&['pouch','open-cost','statue-discard'].includes(game.pendingEffect?.type))game.resolveEffect(id);else if(game.canPlay(id,action)){selected=id;if(!game.spaces(id).length)toast('这张版块当前没有满足放置条件的相邻空格，可查看详情了解条件。');}});}
  const info = event.target.closest('[data-detail]'); if (info) return detail(info.dataset.detail,Boolean(info.closest('[data-source="hand"]')));
  const condition=event.target.closest('[data-upgrade-condition]'); if (condition && !condition.disabled) {finishReminderArmed=false;const chosen=Number(condition.dataset.upgradeCondition);upgradeCondition=upgradeCondition===chosen?null:chosen;render();return;}
  const objective = event.target.closest('[data-objective]'); if (objective) return attempt(() => game.support(objective.dataset.objective,Number(objective.dataset.marker)));
  const discard = event.target.closest('[data-discard]'); if (discard) return attempt(() => { if (game.current !== localSeat) return; game.discardTile(discard.dataset.discard); selected = null; });
  const card = event.target.closest('[data-action]'); if (card && !card.disabled) {
    if (game.phase === 'building' && upgradeCondition!==null && viewing===localSeat) return attempt(()=>{game.upgrade(card.dataset.action,upgradeCondition);upgradeCondition=null;});
    if (game.phase === 'bonus') return attempt(() => game.resolveBonus(card.dataset.action));
    if (game.phase === 'effect') return attempt(() => game.resolveEffect(card.dataset.action));
    finishReminderArmed=false;action = card.dataset.action; selected = null; render(); return;
  }
  const tile = event.target.closest('[data-source]');
  if (tile) return attempt(() => {
    if (game.current !== localSeat || game.phase === 'ended') return;
    if (tile.dataset.source === 'market') {
      if (game.phase === 'bonus' && ['market','building','animal'].includes(game.pendingBonus)) game.resolveBonus(Number(tile.dataset.index));
      else if (game.phase === 'effect' && game.pendingEffect.type === 'market') game.resolveEffect(Number(tile.dataset.index));
      else if (game.phase === 'second-project') game.secondProject(Number(tile.dataset.index));
      else game.draft(Number(tile.dataset.index), game.phase === 'action' && action === 'projects');
      selected = null;
    }
    else if (tile.dataset.source === 'reveal') game.resolveEffect(tile.dataset.id);
    else if (game.phase === 'effect' && game.pendingEffect.type === 'open-cost' && !game.pendingEffect.selectedTarget) toast('请先点击地图上一个金色开放区域位置，再选择这张手牌。');
    else if (game.phase === 'effect' && ['pouch','open-cost','statue-discard'].includes(game.pendingEffect.type)) game.resolveEffect(tile.dataset.id);
    else if (game.canPlay(tile.dataset.id, action)) { selected = selected===tile.dataset.id ? null : tile.dataset.id; viewing = localSeat; if (selected&&!game.spaces(selected).length) toast('这张版块当前没有满足放置条件的相邻空格，可查看详情了解条件。'); render(); }
    else if (/^release 1 Animal/.test(game.tiles[tile.dataset.id].placement_requirement||'') && action==='projects' && game.phase==='action') toast(`当前项目强度 ${game.strength('projects')}；该放归项目需要 ${game.effectiveLevel(game.tiles[tile.dataset.id])} 强度。`);
    else toast('请先选择匹配的行动；版块等级不能超过行动强度。建筑在行动完成后放置。');
  });
  const release=event.target.closest('[data-release-cell]');
  if (release) return attempt(()=>{game.place(selected,action,release.dataset.releaseCell.split(',').map(Number));selected=null;});
  const cell = event.target.closest('[data-cell]');
  if (cell) attempt(() => {
    const coord = cell.dataset.cell.split(',').map(Number), id = game.players[viewing].placed[key(coord)];
    if (viewing === localSeat && game.current === localSeat && game.phase === 'effect' && game.pendingEffect.type === 'open-cost') {game.selectOpenTarget(coord); render(); return;}
    if (viewing === localSeat && game.current === localSeat && game.phase === 'effect' && (game.pendingEffect.type === 'open-area' || game.pendingEffect.type === 'relocate')) {game.resolveEffect(game.pendingEffect.type === 'relocate' && !game.pendingEffect.source ? key(coord) : coord); return;}
    if (id && !(viewing === localSeat && game.current === localSeat && selected && game.spaces(selected).some(c => key(c) === key(coord)))) return detail(id);
    if (viewing !== localSeat || game.current !== localSeat || !selected) return;
    game.place(selected, action, coord); selected = null;
  });
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-source], [data-cell]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click',{bubbles:true})); } });
$('#result').addEventListener('click',event=>{if(event.target.closest('#show-score'))showScore();});
document.addEventListener('contextmenu', e => { const tile = e.target.closest('[data-id]'); if (tile) { e.preventDefault(); detail(tile.dataset.id,tile.dataset.source==='hand'); } });
$('#draw').onclick = () => attempt(() => {game.draw(action); selected = null;});
$('#undo').onclick = () => {
  if (!history.length||matchMode==='online'||replayMode) return;
  finishReminderArmed=false;
  aiRequestToken++;aiFailed=false;
  clearTimeout(aiPickupStatusTimer);$('#ai-pickup-status').hidden=true;
  clearTimeout(timer);timer=null;
  const before=game.snapshot(),previous=history.pop();game.restore(previous.state);
  ({selected,action,upgradeCondition,viewing}=previous.ui);
  recordState(before,game.snapshot(),{kind:'undo',label:'撤回上一步操作',actor:localSeat})?.catch(()=>{});
  if ($('#score-dialog').open) $('#score-dialog').close();
  scoreDialogShown=false;render();
};
$('#complete-action').onclick = () => attempt(() => game.phase === 'second-project' ? game.secondProject() : game.endAnimalAction());
$('#skip-bonus').onclick = () => attempt(() => game.phase === 'effect' ? game.resolveEffect(null) : game.resolveBonus(null));
$('#finish').onclick = () => {
  const remaining=endTurnOpportunities(game);
  if (!finishReminderArmed && (remaining.objectives.length || remaining.upgrades.length)) {finishReminderArmed=true;render();return;}
  attempt(() => {
  game.finish(); selected = null; action = null;
  if (matchMode==='local'&&game.current === 1 && game.phase !== 'ended') timer = setTimeout(runComputerTurn, 700);
  });
};
async function runComputerTurn() {
  if(matchMode!=='local'||game.current!==1||game.phase==='ended')return;
  const token=++aiRequestToken;
  aiFailed=false;clearTimeout(aiPickupStatusTimer);$('#ai-pickup-status').hidden=true;render();
  try {
    let steps=0;
    while(token===aiRequestToken&&game.current===1&&game.phase!=='ended'&&steps<100){
      const before=game.snapshot(),previousMarketLayout=marketLayout();
      const deckAnchor=$('#deck-count')||$('.market-section');
      const origins={market:[...document.querySelectorAll('#market .tile')].map(tile=>tile.getBoundingClientRect()),deck:deckAnchor?.getBoundingClientRect()};
      await new Promise(resolve=>setTimeout(resolve,30));
      if(token!==aiRequestToken||matchMode!=='local')return;
      const chosen=chooseDecision(game);if(!chosen)throw Error('当前局面没有合法策略动作');
      applyDecision(game,chosen.decision);
      const after=game.snapshot();
      const result={state:after,simulations:0,trace:[{decision:chosen.decision,search:null}],pickups:collectComputerPickups(before,after)};
      if(token!==aiRequestToken)return;
      if(!result.state)throw Error('电脑返回了无效的策略结果');
      const step=result.trace?.[0];
      const saved=recordState(before,result.state,{kind:'ai-decision',label:latestActionLabel(before,result.state),
        decision:step?.decision||null,search:step?.search||null,actor:1});
      game.restore(result.state);render();animateMarketChange(before.market,previousMarketLayout);
      await saved;
      showComputerPickups(result.pickups||[],origins,token);
      steps++;
      if(game.current===1&&game.phase!=='ended')await new Promise(resolve=>setTimeout(resolve,420));
    }
    if(steps>=100&&game.current===1&&game.phase!=='ended')throw Error('电脑回合超过 100 个决策');
  } catch(error) {
    if(token!==aiRequestToken)return;
    aiFailed=true;render();toast(`电脑回合未完成：${error.message}`);
  }
}
$('#retry-ai').onclick=runComputerTurn;
$('#my-map').onclick = () => {finishReminderArmed=false;viewing = localSeat; render();}; $('#ai-map').onclick = () => {finishReminderArmed=false;viewing = 1-localSeat; render();};
$('#help').onclick = () => $('#help-dialog').showModal();
document.querySelectorAll('.close').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#restart').onclick = () => showStartScreen(true);
$('#map-select').onchange = () => {if(game)$('#map-select').value=game.mapSideFor(viewing);};
function resetRuntime(){stopTimers();aiRequestToken++;aiFailed=false;finishReminderArmed=false;onlineSyncing=false;history=[];selected=null;action=null;upgradeCondition=null;scoreDialogShown=false;$('#ai-pickup-status').hidden=true;if($('#score-dialog').open)$('#score-dialog').close();}
function initializeGame(mapSide,first=Math.random()<.5?0:1){
  resetRuntime();game=new DemoGame(catalog,Math.random,mapSide,first);viewing=localSeat;
  game.logs[0]=first===localSeat?'随机先手：你先行动。请从展示区拿取第一张版块。':`${matchMode==='local'?'电脑':'对手'}随机获得先手。`;
  $('#map-select').value=game.mapSideFor(localSeat);return game;
}
async function beginRecord(options){currentRecord=createMatchRecord({...options,initialState:game.snapshot()});await saveMatchRecord(currentRecord);}
function enterGame(){
  document.body.classList.remove('ark-menu');
  $('#start-screen').hidden=true;document.body.classList.remove('replay-mode');$('#replay-bar').hidden=true;
  $('#map-select').disabled=true;render();
}
async function startLocal(){
  matchMode='local';localSeat=0;aiSimulations=0;room=null;replayMode=false;
  initializeGame(resolveMapChoice($('#start-map-select').value));
  const aiStatus={model:'browser-baseline-policy'};
  await beginRecord({mode:'local',ai:{model:aiStatus.model,simulations:aiSimulations},mapSide:game.mapSides,seat:0});
  $('#mode-status').textContent='浏览器试玩 · 轻量策略';
  $('#match-notice').textContent='本场对局正在自动记录，结束后可在“观看回放”中查看并导出。';
  enterGame();if(game.current===1)timer=setTimeout(runComputerTurn,700);
}
async function createRoom(){
  matchMode='online';localSeat=0;replayMode=false;initializeGame(resolveMapChoice($('#online-map-select').value));
  const response=await fetch('/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapSide:game.mapSides,state:game.snapshot()})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'创建房间失败');
  room={...data,players:1};await beginRecord({mode:'online',mapSide:game.mapSides,seat:0,roomCode:data.code});
  $('#mode-status').textContent=`● 联机房间 ${data.code}`;$('#match-notice').textContent=`房间码 ${data.code} · 等待另一名玩家加入…`;
  enterGame();startRoomPolling();
}
async function joinRoom(){
  const code=$('#room-code').value.trim().toUpperCase();if(!code)throw Error('请输入房间码');
  const response=await fetch(`/rooms/${encodeURIComponent(code)}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'加入房间失败');
  matchMode='online';localSeat=1;replayMode=false;resetRuntime();room={...data,players:2};
  game=new DemoGame(catalog,Math.random,data.mapSide,0);game.restore(data.state);viewing=localSeat;$('#map-select').value=game.mapSideFor(localSeat);
  await beginRecord({mode:'online',mapSide:data.mapSide,seat:1,roomCode:data.code});
  $('#mode-status').textContent=`● 联机房间 ${data.code}`;$('#match-notice').textContent=`已加入房间 ${data.code}，双方操作会自动同步。`;
  enterGame();startRoomPolling();
}
async function pushOnlineState(before,after){
  if(!room||onlineSyncing||JSON.stringify(before)===JSON.stringify(after))return;
  onlineSyncing=true;render();
  try{
    const response=await fetch(`/rooms/${room.code}/state`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:room.token,revision:room.revision,state:after})});
    const data=await response.json();
    if(response.status===409&&data.state){room.revision=data.revision;game.restore(data.state);recordState(after,data.state,{kind:'sync',label:'同步了对手较新的操作',actor:1-localSeat});}
    else if(!response.ok)throw Error(data.error||'同步失败');
    else room.revision=data.revision;
  }catch(error){toast(`联机同步失败：${error.message}`);}finally{onlineSyncing=false;render();}
}
async function pollRoom(){
  if(!room||onlineSyncing||replayMode)return;
  try{
    const response=await fetch(`/rooms/${room.code}`),data=await response.json();if(!response.ok)throw Error(data.error||'房间连接中断');
    room.players=data.players;
    if(data.revision>room.revision){const before=game.snapshot();room.revision=data.revision;game.restore(data.state);selected=null;action=null;upgradeCondition=null;viewing=localSeat;history=[];recordState(before,data.state,{kind:'remote-action',label:latestActionLabel(before,data.state),actor:1-localSeat});render();}
    $('#match-notice').textContent=data.players<2?`房间码 ${room.code} · 等待另一名玩家加入…`:`房间 ${room.code} · ${game.current===localSeat?'轮到你行动':'等待对手行动'} · 对局自动记录中`;
    if(data.players>=2)render();
  }catch(error){$('#match-notice').textContent=`房间 ${room.code} · ${error.message}`;}
}
function startRoomPolling(){clearInterval(roomPollTimer);roomPollTimer=setInterval(pollRoom,900);pollRoom();}
function modePanel(name){
  document.querySelectorAll('[data-open-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.openMode===name)));
  $('#mode-menu').hidden=Boolean(name);document.querySelectorAll('.start-panel').forEach(panel=>panel.hidden=true);
  if(name)$(`#${name==='replays'?'replay':name}-setup`).hidden=false;
}
async function renderRecordList(){
  const records=await listMatchRecords();$('#record-count').textContent=`${records.length} 场`;
  $('#restore-records').hidden=!localStorage.getItem('lab-ark-cleared-backup');
  $('#record-list').innerHTML=records.length?records.map(record=>{
    const date=new Date(record.startedAt).toLocaleString('zh-CN',{hour12:false}),steps=record.events.length;
    const result=record.result?` · ${record.result[record.seat||0]?.total??0} : ${record.result[1-(record.seat||0)]?.total??0}`:'';
    const opponent=record.mode==='local'?'浏览器轻量策略':`房间 ${record.roomCode||'—'}`;
    const status=record.status==='complete'?'已完成':record.status==='abandoned'?'已退出':'未完成';
    return `<article class="record-row" data-record-id="${esc(record.id)}"><div class="record-row-main"><strong>${record.mode==='local'?'本地对战':'联机对战'} · ${esc(opponent)}</strong><span>${date} · ${esc(mapSideLabel(record.mapSide))} · ${steps} 步 · ${status}${result}</span></div>${record.mode==='local'&&record.status==='active'?`<button data-resume-id="${esc(record.id)}">继续对局</button>`:''}<button data-replay-id="${esc(record.id)}">观看</button><button class="export-record" data-export-id="${esc(record.id)}">导出</button><button class="delete-record" data-delete-id="${esc(record.id)}">删除</button></article>`;
  }).join(''):'<div class="record-empty">还没有对局记录。完成一场本地或联机对战后会显示在这里。</div>';
  $('#record-list').onclick=async event=>{try{const resume=event.target.closest('[data-resume-id]'),replay=event.target.closest('[data-replay-id]'),download=event.target.closest('[data-export-id]'),remove=event.target.closest('[data-delete-id]');const id=resume?.dataset.resumeId||replay?.dataset.replayId||download?.dataset.exportId||remove?.dataset.deleteId;const record=records.find(item=>item.id===id);if(resume)resumeRecord(record);if(replay)openReplay(record);if(download)exportMatchRecord(record);if(remove&&await askConfirm('确定删除这场对局记录吗？')){await deleteMatchRecord(id);await renderRecordList();}}catch(error){toast(error.message);}};
}
function resumeRecord(record){
  if(!record||record.mode!=='local'||record.status!=='active')return;
  resetRuntime();matchMode='local';localSeat=record.seat||0;room=null;replayMode=false;
  currentRecord=structuredClone(record);currentReplay=null;aiSimulations=0;
  game=new DemoGame(catalog,Math.random,record.mapSide,0);
  game.restore(record.events.at(-1)?.state||record.initialState);viewing=localSeat;
  $('#mode-status').textContent='● 继续本地对局';
  $('#match-notice').textContent='已恢复原对局，继续保存到同一份回放。';
  enterGame();if(game.current===1&&game.phase!=='ended')timer=setTimeout(runComputerTurn,700);
}
function setReplayStep(index){
  const states=replayStates(currentReplay);replayIndex=Math.max(0,Math.min(states.length-1,index));game.restore(states[replayIndex]);selected=null;action=null;upgradeCondition=null;viewing=localSeat;
  $('#replay-range').value=replayIndex;const event=currentReplay.events[replayIndex-1];$('#replay-progress').textContent=replayIndex===0?`0 / ${states.length-1} · 初始状态`:`${replayIndex} / ${states.length-1} · ${event?.label||'完成一步操作'}`;render();
}
function openReplay(record){
  if(!record)return;resetRuntime();currentReplay=record;replayMode=true;matchMode=record.mode;localSeat=record.seat||0;
  game=new DemoGame(catalog,Math.random,record.mapSide,0);$('#map-select').value=game.mapSideFor(localSeat);$('#map-select').disabled=true;
  $('#start-screen').hidden=true;$('#replay-bar').hidden=false;document.body.classList.add('replay-mode');
  $('#replay-range').max=replayStates(record).length-1;$('#mode-status').textContent='对局回放';$('#match-notice').textContent='回放包含每一步完整状态与轻量策略选择，不包含神经网络搜索证据。';setReplayStep(0);
}
function toggleReplay(){
  if(replayTimer){clearInterval(replayTimer);replayTimer=null;$('#replay-play').textContent='播放';return;}
  $('#replay-play').textContent='暂停';replayTimer=setInterval(()=>{const last=replayStates(currentReplay).length-1;if(replayIndex>=last){toggleReplay();return;}setReplayStep(replayIndex+1);},700);
}
async function showStartScreen(confirmExit=false){
  if(confirmExit&&game&&!replayMode&&game.phase!=='ended'&&!await askConfirm('返回准备页会暂停当前对局，可从“本地回放”继续。是否返回？'))return;
  await flushMatchRecords().catch(()=>{});
  resetRuntime();room=null;currentRecord=null;currentReplay=null;replayMode=false;matchMode='menu';document.body.classList.remove('replay-mode');document.body.classList.add('ark-menu');$('#replay-bar').hidden=true;$('#start-screen').hidden=false;$('#mode-status').textContent='对战准备';$('#match-notice').textContent='请选择一种对战方式开始。';modePanel('local');
}
document.querySelectorAll('[data-open-mode]').forEach(button=>button.onclick=async()=>{const mode=button.dataset.openMode;modePanel(mode);if(mode==='replays')await renderRecordList();});
document.querySelectorAll('.back-mode').forEach(button=>button.onclick=()=>modePanel('local'));
$('#start-local').onclick=()=>startLocal().catch(error=>toast(error.message));
$('#clear-records').onclick=async()=>{try{const result=await clearMatchRecords();await renderRecordList();toast(`已清空 ${result.count} 条回放，可撤回清空。`);}catch(error){toast(error.message);}};
$('#restore-records').onclick=async()=>{try{await restoreClearedMatchRecords();await renderRecordList();}catch(error){toast(error.message);}};
window.addEventListener('beforeunload',event=>{if(hasPendingMatchWrites()){event.preventDefault();event.returnValue='对局记录正在保存';}});
$('#create-room').onclick=()=>createRoom().catch(error=>{$('#room-status').textContent=error.message;});
$('#join-room').onclick=()=>joinRoom().catch(error=>{$('#room-status').textContent=error.message;});
$('#room-code').oninput=event=>event.target.value=event.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');
$('#replay-prev').onclick=()=>setReplayStep(replayIndex-1);$('#replay-next').onclick=()=>setReplayStep(replayIndex+1);$('#replay-play').onclick=toggleReplay;
$('#replay-range').oninput=event=>setReplayStep(Number(event.target.value));$('#replay-export').onclick=()=>exportMatchRecord(currentReplay);$('#replay-exit').onclick=()=>showStartScreen(false);
try { const response = await fetch('./catalog.json'); if (!response.ok) throw Error('版块数据加载失败'); catalog = await response.json(); await showStartScreen(false);$('#start-local').disabled=false;$('#start-local').textContent='开始对战 ↗'; }
catch (e) { $('#ark-ready').textContent=`版块加载失败：${e.message}。请刷新重试。`; }
document.querySelector('.lab-global-header a').onclick=async e=>{if(game&&matchMode!=='menu'&&!replayMode&&game.phase!=='ended'){e.preventDefault();if(await askConfirm('返回游戏库？对局已保存在当前浏览器，可从本地回放继续。')){await flushMatchRecords();location.href='../index.html#experiments';}}};
