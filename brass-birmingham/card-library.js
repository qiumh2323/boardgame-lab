import {createDeck} from './engine.js?v=0.42';
import {sortedHand} from './interaction-help.js?v=0.42';

export const cardKey = card => card.kind==='location' ? `location:${card.loc}`
  : card.kind==='industry' ? `industry:${[...card.types].sort().join(',')}` : card.kind;

// Build from the fixed composition. Neither the draw order nor hidden discards are available here.
export function cardCatalogue(view, seat) {
  const hand = view.players[seat].hand;
  const ownIds = new Set(hand.map(card=>card.id));
  const discardedIds = new Set(view.discard.map(card=>card.id));
  const available = [], marked = [];
  for (const {card} of sortedHand(createDeck(view.players.length))) {
    const status = ownIds.has(card.id) ? 'hand' : discardedIds.has(card.id) ? 'discarded' : null;
    (status ? marked : available).push({key:cardKey(card),card,status});
  }
  return [...available,...marked];
}
