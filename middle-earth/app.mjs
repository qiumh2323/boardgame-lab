import {createGame} from './engine.mjs';
import {stepAI} from './ai.mjs';
import {landmarkIcon,pawnIcon,originalPawn} from './board-icons.mjs?v=9';
const $=s=>document.querySelector(s), names=['护戒同盟','索伦'];
const words={Lindon:'林顿',Arnor:'亚尔诺',Rhovanion:'罗瓦尼安',Enedwaith:'埃奈德',Rohan:'洛汗',Gondor:'刚铎',Mordor:'魔多',BaradDur:'巴拉督尔',Bree:'布理',Erebor:'孤山',GreyHavens:'灰港',HelmsDeep:'圣盔谷',Isengard:'艾森加德',MinasTirith:'米那斯提力斯',Elves:'精灵',Dwarves:'矮人',Hobbits:'霍比特人',Humans:'人类',Ents:'树人',Wizards:'巫师',Eagles:'巨鹰',Ruse:'诡计',Strength:'力量',Courage:'勇气',Knowledge:'知识',Leadership:'领导力'};
const colors={gray:['技能','#5a6869'],yellow:['金币','#bb8c25'],blue:['魔戒','#356d99'],green:['族群','#3a7752'],red:['部队','#a34839'],purple:['谋略','#78528a']};
const flags={Lindon:[10,35],Arnor:[30,20],Rhovanion:[69,20],Enedwaith:[36,55],Rohan:[61,53],Gondor:[55,84],Mordor:[88,76]};
const sym={HARP:'竖琴',ANVIL:'铁砧',POT:'锅',HORSESHOE:'马蹄铁',FISH:'鱼',BACKPACK:'背包',HORSE:'马',ARROW:'箭',HELMET:'头盔',KNIFE:'短刀',ACORN:'橡果',SCROLL:'卷轴',FIRE:'火焰',BEDROLL:'铺盖',TREASURE_CASKET:'宝匣',ARMOR:'盔甲',AXE:'斧'};
const originalFlags={Lindon:[16,32],Arnor:[43,25],Rhovanion:[81,33],Enedwaith:[39,58],Rohan:[67,61],Gondor:[55,83],Mordor:[88,81]};
let g, data, board, picked=null, artwork=null, aiSide=null, timer=null;
const aiTurn=()=>g&&aiSide===g.s.turn&&!g.s.victory;
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
 if(!aiTurn()||timer!==null)return;
 timer=setTimeout(()=>{timer=null;if(!aiTurn())return;try{if(!stepAI(g))throw Error('no legal plan');picked=null;render();scheduleAI();}catch(e){console.error(e);$('#actions').append(el('p','电脑未能继续行动，请返回准备界面重开。'));}},320);
}
function execute(type,i){if(!aiTurn()&&g.action(type,i)){picked=null;render();if(g.s.choice||g.s.victory)$('#actions h2')?.focus();scheduleAI();}}
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
function hideTip(){const t=$('#inspect');t.hidden=true;document.querySelector('[aria-describedby="inspect"]')?.removeAttribute('aria-describedby');}
function positionTip(node){
 const t=$('#inspect'),a=node.getBoundingClientRect(),w=t.offsetWidth,h=t.offsetHeight;
 if(a.bottom<0||a.top>innerHeight||a.right<0||a.left>innerWidth){hideTip();return;}
 t.style.left=Math.max(8,Math.min(innerWidth-w-8,a.right+9+w<=innerWidth?a.right+9:a.left-w-9))+'px';
 t.style.top=Math.max(8,Math.min(innerHeight-h-8,a.top))+'px';
}
function tooltip(node,title,lines,{precise=false}={}){
 const t=$('#inspect');
 const show=()=>{if(!node.isConnected)return;hideTip();appendDetails(t,title,lines());t.hidden=false;node.setAttribute('aria-describedby','inspect');positionTip(node);};
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
   const opener=el('button',undefined,'quest-open');opener.type='button';opener.setAttribute('aria-label','放大魔戒轨道查看奖励');
   opener.setAttribute('aria-controls','quest-zoom');opener.setAttribute('aria-expanded','false');opener.append(createTrack());
   const zoom=el('section',undefined,'quest-zoom');zoom.id='quest-zoom';zoom.hidden=true;zoom.setAttribute('aria-label','放大的魔戒轨道');
   const track=createTrack(),head=el('div',undefined,'quest-zoom-head'),close=btn('关闭',()=>{opener.focus();hideZoom();});
   const rail=el('div',undefined,'quest-zoom-rail');rail.append(track);
   head.append(el('strong','魔戒轨道'),el('small','可左右滑动','quest-scroll-hint'),close);zoom.append(head,rail);ring.append(opener,zoom);
   let hideTimer,pinned=false;
   function positionZoom(){
    if(zoom.hidden)return;
    const a=opener.getBoundingClientRect(),w=zoom.offsetWidth,h=zoom.offsetHeight;
    if(a.bottom<=0||a.top>=innerHeight){hideZoom();return;}
    const y=a.top>=h+10?a.top-h-5:a.bottom+5;
    zoom.style.top=Math.max(6,Math.min(innerHeight-h-6,y))+'px';
    zoom.style.left=Math.max(6,Math.min(innerWidth-w-6,a.left+(a.width-w)/2))+'px';
   }
   function showZoom(){clearTimeout(hideTimer);if(zoom.hidden)hideTip();zoom.hidden=false;opener.setAttribute('aria-expanded','true');positionZoom();}
   function hideZoom(){clearTimeout(hideTimer);pinned=false;zoom.hidden=true;opener.setAttribute('aria-expanded','false');hideTip();}
   const leave=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!pinned&&!zoom.matches(':hover,:focus-within')&&!opener.matches(':hover,:focus-visible'))hideZoom();},240);};
   opener.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showZoom();});
   opener.addEventListener('pointerleave',leave);zoom.addEventListener('pointerenter',()=>clearTimeout(hideTimer));zoom.addEventListener('pointerleave',leave);
   opener.addEventListener('focus',()=>{if(opener.matches(':focus-visible'))showZoom();});
   opener.addEventListener('click',()=>{if(pinned)hideZoom();else{pinned=true;showZoom();}});
   // Events live on the ring's contents; abort window listeners when a new game resets the ring.
   ringVisibility?.abort();ringVisibility=new AbortController();const signal=ringVisibility.signal;
   ring.addEventListener('focusout',leave,{signal});
   ring.addEventListener('keydown',e=>{if(e.key==='Escape'&&!zoom.hidden){opener.focus();hideZoom();}},{signal});
   window.addEventListener('scroll',positionZoom,{capture:true,passive:true,signal});
   window.addEventListener('resize',positionZoom,{signal});
   document.addEventListener('pointerdown',e=>{if(!zoom.hidden&&!ring.contains(e.target))hideZoom();},{signal});
   ringDismiss=hideZoom;
   for(const side of [0,1])for(const reward of board.ring.BonusActions){
    const name=side?'戒灵':'持戒者',text=reward.BonusActions.map(description).join('；');
    const hint=el('button',undefined,'quest-reward quest-reward-'+side);hint.type='button';
    hint.dataset.side=side;hint.dataset.step=reward.Position;
    hint.setAttribute('aria-label',name+'第 '+reward.Position+' 格：'+text);
    const show=tooltip(hint,name+' · 第 '+reward.Position+' 格',()=>[
     ['奖励',text],['触发','到达或经过这格时结算一次'],['进度',g.s.players[side].ring>=reward.Position?'已通过':'尚未通过']
    ],{precise:true});
    hint.addEventListener('click',show);track.append(hint);
   }
  }
  ring.append(status);
 }
 const [f,s]=g.s.players.map(p=>p.ring);
 ring.querySelector('.quest-status .f0').textContent='持戒者距末日火山 '+(14-f)+' 格';
 ring.querySelector('.quest-status .f1').textContent='戒灵距持戒者 '+(14-s)+' 格';
 for(const track of ring.querySelectorAll('.quest-track')){
  track.querySelector('.quest-fellowship').style.setProperty('--shift',f*3.33+'%');
  track.querySelector('.quest-nazgul').style.setProperty('--shift',(f+s)*3.33+'%');
  for(const hint of track.querySelectorAll('.quest-reward')){
   const side=Number(hint.dataset.side),step=Number(hint.dataset.step);
   hint.style.setProperty('--pos',(4.93+3.33*(step+(side?f:14)))+'%');
   hint.toggleAttribute('data-overlap',side===1&&board.ring.BonusActions.some(reward=>Math.abs(reward.Position+14-step-f)<=1));
  }
 }
}
let ringVisibility,ringDismiss;
function drawMap(){
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
   if(g.s.forts[i]===j){const fort=el('span',undefined,'fort-piece');fort.setAttribute('aria-label',names[j]+'要塞');fort.append(piece(j,true));faction.append(fort);}
   if(q){const unit=el('span',undefined,'unit-piece');unit.setAttribute('role','img');unit.setAttribute('aria-label',names[j]+'士兵 ×'+q);unit.style.setProperty('--unit-step',Math.min(9,57/Math.max(1,q-1))+'px');unit.style.setProperty('--map-unit-step',Math.min(2.05,4.7/Math.max(1,q-1))+'cqw');for(let k=0;k<q;k++)unit.append(piece(j,false));faction.append(unit);}
   if(faction.childElementCount)pieces.append(faction);
  });
  n.append(pieces);n.tabIndex=0;tooltip(n,tr(r),()=>[
   ['相邻地区',board.regions[i].ConnectedWith.map(tr).join('、')],
   ...names.map((f,j)=>[f,g.s.units[i][j]+' 支士兵'+(g.s.forts[i]===j?' · 有要塞':'')])
  ]);box.append(n);
 });drawRing();
}
function drawCards(){
 const s=g.s,box=$('#cards'),max=Math.max(...s.slots.map(x=>s.slots.filter(y=>y.Row===x.Row).length));
 box.style.gridTemplateColumns='repeat('+(max*2)+',minmax(0,1fr))';box.replaceChildren();
 const counts={};for(const x of s.slots){const i=counts[x.Row]??0;counts[x.Row]=i+1;if(x.taken)continue;
  const row=s.slots.filter(y=>y.Row===x.Row).length, open=g.available(x), vis=g.visible(x), c=x.card;
  const n=btn(undefined,()=>pick('card',x.ID),'card '+(vis?(open?'open':'blocked'):'back'));n.disabled=!open||!!s.choice||!!s.victory||aiTurn();
  n.style.gridColumnStart=s.chapter===3&&x.Row===4?2+i*4:max-row+1+i*2;n.style.gridColumnEnd='span 2';n.style.gridRow=x.Row;
  if(vis){n.style.setProperty('--c',colors[c.color][1]);n.append(el('b',colors[c.color][0]),el('span',c.effects.map(description).join('；')));tooltip(n,colors[c.color][0]+'章节牌',()=>details(c,{blocked:!open}));if(open)n.append(el('small',g.price(c).coins+' 金币'));}
  else n.textContent='未揭示';
  if(artwork){const img=art(vis?artwork[c.id]:'./original-art/chapter-'+s.chapter+'-back.png',vis?cardText(c):'未揭示');img.onerror=()=>{n.classList.remove('with-art');img.remove();};n.prepend(img);n.classList.add('with-art');if(open)n.dataset.price=g.price(c).coins+' 金币';}
  if(picked?.type==='card'&&picked.i===x.ID)n.classList.add('picked');box.append(n);
 }
 $('#remaining').textContent=s.slots.filter(x=>!x.taken).length+' 张剩余';
 const ls=$('#landmarks');ls.className='landmarks';ls.replaceChildren(...s.market.map((l,i)=>{
  const tile=btn(undefined,()=>pick('landmark',i),'landmark-tile');tile.append(landmarkImage(l));
  tile.append(el('strong',landmarkName(l)),el('small',g.price(l).coins+' 金币'));tooltip(tile,landmarkName(l),()=>details(l,{landmark:true}));return tile;
 }));
 for(const n of ls.children)n.disabled=!!s.choice||!!s.victory||aiTurn();
 if(!s.market.length)ls.textContent='本章没有可选地标。';
}
function drawActions(){
 const s=g.s, a=$('#actions');a.replaceChildren();const heading=el('h2',s.choice?.label??'本回合');heading.tabIndex=-1;a.append(heading);
 if(s.victory){a.append(el('p',s.victory.reason));return;}
 if(aiTurn()){heading.textContent='规则电脑正在行动';return;}
 if(s.choice){const choices=el('div',undefined,'choices');s.choice.options.forEach((o,i)=>{const label=o.value?.race&&o.value?.id?token(o.value):o.label.split(' → ').map(tr).join(' → ');const card=data.find(c=>c.id===label);choices.append(btn(card?cardText(card):label,()=>{if(aiTurn())return;g.select(i);render();$('#actions h2')?.focus({preventScroll:true});scheduleAI();}));});a.append(choices);return;}
 if(!picked){a.append(el('p','在牌阵中选择一张可拿取的牌，或从地标区选择地标。','hint'));return;}
 const {type,i}=picked,c=type==='card'?s.slots[i].card:s.market[i],price=g.price(c);
 if(type==='card'&&artwork)a.append(art(artwork[c.id],cardText(c)));
 if(type==='landmark'){const pic=landmarkImage(c);pic.classList.add('landmark-preview');a.append(pic);}
 const info=el('section',undefined,'action-details');appendDetails(info,type==='card'?colors[c.color][0]+'章节牌':landmarkName(c),details(c,{landmark:type==='landmark'}));a.append(info);
 const build=btn('支付 '+price.coins+' 金币并建造',()=>execute(type==='card'?'play':'landmark',i),'primary');build.disabled=s.players[s.turn].coins<price.coins;a.append(build);
 if(type==='card')a.append(btn('弃牌换金币',()=>execute('discard',i)));
 a.append(btn('取消选择',()=>{picked=null;render();}));
}
function render(){
 hideTip();
 const s=g.s;$('#chapter').textContent='第 '+s.chapter+' 章';$('#turn').textContent=s.victory?(s.victory.winner===null?'双方平局':names[s.victory.winner]+'获胜'):names[s.turn]+(aiTurn()?'（电脑）':'')+'行动';
 drawMap();drawCards();drawActions();
 $('#players').replaceChildren(...s.players.map((p,i)=>{const n=el('div',undefined,'panel '+(!s.victory&&i===s.turn?'active':''));n.append(el('h2',names[i]),el('p',p.coins+' 金币 · '+g.count(i)+'/7 地区 · '+g.raceCount(i)+'/6 支持'),el('small',Object.keys(p.races).map(tr).join('、')||'尚无族群支持'));return n;}));
 $('#played').replaceChildren(...s.players.map((p,i)=>{const d=el('div');d.append(el('h3',names[i]));for(const c of p.played)d.append(el('p',cardText(c)+(c.chain.grants?' · '+glyph(c.chain.grants):'')));for(const t of p.tokens)d.append(el('p',token(t)));return d;}));
 $('#log').replaceChildren(...s.log.slice().reverse().map(l=>el('li',l)));
}
$('#start').onclick=()=>{const seat=$('#seat').value;aiSide=$('#mode').value==='pve'?(seat==='random'?Math.floor(Math.random()*2):1-Number(seat)):null;g=createGame(data,board);picked=null;$('#ring').replaceChildren();$('#lobby').hidden=true;$('#game').hidden=false;render();window.scrollTo(0,0);scheduleAI();};
$('#return').onclick=()=>{if(!g.s.victory&&!confirm('返回准备界面将结束本局。确定返回？'))return;ringDismiss?.();ringVisibility?.abort();hideTip();clearTimeout(timer);timer=null;g=null;picked=null;$('#game').hidden=true;$('#lobby').hidden=false;$('#start').focus();window.scrollTo(0,0);};
$('#mode').onchange=()=>{$('#seat-field').hidden=$('#mode').value==='pvp';};
const read=async f=>{const r=await fetch(f);if(!r.ok)throw Error(f);return r.json();};
try{[data,board,artwork]=await Promise.all([read('./chapter-cards.json?v=2'),read('./board.json'),read('./original-art/manifest.json?v=3').catch(()=>null)]);if(data.length!==69||board.layouts.length!==3)throw Error('数据不完整');if(artwork&&data.every(c=>artwork[c.id]))document.body.classList.add('original-art');else artwork=null;$('#start').disabled=false;$('#start').textContent='开始对战';}catch(e){$('#status').textContent='无法载入游戏资料，请刷新页面重试。';console.error(e);}
