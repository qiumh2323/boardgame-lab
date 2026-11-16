// Heuristic player. The policy receives public information and legal/revealed choices only.
const advantage=(u,f,i)=>u[i]>0||f===i;
const total=(maps,i)=>maps.filter(z=>advantage(z.units,z.fort,i)).length;
function clash(u){const n=Math.min(...u);return u.map(x=>x-n);}
function territoryDelta(v,j,units,f=v.map[j].fort){
 const {side,foe,map}=v,old=map[j],after=map.map((x,i)=>i===j?{units,fort:f}:x);
 const own=total(after,side),enemy=total(after,foe);
 if(own===7)return 200;
 return (Number(advantage(units,f,side))-Number(advantage(old.units,old.fort,side)))*(own>=6?6:3)
  +(Number(advantage(old.units,old.fort,foe))-Number(advantage(units,f,foe)))*(total(map,foe)>=6?7:2)
  +(units[side]-old.units[side]-units[foe]+old.units[foe])*.35-(enemy===7?100:0);
}
function deployment(v,j,n){const x=[...v.map[j].units];x[v.side]+=Math.min(n,v.reserve);return territoryDelta(v,j,clash(x));}
function effects(v,list){
 let s=0;
 for(const e of list??[]){
  switch(e.Type){
   case 'GainSkill':s+=(4-v.chapter)*(e.SkillSet.IsOptional?1.4:Object.entries(e.SkillSet).reduce((n,[k,x])=>n+(k==='IsOptional'?0:x),0))*1.55;break;
   case 'GetCoinsFromReserve':s+=Math.min(v.bank,e.CoinsToGet)*(v.coins<4?1.15:.72);break;
   case 'MoveOnTheRingQuestTrack':s+=v.ring+e.MoveCount>=14?250:e.MoveCount*(v.ring>=10?4.6:2.5);break;
   case 'AddSupportOfARace':{const n=v.races[e.RaceToSupport]??0,distinct=Object.keys(v.races).length;s+=!n&&distinct>=5?250:!n?(distinct>=4?6:3.5):n===1?4:.3;break;}
   case 'PlaceUnitsOnCentralBoard':s+=Math.max(0,...e.PossibleRegionsToPlace.map(r=>deployment(v,v.map.findIndex(m=>m.name===r),e.UnitsToPlace)));break;
   case 'TakeEnemyCoins':s+=Math.min(v.enemyCoins,e.CoinsToTake)*.85;break;
   case 'TakeEnemyUnitFromCentralBoard':s+=v.map.some(m=>m.units[v.foe])?e.UnitsToTake*1.65:0;break;
   case 'MoveUnitsOnCentralBoard':s+=v.map.some(m=>m.units[v.side])?e.UnitsToMove*1.15:0;break;
   case 'RemoveEnemyFortress':s+=v.map.some(m=>m.fort===v.foe)?3:0;break;
   case 'TakeAnotherTurn':s+=5;break;
   case 'DiscardEnemyGreyCard':s+=2;break;
   case 'PlayDiscardedChapterCard':s+=4;break;
   case 'RevealAllianceTokensAndChooseSome':s+=4;break;
   case 'MultiChoice':s+=4;break;
  }
 }
 return s;
}
function top(items,score){let best=null,max=-Infinity;for(const item of items){const v=score(item);if(v>max){max=v;best=item;}}return best;}
export function observe(game){
 const {s,regions}=game,side=s.turn,foe=1-side,p=s.players[side],q=s.players[foe];
 const map=regions.map((name,j)=>({name,units:[...s.units[j]],fort:s.forts[j]}));
 const cards=s.choice?[]:s.slots.flatMap((x,i)=>game.available(x)?[{i,card:x.card,price:game.price(x.card),unlocks:s.slots.filter(t=>!t.taken&&t.DependsOn.includes(i)&&t.DependsOn.every(j=>j===i||s.slots[j].taken)).length}]:[]);
 const landmarks=s.choice?[]:s.market.map((card,i)=>({i,card,price:game.price(card)}));
 return {side,foe,map,chapter:s.chapter,races:{...p.races},enemyRaces:{...q.races},ring:p.ring,enemyRing:q.ring,coins:p.coins,enemyCoins:q.coins,bank:30-p.coins-q.coins,reserve:15-map.reduce((n,x)=>n+x.units[side],0),cards,landmarks,tokens:[...p.tokens],choice:s.choice?{label:s.choice.label, options:s.choice.options.map(o=>({...o,card:s.choice.label.startsWith('从弃牌堆')&&o.value!==null?s.discard[o.value]:null}))}:null};
}
export function decide(v){
 if(v.choice){
  const {label,options}=v.choice, idx=r=>v.map.findIndex(x=>x.name===r);
  const opts=options.map((o,i)=>({...o,i}));
  return ['choice',top(opts,o=>{
   const x=o.value;if(x===null)return -.05;
   if(o.card)return effects(v,o.card.effects);
   if(x?.race)return x.Attribute?3.9:x.Type==='EventBasedRaceEffect'?2.1+effects(v,[x.Effect])*.5:effects(v,[x.Effect]);
   if(label.startsWith('选择部署'))return deployment(v,x,1)+.1;
   if(label.startsWith('移动')&&Array.isArray(x)){
    const from=v.map[x[0]],to=[...v.map[x[1]].units];to[v.side]++;
    return territoryDelta(v,x[1],clash(to))-(from.units[v.side]===1&&from.fort!==v.side?3:0)+.02;
   }
   if(label.startsWith('移除')&&v.map[x]){const m=v.map[x],u=[...m.units];if(label.includes('部队'))u[v.foe]--;return territoryDelta(v,x,u,label.includes('要塞')?null:m.fort)+.1;}
   if(label.includes('谋略'))return o.label.includes('敌军')&&v.map.some(m=>m.units[v.foe])?3:o.label.includes('金币')&&v.enemyCoins?2:1;
   return idx(x)>=0?.1:1;
  }).i];
 }
 const plans=[];
 for(const {i,card,price,unlocks} of v.cards){
  const own=effects(v,card.effects);
  const flipped={...v,side:v.foe,foe:v.side,ring:v.enemyRing,races:v.enemyRaces,reserve:15-v.map.reduce((n,x)=>n+x.units[v.foe],0),coins:v.enemyCoins,enemyCoins:v.coins};
  const threat=effects(flipped,card.effects),denial=threat>=180?60:threat*.13;
  const trigger=v.tokens.filter(t=>t.Trigger==='CHAPTER_CARD_'+card.color.toUpperCase()+'_USED'||(price.chain&&t.Trigger==='CHAINING_SYMBOL_USED')).map(t=>t.Effect);
  if(price.coins<=v.coins)plans.push({action:['play',i],score:1.2+own+denial+effects(v,trigger)+(card.chain.grants?(4-v.chapter)*.8:0)-price.coins*(v.coins<4?1.45:1)-unlocks*.34});
  plans.push({action:['discard',i],score:Math.min(v.bank,v.chapter*(v.tokens.some(t=>t.Trigger==='CHAPTER_CARD_DISCARDED')?2:1))*(v.coins<4?1.05:.45)+denial*.90-unlocks*.34-.7});
 }
 for(const {i,card,price} of v.landmarks)if(price.coins<=v.coins){
  const j=v.map.findIndex(x=>x.name===card.FortressToPlaceTo);
  if(v.map[j].fort===null)plans.push({action:['landmark',i],score:1.3+territoryDelta(v,j,v.map[j].units,v.side)+effects(v,card.Effects)-price.coins*(v.coins<4?1.35:.75)});
 }
 return top(plans,x=>x.score)?.action??null;
}
export function stepAI(game){const a=decide(observe(game));return !!a&&(a[0]==='choice'?game.select(a[1]):game.action(...a));}
