import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,applyAction,publicView,cityName} from '../brass-birmingham/engine.js?v=0.50';
import {makeActionFeedback,needsMissingCityWarning,missingCardCities,missingCityPreferenceKey} from '../brass-birmingham/action-feedback.js';
const facts=JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url)));configure(facts);
const fresh=(n=2)=>{const s=createGame(Array.from({length:n},(_,i)=>'P'+i),Array(n).fill(false),91);s.order=s.players.map(p=>p.id);s.players[0].money=100;s.round=2;return s;};
function feedback(s,a){const r=applyAction(s,0,a,{auto:true});assert.ok(r.ok,r.error);return makeActionFeedback(s,r.state,0,a);}

test('missing-city reminder uses complete 2/3/4-player composition and excludes farms',()=>{
 for(const n of [2,3,4]){
  const s=publicView(fresh(n),0);
  for(const loc of Object.keys(facts.cities))assert.equal(needsMissingCityWarning(s,{type:'build',loc},facts),n<4&&!facts.cards[n].locations[loc],`${n}: ${loc}`);
  for(const loc of Object.keys(facts.farms))assert.equal(needsMissingCityWarning(s,{type:'build',loc},facts),false);
  assert.equal(needsMissingCityWarning(s,{type:'network',loc:'derby'},facts),false);
 }
 assert.notEqual(missingCityPreferenceKey({gameId:'one'}),missingCityPreferenceKey({gameId:'two'}));
});

test('public build, link, develop, loan, scout and pass feedback describes the action without revealing hands or card order',()=>{
 let s=fresh();s.players[0].hand[0]={kind:'location',loc:'birmingham'};
 let e=feedback(s,{type:'build',loc:'birmingham',slot:0,industry:'cottonMill',card:0});assert.match(e.description,/建造 伯明翰 棉纺厂1级/);assert.deepEqual(e.targets[0],{kind:'tile',key:'birmingham:0',effect:'build'});assert.equal(e.previews[0].level,1);
 e=feedback(fresh(),{type:'network',edges:['birmingham-oxford'],card:0});assert.match(e.description,/伯明翰—牛津/);assert.equal(e.targets[0].kind,'route');
 e=feedback(fresh(),{type:'develop',industries:['coalMine','coalMine'],card:0});assert.match(e.description,/煤矿1级、煤矿2级/);assert.deepEqual(e.previews.map(p=>p.level),[1,2]);assert.ok(e.targets.some(t=>t.kind==='market'&&t.resource==='iron'));
 for(const a of [{type:'loan',card:0},{type:'scout',card:0,extra:[1,2]},{type:'pass',card:0}]){
  const before=fresh(),old=JSON.stringify(before);e=feedback(before,a);assert.equal(JSON.stringify(before),old);assert.ok(e.description.length>0);assert.equal(e.actor,0);assert.ok(!('hand' in e));assert.ok(!('card' in e));assert.ok(!('seed' in e));assert.ok(!('deck' in e));
 }
});

test('sale feedback identifies flipped industries and the beer source, and is safe to broadcast',()=>{
 const s=fresh();s.board['birmingham:0']={owner:0,type:'cottonMill',level:2,resource:0,flipped:false};s.board['southern:0']={owner:0,type:'brewery',level:1,resource:1,flipped:false};s.links['birmingham-oxford']={owner:0};s.merchants[0]={id:0,loc:'oxford',buys:'any',beer:true};
 const a={type:'sell',card:0,sales:[{key:'birmingham:0',merchant:0}],choices:['southern:0']},r=applyAction(s,0,a);assert.ok(r.ok,r.error);const e=makeActionFeedback(s,r.state,0,a);
 assert.match(e.description,/出售并翻面.*伯明翰/);assert.ok(e.previews[0].flipped);assert.ok(e.targets.some(t=>t.key==='southern:0'&&t.effect==='resource'));assert.ok(e.targets.some(t=>t.key==='southern:0'&&t.effect==='flip'));assert.ok(e.details.some(t=>t.includes('已耗尽并翻面')));
 r.state.lastAction=e;assert.deepEqual(publicView(r.state,1).lastAction,e);assert.equal(publicView(r.state,1).players[0].hand.length,0);
});

test('corrected simplified Chinese place names are shared by all public labels',()=>{
 for(const [key,name] of Object.entries({stokeOnTrent:'斯托克',coalbrookdale:'柯尔布鲁德尔',burtonOnTrent:'特伦河畔伯顿',tamworth:'谭沃斯',stone:'斯东',nuneaton:'纳尼顿'}))assert.equal(cityName(key),name);
});

const warningFacts=JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url),'utf8'));
test('network reminders cover both endpoints for every route and player count',()=>{
 for(const n of [2,3,4])for(const edge of warningFacts.connections){
  const view={players:Array(n)},action={type:'network',edges:[edge.id]};
  const expected=n===4?[]:[...new Set([edge.from,edge.to])].filter(loc=>warningFacts.cities[loc]&&!warningFacts.cards[n].locations[loc]);
  assert.deepEqual(missingCardCities(view,action,warningFacts),expected,`${n} players ${edge.id}`);
  assert.equal(needsMissingCityWarning(view,action,warningFacts),expected.length>0);
 }
});
test('double connections deduplicate missing cities and share the game preference',()=>{
 const action={type:'network',edges:['belper-derby','derby-uttoxeter']};
 for(const [n,expected] of [[2,['belper','derby','uttoxeter']],[3,['belper','derby']],[4,[]]])assert.deepEqual(missingCardCities({players:Array(n)},action,warningFacts),expected);
 assert.equal(missingCityPreferenceKey({gameId:'same-game'}),'brass-missing-city-warning:same-game');
});


test('movement records actual payment and replenishment at the round boundary without broadcasting card identities',()=>{
 const s=fresh();s.turn=1;s.used=1;
 const action={type:'network',edges:['birmingham-oxford'],card:0};
 const result=applyAction(s,1,action,{recordActivity:true});
 assert.ok(result.ok,result.error);
 assert.equal(result.state.round,3);
 assert.equal(result.state.players[1].spent,0);
 const event=makeActionFeedback(s,result.state,1,action,result.activity);
 assert.deepEqual(event.movement,{discarded:1,wild:0,drawn:[{player:1,count:1}],spent:3,cashChange:-3});
});
