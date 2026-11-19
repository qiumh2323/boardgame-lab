import {previewSales,isGoods,distances,tileLocation} from './engine.js?v=0.28';
// Resolve each selected industry locally; commit the full transaction only on final confirmation.
export function createSalePlan(view,seat){
 let sales=[],choices=[],checkpoints=[],pending=null;
 const feasibility=new Map();
 function completable(list,picks,result=previewSales(view,seat,list,picks)){
  if(result.ok)return true;if(!result.choice)return false;
  const key=JSON.stringify([list,picks]);if(feasibility.has(key))return feasibility.get(key);
  const valid=result.choice.options.some(o=>{const next=[...picks];next[result.choice.index]=o.id;return completable(list,next);});
  feasibility.set(key,valid);return valid;
 }
 function proposals(key){
  const tile=view.board[key];if(!tile||tile.owner!==seat||tile.flipped||!isGoods(tile.type)||sales.some(s=>s.key===key))return [];
  const reachable=distances(view,[tileLocation(key)]);
  return view.merchants.filter(m=>(m.buys==='any'||m.buys===tile.type)&&reachable[m.loc]!==undefined).map(m=>{
   const sale={key,merchant:m.id},result=previewSales(view,seat,[...sales,sale],choices);
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
  const proposal=pending?.find(p=>{if(!p.result.choice?.options.some(o=>o.id===id))return false;const next=[...p.choices];next[p.result.choice.index]=id;return completable([...sales,p.sale],next);});if(!proposal)return;
  const next=[...proposal.choices];next[proposal.result.choice.index]=id;
  const result=previewSales(view,seat,[...sales,proposal.sale],next);
  if(!result.ok&&!result.choice)return;
  pending=[{sale:proposal.sale,choices:next,result}];settle();
 }
 function snapshot(){
  const options=[...new Map((pending||[]).flatMap(p=>(p.result.choice?.options||[]).filter(o=>{const next=[...p.choices];next[p.result.choice.index]=o.id;return completable([...sales,p.sale],next);} )).map(o=>[o.id,o])).values()];
  return {sales:structuredClone(sales),choices:[...choices],pending:pending?.[0]?.sale.key||null,kind:pending?.[0]?.result.choice?.kind||null,options};
 }
 return {append,choose,snapshot,cancelPending:()=>{pending=null;},available:()=>Object.keys(view.board).filter(key=>proposals(key).length)};
}
