import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configure,createGame,applyAction,legalActions,current,publicView,income,incomeTop,network,distances,F,clone,TYPES} from '../brass-birmingham/engine.js';
import {selectAI} from '../brass-birmingham/ai.js';
configure(JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url))));
function fresh(n=2){let s=createGame(Array.from({length:n},(_,i)=>'P'+i),Array(n).fill(false),87);s.order=s.players.map(p=>p.id);return s;}
function play(s,a){let r=applyAction(s,current(s),a,{auto:true});assert.ok(r.ok,r.error);return r.state;}
function tile(owner,type,level=1,resource=0,flipped=false){return {owner,type,level,resource,flipped};}
test('physical setup: 40/54/64 ordinary cards, 45 industry tiles per player',()=>{
 for(let [n,count]of [[2,40],[3,54],[4,64]]){let s=fresh(n);assert.equal(s.deck.length+s.players.reduce((t,p)=>t+p.hand.length,0)+s.hiddenDiscard.length,count);for(let p of s.players){assert.equal(p.money,17);assert.equal(p.income,10);assert.equal(Object.values(p.stacks).flat().length,45);}assert.equal(s.merchants.length,n===2?5:n===3?7:9);}
});
test('income level thresholds and loan drops levels, not track spaces',()=>{
 for(let n=-10;n<=30;n++)assert.equal(income(incomeTop(n)),n);
 let s=fresh();s.players[0].income=31;let t=play(s,{type:'loan',card:0});assert.equal(t.players[0].income,incomeTop(8));assert.equal(t.players[0].money,47);
 s.players[0].income=2;assert.equal(applyAction(s,0,{type:'loan',card:0}).ok,false);
});
test('invalid actions and wrong seats leave original unchanged',()=>{
 let s=fresh(),old=JSON.stringify(s);assert.equal(applyAction(s,1,{type:'loan',card:0}).ok,false);assert.equal(applyAction(s,0,{type:'build',card:0,loc:'nonsense',slot:0,industry:'pottery'}).ok,false);assert.equal(JSON.stringify(s),old);
});
test('hand privacy includes deck, seed and initial hidden discard',()=>{
 let s=fresh(4),v=publicView(s,2);assert.equal(v.players[2].hand.length,8);assert.ok(v.players.filter(p=>p.id!==2).every(p=>p.hand.length===0&&p.handCount===8));for(let k of ['deck','seed','hiddenDiscard'])assert.ok(!(k in v));
});
test('coal needs connectivity, iron does not; supply fills iron market',()=>{
 let s=fresh();s.players[0].hand=[{kind:'location',loc:'birmingham'}];s.players[0].money=30;
 assert.equal(applyAction(s,0,{type:'build',card:0,loc:'birmingham',slot:2,industry:'ironWorks'}).ok,false);
 s.board['coventry:2']=tile(1,'coalMine',2,3);s.links['birmingham-coventry']={owner:1};
 let t=play(s,{type:'build',card:0,loc:'birmingham',slot:2,industry:'ironWorks'});assert.equal(t.board['coventry:2'].resource,2);assert.equal(t.iron,10);assert.equal(t.board['birmingham:2'].resource,2);
});
test('coal must come from nearest connected mine; alternatives are explicit',()=>{
 let s=fresh();s.round=2;s.players[0].money=100;s.players[0].hand=[{kind:'location',loc:'birmingham'},{kind:'location',loc:'birmingham'}];
 s.board['birmingham:0']=tile(1,'coalMine',2,1);s.board['coventry:2']=tile(1,'coalMine',2,3);s.links['birmingham-coventry']={owner:1};
 let t=play(s,{type:'build',card:0,loc:'birmingham',slot:2,industry:'ironWorks'});assert.equal(t.board['birmingham:0'].resource,0);assert.equal(t.board['coventry:2'].resource,3);
});
test('dedicated industry spaces take precedence; canal city limit',()=>{
 let s=fresh();s.players[0].hand=[{kind:'location',loc:'wolverhampton'}];s.players[0].money=100;s.links['coalbrookdale-shrewsbury']={owner:1};s.links['coalbrookdale-wolverhampton']={owner:1};
 assert.equal(applyAction(s,0,{type:'build',card:0,loc:'wolverhampton',slot:1,industry:'manufacturer'}).ok,false);
 s.board['wolverhampton:0']=tile(0,'manufacturer',1);assert.equal(applyAction(s,0,{type:'build',card:0,loc:'wolverhampton',slot:1,industry:'coalMine'}).ok,false);
});
test('pottery protected levels cannot develop; double development is sequential',()=>{
 let s=fresh();s.players[0].money=100;assert.equal(applyAction(s,0,{type:'develop',card:0,industries:['pottery']}).ok,false);
 let t=play(s,{type:'develop',card:0,industries:['coalMine','coalMine']});assert.equal(t.players[0].stacks.coalMine[0],2);assert.equal(t.players[0].stacks.coalMine.length,5);assert.equal(t.iron,6);
});
test('own beer needs no connection, opponent beer does',()=>{
 let s=fresh();s.players[0].money=50;s.board['worcester:0']=tile(0,'cottonMill',1);s.links['gloucester-worcester']={owner:1};s.board['northern:0']=tile(0,'brewery',1,1);s.merchants[0]={id:0,loc:'gloucester',buys:'any',beer:false};
 let t=play(s,{type:'sell',card:0,sales:[{key:'worcester:0',merchant:0}]});assert.ok(t.board['worcester:0'].flipped);assert.ok(t.board['northern:0'].flipped);
 s.board['northern:0'].owner=1;assert.equal(applyAction(s,0,{type:'sell',card:0,sales:[{key:'worcester:0',merchant:0}]}).ok,false);
});
test('resource choices do not partially mutate or discard cards',()=>{
 let s=fresh();s.players[0].hand[0]={kind:'location',loc:'worcester'};s.board['worcester:0']=tile(0,'cottonMill',1);s.links['gloucester-worcester']={owner:0};s.board['northern:0']=tile(0,'brewery',1,1);s.board['southern:0']=tile(0,'brewery',1,1);s.merchants[0]={id:0,loc:'gloucester',buys:'any',beer:false};
 let before=JSON.stringify(s),a={type:'sell',card:0,sales:[{key:'worcester:0',merchant:0}]},r=applyAction(s,0,a);assert.ok(r.choice);assert.equal(JSON.stringify(s),before);let t=play(s,{...a,choices:[r.choice.options[1].id]});assert.ok(t.board['worcester:0'].flipped);
});
test('scouting consumes three distinct cards; wild cards return to supply',()=>{
 let s=fresh(),t=play(s,{type:'scout',card:0,extra:[1,2]});assert.equal(t.wild.location,3);assert.ok(t.players[0].hand.some(c=>c.kind==='wildLocation'));assert.equal(applyAction(s,0,{type:'scout',card:0,extra:[0,1]}).ok,false);
});
test('southern farm connects with the single Kidderminster-Worcester link',()=>{
 let s=fresh();s.links['kidderminster-worcester']={owner:0};assert.ok(network(s,0).has('southern'));assert.equal(distances(s,['southern']).worcester,1);
});
test('double rail charges £15 plus two coal and connected beer',()=>{
 let s=fresh();s.era='rail';s.round=2;s.players[0].money=50;s.board['coalbrookdale:2']=tile(0,'coalMine',2,3);s.board['northern:0']=tile(0,'brewery',2,2);
 let t=play(s,{type:'network',card:0,edges:['coalbrookdale-wolverhampton','walsall-wolverhampton']});assert.equal(t.players[0].money,35);assert.equal(t.board['coalbrookdale:2'].resource,1);assert.equal(t.board['northern:0'].resource,1);assert.equal(Object.keys(t.links).length,2);
});
test('era transition retains level 2+, removes level 1, and no rail seed discard',()=>{
 let s=fresh();s.discard=[...s.deck,...s.players.flatMap(p=>p.hand)];s.deck=[];s.players.forEach(p=>p.hand=[]);s.players[0].hand=[s.discard.pop()];s.turn=0;s.round=10;s.board['worcester:0']=tile(0,'cottonMill',1,0,true);s.board['worcester:1']=tile(0,'cottonMill',2,0,true);s.links['gloucester-worcester']={owner:0};
 let t=play(s,{type:'pass',card:0});assert.equal(t.era,'rail');assert.ok(!t.board['worcester:0']);assert.ok(t.board['worcester:1']);assert.equal(Object.keys(t.links).length,0);assert.equal(t.hiddenDiscard.length,0);assert.equal(t.players[0].vp,5+5+5);assert.equal(t.deck.length+t.players.reduce((n,p)=>n+p.hand.length,0),40);
});
test('complete pass-only games have 38/51/60 canal and 40/54/64 rail actions',()=>{
 for(let [n,expected]of [[2,[38,40]],[3,[51,54]],[4,[60,64]]]){let s=fresh(n),counts={canal:0,rail:0};for(let i=0;i<300&&!s.gameOver;i++){counts[s.era]++;s=play(s,{type:'pass',card:0});}assert.ok(s.gameOver);assert.deepEqual([counts.canal,counts.rail],expected);assert.equal(s.scores.length,2);}
});
test('AI plays a complete legal game with scoring and conserved tile counts',()=>{
 let s=createGame(['AI0','AI1'],[true,true],987),steps=0;while(!s.gameOver&&steps++<220){let a=selectAI(s);assert.ok(a);let r=applyAction(s,current(s),a,{auto:true});assert.ok(r.ok,r.error);s=r.state;for(let p of s.players){assert.ok(p.money>=0||s.phase==='liquidation');assert.ok(p.income>=0&&p.income<=99);assert.ok(p.linkCount<=14);}}
 assert.ok(s.gameOver,'AI game must terminate');assert.equal(s.scores.length,2);assert.ok(s.players.some(p=>p.vp>0));console.log('AI complete:',steps,'actions',s.players.map(p=>p.vp));
});
test('failed second rail is atomic and cannot consume a first coal cube',()=>{
 let s=fresh();s.era='rail';s.players[0].money=100;s.board['coalbrookdale:2']=tile(0,'coalMine',2,1);let before=JSON.stringify(s);
 let r=applyAction(s,0,{type:'network',card:0,edges:['coalbrookdale-wolverhampton','belper-derby']},{auto:true});assert.equal(r.ok,false);assert.equal(JSON.stringify(s),before);
});
test('one sell action flips multiple industries and Oxford beer adds two income spaces',()=>{
 let s=fresh();s.board['birmingham:0']=tile(0,'cottonMill',2);s.board['redditch:0']=tile(0,'manufacturer',3);s.links['birmingham-oxford']={owner:0};s.links['redditch-oxford']={owner:0};s.merchants[0]={id:0,loc:'oxford',buys:'any',beer:true};let before=s.players[0].income;
 let t=play(s,{type:'sell',card:0,sales:[{key:'birmingham:0',merchant:0},{key:'redditch:0',merchant:0}]});assert.ok(t.board['birmingham:0'].flipped&&t.board['redditch:0'].flipped);assert.equal(t.players[0].income,before+4+4+2);assert.equal(t.merchants[0].beer,false);
});
test('bankruptcy gives the debtor a choice and stops once paid',()=>{
 let s=fresh();s.round=2;s.turn=1;s.used=1;s.players[1].money=0;s.players[1].income=8;s.board['birmingham:0']=tile(1,'cottonMill',2);s.board['redditch:0']=tile(1,'manufacturer',2);
 let t=play(s,{type:'pass',card:0});assert.equal(t.phase,'liquidation');assert.equal(current(t),1);t=play(t,{type:'liquidate',key:'birmingham:0'});assert.equal(t.phase,'play');assert.equal(t.players[1].money,5);assert.ok(t.board['redditch:0']);assert.equal(applyAction(t,1,{type:'liquidate',key:'redditch:0'}).ok,false);
});
test('last rail round awards no income, with flipped southern farm contributing to its link',()=>{
 let s=fresh();s.era='rail';s.deck=[];s.players[0].hand=[s.players[0].hand[0]];s.players[1].hand=[];s.players[0].income=30;s.players[0].money=17;s.board['southern:0']=tile(1,'brewery',2,0,true);s.links['kidderminster-worcester']={owner:0};
 let t=play(s,{type:'pass',card:0});assert.ok(t.gameOver);assert.equal(t.players[0].money,17);assert.equal(t.players[0].vp,2);assert.equal(t.players[1].vp,5);
});
test('opponent overbuilding needs both board and market resource depletion',()=>{
 let s=fresh();s.players[0].stacks.coalMine=[2,2,3,3,4,4];s.players[0].hand[0]={kind:'location',loc:'dudley'};s.board['dudley:0']=tile(1,'coalMine',1,0,true);s.players[0].money=100;
 let a={type:'build',card:0,loc:'dudley',slot:0,industry:'coalMine'};assert.equal(applyAction(s,0,a).ok,false);s.coal=0;let t=play(s,a);assert.equal(t.board['dudley:0'].owner,0);assert.equal(t.board['dudley:0'].level,2);
});
