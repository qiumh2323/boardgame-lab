import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createDirectFlow} from '../brass-birmingham/direct-flow.js';
import {configure} from '../brass-birmingham/engine.js?v=0.21';
configure({connections:[{id:'a',from:'birmingham',to:'coventry'},{id:'b',from:'coventry',to:'nuneaton'}]});
function setup(){
 const {document,window}=parseHTML(`<html><body><section id="hand-float"><button id="hand-toggle"></button>${[0,1,2,3].map(i=>`<button data-card="${i}"></button>`).join('')}</section><div id="flow-bar"><p id="flow-text"></p><div id="flow-options"></div><button id="flow-finish"></button><button id="flow-cancel"></button></div><div id="action-buttons">${['build','network','develop','sell','scout'].map(t=>`<button data-type="${t}"></button>`).join('')}</div><div id="mat-board"></div><button data-loc="birmingham" data-slot="0"></button><button data-loc="coventry" data-slot="0"></button><button data-loc="northern" data-slot="0"></button><button data-merchant="0"></button><button data-mat-type="coalMine" data-level="1"></button><button data-mat-type="coalMine" data-level="2"></button><button data-route="a"></button><button data-route="b"></button></body></html>`);
 globalThis.document=document;document.querySelector('#mat-board').scrollIntoView=()=>{};
 let view={rev:0,era:'rail',phase:'play',players:[{id:0,stacks:{coalMine:[1,2]}}],merchants:[{id:0,loc:'oxford'}]},sent=[],acts=[
 {type:'build',loc:'birmingham',slot:0,industry:'cottonMill',card:1},{type:'build',loc:'coventry',slot:0,industry:'pottery',card:2},
 {type:'develop',industries:['coalMine'],card:0},{type:'develop',industries:['coalMine','coalMine'],card:0},
 {type:'network',edges:['a'],card:0},{type:'network',edges:['a','b'],card:0},
 {type:'sell',sales:[{key:'birmingham:0',merchant:0}],card:0},{type:'scout',card:0,extra:[1,2]}
 ];
 let flow=createDirectFlow({view:()=>view,seat:()=>0,myTurn:()=>true,actions:()=>acts,submit:a=>sent.push(a),showMyMat:()=>{}});flow.paint();
 let $=s=>document.querySelector(s),click=s=>{let b=$(s);assert.ok(b,s);assert.equal(typeof b.onclick,'function',s);b.onclick();};
 return {flow,$,click,sent,view};
}
test('build highlights union of all hand-supported slots before asking for a matching discard',()=>{
 let {flow,$,click,sent}=setup();flow.begin('build');assert.ok($('[data-loc="birmingham"]').classList.contains('flow-target'));assert.ok($('[data-loc="coventry"]').classList.contains('flow-target'));
 click('[data-loc="birmingham"]');assert.ok($('[data-card="1"]').classList.contains('discard-allowed'));assert.ok(!$('[data-card="2"]').classList.contains('discard-allowed'));click('[data-card="2"]');assert.equal(sent.length,0);click('[data-card="1"]');assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0],{type:'build',loc:'birmingham',slot:0,industry:'cottonMill',card:1});
});
test('develop selects consecutive lowest tiles on the player mat then discards one card',()=>{
 let {flow,$,click,sent}=setup();flow.begin('develop');assert.ok($('[data-level="1"]').classList.contains('flow-target'));assert.ok(!$('[data-level="2"]').classList.contains('flow-target'));
 click('[data-level="1"]');assert.ok($('[data-level="2"]').classList.contains('flow-target'));click('[data-level="2"]');click('[data-card="3"]');assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0],{type:'develop',industries:['coalMine','coalMine'],card:3});
});
test('network reveals second railway only after selecting its valid first railway',()=>{
 let {flow,$,click,sent}=setup();flow.begin('network');assert.ok($('[data-route="a"]').classList.contains('flow-target'));assert.ok(!$('[data-route="b"]').classList.contains('flow-target'));click('[data-route="a"]');assert.ok($('[data-route="b"]').classList.contains('flow-target'));click('[data-route="b"]');click('[data-card="2"]');assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0],{type:'network',edges:['a','b'],card:2});
});
test('selling picks the board industry and connected merchant, then beer on the map',()=>{
 let {flow,$,click,sent}=setup();flow.begin('sell');click('[data-loc="birmingham"]');assert.ok($('[data-merchant="0"]').classList.contains('flow-target'));click('[data-merchant="0"]');click('[data-card="2"]');assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0],{type:'sell',sales:[{key:'birmingham:0',merchant:0}],card:2});
 flow.requestChoice(sent[0],{index:0,kind:'啤酒来源',options:[{id:'northern:0',label:'北部农场'}]});assert.ok($('[data-loc="northern"]').classList.contains('flow-target'));click('[data-loc="northern"]');assert.equal(sent.length,1);click('#flow-finish');assert.deepEqual(sent[1].choices,['northern:0']);
});
test('cancelling is non-mutating and newer snapshots clear draft highlights',()=>{
 let {flow,$,click,sent,view}=setup();flow.begin('network');click('[data-route="a"]');click('#flow-cancel');assert.equal(sent.length,0);assert.ok(!$('[data-route="a"]').classList.contains('flow-selected'));flow.begin('build');view.rev++;flow.paint();assert.ok(!$('[data-loc="birmingham"]').classList.contains('flow-target'));
});
test('scout selects three different cards in floating hand before confirming',()=>{
 let {flow,click,sent}=setup();flow.begin('scout');for(let i of [0,1,3])click(`[data-card="${i}"]`);assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0].extra,[1,3]);assert.equal(sent[0].card,0);
});

test('selected discard can be changed or cancelled without submitting an action',()=>{
 let {flow,click,$,sent}=setup();flow.begin('loan');click('[data-card="1"]');assert.equal(sent.length,0);assert.ok($('[data-card="1"]').classList.contains('discard-picked'));
 click('[data-card="3"]');assert.ok(!$('[data-card="1"]').classList.contains('discard-picked'));assert.ok($('[data-card="3"]').classList.contains('discard-picked'));assert.equal(sent.length,0);
 click('#flow-cancel');assert.equal(sent.length,0);flow.begin('pass');click('[data-card="2"]');assert.equal(sent.length,0);click('#flow-finish');assert.deepEqual(sent[0],{type:'pass',extra:[],card:2});
});

test('breathing guidance marks only available actions while choosing an action',()=>{
 const {flow,$,click,view}=setup();
 assert.ok($('[data-type="build"]').classList.contains('action-ready'));
 assert.ok(!$('[data-type="sell"]').disabled);
 flow.begin('network');assert.ok(!$('[data-type="build"]').classList.contains('action-ready'));
 click('#flow-cancel');assert.ok($('[data-type="build"]').classList.contains('action-ready'));
 view.gameOver=true;view.rev++;flow.paint();assert.ok(!$('[data-type="build"]').classList.contains('action-ready'));
});
