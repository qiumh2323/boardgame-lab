import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,publicView,applyAction} from '../brass-birmingham/engine.js?v=0.49';
import {createSalePlan} from '../brass-birmingham/sale-plan.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
function fresh(){
 const s=createGame(['You','AI'],[false,true],55);s.order=[0,1];s.round=2;s.era='rail';
 s.links={'gloucester-worcester':{owner:0},'gloucester-redditch':{owner:0},'redditch-oxford':{owner:0}};
 s.board={'worcester:0':{owner:0,type:'cottonMill',level:2,resource:0,flipped:false},'redditch:0':{owner:0,type:'cottonMill',level:2,resource:0,flipped:false},'southern:0':{owner:0,type:'brewery',level:2,resource:1,flipped:false}};
 s.merchants=[{id:0,loc:'gloucester',buys:'any',beer:true},{id:1,loc:'gloucester',buys:'any',beer:true},{id:2,loc:'oxford',buys:'any',beer:true}];return s;
}
test('multiple industries and beers can be selected in either order before resolving merchant rewards',()=>{
 const s=fresh();s.players[0].stacks.coalMine=[1,2,3];const before=structuredClone(s),plan=createSalePlan(publicView(s,0),0);
 plan.cycleBeer('merchant:0');assert.equal(plan.snapshot().picked,1);assert.equal(plan.snapshot().required,0);
 plan.toggleIndustry('worcester:0');assert.equal(plan.snapshot().action.sales.length,1);
 plan.toggleIndustry('redditch:0');assert.equal(plan.snapshot().required,2);assert.equal(plan.snapshot().action,null);
 plan.cycleBeer('merchant:1');
 const draft=plan.snapshot().action;assert.equal(draft.sales.length,2);assert.deepEqual(draft.choices,['merchant:0','merchant:1']);
 const action={type:'sell',card:0,sales:draft.sales,choices:draft.choices};
 const first=applyAction(s,0,action);assert.match(first.choice.kind,/免费研发/);assert.equal(first.choice.index,2);assert.equal(first.choice.options.find(o=>o.id==='coalMine').level,1);
 const second=applyAction(s,0,{...action,choices:[...draft.choices,'coalMine']});assert.equal(second.choice.index,3);assert.equal(second.choice.options.find(o=>o.id==='coalMine').level,2);
 assert.deepEqual(s,before);
 const result=applyAction(s,0,{...action,choices:[...draft.choices,'coalMine','coalMine']},{recordActivity:true});assert.ok(result.ok,result.error);assert.deepEqual(result.activity.developed,[{type:'coalMine',level:1},{type:'coalMine',level:2}]);assert.equal(result.state.rev,1);assert.equal(result.state.used,1);assert.equal(result.state.players[0].hand.length,7);assert.equal(result.state.players[0].stacks.coalMine[0],3);assert.ok(result.state.board['worcester:0'].flipped&&result.state.board['redditch:0'].flipped);
});
test('industries sharing one barrel cannot be selected together, and each choice can be undone independently',()=>{
 const s=fresh();s.merchants.forEach(m=>m.beer=false);const plan=createSalePlan(publicView(s,0),0);
 plan.toggleIndustry('worcester:0');plan.cycleBeer('southern:0');assert.equal(plan.snapshot().action.sales.length,1);assert.deepEqual(plan.snapshot().available,[]);
 assert.match(plan.blockedReason('redditch:0'),/啤酒不足/);
 plan.toggleIndustry('worcester:0');assert.deepEqual(plan.snapshot().industries,[]);assert.equal(plan.snapshot().picked,1);assert.ok(plan.snapshot().available.includes('redditch:0'));
 plan.cycleBeer('southern:0');assert.equal(plan.snapshot().picked,0);
});
test('a brewery barrel keeps all valid matching merchants available for the second barrel',()=>{
 const s=fresh();s.board['redditch:0'].type='pottery';s.board['redditch:0'].level=3;
 const plan=createSalePlan(publicView(s,0),0);plan.toggleIndustry('redditch:0');assert.equal(plan.snapshot().required,2);
 plan.cycleBeer('southern:0');assert.equal(plan.snapshot().picked,1);assert.ok(plan.snapshot().sources.some(o=>o.id==='merchant:2'));
 plan.cycleBeer('merchant:2');assert.deepEqual(plan.snapshot().action.sales,[{key:'redditch:0',merchant:2}]);
});
test('zero-beer sales complete immediately, and industries needing two beers are unavailable with only one',()=>{
 const s=fresh();s.merchants.forEach(m=>m.beer=false);s.board['worcester:0'].type='manufacturer';s.board['worcester:0'].level=3;s.board['redditch:0'].type='pottery';s.board['redditch:0'].level=3;
 const plan=createSalePlan(publicView(s,0),0);assert.ok(!plan.snapshot().available.includes('redditch:0'));plan.toggleIndustry('worcester:0');assert.equal(plan.snapshot().action.sales.length,1);assert.deepEqual(plan.snapshot().action.choices,[]);
});
test('merchant beer determines a matching destination and grants its actual reward',()=>{
 const s=fresh(),plan=createSalePlan(publicView(s,0),0);plan.toggleIndustry('worcester:0');plan.cycleBeer('merchant:2');const draft=plan.snapshot().action;assert.equal(draft.sales[0].merchant,2);
 const result=applyAction(s,0,{type:'sell',card:0,sales:draft.sales,choices:draft.choices});assert.ok(result.ok,result.error);assert.equal(result.state.players[0].income,s.players[0].income+6);assert.equal(result.state.merchants[2].beer,false);
});
test('an exact beer quantity still needs to match the industries and merchants',()=>{
 const s=fresh();s.board['redditch:0'].type='pottery';s.board['redditch:0'].level=3;s.merchants[2].buys='cottonMill';
 const plan=createSalePlan(publicView(s,0),0);plan.cycleBeer('merchant:2');plan.cycleBeer('southern:0');plan.toggleIndustry('redditch:0');
 assert.equal(plan.snapshot().picked,plan.snapshot().required);assert.equal(plan.snapshot().action,null);
 plan.cycleBeer('merchant:2');plan.cycleBeer('merchant:1');assert.ok(plan.snapshot().action);
});
