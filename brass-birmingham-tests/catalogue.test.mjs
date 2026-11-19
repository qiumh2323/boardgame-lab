import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,createDeck,applyAction,current,publicView} from '../brass-birmingham/engine.js?v=0.13';
import {cardCatalogue,cardKey} from '../brass-birmingham/card-library.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
const fresh=n=>createGame(Array.from({length:n},(_,i)=>'P'+i),Array(n).fill(false),142);
const play=(s,a)=>{let r=applyAction(s,current(s),a,{auto:true});assert.ok(r.ok,r.error);return r.state;};

test('2/3/4 player setup has 22/27/28 draw cards, 8 in each hand, one hidden discard each, and four of each wild',()=>{
 for(const [n,total,draw] of [[2,40,22],[3,54,27],[4,64,28]]){
  const s=fresh(n),cards=createDeck(n),rows=cardCatalogue(publicView(s,0),0);
  assert.equal(cards.length,total);assert.equal(s.deck.length,draw);assert.equal(s.hiddenDiscard.length,n);
  assert.ok(s.players.every(p=>p.hand.length===8));assert.deepEqual(s.wild,{location:4,industry:4});
  assert.equal(rows.filter(r=>!r.card.kind.startsWith('wild')).reduce((v,r)=>v+r.total,0),total);
  assert.equal(rows.reduce((v,r)=>v+r.hand,0),8);assert.equal(rows.reduce((v,r)=>v+r.seen,0),0);
  assert.equal(rows.filter(r=>r.card.kind.startsWith('wild')).reduce((v,r)=>v+r.total,0),8);
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

test('catalogue flags only local hand and publicly seen cards, retaining history across eras',()=>{
 let s=fresh(4),privateIds=new Set(s.hiddenDiscard.map(c=>c.id)),card=s.players[current(s)].hand[0];
 s=play(s,{type:'pass',card:0});let v=publicView(s,0),rows=cardCatalogue(v,0),row=rows.find(r=>r.key===cardKey(card));
 assert.equal(row.seen,1);assert.equal(row.discarded,1);
 assert.ok(v.seenCards.every(c=>!privateIds.has(c.id)));assert.equal(v.seenCards.length,1);
 const catalogue=JSON.stringify(rows);v.players[1].hand=[{kind:'wildLocation'}];
 assert.equal(JSON.stringify(cardCatalogue(v,0)),catalogue);
 v.era='rail';v.discard=[];row=cardCatalogue(v,0).find(r=>r.key===cardKey(card));
 assert.equal(row.seen,1);assert.equal(row.discarded,0);
 v.seenCards=[card,card];assert.equal(cardCatalogue(v,0).find(r=>r.key===cardKey(card)).seen,1);
});

test('old saves derive public seen cards from their existing discard pile',()=>{
 let s=fresh(2);delete s.seenCards;s=play(s,{type:'pass',card:0});assert.equal(s.seenCards.length,1);
 let v=publicView(s,0);delete v.seenCards;
 assert.equal(cardCatalogue(v,0).reduce((v,r)=>v+r.seen,0),1);
});
