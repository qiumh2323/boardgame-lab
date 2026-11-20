import {isGoods,distances,tileLocation,tileData} from './engine.js?v=0.46';

export function createSalePlan(view,seat){
 const selected=new Set(),beer=new Map(),stock=new Map(),products=new Map();
 for(const [key,tile] of Object.entries(view.board)){
  if(tile.type==='brewery'&&tile.resource>0)stock.set(key,tile.resource);
 }
 for(const merchant of view.merchants)if(merchant.beer)stock.set(`merchant:${merchant.id}`,1);
 for(const [key,tile] of Object.entries(view.board)){
  if(tile.owner!==seat||tile.flipped||!isGoods(tile.type))continue;
  const reachable=distances(view,[tileLocation(key)]);
  const merchants=view.merchants.filter(m=>(m.buys==='any'||m.buys===tile.type)&&reachable[m.loc]!==undefined);
  const breweries=[...stock.keys()].filter(id=>view.board[id]&&(view.board[id].owner===seat||reachable[tileLocation(id)]!==undefined));
  products.set(key,{need:tileData(tile).beersToSell,merchants,breweries});
 }
 function resolve(keys,supply){
  const available=new Map(supply),sales=[],choices=[],failed=new Set();
  const remaining=keys.map((_,i)=>keys.slice(i).reduce((sum,key)=>sum+products.get(key).need,0));
  function assign(index){
   if(index===keys.length)return true;
   if([...available.values()].reduce((sum,n)=>sum+n,0)<remaining[index])return false;
   const state=JSON.stringify([index,[...available.values()]]);
   if(failed.has(state))return false;
   const key=keys[index],{need,merchants,breweries}=products.get(key);
   for(const merchant of merchants){
    const sources=[`merchant:${merchant.id}`,...breweries];
    sales.push({key,merchant:merchant.id});
    if(take(need,0))return true;
    sales.pop();
    // A sale only needs the combination of barrels, regardless of click order.
    function take(left,start){
     if(!left)return assign(index+1);
     for(let i=start;i<sources.length;i++){
      const id=sources[i],count=available.get(id);
      if(!count)continue;
      available.set(id,count-1);choices.push(id);
      if(take(left-1,i))return true;
      choices.pop();available.set(id,count);
     }
     return false;
    }
   }
   failed.add(state);return false;
  }
  return assign(0)?{sales,choices}:null;
 }
 function selectableIndustries(){
  return [...products.keys()].filter(key=>!selected.has(key)&&resolve([...selected,key],stock));
 }
 function toggleIndustry(key){
  if(!selected.delete(key)&&products.has(key)&&resolve([...selected,key],stock))selected.add(key);
 }
 function sourceIds(keys){
  const sources=new Set();
  for(const key of keys){
   const {need,merchants,breweries}=products.get(key);
   if(!need)continue;
   for(const id of breweries)sources.add(id);
   for(const merchant of merchants){const id=`merchant:${merchant.id}`;if(stock.has(id))sources.add(id);}
  }
  return sources;
 }
 function cycleBeer(id){
  if(!beer.has(id)&&!sourceIds([...selected,...selectableIndustries()]).has(id))return;
  const count=(beer.get(id)??0)+1;
  if(count<=stock.get(id))beer.set(id,count);else beer.delete(id);
 }
 function snapshot(){
  const industries=[...selected],available=selectableIndustries();
  const required=industries.reduce((sum,key)=>sum+products.get(key).need,0),picked=[...beer.values()].reduce((sum,n)=>sum+n,0);
  const action=industries.length&&required===picked?resolve(industries,beer):null;
  const sources=[...new Set([...sourceIds([...industries,...available]),...beer.keys()])].map(id=>({id,picked:beer.get(id)??0,total:stock.get(id)}));
  return {industries,available,required,picked,sources,action};
 }
 function blockedReason(key){
  const product=products.get(key);
  if(!product)return '只能出售自己尚未翻面的商品产业。';
  return product.merchants.length?'可用啤酒不足，无法将这个产业加入本次出售。':'没有连到收购此商品的商人。';
 }
 return {toggleIndustry,cycleBeer,snapshot,blockedReason};
}
