import {F,cityName,ZH,income} from './engine.js?v=0.50';

export function makeActionFeedback(before,after,actor,action,activity=null){
 const p=before.players[actor],next=after.players[actor],a=action,targets=[],previews=[],exhausted=[];
 let description='';
 if(a.type==='build'){
  const level=p.stacks[a.industry][0];description=`建造 ${cityName(a.loc)} ${ZH[a.industry]}${level}级`;
  targets.push({kind:'tile',key:`${a.loc}:${a.slot}`,effect:'build'});previews.push({owner:actor,type:a.industry,level});
 }else if(a.type==='network'){
  description=`连接${before.era==='canal'?'运河':'铁路'}：`+a.edges.map(id=>{
   targets.push({kind:'route',key:id,effect:'link'});
   const edge=F.connections.find(c=>c.id===id);return edge?cityName(edge.from)+'—'+cityName(edge.to):id;
  }).join('、');
 }else if(a.type==='develop'){
  const removed={};description='研发：'+a.industries.map(type=>{
   const level=p.stacks[type][removed[type]||0];removed[type]=(removed[type]||0)+1;
   targets.push({kind:'mat',type,level,effect:'develop'});previews.push({owner:actor,type,level});return `${ZH[type]}${level}级`;
  }).join('、');
 }else if(a.type==='sell'){
  description='出售并翻面：'+a.sales.map(sale=>{
   const t=before.board[sale.key];targets.push({kind:'tile',key:sale.key,effect:'flip'});
   previews.push({...t,flipped:true});return `${cityName(sale.key.split(':')[0])} ${ZH[t.type]}${t.level}级`;
  }).join('、');
 }else if(a.type==='loan')description='贷款 £30，收入降低3级';
 else if(a.type==='scout')description='探索，弃3张牌换取两张万能牌';
 else if(a.type==='liquidate'){
  const tile=before.board[a.key];
  description=`变卖 ${cityName(a.key.split(':')[0])} 的产业以支付欠款`;
  previews.push(tile);targets.push({kind:'tile',key:a.key,effect:'remove'});
 }
 else description='弃牌跳过行动';
 if(a.type==='sell')for(const tile of activity?.developed||[]) {
  targets.push({kind:'mat',...tile,effect:'develop'});
  previews.push({...tile,owner:actor});
 }
 for(const [key,t] of Object.entries(before.board)){
  const n=after.board[key];
  if(n&&n.owner===t.owner&&n.type===t.type&&n.level===t.level&&n.resource<t.resource){targets.push({kind:'tile',key,effect:'resource'});if(!t.flipped&&n.flipped){targets.push({kind:'tile',key,effect:'flip'});exhausted.push(`${cityName(key.split(':')[0])}${ZH[t.type]}已耗尽并翻面`);}}
 }
 for(const resource of ['coal','iron'])if(after[resource]<before[resource])targets.push({kind:'market',resource,effect:'resource'});
 for(const m of before.merchants)if(m.beer&&!after.merchants.find(n=>n.id===m.id)?.beer)targets.push({kind:'merchant',id:m.id,effect:'resource'});
 const details=[`${before.round!==after.round||before.era!==after.era?'含轮末结算，':''}现金 £${p.money} → £${next.money}`];
 if(p.income!==next.income)details.push(`收入 ${income(p.income)} → ${income(next.income)}`);
 if(exhausted.length)details.push(exhausted.join('、'));
 if(before.era!==after.era)details.push('运河时代结算完成，进入铁路时代');else if(!before.gameOver&&after.gameOver)details.push('铁路时代结算完成，对局结束');
 const discarded=a.type==='liquidate'?0:a.type==='scout'?3:1;
 const wild=a.type==='scout'?2:0;
 const drawn=after.players.flatMap((player,id)=>{
  const count=player.hand.length-before.players[id].hand.length+(id===actor?discarded-wild:0);
  return count>0?[{player:id,count}]:[];
 });
 const spent=activity?.spent??Math.max(0,next.spent-p.spent);
 return {rev:after.rev,actor,era:before.era,round:before.round,type:a.type,description,details,targets,previews,logEntry:activity?.logEntry,
  movement:{discarded,wild,drawn,spent,cashChange:next.money-p.money}};
}

// The composition is fixed by player count, independent of cards drawn or discarded.
export function missingCardCities(view,action,facts){
 const n=view.players.length;if(n>=4)return [];
 let cities=action.type==='build'?[action.loc]:action.type==='network'?(action.edges||[]).flatMap(id=>{const edge=facts.connections.find(c=>c.id===id);return edge?[edge.from,edge.to]:[];}):[];
 return [...new Set(cities)].filter(loc=>facts.cities[loc]&&!(facts.cards[n].locations[loc]>0));
}
export function needsMissingCityWarning(view,action,facts){return missingCardCities(view,action,facts).length>0;}

export function missingCityPreferenceKey(view){return `brass-missing-city-warning:${view.gameId}`;}
