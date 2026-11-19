// Public tabletop pieces, rendered from the authoritative game view.
const colors=['yellow','purple','red','gray'];
const portraits=['watt','brunel','arkwright','bessemer'];
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const at=([x,y])=>`left:${x*100}%;top:${y*100}%`;
export function coins(amount){let n=Math.max(0,Math.floor(amount)),list=[];for(let value of [15,5,1])while(n>=value){list.push(value);n-=value;}return list;}
export function boardPieces(view,layout){
 let html='';
 view.order.forEach((id,index)=>{
  let p=view.players[id],pos=layout.turnOrder[index],label=`第${index+1}位 ${p.name}，本轮花费 £${p.spent}`;
  html+=`<div class="turn-character ${view.order[view.turn]===id&&!view.gameOver?'current':''}" style="${at(pos)};--piece-color:var(--${colors[id]})" title="${safe(label)}" aria-label="${safe(label)}"><img class="character-face" src="assets/pieces/piece-character-${portraits[id]}.webp" alt="${safe(p.name)}的行动顺序头像"></div>`;
  html+=`<div class="turn-payment" style="${at(layout.turnSpend[index])}" data-spent="${p.spent}" title="${safe(label)}"><span class="payment-total">£${p.spent}</span></div>`;
 });
 let groups=new Map();for(let p of view.players)for(let kind of ['vp','income']){
  let value=kind==='vp'?p.vp:p.income,space=kind==='vp'?((value%100)+100)%100:Math.min(99,Math.max(0,value)),pos=layout.track[String(space)];if(!pos)continue;
  let key=String(space),index=groups.get(key)||0;groups.set(key,index+1);
  let x=pos[0]+((index%2)-.5)*.008,y=pos[1]+Math.floor(index/2)*.008;
  let label=`${p.name} ${kind==='vp'?'胜利点':'收入轨'}：${value}`;
  html+=`<div class="track-token ${kind}" data-track-space="${space}" data-player="${p.id}" style="${at([x,y])}" title="${safe(label)}" aria-label="${safe(label)}"><img src="assets/pieces/piece-${kind}-${colors[p.id]}.webp" alt="${safe(label)}">${kind==='vp'&&value>=100?`<span>+${Math.floor(value/100)*100}</span>`:''}</div>`;
 }
 return html;
}
export function routePieces(view,layout,connections){
 return connections.filter(c=>c[view.era]).map(c=>{
  let loc=layout.routes[c.id]?.eras?.[view.era]||layout.routes[c.id];if(!loc)return '';let owner=view.links[c.id]?.owner;
  const tangent=loc.tangent,angle=tangent?Math.atan2(tangent[1][1]-tangent[0][1],tangent[1][0]-tangent[0][0])*180/Math.PI:loc.angle;
  let label=`${c.from}—${c.to}${owner!==undefined?'：'+view.players[owner].name:''}`;
  return `<button class="route-piece ${owner===undefined?'route-empty':'route-placed'}" data-route="${c.id}" data-route-era="${view.era}" style="${at(loc.center)};--angle:${angle}deg;${loc.width?'width:'+loc.width+'%;height:'+(loc.width*5/9)+'%;':''}" title="${safe(label)}" aria-label="${safe(label)}">${owner!==undefined?`<img src="assets/pieces/piece-link-${colors[owner]}-${view.era}.webp" alt="${view.era==='canal'?'运河':'铁路'}连接板块">`:'<span></span>'}</button>`;
 }).join('');
}
export function playerReserve(p,era){
 let left=14-p.linkCount;
 return `<div class="reserve-links" aria-label="剩余${left}枚${era==='canal'?'运河':'铁路'}连接板块"><strong>${era==='canal'?'运河':'铁路'}连接板块 · 剩余 ${left}/14</strong><div class="link-reserve-pieces">${Array.from({length:left},(_,i)=>`<img style="--reserve-i:${i}" src="assets/pieces/piece-link-${colors[p.id]}-${era}.webp" alt="备用连接板块">`).join('')}</div></div><div class="player-purse"><strong>现金</strong><div class="cash-amount">£${p.money}</div></div>`;
}
