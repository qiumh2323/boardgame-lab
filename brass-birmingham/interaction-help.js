import {F,ZH,applyAction} from './engine.js?v=0.23';
// Sort a display copy; data-card retains the authoritative hand index.
export function sortedHand(hand){
 const rank={location:0,industry:1,wildLocation:2,wildIndustry:3};
 return hand.map((card,index)=>({card,index})).sort((a,b)=>(rank[a.card.kind]??4)-(rank[b.card.kind]??4)||a.index-b.index);
}
export const ownOverbuild=(view,seat,a)=>a.type==='build'&&view.board[`${a.loc}:${a.slot}`]?.owner===seat;
export const overbuildPreferenceKey=view=>`brass-own-overbuild-warning:${view.gameId}`;
export function placementReason(view,seat,target,edges=[]){
 if(view.gameOver)return '对局已结束。';
 const p=view.players[seat];if(!p.hand.length)return '没有可用手牌。';
 // Public snapshots omit the deck; diagnostics use only the visible position.
 const s={...view,deck:view.deck||[],hiddenDiscard:view.hiddenDiscard||[]};
 if(target.route){
  if(edges.includes(target.route))return '这条连接已在本次行动中选中。';
  const a={type:'network',card:0,edges:[...edges,target.route]};
  return applyAction(s,seat,a,{auto:true}).error||'该线路可铺设，请先选择铺路行动。';
 }
 const types=F.cities[target.loc]?.slots[target.slot]||(F.farms[target.loc]?['brewery']:[]);
 return types.map(industry=>{
  const attempts=p.hand.map((_,card)=>applyAction(s,seat,{type:'build',loc:target.loc,slot:target.slot,industry,card},{auto:true}));
  if(attempts.some(a=>a.ok))return `${ZH[industry]}：可以建造，请先选择建造行动。`;
  const reason=attempts.find(a=>a.error!=='手牌不匹配地点或产业网络')?.error||'没有匹配的地点牌，或产业牌不匹配／未接入自己的网络';
  return `${ZH[industry]}：${reason}`;
 }).join('；')||'这里没有产业建造位。';
}
