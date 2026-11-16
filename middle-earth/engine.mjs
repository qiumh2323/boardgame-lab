const all=(o)=>Object.entries(o).filter(([,n])=>n>0);
const effect=(Type,props={})=>({Type,...props});
export function createGame(cards,board,random=Math.random){
 const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const regions=board.regions.map(r=>r.Name), other=()=>1-s.turn, p=()=>s.players[s.turn];
 const s={chapter:0,turn:1,players:[3,2].map(coins=>({coins,played:[],races:{},tokens:[],trio:false,ring:0})),units:regions.map(r=>[r==='Arnor'?2:0,r==='Mordor'?2:0]),forts:regions.map(()=>null),market:[],landmarks:shuffle(board.landmarks),discard:[],slots:[],queue:[],choice:null,extra:false,victory:null,log:[]};
 const stacks=Object.fromEntries(board.races.map(r=>[r.Name,shuffle(r.AllianceTokens.map((t,i)=>({...t,race:r.Name,id:r.Name+'-'+i})))]));
 const log=(message)=>s.log.push(message);
 const refill=()=>{while(s.market.length<3&&s.landmarks.length)s.market.push(s.landmarks.shift());};
 function chapter(){s.chapter++;const deck=shuffle(cards.filter(c=>c.chapter===s.chapter));s.slots=board.layouts[s.chapter-1].map((d,i)=>({...d,card:deck[i],taken:false}));s.discard.push(...deck.slice(20));refill();log('第 '+s.chapter+' 章开始');}
 chapter();
 const available=(slot)=>!slot.taken&&slot.DependsOn.every(i=>s.slots[i].taken);
 const visible=(slot)=>!slot.taken&&(slot.IsFaceUp||available(slot));
 const count=(i)=>s.units.filter((u,j)=>u[i]>0||s.forts[j]===i).length;
 const raceCount=(i)=>Object.keys(s.players[i].races).length;
 const skillEffects=(i)=>s.players[i].played.flatMap(c=>c.effects.filter(e=>e.Type==='GainSkill'));
 const attr=(name)=>p().tokens.some(t=>t.Attribute===name);
 function price(c){
  if(c.chain?.requiresForFree&&p().played.some(x=>x.chain.grants===c.chain.requiresForFree))return {coins:0,chain:true};
  const need=Object.fromEntries(all(c.cost?.skills??c.RequiredSkills??{})), flex=[];
  for(const {SkillSet} of skillEffects(s.turn)){
   const items=all(SkillSet).filter(([k])=>k!=='IsOptional');
   if(SkillSet.IsOptional)flex.push(items.map(([k])=>k));
   else for(const [k,n] of items)need[k]=Math.max(0,(need[k]??0)-n);
  }
  if(attr('BENEFIT_FROM_ANY_SKILL'))flex.push(Object.keys(need));
  function missing(i){if(i===flex.length)return Object.values(need).reduce((a,b)=>a+b,0);let best=missing(i+1);for(const key of flex[i])if(need[key]>0){need[key]--;best=Math.min(best,missing(i+1));need[key]++;}return best;}
  return {coins:missing(0)+(c.cost?.coins??0)+(c.FortressToPlaceTo&&!attr('IGNORE_LANDMARK_TILE_COST')?s.forts.filter(x=>x===s.turn).length:0),chain:false};
 }
 function win(reason,winner=s.turn){s.victory={reason,winner};s.queue=[];s.choice=null;log(reason);}
 function check(){if(s.victory)return true;if(raceCount(s.turn)>=6){win('六族支持');return true;}if(count(s.turn)===7){win('七区势力');return true;}return false;}
 const money=(n)=>{p().coins+=Math.min(n,30-s.players[0].coins-s.players[1].coins);};
 const unitsLeft=()=>15-s.units.reduce((n,u)=>n+u[s.turn],0);
 function addUnits(j,n){const u=s.units[j];u[s.turn]+=Math.min(n,unitsLeft());const clash=Math.min(...u);u[0]-=clash;u[1]-=clash;}
 const front=(...e)=>s.queue.unshift(...e);
 const trigger=(name,tokens=p().tokens)=>tokens.filter(t=>t.Trigger===name).map(t=>t.Effect);
 const option=(label,value)=>({label,value});
 function choose(label,options,apply,optional=true){if(!options.length)return;if(optional)options.push(option('跳过此效果',null));s.choice={label,options,apply};}
 function tokens(races){return races.flatMap(([race,n])=>stacks[race].slice(0,n));}
 function pickToken(opts){choose('选择一枚结盟标记',opts.map(t=>option(t.id,t)),t=>{stacks[t.race].splice(stacks[t.race].indexOf(t),1);p().tokens.push(t);if(t.Type==='OneTimeImmediateRaceEffect')front(t.Effect);},false);}
 function play(c,chained=false){
  const current=[...p().tokens];p().played.push(c);
  const effects=c.effects.map(e=>c.color==='red'&&e.Type==='PlaceUnitsOnCentralBoard'?{...e,UnitsToPlace:e.UnitsToPlace+Number(attr('PLACE_EXTRA_UNIT_FOR_RED_CARD')),PossibleRegionsToPlace:attr('PLACE_ANYWHERE_FOR_RED_CARD')?regions:e.PossibleRegionsToPlace}:e);
  front(...effects,...trigger('CHAPTER_CARD_'+c.color.toUpperCase()+'_USED',current),...(chained?trigger('CHAINING_SYMBOL_USED',current):[]));
 }
 function finish(){
  if(s.slots.every(x=>x.taken)){if(s.chapter===3){const a=count(0),b=count(1);win('第三章结束 · 比较地区势力',a===b?null:a>b?0:1);return;}chapter();}
  if(!s.extra)s.turn=other();s.extra=false;
 }
 function resolve(e){
  switch(e.Type){
   case 'GainSkill':break;
   case 'GetCoinsFromReserve':money(e.CoinsToGet);break;
   case 'TakeEnemyCoins':s.players[other()].coins=Math.max(0,s.players[other()].coins-e.CoinsToTake);break;
   case 'TakeAnotherTurn':s.extra=true;break;
   case 'MoveOnTheRingQuestTrack':{
    const old=p().ring;p().ring+=e.MoveCount;
    if(p().ring>=14){p().ring=14;win(s.turn?'戒灵追上持戒者':'魔戒在末日火山毁灭');break;}
    front(...board.ring.BonusActions.filter(x=>x.Position>old&&x.Position<=p().ring).flatMap(x=>x.BonusActions));break;}
   case 'AddSupportOfARace':{
    const race=e.RaceToSupport;const n=p().races[race]=(p().races[race]??0)+1;
    if(n===2&&stacks[race])front(effect('PickAlliance',{races:[[race,2]]}));
    const colors=Object.keys(p().races).filter(k=>stacks[k]);
    if(!p().trio&&colors.length>=3){p().trio=true;s.queue.splice(n===2&&stacks[race]?1:0,0,effect('PickAlliance',{races:colors.slice(0,3).map(x=>[x,1])}));}break;}
   case 'PickAlliance':pickToken(tokens(e.races));break;
   case 'RevealAllianceTokensAndChooseSome':choose('选择结盟标记所属族群',e.RacesToRevealFrom.filter(r=>stacks[r].length).map(r=>option(r,r)),r=>pickToken(tokens([[r,e.TokensToReveal]])));break;
   case 'PlaceUnitsOnCentralBoard':{
    if(!unitsLeft())break;
    const split=e.Strategy==='EVERY_UNIT_FREELY', options=e.PossibleRegionsToPlace.map(r=>option(r,regions.indexOf(r)));
    const place=j=>{addUnits(j,split?1:e.UnitsToPlace);if(split&&e.UnitsToPlace>1)front({...e,UnitsToPlace:e.UnitsToPlace-1});};
    if(options.length===1)place(options[0].value);else choose('选择部署地区',options,place);break;}
   case 'MoveUnitsOnCentralBoard':{
    const options=board.regions.flatMap((r,i)=>s.units[i][s.turn]?r.ConnectedWith.map(b=>option(r.Name+' → '+b,[i,regions.indexOf(b)])):[]);
    choose('移动 1 支部队（剩余 '+e.UnitsToMove+' 次）',options,([i,j])=>{s.units[i][s.turn]--;addUnits(j,1);if(e.UnitsToMove>1)front({...e,UnitsToMove:e.UnitsToMove-1});});break;}
   case 'TakeEnemyUnitFromCentralBoard':choose('移除敌方部队',regions.flatMap((r,j)=>s.units[j][other()]?[option(r,j)]:[]),j=>{s.units[j][other()]--;if(e.UnitsToTake>1)front({...e,UnitsToTake:e.UnitsToTake-1});});break;
   case 'RemoveEnemyFortress':choose('移除敌方要塞',regions.flatMap((r,j)=>s.forts[j]===other()?[option(r,j)]:[]),j=>{s.forts[j]=null;});break;
   case 'DiscardEnemyGreyCard':choose('弃掉对手一张灰牌',s.players[other()].played.flatMap((c,i)=>c.color==='gray'?[option(c.id,i)]:[]),i=>s.discard.push(...s.players[other()].played.splice(i,1)));break;
   case 'PlayDiscardedChapterCard':choose('从弃牌堆免费建造一张',s.discard.map((c,i)=>option(c.id,i)),i=>play(s.discard.splice(i,1)[0]));break;
   case 'MultiChoice':{
    const opts=e.PossibleActions[0]?.Type==='MultiChoice'?e.PossibleActions[0].PossibleActions:e.PossibleActions;
    const labels={TakeEnemyUnitFromCentralBoard:'移除一支敌军',TakeEnemyCoins:'对手失去一枚金币',MoveUnitsOnCentralBoard:'移动一支部队'};
    choose('选择谋略（剩余 '+e.ActionsToTake+' 次）',opts.map((a,i)=>option(labels[a.Type]??a.Type,i)),i=>{front(opts[i],...(e.ActionsToTake>1?[{...e,ActionsToTake:e.ActionsToTake-1}]:[]));});break;}
   default:throw Error('未知效果 '+e.Type);
  }
 }
 function drain(){while(!s.choice&&!check()&&s.queue.length){resolve(s.queue.shift());check();}if(!s.choice&&!s.victory)finish();}
 function action(type,i){
  if(s.victory||s.choice||s.queue.length)return false;
  const slot=s.slots[i],card=type==='landmark'?s.market[i]:slot?.card;
  if(!card||!['play','discard','landmark'].includes(type)||(type!=='landmark'&&!available(slot)))return false;
  const cost=price(card);if(type!=='discard'&&p().coins<cost.coins)return false;
  if(type==='landmark'){
   const j=regions.indexOf(card.FortressToPlaceTo);if(s.forts[j]!==null)return false;
   p().coins-=cost.coins;s.market.splice(i,1);s.forts[j]=s.turn;log('修建 '+board.regions[j].Fortress);front(...card.Effects,...trigger('LANDMARK_TILE_USED'));
  }else{
   slot.taken=true;
   if(type==='discard'){s.discard.push(card);const bonus=p().tokens.some(t=>t.Trigger==='CHAPTER_CARD_DISCARDED');money(s.chapter*(bonus?2:1));log('弃牌 '+card.id);}
   else{p().coins-=cost.coins;play(card,cost.chain);log('建造 '+card.id);}
  }
  drain();return true;
 }
 function select(i){const ch=s.choice;if(!ch||!ch.options[i])return false;s.choice=null;const v=ch.options[i].value;if(v!==null)ch.apply(v);drain();return true;}
 return {s,price,available,visible,count,raceCount,action,select,regions,skillEffects};
}
