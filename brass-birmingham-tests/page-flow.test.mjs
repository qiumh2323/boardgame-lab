import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {configure,createGame} from '../brass-birmingham/engine.js?v=0.9';
test('full page restores a game, develops from mat before discarding, and updates the stack',async()=>{
 const root=new URL('../brass-birmingham/',import.meta.url),{window,document}=parseHTML(fs.readFileSync(new URL('index.html',root),'utf8'));
 globalThis.document=document;globalThis.window=window;globalThis.location={search:'',origin:'http://test',pathname:'/'};
 configure(JSON.parse(fs.readFileSync(new URL('facts.json',root),'utf8')));let s=createGame(['You','AI'],[false,true],28);s.order=[0,1];s.round=2;s.players[0].money=100;s.board['southern:0']={owner:0,type:'brewery',level:2,resource:2,flipped:false};
 const store=new Map([['brass-night-save-v1',JSON.stringify(s)]]);globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url.split('?')[0],root),'utf8'))});
 window.HTMLElement.prototype.scrollIntoView=()=>{};let modal=document.querySelector('#modal');modal.close=()=>modal.open=false;modal.showModal=()=>modal.open=true;
 await import('../brass-birmingham/app.js?integration');await new Promise(r=>setImmediate(r));
 let $=q=>document.querySelector(q);$('#resume-btn').onclick();
 assert.equal($('#hand-float').hidden,false);assert.equal(document.querySelectorAll('#hand [data-card]').length,8);assert.equal(document.querySelectorAll('.score-estimate').length,2);assert.equal($('.score-estimate').textContent,'0');assert.equal($('#mat-player').tagName,'DIV');assert.equal(document.querySelectorAll('[data-mat-player]').length,2);let trackBefore=$('.track-token.vp').getAttribute('data-track-space');$('[data-mat-player="1"]').onclick();assert.ok($('#mat-tokens').innerHTML.includes('tile-purple-'));assert.equal($('[data-mat-player="1"]').getAttribute('aria-pressed'),'true');$('[data-mat-player="0"]').onclick();assert.equal($('.track-token.vp').getAttribute('data-track-space'),trackBefore);assert.equal(document.querySelectorAll('.mat-tile').length,29);

 assert.equal($('#action-buttons [data-type="pass"]'),null);assert.equal($('#market-state'),null);
 assert.equal($('#journal-dropdown').hasAttribute('open'),false);assert.equal($('.sidebar #log'),null);
 assert.equal(document.querySelectorAll('.industry-resources.beer img').length,2);
 assert.equal($('#player-reserve').parentElement.className,'mat-workspace');
 $('[data-pile="draw"]').onmouseenter();assert.equal($('#card-catalogue').hidden,false);assert.match($('#catalogue-heading').textContent,/普通牌 40张/);
 assert.ok(document.querySelectorAll('.catalogue-card .in-hand').length>0);$('#catalogue-close').onclick();assert.equal($('#card-catalogue').hidden,true);
 $('#menu-btn').onclick();assert.ok($('#pass-menu-btn'));$('#pass-menu-btn').onclick();assert.equal($('#modal').open,false);assert.match($('#flow-text').textContent,/跳过/);$('#flow-cancel').onclick();
 $('#action-buttons [data-type="develop"]').onclick();assert.ok($('[data-mat-type="coalMine"][data-level="1"]').classList.contains('flow-target'));
 let before=$('[data-mat-type="coalMine"][data-level="1"]').dataset.count;$('[data-mat-type="coalMine"][data-level="1"]').onclick();assert.equal($('[data-mat-type="coalMine"][data-level="1"]').dataset.count,before);
 $('#flow-finish').onclick();assert.ok($('[data-card="0"]').classList.contains('discard-allowed'));$('[data-card="0"]').onclick();
 assert.equal($('[data-mat-type="coalMine"][data-level="1"]').dataset.count,'0');assert.equal(JSON.parse(store.get('brass-night-save-v1')).players[0].stacks.coalMine[0],2);
 assert.equal($('#modal').open,false);assert.match($('#flow-text').textContent,/先选择行动/);assert.ok(document.querySelectorAll('.catalogue-card .seen').length>0);
 for(const [n,draw,total] of [[3,27,54],[4,28,64]]){
  $('#menu-btn').onclick();$('#back-btn').onclick();
  let game=createGame(Array.from({length:n},(_,i)=>'P'+i),Array(n).fill(false),31);game.order=game.players.map(p=>p.id);store.set('brass-night-save-v1',JSON.stringify(game));$('#resume-btn').onclick();
  assert.equal(document.querySelectorAll('#players .player').length,n);assert.equal(document.querySelectorAll('[data-mat-player]').length,n);assert.match($('[data-pile="draw"]').textContent,new RegExp(String(draw)));assert.match($('[data-pile="wildLocation"]').textContent,/4/);assert.match($('[data-pile="wildIndustry"]').textContent,/4/);
  assert.equal(document.querySelectorAll('.merchant-beer').length,game.merchants.filter(m=>m.beer).length);
  $('[data-pile="draw"]').onmouseenter();assert.match($('#catalogue-heading').textContent,new RegExp('普通牌 '+total+'张'));$('#catalogue-close').onclick();
 }
 $('#menu-btn').onclick();$('#back-btn').onclick();
});
