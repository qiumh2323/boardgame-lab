import {createGame} from './engine.mjs';
import {decide,observe} from './ai.mjs';
import {landmarkIcon,pawnIcon,originalPawn} from './board-icons.mjs?v=11';
const $=s=>document.querySelector(s), names=['护戒同盟','索伦'];
const words={Lindon:'林顿',Arnor:'亚尔诺',Rhovanion:'罗瓦尼安',Enedwaith:'埃奈德',Rohan:'洛汗',Gondor:'刚铎',Mordor:'魔多',BaradDur:'巴拉督尔',Bree:'布理',Erebor:'孤山',GreyHavens:'灰港',HelmsDeep:'圣盔谷',Isengard:'艾森加德',MinasTirith:'米那斯提力斯',Elves:'精灵',Dwarves:'矮人',Hobbits:'霍比特人',Humans:'人类',Ents:'树人',Wizards:'巫师',Eagles:'巨鹰',Ruse:'诡计',Strength:'力量',Courage:'勇气',Knowledge:'知识',Leadership:'领导力'};
const colors={gray:['技能','#5a6869'],yellow:['金币','#bb8c25'],blue:['魔戒','#356d99'],green:['族群','#3a7752'],red:['部队','#a34839'],purple:['谋略','#78528a']};
const flags={Lindon:[10,35],Arnor:[30,20],Rhovanion:[69,20],Enedwaith:[36,55],Rohan:[61,53],Gondor:[55,84],Mordor:[88,76]};
const sym={HARP:'竖琴',ANVIL:'铁砧',POT:'锅',HORSESHOE:'马蹄铁',FISH:'鱼',BACKPACK:'背包',HORSE:'马',ARROW:'箭',HELMET:'头盔',KNIFE:'短刀',ACORN:'橡果',SCROLL:'卷轴',FIRE:'火焰',BEDROLL:'铺盖',TREASURE_CASKET:'宝匣',ARMOR:'盔甲',AXE:'斧'};
const originalFlags={Lindon:[16,32],Arnor:[43,25],Rhovanion:[81,33],Enedwaith:[39,58],Rohan:[67,61],Gondor:[55,83],Mordor:[88,81]};
const fortressAnchors={Lindon:[6.9,26.6],Arnor:[34.2,19.2],Rhovanion:[70.9,27],Enedwaith:[29.5,52.5],Rohan:[57.1,55.8],Gondor:[45.4,78],Mordor:[78.5,75.5]};
let g, data, board, picked=null, artwork=null, aiSide=null, timer=null;
let busy=false;
let matchStats=null,resultShown=false;
let publicCardKnowledge=new Set(),discardKnowledge=[new Set(),new Set()];
const skillKeys=['Ruse','Strength','Courage','Knowledge','Leadership'];
const skillArt={Ruse:['1-03.png',113,16,67],Strength:['1-05.png',113,16,67],Courage:['1-06.png',113,16,67],Knowledge:['1-22.png',115,13,68],Leadership:['1-20.png',114,13,68]};
function skillIcon(key){const [file,x,y,size]=skillArt[key],svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),img=document.createElementNS('http://www.w3.org/2000/svg','image');svg.setAttribute('viewBox',[x,y,size,size].join(' '));svg.setAttribute('class','ability-icon');svg.setAttribute('role','img');svg.setAttribute('aria-label',tr(key));img.setAttribute('width','292');img.setAttribute('height','432');img.setAttribute('href','./original-art/cards/'+file);svg.append(img);return svg;}
function notify(text){const box=$('#action-notice');box.textContent=text;box.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>box.hidden=true,2700);}
async function transition(action,source,kind='play',landmark=null){
 if(busy||!g||g.s.victory)return;busy=true;document.body.classList.add('action-busy');hideTip();hideOwnedZoom();
 const side=g.s.turn,game=g,rect=source?.getBoundingClientRect(),target=(kind==='discard'?$('#actions'):document.querySelector('.resource-'+side))?.getBoundingClientRect();
 const onMap=kind==='choice'&&['map','move'].includes(choiceKind(game.s.choice,true));
 try{
  if(!onMap&&source&&rect&&target){
   const ghost=source.cloneNode(true);ghost.removeAttribute('id');ghost.className='action-flight';ghost.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;ghost.append(el('em',kind==='discard'?'弃牌换金币':kind==='landmark'?'建造地标':kind==='choice'?'结算效果':'建造章节牌','flight-label'));document.body.append(ghost);
   const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
   await ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${target.left+target.width/2-rect.left-rect.width/2}px,${target.top+target.height/2-rect.top-rect.height/2}px) scale(.25)`,opacity:.15}],{duration:reduced?100:650,easing:'ease-in-out',fill:'forwards'}).finished;ghost.remove();
  }else if(!onMap)await new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion:reduce)').matches?60:350));
  if(g!==game)return;
  if(!action()){notify('无法执行：请检查金币、可拿取状态或当前待结算效果。');return;}
  if(matchStats){const stats=matchStats.players[side];if(kind==='choice')stats.choices++;else{stats.turns++;if(kind==='play')stats.build++;if(kind==='discard')stats.discard++;if(kind==='landmark'){stats.landmark++;if(landmark)stats.landmarks.push(landmark);}}}
  picked=null;render();
  const next=({map:'#map .map-target',move:'#map .map-target'})[choiceKind()];
  if(next){const target=$(next);target?.scrollIntoView({block:'nearest'});target?.focus({preventScroll:true});}
  const panel=document.querySelector('.resource-panel.resource-'+side);if(panel&&!onMap)await panel.animate([{background:'#f2df9a'},{background:'#fffdf5'}],{duration:400}).finished;
 }finally{busy=false;document.body.classList.remove('action-busy');scheduleAI();}
}
const aiTurn=()=>g&&aiSide===g.s.turn&&!g.s.victory;
const viewerSide=()=>aiSide===null?g.s.turn:1-aiSide;
const dangerFor=side=>!g.s.victory&&side!==viewerSide();
function warning(node,text){node.classList.add('victory-warning');node.title=text;node.setAttribute('aria-label',text);}
function el(tag,text,klass){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(klass)e.className=klass;return e;}
function btn(label,action,klass){const e=el('button',label,klass);e.onclick=action;return e;}
const tr=k=>words[k]??k, glyph=k=>sym[k]??k;
const skills=(o,sep=' + ')=>Object.entries(o??{}).filter(([k,n])=>k!=='IsOptional'&&n>0).map(([k,n])=>tr(k)+' '+n).join(sep);
function description(e){switch(e.Type){
 case 'AddSupportOfARace':return '获得'+tr(e.RaceToSupport)+'支持';
 case 'GainSkill':return skills(e.SkillSet,e.SkillSet.IsOptional?'／':' + ');
 case 'GetCoinsFromReserve':return '获得 '+e.CoinsToGet+' 金币';
 case 'MoveOnTheRingQuestTrack':return '魔戒轨道前进 '+e.MoveCount+' 格';
 case 'PlaceUnitsOnCentralBoard':return '部署 '+e.UnitsToPlace+' 支部队：'+(e.PossibleRegionsToPlace.length===7?'任意地区':e.PossibleRegionsToPlace.map(tr).join('／'));
 case 'TakeEnemyCoins':return '对手失去 '+e.CoinsToTake+' 金币';
 case 'MoveUnitsOnCentralBoard':return '完成 '+e.UnitsToMove+' 次移动';
 case 'TakeEnemyUnitFromCentralBoard':return '移除 '+e.UnitsToTake+' 支敌军';
 case 'TakeAnotherTurn':return '再执行一个回合';
 case 'RemoveEnemyFortress':return '移除一座敌方要塞';
 case 'PlayDiscardedChapterCard':return '免费建造一张弃牌';
 case 'DiscardEnemyGreyCard':return '弃掉对手一张灰牌';
 case 'RevealAllianceTokensAndChooseSome':return '选择一族，翻两枚标记选一枚';
 case 'MultiChoice':return '三次选择：移除敌军／扣敌方金币／移动';
 default:return e.Type;
}}
const attributes={PLACE_ANYWHERE_FOR_RED_CARD:'红牌可部署到任意地区',BENEFIT_FROM_ANY_SKILL:'每回合可补一项任意技能',PLACE_EXTRA_UNIT_FOR_RED_CARD:'红牌额外部署一支部队',IGNORE_LANDMARK_TILE_COST:'免地标的要塞附加费'};
const triggers={CHAPTER_CARD_YELLOW_USED:'打出黄牌',CHAPTER_CARD_RED_USED:'打出红牌',CHAPTER_CARD_GREEN_USED:'打出绿牌',CHAPTER_CARD_BLUE_USED:'打出蓝牌',LANDMARK_TILE_USED:'建造地标',CHAINING_SYMBOL_USED:'连锁免费建造',CHAPTER_CARD_DISCARDED:'弃牌'};
const token=t=>tr(t.race)+' · '+(attributes[t.Attribute]??(t.Trigger==='CHAPTER_CARD_DISCARDED'?'弃牌金币翻倍':(t.Trigger?triggers[t.Trigger]+'时：':'')+description(t.Effect)));
function costText(c){return [c.cost?.coins?c.cost.coins+' 金币':'',skills(c.cost?.skills??c.RequiredSkills)].filter(Boolean).join(' + ')||'免费';}
function cardText(c){return (colors[c.color]?.[0]??'')+' · '+c.effects.map(description).join('；');}
function pick(type,i){picked={type,i};render();if(matchMedia('(max-width:800px)').matches)$('#actions').scrollIntoView({block:'nearest'});$('#actions h2')?.focus({preventScroll:true});}
function scheduleAI(){
 if(!aiTurn()||timer!==null||busy)return;
 timer=setTimeout(()=>{timer=null;if(!aiTurn())return;try{const a=decide(observe(g));if(!a)throw Error('no legal plan');const source=a[0]==='landmark'?$('#landmarks').children[a[1]]:a[0]==='choice'?$('#actions'):$(`[data-slot="${a[1]}"]`);transition(()=>a[0]==='choice'?g.select(a[1]):g.action(...a),source,a[0],a[0]==='landmark'?g.s.market[a[1]]:null);}catch(e){console.error(e);$('#actions').append(el('p','电脑未能继续行动，请返回准备界面重开。'));}},450);
}
function execute(type,i){if(aiTurn()||busy)return;const c=type==='landmark'?g.s.market[i]:g.s.slots[i]?.card;if(!c)return;if(type!=='discard'&&g.price(c).coins>g.s.players[g.s.turn].coins){notify('金币不足：还缺 '+(g.price(c).coins-g.s.players[g.s.turn].coins)+' 金币');return;}transition(()=>g.action(type,i),type==='landmark'?$('#landmarks').children[i]:$(`[data-slot="${i}"]`),type,type==='landmark'?c:null);}
function art(src,alt){const n=el('img',undefined,'component-art');n.src=src;n.alt=alt;n.decoding='async';return n;}
const svgNS='http://www.w3.org/2000/svg';
// Unobstructed physical tiles, read from the same cached photograph. The
// coordinates are interior insets so neighbouring tiles and the table stay out.
const landmarkFrames={Arnor:[53,95,251,249],Mordor:[332,95,249,250],Enedwaith:[607,91,249,248],Lindon:[886,86,250,249],Rohan:[185,380,254,256],Rhovanion:[485,378,251,257],Gondor:[776,377,253,258]};
function landmarkImage(l){
 const frame=landmarkFrames[l.FortressToPlaceTo];if(!artwork||!frame)return landmarkIcon(l.FortressToPlaceTo);
 const svg=document.createElementNS(svgNS,'svg'),img=document.createElementNS(svgNS,'image');
 svg.setAttribute('class','landmark-photo');svg.setAttribute('viewBox',frame.join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',landmarkName(l)+'原版地标板块');
 img.setAttribute('width','1200');img.setAttribute('height','720');img.setAttribute('href','./original-art/landmark-tiles.jpg');
 img.addEventListener('error',()=>{const fallback=landmarkIcon(l.FortressToPlaceTo);if(svg.classList.contains('landmark-preview'))fallback.classList.add('landmark-preview');svg.replaceWith(fallback);},{once:true});
 svg.append(img);return svg;
}
function landmarkName(l){return tr(board.regions.find(r=>r.Name===l.FortressToPlaceTo).Fortress);}
function details(c,{blocked=false,landmark=false}={}){
 const price=g.price(c),coins=g.s.players[g.s.turn].coins;
 const lines=[['效果',(landmark?['在'+tr(c.FortressToPlaceTo)+'建造要塞']:[]).concat((c.effects??c.Effects).map(description)).join('；')],['印刷费用',costText(c)],['本回合支付',price.chain?'0 金币（连锁免费）':price.coins+' 金币']];
 if(c.chain?.requiresForFree)lines.push(['免费连锁',glyph(c.chain.requiresForFree)]);
 if(c.chain?.grants)lines.push(['提供连锁',glyph(c.chain.grants)]);
 if(landmark){const forts=g.s.forts.filter(x=>x===g.s.turn).length,waived=g.s.players[g.s.turn].tokens.some(t=>t.Attribute==='IGNORE_LANDMARK_TILE_COST');lines.push(['要塞附加费',waived?'已免除':forts+' 金币']);}
 if(blocked)lines.push(['状态','被下方的牌压住，暂不可拿取']);
 else if(price.coins>coins)lines.push(['状态','还缺 '+(price.coins-coins)+' 金币'+(landmark?'':'；仍可弃牌换金币')]);
 return lines;
}
function appendDetails(target,title,lines){target.replaceChildren(el('strong',title,'detail-title'));const list=el('dl');for(const [name,value] of lines)list.append(el('dt',name),el('dd',value));target.append(list);}
function hideTip(){const t=$('#inspect');t.hidden=true;t.classList.remove('ring-tip');document.querySelector('[aria-describedby="inspect"]')?.removeAttribute('aria-describedby');}
function positionTip(node){
 const t=$('#inspect'),a=node.getBoundingClientRect(),w=t.offsetWidth,h=t.offsetHeight;
 if(a.bottom<0||a.top>innerHeight||a.right<0||a.left>innerWidth){hideTip();return;}
 if(node.classList.contains('quest-reward')){const x=Math.max(8,Math.min(innerWidth-w-8,a.left+a.width/2-w/2)),above=a.top>=h+12;t.style.left=x+'px';t.style.top=Math.max(8,Math.min(innerHeight-h-8,above?a.top-h-10:a.bottom+10))+'px';t.style.setProperty('--tip-arrow-x',Math.max(10,Math.min(w-10,a.left+a.width/2-x))+'px');t.dataset.placement=above?'above':'below';return;}
 t.style.left=Math.max(8,Math.min(innerWidth-w-8,a.right+9+w<=innerWidth?a.right+9:a.left-w-9))+'px';
 t.style.top=Math.max(8,Math.min(innerHeight-h-8,a.top))+'px';
}
function tooltip(node,title,lines,{precise=false}={}){
 const t=$('#inspect');
 const show=()=>{if(!node.isConnected)return;hideTip();appendDetails(t,typeof title==='function'?title():title,lines());t.classList.toggle('ring-tip',node.classList.contains('quest-reward'));t.hidden=false;node.setAttribute('aria-describedby','inspect');positionTip(node);};
 node.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&(!precise||matchMedia('(hover:hover)').matches))show();});
 node.addEventListener('pointerleave',hideTip);node.addEventListener('focus',()=>{if(!precise||node.matches(':focus-visible'))show();});node.addEventListener('blur',hideTip);
 return show;
}
const followTip=()=>{const node=document.querySelector('[aria-describedby="inspect"]');if(node)positionTip(node);};
window.addEventListener('scroll',followTip,{capture:true,passive:true});
window.addEventListener('resize',followTip);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});
function drawRing(){
 const ring=$('#ring');
 if(!ring.querySelector('.quest-status')){
  const status=el('div',undefined,'quest-status');status.append(el('span',undefined,'f0'),el('span',undefined,'f1'));
  if(artwork){
   const createTrack=()=>{const track=el('span',undefined,'quest-track');
    const base=art('./original-art/ring-track.png','');
    const fixed=art('./original-art/sauronWay.png','');
    const fellowship=art('./original-art/FotR.png',''),nazgul=art('./original-art/Sauron.png','');
    fixed.classList.add('quest-layer');fellowship.classList.add('quest-layer','quest-fellowship');nazgul.classList.add('quest-layer','quest-nazgul');
    track.append(base,fixed,fellowship,nazgul);return track;
   };
   const track=createTrack();track.classList.add('quest-inline');track.setAttribute('role','group');track.setAttribute('aria-label','魔戒轨道，悬浮奖励位置查看效果');ring.append(track);
   ringVisibility?.abort();ringVisibility=new AbortController();
   document.addEventListener('pointerdown',e=>{if(!ring.contains(e.target)&&document.querySelector('.quest-reward[aria-describedby]'))hideTip();},{signal:ringVisibility.signal});
   ringDismiss=hideTip;
   for(const side of [0,1])for(const reward of board.ring.BonusActions){
    const name=side?'戒灵':'持戒者',text=reward.BonusActions.map(description).join('；');
    const hint=el('button',undefined,'quest-reward quest-reward-'+side);hint.type='button';
    hint.dataset.side=side;hint.dataset.step=reward.Position;
    hint.setAttribute('aria-label',name+'第 '+reward.Position+' 格：'+text);
    const show=tooltip(hint,()=>hint.dataset.sharedStep?'魔戒轨道 · 重叠奖励':name+' · 第 '+reward.Position+' 格',()=>{
     const rows=[['奖励',text],['触发','到达或经过这格时结算一次'],['进度',g.s.players[side].ring>=reward.Position?'已通过':'尚未通过']];
     if(hint.dataset.sharedStep){const otherSide=1-side,otherStep=Number(hint.dataset.sharedStep),otherReward=board.ring.BonusActions.find(r=>r.Position===otherStep);rows[0]=[name+' · 第 '+reward.Position+' 格',text+'（'+(g.s.players[side].ring>=reward.Position?'已通过':'尚未通过')+'）'];rows.splice(1,0,[(otherSide?'戒灵':'持戒者')+' · 第 '+otherStep+' 格',otherReward.BonusActions.map(description).join('；')+'（'+(g.s.players[otherSide].ring>=otherStep?'已通过':'尚未通过')+'）']);rows[2]=['触发','双方各自到达对应进度时结算，并非同时获得两项奖励'];rows.pop();}
     return rows;
    },{precise:true});
    hint.addEventListener('click',show);track.append(hint);
   }
  }
  ring.append(status);
 }
 const [f,s]=g.s.players.map(p=>p.ring);
 ring.querySelector('.quest-status .f0').textContent='持戒者距末日火山 '+(14-f)+' 格';
 ring.querySelector('.quest-status .f1').textContent='戒灵距持戒者 '+(14-s)+' 格';
 for(const side of [0,1]){const status=ring.querySelector('.quest-status .f'+side),danger=dangerFor(side)&&g.s.players[side].ring===13;status.classList.toggle('victory-warning',danger);status.title=danger?names[side]+'的魔戒进度再前进1格即获胜':'';}
 for(const track of ring.querySelectorAll('.quest-track')){
  track.querySelector('.quest-fellowship').classList.toggle('ring-danger',dangerFor(0)&&f===13);track.querySelector('.quest-nazgul').classList.toggle('ring-danger',dangerFor(1)&&s===13);
  track.querySelector('.quest-fellowship').style.setProperty('--shift',f*3.33+'%');
  track.querySelector('.quest-nazgul').style.setProperty('--shift',(f+s)*3.33+'%');
  for(const hint of track.querySelectorAll('.quest-reward')){
   const side=Number(hint.dataset.side),step=Number(hint.dataset.step);
   hint.style.setProperty('--pos',(4.93+3.33*(step+(side?f:14)))+'%');
   const shared=board.ring.BonusActions.find(r=>side===0?f+r.Position===14+step:14+r.Position===f+step);
   hint.hidden=side===1&&!!shared;if(side===0&&shared)hint.dataset.sharedStep=shared.Position;else delete hint.dataset.sharedStep;
  }
 }
}
let ringVisibility,ringDismiss;
let moveChoice,moveFrom=null;
function choiceKind(c=g.s.choice,includeAI=false){
 if(!c||(!includeAI&&aiTurn())||g.s.victory)return null;
 return [['选择部署','map'],['移动 1 支','move'],['移除敌方','map'],['选择一枚结盟','token'],['选择结盟标记所属族群','race'],['从弃牌堆','discard'],['弃掉对手','gray'],['选择谋略','tactics']].find(([prefix])=>c.label.startsWith(prefix))?.[1];
}
function selectHere(c,i,node){if(!busy&&!aiTurn()&&g.s.choice===c&&c.options[i]){if($('#effect-choice').open)$('#effect-choice').close();transition(()=>g.select(i),node?.isConnected&&node.getClientRects().length?node:null,'choice');}}
function localGuide(selector,kinds,message){
 const box=$(selector),c=g.s.choice,kind=choiceKind(c);box.replaceChildren();box.hidden=!kinds.includes(kind);if(box.hidden)return;
 box.append(el('span',message??c.label));
 const skip=c.options.findIndex(o=>o.value===null);if(skip>=0){const button=btn('跳过',()=>selectHere(c,skip,button));box.append(button);}
}
function mapTarget(n,i){
 const c=g.s.choice,kind=choiceKind(c);if(kind!=='map'&&kind!=='move')return;
 const index=c.options.findIndex(o=>kind==='map'?o.value===i:Array.isArray(o.value)&&(moveFrom===null?o.value[0]===i:o.value[0]===moveFrom&&o.value[1]===i));
 const selected=kind==='move'&&i===moveFrom;
 if(index<0&&!selected)return;
 const label=kind==='map'?c.label:moveFrom===null?'选择出发地区':selected?'重选出发地区':'移动到';
 const button=btn(undefined,()=>{if(busy||g.s.choice!==c)return;if(kind==='move'&&(moveFrom===null||selected)){moveFrom=selected?null:i;drawMap();$('#map .map-target')?.focus({preventScroll:true});}else selectHere(c,index,button);},'map-target'+(selected?' origin-selected':''));
 n.removeAttribute('tabindex');button.setAttribute('aria-label',label+'：'+tr(g.regions[i]));n.append(button);
}
function drawMap(){
 const c=g.s.choice,kind=choiceKind(c);if(moveChoice!==c){moveChoice=c;moveFrom=null;}
 localGuide('#map-choice',['map','move'],kind==='move'?(moveFrom===null?'移动部队：点选出发地区':'移动部队：点选目的地，再点出发地区可重选'):null);
 drawTurnPrompt();
 const box=$('#map');box.replaceChildren();
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 for(const r of board.regions)for(const other of r.ConnectedWith)if(r.Name<other){const l=document.createElementNS(ns,'line'),a=flags[r.Name],b=flags[other];for(const [k,v] of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#927d53','stroke-width':'.6'}))l.setAttribute(k,v);svg.append(l);}
 if(!artwork)box.append(svg);
 g.regions.forEach((r,i)=>{
  const n=el('div',undefined,'region'),point=(artwork?originalFlags:flags)[r],pieces=el('div',undefined,'region-pieces');
  n.dataset.region=r;n.style.left=point[0]+'%';n.style.top=point[1]+'%';n.append(el('b',tr(r),'region-name'));
  g.s.units[i].forEach((q,j)=>{
   const faction=el('span',undefined,'region-faction f'+j);
   const piece=artwork?originalPawn:pawnIcon;
   if(g.s.forts[i]===j){const fort=el('span',undefined,'fort-piece'+(artwork?' map-fortress':''));fort.setAttribute('aria-label',names[j]+'要塞 · '+tr(r));fort.dataset.region=r;fort.append(piece(j,true));if(artwork){const a=fortressAnchors[r];fort.style.left=a[0]+'%';fort.style.top=a[1]+'%';box.append(fort);}else faction.append(fort);}
   if(q){const unit=el('span',undefined,'unit-piece');unit.setAttribute('role','img');unit.setAttribute('aria-label',names[j]+'士兵 ×'+q);unit.style.setProperty('--unit-step',Math.min(9,57/Math.max(1,q-1))+'px');unit.style.setProperty('--map-unit-step',Math.min(2.05,4.7/Math.max(1,q-1))+'cqw');for(let k=0;k<q;k++){const outline=el('span',undefined,'soldier-token');outline.append(piece(j,false));unit.append(outline);}faction.append(unit);}
   if(faction.childElementCount)pieces.append(faction);
  });
  n.append(pieces);n.tabIndex=0;tooltip(n,tr(r),()=>[
   ['相邻地区',board.regions[i].ConnectedWith.map(tr).join('、')],
   ...names.map((f,j)=>[f,g.s.units[i][j]+' 支士兵'+(g.s.forts[i]===j?' · 有要塞':'')])
  ]);mapTarget(n,i);box.append(n);
 });drawRing();
}
function drawCards(){
 const s=g.s,box=$('#cards'),max=Math.max(...s.slots.map(x=>s.slots.filter(y=>y.Row===x.Row).length));
 box.style.gridTemplateColumns='repeat('+(max*2)+',minmax(0,1fr))';box.replaceChildren();
 const counts={};for(const x of s.slots){const i=counts[x.Row]??0;counts[x.Row]=i+1;if(x.taken)continue;
  const row=s.slots.filter(y=>y.Row===x.Row).length, open=g.available(x), vis=g.visible(x), c=x.card;
  const n=btn(undefined,()=>execute('play',x.ID),'card '+(vis?(open?'open':'blocked'):'back'));n.dataset.slot=x.ID;n.disabled=!open||!!s.choice||!!s.victory||aiTurn();
  n.addEventListener('contextmenu',e=>{e.preventDefault();if(!n.disabled)execute('discard',x.ID);});
  n.style.gridColumnStart=s.chapter===3&&x.Row===4?2+i*4:max-row+1+i*2;n.style.gridColumnEnd='span 2';n.style.gridRow=x.Row;
  if(vis){n.style.setProperty('--c',colors[c.color][1]);n.append(el('b',colors[c.color][0]),el('span',c.effects.map(description).join('；')));if(c.chain?.requiresForFree&&s.players[viewerSide()].played.some(own=>own.chain.grants===c.chain.requiresForFree))n.classList.add('chain-ready');if(open)n.append(el('small',g.price(c).coins+' 金币'));}
  else n.textContent='未揭示';
  if(artwork){const img=art(vis?artwork[c.id]:'./original-art/chapter-'+s.chapter+'-back.png',vis?cardText(c):'未揭示');img.onerror=()=>{n.classList.remove('with-art');img.remove();};n.prepend(img);n.classList.add('with-art');if(open)n.dataset.price=g.price(c).coins+' 金币';}
  if(vis)largePreview(n,()=>art(artwork?.[c.id],cardText(c)),colors[c.color][0]+'章节牌',()=>details(c,{blocked:!open}));
  if(picked?.type==='card'&&picked.i===x.ID)n.classList.add('picked');box.append(n);
 }
 $('#remaining').textContent=s.slots.filter(x=>!x.taken).length+' 张剩余';
 $('#discard-open').textContent='弃牌堆 '+s.discard.length;$('#discard-open').setAttribute('aria-label','查看弃牌堆，共'+s.discard.length+'张');
 const ls=$('#landmarks');ls.className='landmarks';ls.replaceChildren(...s.market.map((l,i)=>{
  const tile=btn(undefined,()=>execute('landmark',i),'landmark-tile');tile.append(landmarkImage(l));
  tile.append(el('strong',landmarkName(l)),el('small',g.price(l).coins+' 金币'));largePreview(tile,()=>landmarkImage(l),landmarkName(l),()=>details(l,{landmark:true}));return tile;
 }));
 for(const n of ls.children)n.disabled=!!s.choice||!!s.victory||aiTurn();
 if(!s.market.length)ls.textContent='本章没有可选地标。';
}
function drawActions(){
 const s=g.s, a=$('#actions');a.hidden=false;a.replaceChildren();const heading=el('h2',s.choice?.label??'本回合');heading.tabIndex=-1;a.append(heading);
 if(s.victory){a.append(el('p',s.victory.reason),btn('查看本局统计',showVictoryStats));return;}
 if(aiTurn()){heading.textContent='规则电脑正在行动';return;}
 if(s.choice){a.hidden=true;return;}
 if(!picked){a.append(el('p','左键建造章节牌或地标；右键弃掉可拿取的章节牌换金币。悬浮查看大图与效果。','hint'));const mobile=el('details',undefined,'touch-discard');mobile.append(el('summary','触屏弃牌'));for(const x of s.slots.filter(x=>g.available(x)))mobile.append(btn('弃掉'+colors[x.card.color][0]+'牌（+'+s.chapter+'金币）',()=>execute('discard',x.ID)));a.append(mobile);return;}
 const {type,i}=picked,c=type==='card'?s.slots[i].card:s.market[i],price=g.price(c);
 if(type==='card'&&artwork)a.append(art(artwork[c.id],cardText(c)));
 if(type==='landmark'){const pic=landmarkImage(c);pic.classList.add('landmark-preview');a.append(pic);}
 const info=el('section',undefined,'action-details');appendDetails(info,type==='card'?colors[c.color][0]+'章节牌':landmarkName(c),details(c,{landmark:type==='landmark'}));a.append(info);
 const build=btn('支付 '+price.coins+' 金币并建造',()=>execute(type==='card'?'play':'landmark',i),'primary');build.disabled=s.players[s.turn].coins<price.coins;a.append(build);
 if(type==='card')a.append(btn('弃牌换金币',()=>execute('discard',i)));
 a.append(btn('取消选择',()=>{picked=null;render();}));
}
let minimizedEffect=null;
function drawEffectChoice(){
 const dialog=$('#effect-choice'),c=g.s.choice,kind=choiceKind(c);
 const restore=$('#effect-restore');
 if(!c||aiTurn()||g.s.victory||kind==='map'||kind==='move'){minimizedEffect=null;restore.hidden=true;if(dialog.open)dialog.close();return;}
 restore.hidden=minimizedEffect!==c;
 if(!restore.hidden)return;
 const heading=$('#effect-choice-title'),options=$('#effect-options'),footer=$('#effect-footer');
 heading.textContent=c.label;options.replaceChildren();footer.replaceChildren();
 for(const [i,o] of c.options.entries()){
  const button=btn(undefined,()=>selectHere(c,i),'effect-option');
  if(o.value===null){button.textContent='跳过此效果';footer.append(button);continue;}
  const card=kind==='gray'?g.s.players[1-g.s.turn].played[o.value]:kind==='discard'?g.s.discard[o.value]:kind==='race'?data.find(c=>c.effects.some(e=>e.Type==='AddSupportOfARace'&&e.RaceToSupport===o.value)):null;
  const tokenChoice=kind==='token'&&o.value?.id;
  const label=tokenChoice?token(o.value):kind==='race'?tr(o.value):card?cardText(card):o.label;
  const src=tokenChoice?allianceArt(o.value):card?artwork?.[card.id]:null;
  if(src){const img=art(src,'');img.classList.add(tokenChoice?'effect-token':'effect-card');img.addEventListener('error',()=>img.remove(),{once:true});button.append(img);}
  button.append(el('span',label));options.append(button);
 }
 footer.hidden=!footer.childElementCount;
 if(!dialog.open){for(const id of ['#discard-detail','#owned-detail'])if($(id).open)$(id).close();hideTip();hideOwnedZoom();dialog.showModal();}
}
function minimizeEffect(){
 const dialog=$('#effect-choice');if(!dialog.open||!g?.s.choice)return;
 minimizedEffect=g.s.choice;dialog.close();
 const restore=$('#effect-restore');restore.hidden=false;restore.focus({preventScroll:true});
}
$('#effect-minimize').onclick=minimizeEffect;
$('#effect-restore').onclick=()=>{if(!g)return;minimizedEffect=null;drawEffectChoice();};
$('#effect-choice').addEventListener('cancel',e=>{e.preventDefault();minimizeEffect();});
function inspectOwned(c,title='已建造章节牌'){
 $('#owned-detail h2').textContent=title;
 const dialog=$('#owned-detail'),content=$('#owned-content');content.classList.remove('alliance-catalog');content.replaceChildren();
 if(artwork)content.append(art(artwork[c.id],cardText(c)));
 const info=el('section');appendDetails(info,colors[c.color][0]+'章节牌',[
  ['效果',c.effects.map(description).join('；')],['印刷费用',costText(c)],
  ...(c.chain.grants?[['提供连锁',glyph(c.chain.grants)]]:[]),
  ...(c.chain.requiresForFree?[['免费连锁',glyph(c.chain.requiresForFree)]]:[])
 ]);content.append(info);hideTip();dialog.showModal();
}
let ownedHover;
function hideOwnedZoom(){clearTimeout(ownedHover);$('#owned-zoom').hidden=true;}
function largePreview(node,image,title,lines){
 const show=()=>{if(busy||!node.isConnected||document.querySelector('dialog[open]'))return;hideTip();const box=$('#owned-zoom');box.replaceChildren();
  if(artwork)box.append(image());
  const text=el('section');appendDetails(text,title,lines());box.append(text);box.hidden=false;
  const a=node.getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight;
  box.style.left=Math.max(8,Math.min(innerWidth-w-8,a.right+w+10<innerWidth?a.right+10:a.left-w-10))+'px';
  box.style.top=Math.max(8,Math.min(innerHeight-h-8,a.top))+'px';
 };
 node.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;clearTimeout(ownedHover);ownedHover=setTimeout(show,230);});
 node.addEventListener('pointerleave',hideOwnedZoom);node.addEventListener('focus',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(node.matches(':focus-visible'))show();})));node.addEventListener('blur',hideOwnedZoom);node.addEventListener('click',hideOwnedZoom);
}
function ownedPreview(node,c){largePreview(node,()=>art(artwork[c.id],cardText(c)),colors[c.color][0]+'章节牌',()=>[
 ['效果',c.effects.map(description).join('；')],...(c.chain.grants?[['提供连锁',glyph(c.chain.grants)]]:[]),...(c.chain.requiresForFree?[['免费连锁',glyph(c.chain.requiresForFree)]]:[])
]);}
function showAlliances(raceName=null){
 if(typeof raceName!=='string')raceName=null;
 const dialog=$('#owned-detail'),content=$('#owned-content');content.replaceChildren();$('#owned-detail h2').textContent=raceName?tr(raceName)+' · 潜在结盟效果':'联盟奖励';content.classList.add('alliance-catalog');
 content.append(el('p','同族第二张牌：翻两枚选一枚。首次集齐三种族群：各翻一枚，再选一枚。这里展示奖励种类，不显示本局未翻开的顺序。'));
 for(const race of board.races.filter(r=>!raceName||r.Name===raceName)){const section=el('section');section.append(el('h3',tr(race.Name)));race.AllianceTokens.forEach((t,i)=>{const row=el('p',token({...t,race:race.Name})),owner=g.s.players.findIndex(p=>p.tokens.some(x=>x.id===race.Name+'-'+i));if(owner>=0)row.append(el('small',names[owner]+'已获得','alliance-claimed'));section.append(row);});content.append(section);}
 if(raceName)content.append(btn('查看全部族群',()=>showAlliances()));
 hideTip();hideOwnedZoom();if(!dialog.open)dialog.showModal();
}
const allianceFiles={Elves:[13,14,15],Humans:[10,11,12],Dwarves:[8,9,7],Wizards:[1,3,2],Hobbits:[16,17,18],Ents:[5,4,6]};
function allianceArt(t){const race=board.races.find(r=>r.Name===t.race);let index=t.id?Number(t.id.split('-').at(-1)):race.AllianceTokens.findIndex(x=>(t.Attribute&&x.Attribute===t.Attribute)||(t.Effect&&JSON.stringify(x.Effect)===JSON.stringify(t.Effect)&&x.Trigger===t.Trigger));if(index<0)index=0;return './original-art/alliance/'+String(allianceFiles[t.race][index]).padStart(2,'0')+'.webp';}
function inspectAlliance(t){const d=$('#owned-detail'),content=$('#owned-content');content.classList.remove('alliance-catalog');content.replaceChildren(art(allianceArt(t),token(t)));$('#owned-detail h2').textContent=tr(t.race)+'结盟标记';const info=el('section');appendDetails(info,'标记效果',[['效果',token(t).split(' · ').slice(1).join(' · ')],['选择规则','每枚标记全局唯一；必须触发结盟，从本次翻出的标记中选择。']]);content.append(info);hideTip();hideOwnedZoom();d.showModal();}
function ownedAlliances(p){const section=el('section',undefined,'owned-tokens');section.append(el('h4','结盟效果'));for(const t of p.tokens){const text=token(t).split(' · '),item=btn(undefined,()=>showAlliances(t.race),'owned-token');item.setAttribute('aria-label',tr(t.race)+'结盟标记，查看该族潜在可选效果');item.append(el('strong',text[0]),el('span',text.slice(1).join(' · ')));section.append(item);}return section;}
function drawAlliancePool(){const host=$('#alliance-pool');host.replaceChildren();const taken=new Set(g.s.players.flatMap(p=>p.tokens.map(t=>t.id)));let total=0;
 for(const race of board.races){const remaining=race.AllianceTokens.map((t,i)=>({...t,race:race.Name,id:race.Name+'-'+i})).filter(t=>!taken.has(t.id));total+=remaining.length;const group=el('section',undefined,'alliance-race-group');group.append(el('h3',tr(race.Name)+' · '+remaining.length));const row=el('div',undefined,'alliance-token-row');for(const t of remaining){const item=btn(undefined,()=>{if(!busy)inspectAlliance(t);},'alliance-tile');item.dataset.token=t.id;item.setAttribute('aria-label',token(t)+'，查看效果');const img=art(allianceArt(t),token(t));img.loading='lazy';item.append(img);largePreview(item,()=>art(allianceArt(t),token(t)),tr(t.race)+'结盟标记',()=>[['效果',token(t).split(' · ').slice(1).join(' · ')],['状态','奖励图鉴；触发结盟后才能从翻出的标记中选择']]);row.append(item);}if(!remaining.length)row.append(el('small','已全部取走'));group.append(row);host.append(group);}
 $('#alliance-remaining').textContent='剩余 '+total+' 枚';
}
function resultContent(){const box=el('div'),winner=g.s.victory.winner;box.append(el('h3',winner===null?'双方平局':names[winner]+(aiSide===winner?'（电脑）':'')+'获胜'),el('p',g.s.victory.reason,'result-reason'));const duration=Math.max(0,Math.round(((matchStats?.endedAt??Date.now())-(matchStats?.startedAt??Date.now()))/1000));box.append(el('p','本局耗时 '+Math.floor(duration/60)+'分'+duration%60+'秒 · 第'+g.s.chapter+'章结束','hint'));const table=el('table',undefined,'result-table'),head=el('tr');head.append(el('th','统计'),...names.map((name,i)=>el('th',name+(aiSide===i?'（电脑）':''))));table.append(head);const values=[['主要行动次数',i=>matchStats?.players[i].turns??0],['建造章节牌',i=>matchStats?.players[i].build??0],['弃牌换金币',i=>matchStats?.players[i].discard??0],['建造地标',i=>matchStats?.players[i].landmark??0],['终局章节牌数',i=>g.s.players[i].played.length],['终局金币',i=>g.s.players[i].coins],['族群支持',i=>g.raceCount(i)+'/6'],['结盟标记',i=>g.s.players[i].tokens.length],['势力地区',i=>g.count(i)+'/7'],['魔戒进度',i=>g.s.players[i].ring+'/14'],['地图士兵',i=>g.s.units.reduce((n,u)=>n+u[i],0)],['地图要塞',i=>g.s.forts.filter(x=>x===i).length]];for(const [label,get] of values){const row=el('tr');row.append(el('th',label),el('td',String(get(0))),el('td',String(get(1))));table.append(row);}box.append(table);return box;}
function showVictoryStats(){if(!g?.s.victory)return;for(const id of ['#owned-detail','#discard-detail'])if($(id).open)$(id).close();hideTip();hideOwnedZoom();$('#victory-content').replaceChildren(resultContent());if(!$('#victory-detail').open)$('#victory-detail').showModal();}
function updateVictory(){if(!g.s.victory)return;if(matchStats&&!matchStats.endedAt)matchStats.endedAt=Date.now();const summary=$('#match-summary');summary.hidden=false;summary.replaceChildren(el('h2','本局统计'),resultContent());if(!resultShown){resultShown=true;const game=g;setTimeout(()=>{if(g===game&&g.s.victory)showVictoryStats();},busy?450:0);}}
$('#alliance-catalog-open').onclick=()=>showAlliances();
$('#victory-close').onclick=()=>$('#victory-detail').close();$('#victory-return').onclick=()=>{$('#victory-detail').close();$('#return').click();};
function drawDiscard(){
 const box=$('#discard-list');box.replaceChildren();let unknown=0;
 for(const c of [...g.s.discard].reverse()){
  const known=publicCardKnowledge.has(c.id)||discardKnowledge[viewerSide()].has(c.id);
  const item=known?btn(undefined,()=>inspectOwned(c,'弃牌详情'),'discard-card'):el('div',undefined,'discard-card discard-unknown');
  if(artwork)item.append(art(known?artwork[c.id]:'./original-art/chapter-'+c.chapter+'-back.png',known?cardText(c):'未公开章节牌'));
  item.append(el('small',known?colors[c.color][0]+' · 第'+c.chapter+'章':'未公开 · 第'+c.chapter+'章'));
  if(known){item.title=cardText(c);item.append(el('span',c.effects.map(description).join('；'),'discard-effect'));}else unknown++;
  box.append(item);
 }
 if(!g.s.discard.length)box.append(el('p','弃牌堆目前为空。','hint'));
 $('#discard-summary').textContent='共 '+g.s.discard.length+' 张'+(unknown?'，其中 '+unknown+' 张尚未公开。':'。')+'点击已公开的牌查看大图与解释。';
}
$('#discard-open').onclick=()=>{hideTip();hideOwnedZoom();drawDiscard();$('#discard-detail').showModal();};
$('#discard-close').onclick=()=>$('#discard-detail').close();
window.addEventListener('scroll',hideOwnedZoom,{capture:true,passive:true});window.addEventListener('resize',hideOwnedZoom);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideOwnedZoom();});
function drawOwned(){
 const host=$('#played');host.replaceChildren();
 g.s.players.forEach((p,i)=>{
  const section=el('section',undefined,'owned-player resource-'+i),head=el('div',undefined,'owned-head');
  head.append(el('h3',names[i]),el('small',p.played.length+' 张牌 · '+p.tokens.length+' 枚标记'));section.append(head);
  const piles=el('div',undefined,'owned-piles');
  for(const [color,[name,accent]] of Object.entries(colors)){
   const cards=p.played.filter(c=>c.color===color);
   const group=el('section',undefined,'owned-group');group.style.setProperty('--card-color',accent);
   group.append(el('h4',name+' '+cards.length));const grid=el('div',undefined,'owned-cards');grid.style.setProperty('--count',Math.max(1,cards.length));
   for(const c of cards){
    const item=btn(undefined,()=>inspectOwned(c),'owned-card');item.setAttribute('aria-label',cardText(c)+'，查看详情');
    item.style.setProperty('--stack-index',grid.childElementCount);
    if(artwork)item.append(art(artwork[c.id],cardText(c)));
    item.append(el('span',c.effects.map(description).join('；'),'owned-caption'));
    if(c.chain.grants)item.append(el('small','连锁 · '+glyph(c.chain.grants)));
    ownedPreview(item,c);
    grid.append(item);
   }if(!cards.length)grid.append(el('span','—','owned-vacant'));group.append(grid);piles.append(group);
  }
  section.append(piles);
  const landmarks=matchStats.players[i].landmarks,landmarkShelf=el('section',undefined,'owned-landmarks');
  landmarkShelf.append(el('h4','已建造地标 · '+landmarks.length));
  const tiles=el('div',undefined,'owned-landmark-tiles');
  for(const l of landmarks){const item=btn(undefined,()=>inspectOwnedLandmark(l),'landmark-tile');item.append(landmarkImage(l),el('strong',landmarkName(l)));largePreview(item,()=>landmarkImage(l),landmarkName(l),()=>ownedLandmarkDetails(l));tiles.append(item);}
  if(!landmarks.length)tiles.append(el('small','尚未建造地标'));
  landmarkShelf.append(tiles);section.append(landmarkShelf);
  host.append(section);
 });
}
function ownedLandmarkDetails(l){return [['建造位置',tr(l.FortressToPlaceTo)],['效果',l.Effects.map(description).join('；')||'建造要塞'],['印刷费用',costText(l)]];}
function inspectOwnedLandmark(l){const dialog=$('#owned-detail'),content=$('#owned-content');content.classList.remove('alliance-catalog');$('#owned-detail h2').textContent='已建造地标';const info=el('section');appendDetails(info,landmarkName(l),ownedLandmarkDetails(l));content.replaceChildren(landmarkImage(l),info);hideTip();hideOwnedZoom();dialog.showModal();}
function drawTurnPrompt(){
 const s=g.s,kind=choiceKind(),prompt=$('#turn-prompt');
 const instruction=s.victory?'':aiTurn()?'电脑正在行动':kind==='move'?(moveFrom===null?'移动部队：请选择出发地':'移动部队：请选择虚框目的地'):kind==='map'?s.choice.label+'：点选地图上的虚框':s.choice?s.choice.label:'请选择章节牌或地标';
 prompt.hidden=!instruction;if(prompt.textContent!==instruction)prompt.textContent=instruction;
}
function preloadArt(){
 const sprites=['map.png','ring-track.png','sauronWay.png','FotR.png','Sauron.png','landmark-tiles.jpg','soldier-fronts.jpg','pawn-tiles.jpg','chapter-1-back.png','chapter-2-back.png','chapter-3-back.png'];
 const queue=[...new Set([...sprites.map(f=>'./original-art/'+f),...Object.values(skillArt).map(([f])=>'./original-art/cards/'+f),...data.filter(c=>c.chapter===1).map(c=>artwork[c.id]),...Object.values(allianceFiles).flat().map(i=>'./original-art/alliance/'+String(i).padStart(2,'0')+'.webp'),...data.filter(c=>c.chapter!==1).map(c=>artwork[c.id])])];
 const next=()=>{const url=queue.shift();if(!url)return;const img=new Image();img.fetchPriority='low';img.onload=img.onerror=()=>setTimeout(next,0);img.src=url;};
 next();next();next();
}
$('#owned-close').onclick=()=>{$('#owned-detail').close();$('#owned-content').classList.remove('alliance-catalog');};
function render(){
 hideTip();
 hideOwnedZoom();
 const s=g.s;for(const slot of s.slots)if(g.visible(slot))publicCardKnowledge.add(slot.card.id);for(const p of s.players)for(const c of p.played)publicCardKnowledge.add(c.id);if(s.choice?.label.startsWith('从弃牌堆'))for(const c of s.discard)discardKnowledge[s.turn].add(c.id);
 $('#chapter').textContent='第 '+s.chapter+' 章';$('#turn').textContent=s.victory?(s.victory.winner===null?'双方平局':names[s.victory.winner]+'获胜'):names[s.turn]+(aiTurn()?'（电脑）':'')+'行动';
 drawMap();drawCards();drawActions();
 $('#players').replaceChildren(...s.players.map((p,i)=>{
  const active=!s.victory&&i===s.turn,n=el('section',undefined,'panel resource-panel resource-'+i+(active?' active':''));
  const header=el('div',undefined,'resource-head'),title=el('h2',names[i]);header.append(title);
  if(active)header.append(el('span','行动中','resource-turn'));
  const stats=el('dl',undefined,'resource-stats');
  for(const [label,value,max] of [['金币',p.coins],['地区',g.count(i),7],['族群',g.raceCount(i),6]]){
   const group=el('div',undefined,'resource-stat'),valueNode=el('dd');valueNode.append(el('strong',String(value)));
   if(max)valueNode.append(el('span','/'+max,'resource-target'));
   group.append(el('dt',label),valueNode);if(dangerFor(i)&&max&&value===max-1){const text=label==='地区'?'再占据1个地区即可获胜':'再获1种族群支持即可获胜';warning(group,names[i]+'：'+text);group.append(el('small',label==='地区'?'还差1区':'还差1族','victory-gap'));}stats.append(group);
  }
  const ringProgress=el('div',undefined,'resource-ring-progress');ringProgress.append(el('span','魔戒进度'),el('strong',p.ring+'/14'));if(dangerFor(i)&&p.ring===13){warning(ringProgress,names[i]+'：魔戒再前进1格即可获胜');ringProgress.append(el('small','还差1格','victory-gap'));}
  const races=Object.keys(p.races),tags=el('div',undefined,'resource-races');
  if(races.length)for(const race of races){const tag=btn(tr(race)+(p.races[race]>1?' ×'+p.races[race]:''),()=>showAlliances(race),'resource-race');tag.title='查看'+tr(race)+'的潜在结盟效果';tags.append(tag);}
  else tags.append(el('small','尚无族群支持'));
  const skillBox=el('section',undefined,'resource-skills'),fixed={},flex=[];
  for(const c of p.played)for(const e of c.effects)if(e.Type==='GainSkill'){
   if(e.SkillSet.IsOptional)flex.push(e.SkillSet);
   else for(const [key,value] of Object.entries(e.SkillSet))if(key!=='IsOptional')fixed[key]=(fixed[key]??0)+value;
  }
  if(p.tokens.some(t=>t.Attribute==='BENEFIT_FROM_ANY_SKILL'))flex.push(Object.fromEntries(skillKeys.map(k=>[k,1])));
  skillBox.append(el('h4','能力'));
  const skillRow=el('div',undefined,'skill-counts');for(const key of skillKeys){
   const item=el('span'),hasOptional=flex.some(f=>f[key]>0);item.append(el('small',tr(key)),skillIcon(key),el('strong',String(fixed[key]??0)+(hasOptional?'+':'')));if(hasOptional)item.title=tr(key)+'固定 '+(fixed[key]??0)+'；另有多选来源，+不代表额外固定能力';skillRow.append(item);
  }skillBox.append(skillRow);
  const optional=el('span',undefined,'multi-skill-column');optional.append(el('small','多选能力'));
  const choices=new Map();for(const f of flex){const keys=skillKeys.filter(k=>f[k]>0),signature=keys.join(',');choices.set(signature,(choices.get(signature)??0)+1);}
  if(!choices.size)optional.append(el('span','—','multi-skill-empty'));else for(const [signature,count] of choices)for(let copy=0;copy<count;copy++){const keys=signature.split(','),label=keys.length===5?'任意能力':keys.map(tr).join('／'),value=el('span',undefined,'multi-skill-value'),icons=el('span',undefined,'multi-choice-icons'+(keys.length>3?' many-options':''));keys.forEach(key=>icons.append(skillIcon(key)));value.append(icons);value.title=label+'：每次支付时任选其中一种，不计入左侧固定能力';value.setAttribute('aria-label',value.title);optional.append(value);}skillRow.append(optional);
  const chains=[...new Set(p.played.flatMap(c=>c.chain.grants?[c.chain.grants]:[]))];
  if(chains.length){const chainRow=el('div',undefined,'resource-chains');chainRow.append(el('small','连锁'));for(const key of chains)chainRow.append(el('span',glyph(key),'chain-chip'));skillBox.append(chainRow);}
  n.append(header,stats,ringProgress,skillBox,tags);if(p.tokens.length)n.append(ownedAlliances(p));return n;
 }));
 drawOwned();
 drawAlliancePool();updateVictory();
 drawEffectChoice();
 if($('#discard-detail').open)drawDiscard();
 $('#log').replaceChildren(...s.log.slice().reverse().map(l=>el('li',l)));
}
$('#start').onclick=()=>{const seat=$('#seat').value;aiSide=$('#mode').value==='pve'?(seat==='random'?Math.floor(Math.random()*2):1-Number(seat)):null;g=createGame(data,board);matchStats={startedAt:Date.now(),endedAt:null,players:[0,1].map(()=>({turns:0,build:0,discard:0,landmark:0,landmarks:[],choices:0}))};resultShown=false;$('#match-summary').hidden=true;publicCardKnowledge=new Set();discardKnowledge=[new Set(),new Set()];picked=null;$('#ring').replaceChildren();$('#lobby').hidden=true;$('#game').hidden=false;render();window.scrollTo(0,0);scheduleAI();};
$('#return').onclick=()=>{if(!g.s.victory&&!confirm('返回准备界面将结束本局。确定返回？'))return;ringDismiss?.();ringVisibility?.abort();hideTip();clearTimeout(timer);timer=null;g=null;picked=null;$('#game').hidden=true;$('#lobby').hidden=false;$('#start').focus();window.scrollTo(0,0);};
$('#mode').onchange=()=>{$('#seat-field').hidden=$('#mode').value==='pvp';};
const read=async f=>{const r=await fetch(f);if(!r.ok)throw Error(f);return r.json();};
try{[data,board,artwork]=await Promise.all([read('./chapter-cards.json?v=2'),read('./board.json'),read('./original-art/manifest.json?v=3').catch(()=>null)]);if(data.length!==69||board.layouts.length!==3)throw Error('数据不完整');if(artwork&&data.every(c=>artwork[c.id]))document.body.classList.add('original-art');else artwork=null;$('#start').disabled=false;$('#start').textContent='开始对战';if(artwork)preloadArt();}catch(e){$('#status').textContent='无法载入游戏资料，请刷新页面重试。';console.error(e);}
