import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,publicView,applyAction} from '../brass-birmingham/engine.js?v=0.27';
import {createSalePlan} from '../brass-birmingham/sale-plan.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
function fresh(){
 const s=createGame(['You','AI'],[false,true],55);s.order=[0,1];s.round=2;s.era='rail';
 s.links={'gloucester-worcester':{owner:0},'gloucester-redditch':{owner:0},'redditch-oxford':{owner:0}};
 s.board={'worcester:0':{owner:0,type:'cottonMill',level:2,resource:0,flipped:false},'redditch:0':{owner:0,type:'cottonMill',level:2,resource:0,flipped:false},'southern:0':{owner:0,type:'brewery',level:2,resource:1,flipped:false}};
 s.merchants=[{id:0,loc:'gloucester',buys:'any',beer:true},{id:1,loc:'gloucester',buys:'any',beer:true},{id:2,loc:'oxford',buys:'any',beer:true}];return s;
}
test('iterated sales select beer before another industry and commit once, with sequential free-development levels',()=>{
 const s=fresh();s.players[0].stacks.coalMine=[1,2,3];const before=structuredClone(s),plan=createSalePlan(publicView(s,0),0);
 plan.append('worcester:0');assert.equal(plan.snapshot().sales.length,0);assert.ok(plan.snapshot().options.some(o=>o.id==='merchant:2'));
 plan.choose('merchant:0');assert.match(plan.snapshot().kind,/免费研发/);assert.equal(plan.snapshot().options.find(o=>o.id==='coalMine').level,1);
 plan.choose('coalMine');assert.equal(plan.snapshot().sales.length,1);assert.ok(plan.available().includes('redditch:0'));
 plan.append('redditch:0');assert.ok(!plan.snapshot().options.some(o=>o.id==='merchant:0'));plan.choose('merchant:1');assert.equal(plan.snapshot().options.find(o=>o.id==='coalMine').level,2);plan.choose('coalMine');
 const draft=plan.snapshot();assert.equal(draft.pending,null);assert.equal(draft.sales.length,2);assert.deepEqual(draft.choices,['merchant:0','coalMine','merchant:1','coalMine']);assert.deepEqual(s,before);
 const result=applyAction(s,0,{type:'sell',card:0,sales:draft.sales,choices:draft.choices});assert.ok(result.ok,result.error);assert.equal(result.state.rev,1);assert.equal(result.state.used,1);assert.equal(result.state.players[0].hand.length,7);assert.equal(result.state.players[0].stacks.coalMine[0],3);assert.ok(result.state.board['worcester:0'].flipped&&result.state.board['redditch:0'].flipped);
});
test('reserving the only barrel removes other sales and undo releases the barrel',()=>{
 const s=fresh();s.merchants.forEach(m=>m.beer=false);const plan=createSalePlan(publicView(s,0),0);
 plan.append('worcester:0');plan.choose('southern:0');assert.equal(plan.snapshot().sales.length,1);assert.deepEqual(plan.available(),[]);
 plan.append('worcester:0');assert.deepEqual(plan.snapshot().sales,[]);assert.deepEqual(plan.snapshot().choices,[]);assert.ok(plan.available().includes('redditch:0'));
});
test('zero-beer sales complete immediately, and industries needing two beers are unavailable with only one',()=>{
 const s=fresh();s.merchants.forEach(m=>m.beer=false);s.board['worcester:0'].type='manufacturer';s.board['worcester:0'].level=3;s.board['redditch:0'].type='pottery';s.board['redditch:0'].level=3;
 const plan=createSalePlan(publicView(s,0),0);assert.ok(!plan.available().includes('redditch:0'));plan.append('worcester:0');assert.equal(plan.snapshot().pending,null);assert.equal(plan.snapshot().sales.length,1);assert.deepEqual(plan.snapshot().choices,[]);
});
test('merchant beer determines a matching destination and grants its actual reward',()=>{
 const s=fresh(),plan=createSalePlan(publicView(s,0),0);plan.append('worcester:0');plan.choose('merchant:2');const draft=plan.snapshot();assert.equal(draft.sales[0].merchant,2);
 const result=applyAction(s,0,{type:'sell',card:0,sales:draft.sales,choices:draft.choices});assert.ok(result.ok,result.error);assert.equal(result.state.players[0].income,s.players[0].income+6);assert.equal(result.state.merchants[2].beer,false);
});
