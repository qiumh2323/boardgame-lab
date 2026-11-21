// Public tabletop pieces, rendered from the authoritative game view.
import {PLAYER_COLORS,COLOR_NAMES,playerColor} from './player-colors.js?v=0.40';
export const merchantTileStem = {
  blank:'2_nothing', any:'2_manufacturecottonpottery',
  cottonMill:'2_cotton', manufacturer:'2_manufacture', pottery:'3_pottery'
};

export function tablePieceAssets() {
  return [
    'assets/pieces/beer-white.svg',
    ...Object.values(merchantTileStem).map(stem => `assets/pieces/piece-merchant-${stem}.webp`),
    ...Object.values(PLAYER_COLORS).map(({portrait:name}) => `assets/pieces/piece-character-${name}.webp`),
    ...[1,5,15].map(value => `assets/pieces/piece-coin-${value}.webp`),
    ...COLOR_NAMES.flatMap(color => [
      `assets/pieces/piece-vp-${color}.webp`,
      `assets/pieces/piece-income-${color}.webp`,
      `assets/pieces/piece-link-${color}-canal.webp`,
      `assets/pieces/piece-link-${color}-rail.webp`
    ])
  ];
}
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const at=([x,y])=>`left:${x*100}%;top:${y*100}%`;
export function coins(amount){let n=Math.max(0,Math.floor(amount)),list=[];for(let value of [15,5,1])while(n>=value){list.push(value);n-=value;}return list;}
export function coinPiece(value,{payment=false,index=0}={}){
 return `<span class="physical-coin${payment?' payment-coin':''}" data-value="${value}"${payment?` style="--coin-x:${index%3};--coin-y:${Math.floor(index/3)}"`:''} title="£${value}"><img src="assets/pieces/piece-coin-${value}.webp" alt="${payment?'本轮花费 ':''}£${value}"></span>`;
}
export function boardPieces(view,layout){
 let html='';
 view.order.forEach((id,index)=>{
  let p=view.players[id],pos=layout.turnOrder[index],label=`第${index+1}位 ${p.name}，本轮花费 £${p.spent}`;
  html+=`<div class="turn-character ${view.order[view.turn]===id&&!view.gameOver?'current':''}" data-player="${id}" style="${at(pos)};--piece-color:var(--${playerColor(p)})" title="${safe(label)}" aria-label="${safe(label)}"><img class="character-face" src="assets/pieces/piece-character-${PLAYER_COLORS[playerColor(p)].portrait}.webp" alt="${safe(p.name)}的行动顺序头像"></div>`;
  html+=`<div class="turn-payment" data-player="${id}" style="${at(layout.turnSpend[index])}" data-spent="${p.spent}" title="${safe(label)}">${coins(p.spent).map((v,i)=>coinPiece(v,{payment:true,index:i})).join('')}<span class="payment-total">£${p.spent}</span></div>`;
 });
 let groups=new Map();for(let p of view.players)for(let kind of ['vp','income']){
  let value=kind==='vp'?p.vp:p.income,space=kind==='vp'?((value%100)+100)%100:Math.min(99,Math.max(0,value)),pos=layout.track[String(space)];if(!pos)continue;
  let key=String(space),index=groups.get(key)||0;groups.set(key,index+1);
  let x=pos[0]+((index%2)-.5)*.008,y=pos[1]+Math.floor(index/2)*.008;
  let label=`${p.name} ${kind==='vp'?'胜利点':'收入轨'}：${value}`;
  html+=`<button type="button" class="track-token ${kind}" data-track-kind="${kind}" data-track-space="${space}" data-player="${p.id}" style="${at([x,y])}" aria-label="${safe(label)}" aria-controls="track-detail" aria-expanded="false"><img src="assets/pieces/piece-${kind}-${playerColor(p)}.webp" alt="">${kind==='vp'&&value>=100?`<span aria-hidden="true">+${Math.floor(value/100)*100}</span>`:''}</button>`;
 }
 return html;
}
export function routePieces(view,layout,connections){
 const width=layout.routePieceWidth;
 return connections.filter(c=>c[view.era]).map(c=>{
  let loc=layout.routes[c.id]?.eras?.[view.era]||layout.routes[c.id];if(!loc)return '';let owner=view.links[c.id]?.owner;
  const tangent=loc.tangent,angle=tangent?Math.atan2(tangent[1][1]-tangent[0][1],tangent[1][0]-tangent[0][0])*180/Math.PI:loc.angle;
  let label=`${c.from}—${c.to}${owner!==undefined?'：'+view.players[owner].name:''}`;
  return `<button class="route-piece ${owner===undefined?'route-empty':'route-placed'}" data-route="${c.id}" data-route-era="${view.era}" style="${at(loc.center)};--angle:${angle}deg;width:${width}%;height:${width*5/9}%" title="${safe(label)}" aria-label="${safe(label)}">${owner!==undefined?`<img src="assets/pieces/piece-link-${playerColor(view.players[owner])}-${view.era}.webp" alt="${view.era==='canal'?'运河':'铁路'}连接板块">`:'<span></span>'}</button>`;
 }).join('');
}
export function playerReserve(p,era){
 let left=14-p.linkCount;
 return `<div class="reserve-links" aria-label="剩余${left}枚${era==='canal'?'运河':'铁路'}连接板块"><strong>${era==='canal'?'运河':'铁路'}板块<br><span class="reserve-count">${left}/14</span></strong><div class="link-reserve-pieces">${Array.from({length:left},(_,i)=>`<img style="--reserve-i:${i}" src="assets/pieces/piece-link-${playerColor(p)}-${era}.webp" alt="备用连接板块">`).join('')}</div></div><div class="player-purse"><strong>现金</strong><div class="cash-amount">£${p.money}</div><div class="cash-coins">${coins(p.money).map(v=>coinPiece(v)).join('')}</div></div>`;
}
