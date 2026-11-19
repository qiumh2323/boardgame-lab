import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,publicView} from '../brass-birmingham/engine.js?v=0.23';
import {sortedHand,placementReason,ownOverbuild,overbuildPreferenceKey} from '../brass-birmingham/interaction-help.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
function fresh(){const s=createGame(['You','AI'],[false,true],88);s.order=[0,1];s.round=2;s.players[0].money=100;return s;}
test('display sorting puts cities before industries and retains original discard indices',()=>{
 const hand=[{kind:'industry',types:['brewery']},{kind:'location',loc:'derby'},{kind:'wildIndustry'},{kind:'location',loc:'birmingham'},{kind:'industry',types:['coalMine']},{kind:'wildLocation'}],before=structuredClone(hand);
 assert.deepEqual(sortedHand(hand).map(x=>x.index),[1,3,0,4,5,2]);assert.deepEqual(hand,before);
});
test('placement diagnostics use visible state and return actual rule failures without mutation',()=>{
 const s=fresh();s.links['birmingham-oxford']={owner:0};const v=publicView(s,0),before=structuredClone(v);
 assert.match(placementReason(v,0,{route:'birmingham-oxford'}),/该线路不能建造/);
 assert.match(placementReason(v,0,{route:'stokeOnTrent-stone'}),/连接自己的网络/);
 v.players[0].money=0;assert.match(placementReason(v,0,{route:'birmingham-coventry'}),/现金不足/);v.players[0].money=100;
 v.players[0].hand=[{kind:'location',loc:'derby'}];assert.match(placementReason(v,0,{loc:'birmingham',slot:0}),/没有匹配/);
 v.players[0].hand=before.players[0].hand;assert.deepEqual(v,before);
});
test('own overbuild detection and suppression are separate from opponent replacements and game scoped',()=>{
 const s=fresh();s.gameId='one';s.board['birmingham:0']={owner:0};s.board['birmingham:1']={owner:1};
 assert.equal(ownOverbuild(s,0,{type:'build',loc:'birmingham',slot:0}),true);
 assert.equal(ownOverbuild(s,0,{type:'build',loc:'birmingham',slot:1}),false);
 assert.equal(ownOverbuild(s,0,{type:'network'}),false);
 assert.notEqual(overbuildPreferenceKey(s),overbuildPreferenceKey({...s,gameId:'two'}));
});
