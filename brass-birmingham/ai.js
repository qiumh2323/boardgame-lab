import {legalActions,applyAction,network,tileData,isGoods,distances,F,income,nextTile,current,ends} from './engine.js?v=0.21';

// Rule-based heuristic: only public board data and the acting player's hand.
// No access to the draw order or opponents' cards is used in evaluation.
export function evaluate(s,id){
 const p=s.players[id];let value=p.vp*12+p.money*.32+income(p.income)*3.5;
 let late=(s.deckCount??s.deck?.length??0)+s.players.reduce((n,p)=>n+(p.handCount??p.hand.length),0)<s.players.length*5;
 for(let [key,t]of Object.entries(s.board))if(t.owner===id){let d=tileData(t),loc=key.split(':')[0],merch=s.merchants.some(m=>(m.buys==='any'||m.buys===t.type)&&distances(s,[loc])[m.loc]!==undefined);
  value+=t.flipped?d.vp*(s.era==='canal'&&t.level>1?16:11):isGoods(t.type)?d.vp*(merch?6.3:3.7)+(d.income*.8):t.resource*(t.type==='brewery'?9:2.6);
  if(s.era==='canal'&&t.level>1)value+=7;
 }
 for(let [key,l]of Object.entries(s.links))if(l.owner===id){let points=0;for(let loc of ends(key)){if(F.merchants[loc])points+=2;for(let [k,t]of Object.entries(s.board))if(k.split(':')[0]===loc&&t.flipped)points+=tileData(t).linkVP;}value+=points*(late?12:9)+4;}
 value+=network(s,id).size*1.4;
 if(!late)for(let t of ['cottonMill','manufacturer','brewery','coalMine','ironWorks']){let d=nextTile(s,id,t);if(d)value+=(d.level-1)*1.4;}
 if(p.money<6&&!late)value-=9;
 return value;
}
export function selectAI(s,id=current(s)){
 let actions=legalActions(s,id),base=evaluate(s,id),best=null,bestScore=-Infinity;
 if(s.phase==='liquidation')return actions.sort((a,b)=>{let x=s.board[a.key],y=s.board[b.key];return (x.flipped?20:0)+tileData(x).vp-(y.flipped?20:0)-tileData(y).vp;})[0];
 for(let a of actions){let result=applyAction(s,id,a,{auto:true});if(!result.ok)continue;
  // Evaluate immediate action on pre-upkeep board to avoid valuing another turn's income twice.
  let score=evaluate(result.state,id)-base;
  if(a.type==='pass')score-=25;if(a.type==='loan')score+=s.players[id].money<12?24:s.players[id].money<22?10:-32;
  if(a.type==='build'&&a.industry==='brewery'&&Object.values(s.board).some(t=>t.owner===id&&t.type==='brewery'&&t.resource>0))score-=10;
  if(a.type==='develop'&&s.players[id].money<12)score-=8;
  score+=(stableNoise(s.rev,JSON.stringify(a))-.5)*.2;
  if(score>bestScore){bestScore=score;best=a;}
 }
 return best||actions.find(a=>a.type==='pass');
}
function stableNoise(n,text){for(let c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296;}
