import {createDeck} from './engine.js?v=0.16';

export const cardKey=c=>c.kind==='location'?`location:${c.loc}`:c.kind==='industry'?`industry:${[...c.types].sort().join(',')}`:c.kind;

// Build a catalogue from the fixed composition, never from the private draw pile.
export function cardCatalogue(view,seat){
 const groups=new Map();
 for(const card of [...createDeck(view.players.length),{kind:'wildLocation'},{kind:'wildIndustry'}]){
  const key=cardKey(card);
  if(!groups.has(key))groups.set(key,{key,card,total:card.kind.startsWith('wild')?4:0,hand:0,seen:0,discarded:0});
  if(!card.kind.startsWith('wild'))groups.get(key).total++;
 }
 const unique=cards=>[...new Map(cards.filter(c=>!c.kind.startsWith('wild')).map(c=>[c.id,c])).values()];
 for(const c of unique([...(view.seenCards||[]),...view.discard])){const row=groups.get(cardKey(c));if(row)row.seen++;}
 for(const c of unique(view.discard)){const row=groups.get(cardKey(c));if(row)row.discarded++;}
 for(const c of view.players[seat].hand){const row=groups.get(cardKey(c));if(row)row.hand++;}
 for(const row of groups.values())if(row.card.kind.startsWith('wild'))row.supply=view.wild[row.card.kind==='wildLocation'?'location':'industry'];
 return [...groups.values()];
}
