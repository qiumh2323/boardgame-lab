import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,createDeck,applyAction,current,publicView} from '../brass-birmingham/engine.js?v=0.41';
import {cardCatalogue,cardKey} from '../brass-birmingham/card-library.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
const fresh=n=>createGame(Array.from({length:n},(_,i)=>'P'+i),Array(n).fill(false),142);
const play=(s,a)=>{let r=applyAction(s,current(s),a,{auto:true});assert.ok(r.ok,r.error);return r.state;};

test('2/3/4 player setup has 22/27/28 draw cards, 8 in each hand, one hidden discard each, and four of each wild',()=>{
 for(const [n,total,draw] of [[2,40,22],[3,54,27],[4,64,28]]){
  const s=fresh(n),cards=createDeck(n),rows=cardCatalogue(publicView(s,0),0);
  assert.equal(cards.length,total);assert.equal(s.deck.length,draw);assert.equal(s.hiddenDiscard.length,n);
  assert.ok(s.players.every(p=>p.hand.length===8));
  assert.ok(publicView(s,0).players.every(p=>p.discardPile.count===1&&p.discardPile.top===null));assert.deepEqual(s.wild,{location:4,industry:4});
  assert.equal(rows.filter(r=>!r.card.kind.startsWith('wild')).length,total);
  assert.equal(rows.filter(r=>r.status==='hand').length,8);assert.equal(rows.filter(r=>r.status==='seen').length,0);
  assert.equal(rows.filter(r=>r.card.kind.startsWith('wild')).length,8);
  assert.ok(!cards.some(c=>c.kind.startsWith('wild')));
  assert.equal(cards.filter(c=>c.kind==='industry'&&c.types.length===2).length,n===2?0:n===3?6:8);
 }
});

test('all player counts conserve both wild supplies through scouting and returning wild cards',()=>{
 for(const n of [2,3,4]){
  let s=fresh(n);
  for(let i=0;i<n;i++)s=play(s,{type:'scout',card:0,extra:[1,2]});
  assert.deepEqual(s.wild,{location:4-n,industry:4-n});
  assert.equal(s.players.flatMap(p=>p.hand).filter(c=>c.kind==='wildLocation').length,n);
  assert.equal(s.players.flatMap(p=>p.hand).filter(c=>c.kind==='wildIndustry').length,n);
  for(let i=0;i<2*n;i++){
   const p=s.players[current(s)],card=p.hand.findIndex(c=>c.kind.startsWith('wild'));
   assert.ok(card>=0);s=play(s,{type:'pass',card});
  }
  assert.deepEqual(s.wild,{location:4,industry:4});
  assert.ok(s.discard.every(c=>!c.kind.startsWith('wild')));
 }
});

test('catalogue marks physical copies individually and groups marked cards after the rest',()=>{
 let s=fresh(4);s.order=[1,0,2,3];
 const hiddenIds=new Set(s.hiddenDiscard.map(c=>c.id)),card=s.players[1].hand[0];
 s=play(s,{type:'pass',card:0});const v=publicView(s,0),rows=cardCatalogue(v,0);
 assert.equal(rows.filter(r=>r.key===cardKey(card)).length,createDeck(4).filter(c=>cardKey(c)===cardKey(card)).length);
 assert.equal(rows.find(r=>r.card.id===card.id).status,'seen');
 assert.deepEqual(v.players[1].discardPile,{count:2,top:card});
 assert.ok(v.seenCards.every(c=>!hiddenIds.has(c.id)));assert.equal(v.seenCards.length,1);
 assert.equal(v.hiddenDiscard,undefined);
 assert.equal(rows.findIndex(r=>r.status),rows.filter(r=>!r.status).length);
 const unmarkedCities=rows.filter(r=>!r.status&&r.card.kind==='location').map(r=>r.card.loc);
 assert.ok(unmarkedCities.indexOf('birmingham')<unmarkedCities.indexOf('coalbrookdale'));
 const catalogue=JSON.stringify(rows);v.players[1].hand=[{kind:'wildLocation'}];
 assert.equal(JSON.stringify(cardCatalogue(v,0)),catalogue);
 v.era='rail';v.discard=[];v.seenCards=[card,card];
 assert.equal(cardCatalogue(v,0).filter(r=>r.status==='seen').length,1);
});

test('old saves derive public seen cards from their discard pile and retain a face-down count',()=>{
 let s=fresh(2);delete s.seenCards;for(const p of s.players)delete p.discardPile;
 s=play(s,{type:'pass',card:0});assert.equal(s.seenCards.length,1);
 const v=publicView(s,0);delete v.seenCards;
 assert.equal(cardCatalogue(v,0).filter(r=>r.status==='seen').length,1);
 assert.deepEqual(v.players.map(p=>p.discardPile.count).sort(),[1,2]);
});
