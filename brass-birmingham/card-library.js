import {createDeck} from './engine.js?v=0.41';
import {sortedHand} from './interaction-help.js?v=0.41';

export const cardKey = card => card.kind==='location' ? `location:${card.loc}`
  : card.kind==='industry' ? `industry:${[...card.types].sort().join(',')}` : card.kind;

// Build from the fixed composition. Neither the draw order nor hidden discards are available here.
export function cardCatalogue(view, seat) {
  const hand = view.players[seat].hand;
  const ownIds = new Set(hand.map(card=>card.id));
  const seenIds = new Set([...(view.seenCards||[]),...view.discard].map(card=>card.id));
  const wildCounts = new Map(['wildLocation','wildIndustry'].map(kind=>[kind,hand.filter(card=>card.kind===kind).length]));
  const cards = [...createDeck(view.players.length)];
  for (const kind of wildCounts.keys()) for (let copy=0;copy<4;copy++) cards.push({kind,copy});
  const available = [], marked = [];
  for (const {card} of sortedHand(cards)) {
    const own = card.id===undefined ? card.copy<wildCounts.get(card.kind) : ownIds.has(card.id);
    const status = own ? 'hand' : card.id!==undefined && seenIds.has(card.id) ? 'seen' : null;
    (status ? marked : available).push({key:cardKey(card),card,status});
  }
  return [...available,...marked];
}
