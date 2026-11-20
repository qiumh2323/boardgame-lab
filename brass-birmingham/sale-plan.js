import {previewSales,isGoods,distances,tileLocation,tileData} from './engine.js?v=0.46';
// Resolve each selected industry locally; commit the full transaction only on final confirmation.
export function createSalePlan(view,seat){
 let sales=[],choices=[],checkpoints=[],pending=null;
 const feasibility=new Map();
 const preview=(list,picks)=>previewSales(view,seat,list,picks,{settleRewards:false});
 function completable(list,picks,result=preview(list,picks)){
  if(result.ok)return true;if(!result.choice)return false;
  const key=JSON.stringify([list,picks]);if(feasibility.has(key))return feasibility.get(key);
  const valid=result.choice.options.some(o=>{const next=[...picks];next[result.choice.index]=o.id;return completable(list,next);});
  feasibility.set(key,valid);return valid;
 }
 function merchantsFor(key){
  const tile=view.board[key];
  const reachable=distances(view,[tileLocation(key)]);
  return view.merchants.filter(m=>(m.buys==='any'||m.buys===tile.type)&&reachable[m.loc]!==undefined);
 }
 function proposals(key){
  const tile=view.board[key];if(!tile||tile.owner!==seat||tile.flipped||!isGoods(tile.type)||sales.some(s=>s.key===key))return [];
  return merchantsFor(key).map(m=>{
   const sale={key,merchant:m.id},result=preview([...sales,sale],choices);
   return {sale,choices:[...choices],result};
  }).filter(p=>completable([...sales,p.sale],p.choices,p.result));
 }
 function settle(){
  const done=pending?.find(p=>p.result.ok);
  if(done){checkpoints.push(choices.length);sales.push(done.sale);choices=done.choices;pending=null;}
 }
 function append(key){
  if(pending)return;
  const index=sales.findIndex(s=>s.key===key);
  if(index>=0){choices=choices.slice(0,checkpoints[index]);sales=sales.slice(0,index);checkpoints=checkpoints.slice(0,index);return;}
  const options=proposals(key);if(!options.length)return;
  pending=options;settle();
 }
 function choose(id){
  const nextProposals=(pending||[]).flatMap(p=>{
   const choice=p.result.choice;
   if(!choice?.options.some(o=>o.id===id))return [];
   const next=[...p.choices];next[choice.index]=id;
   const list=[...sales,p.sale],result=preview(list,next);
   return completable(list,next,result)?[{sale:p.sale,choices:next,result}]:[];
  });
  if(nextProposals.length){pending=nextProposals;settle();}
 }
 function snapshot(){
  const options=[...new Map((pending||[]).flatMap(p=>(p.result.choice?.options||[]).filter(o=>{const next=[...p.choices];next[p.result.choice.index]=o.id;return completable([...sales,p.sale],next);} )).map(o=>[o.id,o])).values()];
  const key=pending?.[0].sale.key??null;
  const remaining=key?tileData(view.board[key]).beersToSell-(pending[0].choices.length-choices.length):0;
  return {sales:structuredClone(sales),choices:[...choices],pending:key,remaining,options};
 }
 function blockedReason(key){
  const tile=view.board[key];
  if(!tile||tile.owner!==seat||tile.flipped||!isGoods(tile.type))return '只能出售自己尚未翻面的商品产业。';
  return merchantsFor(key).length?'可用啤酒不足，无法出售这个产业。':'没有连到收购此商品的商人。';
 }
 return {append,choose,snapshot,blockedReason,cancelPending:()=>{pending=null;},available:()=>Object.keys(view.board).filter(key=>proposals(key).length)};
}
