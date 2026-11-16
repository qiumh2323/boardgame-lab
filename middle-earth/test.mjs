import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame} from './engine.mjs';
import {stepAI,observe,decide} from './ai.mjs';
const json=f=>JSON.parse(readFileSync(new URL(f,import.meta.url)));
const cards=json('./chapter-cards.json'),board=json('./board.json');
const zeros={Ruse:0,Strength:0,Courage:0,Knowledge:0,Leadership:0};
assert.equal(new Set(cards.map(c=>c.id)).size,69);
board.layouts.forEach((layout,i)=>{
 assert.equal(layout.length,20);
 assert.equal(layout.filter(x=>!x.DependsOn.length).length,[6,2,2][i]);
 for(const [j,x] of layout.entries()){assert.equal(x.ID,j);for(const y of x.DependsOn)assert.ok(y>j&&y<20);}
});
const deterministic=()=>0;
let g=createGame(cards,board,deterministic);
assert.equal(g.s.turn,1);
assert.equal(g.s.discard.length,3);
assert.equal(g.action('discard',0),false);
const sponsor={effects:[{Type:'GainSkill',SkillSet:{...zeros,Ruse:1,Knowledge:1,IsOptional:true}}],chain:{grants:'POT'}};
g.s.players[1].played.push(sponsor);
assert.equal(g.price({cost:{coins:1,skills:{Ruse:1,Knowledge:1}}}).coins,2);
assert.deepEqual(g.price({chain:{requiresForFree:'POT'},cost:{coins:4,skills:zeros}}),{coins:0,chain:true});
g.s.players[1].played=[];
for(let i=0;i<60;i++){
 const slot=g.s.slots.findIndex(g.available);
 assert.ok(g.action('discard',slot));assert.equal(g.s.chapter,Math.min(3,1+Math.floor((i+1)/20)));
}
assert.equal(g.s.victory.winner,null);assert.equal(g.s.discard.length,69);
let seed=41;const random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/2**32;
const checked={landmark:0,play:0,effectChoice:0,ring:0};
for(let n=0;n<220;n++){
 g=createGame(cards,board,random);
 for(let i=0;i<800&&!g.s.victory;i++){
  if(g.s.choice){checked.effectChoice++;assert.ok(g.select(Math.floor(random()*g.s.choice.options.length)));continue;}
  const opts=g.s.slots.flatMap((x,j)=>g.available(x)?g.price(x.card).coins<=g.s.players[g.s.turn].coins?[['play',j],['play',j],['discard',j]]:[['discard',j]]:[]);
  g.s.market.forEach((x,j)=>{if(g.price(x).coins<=g.s.players[g.s.turn].coins)opts.push(['landmark',j],['landmark',j]);});
  const [type,j]=opts[Math.floor(random()*opts.length)];
  assert.ok(g.action(type,j));if(checked[type]!==undefined)checked[type]++;
  assert.ok(g.s.players.every(p=>p.coins>=0));assert.ok(g.s.players.reduce((a,p)=>a+p.coins,0)<=30);
  assert.ok(g.s.units.every(u=>u.every(x=>x>=0)&&!u.every(Boolean)));
  for(const p of [0,1])assert.ok(g.s.units.reduce((a,u)=>a+u[p],0)<=15);
 }
 assert.ok(g.s.victory);
 if(g.s.players.some(p=>p.ring===14))checked.ring++;
}
for(const count of Object.values(checked))assert.ok(count>0);
console.log('220 full games, three layouts, discard, flexible skills and chaining:',checked);
for(let i=0;i<100;i++){
 const game=createGame(cards,board,random);
 const hidden=game.s.slots.find(x=>!game.visible(x));
 const card=hidden.card;
 Object.defineProperty(hidden,'card',{configurable:true,get(){throw Error('AI attempted to read a hidden chapter card');}});
 assert.ok(decide(observe(game)));
 Object.defineProperty(hidden,'card',{value:card,writable:true,configurable:true});
 for(let n=0;n<800&&!game.s.victory;n++)assert.ok(stepAI(game));
 assert.ok(game.s.victory);
}
console.log('100 complete AI-vs-AI games; unrevealed-card access check passed');
