import {createGame} from './engine.mjs';
const $=s=>document.querySelector(s), names=['护戒同盟','索伦'];
const words={Lindon:'林顿',Arnor:'亚尔诺',Rhovanion:'罗瓦尼安',Enedwaith:'埃奈德',Rohan:'洛汗',Gondor:'刚铎',Mordor:'魔多',BaradDur:'巴拉督尔',Bree:'布理',Erebor:'孤山',GreyHavens:'灰港',HelmsDeep:'圣盔谷',Isengard:'艾森加德',MinasTirith:'米那斯提力斯',Elves:'精灵',Dwarves:'矮人',Hobbits:'霍比特人',Humans:'人类',Ents:'树人',Wizards:'巫师',Eagles:'巨鹰',Ruse:'诡计',Strength:'力量',Courage:'勇气',Knowledge:'知识',Leadership:'领导力'};
const colors={gray:['技能','#5a6869'],yellow:['金币','#bb8c25'],blue:['魔戒','#356d99'],green:['族群','#3a7752'],red:['部队','#a34839'],purple:['谋略','#78528a']};
const flags={Lindon:[10,35],Arnor:[30,20],Rhovanion:[69,20],Enedwaith:[36,55],Rohan:[61,53],Gondor:[55,84],Mordor:[88,76]};
const sym={HARP:'竖琴',ANVIL:'铁砧',POT:'锅',HORSESHOE:'马蹄铁',FISH:'鱼',BACKPACK:'背包',HORSE:'马',ARROW:'箭',HELMET:'头盔',KNIFE:'短刀',ACORN:'橡果',SCROLL:'卷轴',FIRE:'火焰',BEDROLL:'铺盖',TREASURE_CASKET:'宝匣',ARMOR:'盔甲',AXE:'斧'};
let g, data, board, picked=null;
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
function execute(type,i){if(g.action(type,i)){picked=null;render();if(g.s.choice||g.s.victory)$('#actions h2')?.focus();}}
function drawMap(){
 const box=$('#map');box.replaceChildren();
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 for(const r of board.regions)for(const other of r.ConnectedWith)if(r.Name<other){const l=document.createElementNS(ns,'line'),a=flags[r.Name],b=flags[other];for(const [k,v] of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#927d53','stroke-width':'.6'}))l.setAttribute(k,v);svg.append(l);}
 box.append(svg);
 g.regions.forEach((r,i)=>{const n=el('div',undefined,'region');n.style.left=flags[r][0]+'%';n.style.top=flags[r][1]+'%';n.append(el('b',tr(r)));g.s.units[i].forEach((q,j)=>{if(q||g.s.forts[i]===j)n.append(el('span',(g.s.forts[i]===j?'♜ ':'')+q+' ','f'+j));});box.append(n);});
 const [f,s]=g.s.players.map(p=>p.ring);$('#ring').replaceChildren(el('span','持戒者距末日火山 '+(14-f)+' 格','f0'),el('span','戒灵距持戒者 '+(14-s)+' 格','f1'));
}
function drawCards(){
 const s=g.s,box=$('#cards'),max=Math.max(...s.slots.map(x=>s.slots.filter(y=>y.Row===x.Row).length));
 box.style.gridTemplateColumns='repeat('+(max*2)+',minmax(0,1fr))';box.replaceChildren();
 const counts={};for(const x of s.slots){const i=counts[x.Row]??0;counts[x.Row]=i+1;if(x.taken)continue;
  const row=s.slots.filter(y=>y.Row===x.Row).length, open=g.available(x), vis=g.visible(x), c=x.card;
  const n=btn(undefined,()=>pick('card',x.ID),'card '+(vis?(open?'open':'blocked'):'back'));n.disabled=!open||!!s.choice||!!s.victory;
  n.style.gridColumnStart=s.chapter===3&&x.Row===4?2+i*4:max-row+1+i*2;n.style.gridColumnEnd='span 2';n.style.gridRow=x.Row;
  if(vis){n.style.setProperty('--c',colors[c.color][1]);n.append(el('b',colors[c.color][0]),el('span',c.effects.map(description).join('；')));n.title='费用：'+costText(c)+(c.chain.requiresForFree?' · '+glyph(c.chain.requiresForFree)+'可免费':'');if(open)n.append(el('small',g.price(c).coins+' 金币'));}
  else n.textContent='ᚠ · 未揭示';
  if(picked?.type==='card'&&picked.i===x.ID)n.classList.add('picked');box.append(n);
 }
 $('#remaining').textContent=s.slots.filter(x=>!x.taken).length+' 张剩余';
 const ls=$('#landmarks');ls.className='landmarks';ls.replaceChildren(...s.market.map((l,i)=>btn(tr(board.regions.find(r=>r.Name===l.FortressToPlaceTo).Fortress)+' · '+g.price(l).coins+' 金币',()=>pick('landmark',i))));
 for(const n of ls.children)n.disabled=!!s.choice||!!s.victory;
 if(!s.market.length)ls.textContent='本章没有可选地标。';
}
function drawActions(){
 const s=g.s, a=$('#actions');a.replaceChildren();const heading=el('h2',s.choice?.label??'本回合');heading.tabIndex=-1;a.append(heading);
 if(s.victory){a.append(el('p',s.victory.reason));return;}
 if(s.choice){const choices=el('div',undefined,'choices');s.choice.options.forEach((o,i)=>{const label=o.value?.race&&o.value?.id?token(o.value):o.label.split(' → ').map(tr).join(' → ');const card=data.find(c=>c.id===label);choices.append(btn(card?cardText(card):label,()=>{g.select(i);render();$('#actions h2')?.focus({preventScroll:true});}));});a.append(choices);return;}
 if(!picked){a.append(el('p','在牌阵中选择一张可拿取的牌，或从地标区选择地标。','hint'));return;}
 const {type,i}=picked,c=type==='card'?s.slots[i].card:s.market[i],price=g.price(c);
 if(type==='card'){a.append(el('p',cardText(c)));const chain=[c.chain.requiresForFree?'免费条件：'+glyph(c.chain.requiresForFree):'',c.chain.grants?'提供连锁：'+glyph(c.chain.grants):''].filter(Boolean);if(chain.length)a.append(el('p',chain.join('；'),'hint'));}
 else a.append(el('p','在'+tr(c.FortressToPlaceTo)+'建造要塞；'+c.Effects.map(description).join('；')));
 a.append(el('p','印刷费用：'+costText(c)+(price.chain?' · 连锁免费':''),'hint'));
 const build=btn('支付 '+price.coins+' 金币并建造',()=>execute(type==='card'?'play':'landmark',i),'primary');build.disabled=s.players[s.turn].coins<price.coins;a.append(build);
 if(type==='card')a.append(btn('弃牌换金币',()=>execute('discard',i)));
 a.append(btn('取消选择',()=>{picked=null;render();}));
}
function render(){
 const s=g.s;$('#chapter').textContent='第 '+s.chapter+' 章';$('#turn').textContent=s.victory?(s.victory.winner===null?'双方平局':names[s.victory.winner]+'获胜'):names[s.turn]+'行动';
 drawMap();drawCards();drawActions();
 $('#players').replaceChildren(...s.players.map((p,i)=>{const n=el('div',undefined,'panel '+(!s.victory&&i===s.turn?'active':''));n.append(el('h2',names[i]),el('p',p.coins+' 金币 · '+g.count(i)+'/7 地区 · '+g.raceCount(i)+'/6 支持'),el('small',Object.keys(p.races).map(tr).join('、')||'尚无族群支持'));return n;}));
 $('#played').replaceChildren(...s.players.map((p,i)=>{const d=el('div');d.append(el('h3',names[i]));for(const c of p.played)d.append(el('p',cardText(c)+(c.chain.grants?' · '+glyph(c.chain.grants):'')));for(const t of p.tokens)d.append(el('p',token(t)));return d;}));
 $('#log').replaceChildren(...s.log.slice().reverse().map(l=>el('li',l)));
}
$('#start').onclick=()=>{g=createGame(data,board);picked=null;$('#lobby').hidden=true;$('#game').hidden=false;render();window.scrollTo(0,0);};
$('#return').onclick=()=>{if(!g.s.victory&&!confirm('返回准备界面将结束本局。确定返回？'))return;g=null;picked=null;$('#game').hidden=true;$('#lobby').hidden=false;$('#start').focus();window.scrollTo(0,0);};
const read=async f=>{const r=await fetch(f);if(!r.ok)throw Error(f);return r.json();};
try{[data,board]=await Promise.all([read('./chapter-cards.json'),read('./board.json')]);if(data.length!==69||board.layouts.length!==3)throw Error('数据不完整');$('#start').disabled=false;$('#start').textContent='开始双人对战';}catch(e){$('#status').textContent='无法载入游戏资料，请刷新页面重试。';console.error(e);}
