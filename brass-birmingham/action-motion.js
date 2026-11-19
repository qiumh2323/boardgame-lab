const CARD_BACK = 'assets/cards/piece-card-back.webp';
const COIN = 'assets/pieces/piece-coin-1.webp';
const q = selector => document.querySelector(selector);

export function clearActionMotion() {
  q('#action-motion')?.replaceChildren();
}

function center(element) {
  const r = element?.getBoundingClientRect();
  if (!r?.width || !r.height || r.bottom <= 0 || r.top >= window.innerHeight ||
      r.right <= 0 || r.left >= window.innerWidth) return null;
  return {x:r.left+r.width/2, y:r.top+r.height/2};
}

function offset(point, x, y) {
  return point && {x:point.x+x, y:point.y+y};
}

function fly(layer, {src,from,to,kind,delay=0,caption=''}) {
  if (!from || !to) return false;
  const safePoint = ({x,y}) => ({
    x:Math.min(window.innerWidth-30,Math.max(30,x)),
    y:Math.min(window.innerHeight-50,Math.max(38,y))
  });
  from = safePoint(from);
  to = safePoint(to);
  const piece = document.createElement('div');
  piece.className = `motion-piece motion-${kind}`;
  piece.style.left = `${from.x}px`;
  piece.style.top = `${from.y}px`;
  const image = document.createElement('img');
  image.src = src;
  image.alt = '';
  piece.append(image);
  if (caption) {
    const label = document.createElement('span');
    label.textContent = caption;
    piece.append(label);
  }
  layer.append(piece);
  const dx = to.x-from.x, dy = to.y-from.y;
  const motion = piece.animate([
    {transform:'translate(-50%,-50%) scale(.65)',opacity:0},
    {transform:`translate(calc(-50% + ${dx*.42}px),calc(-50% + ${dy*.42-18}px)) scale(1)`,opacity:1,offset:.48},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.78)`,opacity:.15}
  ],{duration:440,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});
  motion.onfinish=()=>piece.remove();
  return true;
}

export function playActionMotion(event, tileUrl) {
  const layer = q('#action-motion');
  if (!layer || typeof layer.animate!=='function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  clearActionMotion();
  const {actor, targets, previews, movement} = event;
  const viewed = Number(q('#hand').dataset.player);
  const playerArea = id => q(`#players .player:nth-child(${id+1})`);
  const hand = id => (viewed===id && center(q('#hand'))) || center(playerArea(id)) || center(q(`.turn-character[data-player="${id}"]`)) || center(q('#player-action-hint'));
  const anchor = hand(actor);
  const deck = center(q('[data-pile="draw"]'));
  const mat = type => viewed===actor ? center(q(`#mat-tokens [data-mat-type="${type}"]`)) : null;
  const action = options => fly(layer,options);
  if (movement) {
    for (let i=0;i<movement.discarded;i++) action({
      src:CARD_BACK,kind:'card',from:offset(anchor,i*10-10,0),to:offset(anchor,-65-i*7,-40),
      delay:i*75,caption:i===movement.discarded-1?`弃牌 ×${movement.discarded}`:''
    });
    for (const {player,count} of movement.drawn) for (let i=0;i<count;i++) action({
      src:CARD_BACK,kind:'card',from:deck||offset(hand(player),-80,-56),to:offset(hand(player),i*8-14,0),
      delay:460+i*65,caption:i===0?`抽牌 ×${count}`:''
    });
    for (let i=0;i<movement.wild;i++) action({
      src:CARD_BACK,kind:'card',from:center(q(`[data-pile="${i?'wildIndustry':'wildLocation'}"]`))||deck||offset(anchor,-80,-54),
      to:offset(anchor,i*15,0),delay:320+i*85,caption:i===0?'获得万能牌':''
    });
    const cash = center(playerArea(actor)?.querySelector('.summary-cash')) || anchor;
    const paid = center(q(`.turn-payment[data-player="${actor}"]`)) || offset(cash,-65,0);
    if (movement.spent>0) action({src:COIN,kind:'coin',from:cash,to:paid,delay:160,caption:`花费 £${movement.spent}`});
    if (movement.cashChange>0) action({src:COIN,kind:'coin',from:offset(cash,-80,20),to:cash,delay:260,caption:`+£${movement.cashChange}`});
  }
  for (const [index,target] of targets.entries()) {
    const preview = previews[index];
    if (target.kind==='route' && target.effect==='link') {
      const route = q(`[data-route="${target.key}"]`);
      const era = route?.dataset.routeEra;
      const source = viewed===actor && center(q('.reserve-links'));
      if (era && action({src:`assets/pieces/piece-link-${['yellow','purple','red','gray'][actor]}-${era}.webp`,kind:'link',from:source||anchor,to:center(route),delay:220+index*95})) route.classList.add('event-flight');
    } else if (target.kind==='tile' && (target.effect==='build'||target.effect==='remove') && preview) {
      const [loc,slot] = target.key.split(':');
      const tile = q(`[data-loc="${loc}"][data-slot="${slot}"]`);
      const point = center(tile);
      const remove = target.effect==='remove';
      const source = mat(preview.type)||anchor;
      if (action({src:tileUrl(preview.type,preview.level,!!preview.flipped,actor),kind:'tile',from:remove?point:source,to:remove?anchor:point,delay:220})) tile.classList.add('event-flight');
    } else if (target.kind==='mat' && target.effect==='develop') {
      const from = viewed===actor && center(q(`[data-mat-type="${target.type}"][data-level="${target.level}"]`));
      action({src:tileUrl(target.type,target.level,false,actor),kind:'tile',from:from||anchor,to:offset(from||anchor,0,-55),delay:200+index*85});
    }
  }
  q(`#action-buttons [data-type="${event.type}"]`)?.classList.add('event-committed');
}
