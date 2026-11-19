import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {configure,createGame} from '../brass-birmingham/engine.js?v=0.13';
test('full page restores a game, develops from mat before discarding, and updates the stack',async()=>{
 const root=new URL('../brass-birmingham/',import.meta.url),{window,document}=parseHTML(fs.readFileSync(new URL('index.html',root),'utf8'));
 globalThis.document=document;globalThis.window=window;globalThis.location={search:'',origin:'http://test',pathname:'/'};
 configure(JSON.parse(fs.readFileSync(new URL('facts.json',root),'utf8')));let s=createGame(['You','AI'],[false,true],28);s.order=[0,1];s.round=2;s.players[0].money=100;s.board['southern:0']={owner:0,type:'brewery',level:2,resource:2,flipped:false};
 const store=new Map([['brass-night-save-v1',JSON.stringify(s)]]);globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url.split('?')[0],root),'utf8'))});
 window.HTMLElement.prototype.scrollIntoView=()=>{};let modal=document.querySelector('#modal');modal.close=()=>modal.open=false;modal.showModal=()=>modal.open=true;
 await import('../brass-birmingham/app.js?integration');await new Promise(r=>setImmediate(r));
 let $=q=>document.querySelector(q);$('#resume-btn').onclick();
 assert.equal($('#hand-float').hidden,false);assert.equal(document.querySelectorAll('#hand [data-card]').length,8);assert.equal(document.querySelectorAll('.score-estimate').length,2);assert.equal($('.score-estimate strong').textContent,'0');assert.match($('.score-current').textContent,/当前VP/);assert.match($('.score-estimate').textContent,/预计VP/);assert.equal($('#mat-player').tagName,'DIV');assert.equal(document.querySelectorAll('[data-mat-player]').length,2);let trackBefore=$('.track-token.vp').getAttribute('data-track-space');$('[data-mat-player="1"]').onclick();assert.ok($('#mat-tokens').innerHTML.includes('tile-purple-'));assert.equal($('[data-mat-player="1"]').getAttribute('aria-pressed'),'true');$('[data-mat-player="0"]').onclick();assert.equal($('.track-token.vp').getAttribute('data-track-space'),trackBefore);assert.equal(document.querySelectorAll('.mat-tile').length,29);


 assert.equal($('#game > .game-status'),null);assert.ok($('.sidebar').firstElementChild.classList.contains('dock-status'));assert.ok($('link[href^="localization.css"]'));
 assert.equal($('#zoom-btn').parentElement.id,'board-wrap');assert.equal($('#mat-preview').parentElement.id,'mat-board');assert.equal(document.querySelectorAll('[data-city-label]').length,25);assert.equal($('[data-city-label="nuneaton"]').textContent,'纳尼顿');assert.equal($('[data-city-label="northern"]'),null);assert.equal($('[data-city-label="southern"]'),null);assert.equal($('.mat-next'),null);assert.ok(!$('#mat-stacks').textContent.includes('下一块'));assert.ok($('[data-mat-type="coalMine"][data-level="1"]').classList.contains('unlocked'));assert.ok($('[data-mat-type="coalMine"][data-level="2"]').classList.contains('locked'));
 assert.equal($('[data-mat-player="0"]').textContent,'玩家面板（你）');assert.equal($('[data-mat-player="1"]').textContent,'玩家面板（AI 1）');
 $('#zoom-btn').onclick();assert.ok(document.body.classList.contains('board-focus'));assert.equal($('#zoom-btn').getAttribute('aria-pressed'),'true');assert.ok($('#zoom-btn svg'));$('#zoom-btn').onclick();assert.ok(!document.body.classList.contains('board-focus'));
 $('#mat-preview').onclick();assert.equal($('#modal').open,true);assert.ok($('#modal-content .mat-enlarged').innerHTML.includes('tile-yellow-'));assert.equal(document.querySelectorAll('#modal-content .mat-count').length,29);assert.equal($('#modal-content #mat-tokens'),null);$('#modal-close').onclick();
 assert.equal($('#action-buttons [data-type="pass"]'),null);assert.equal($('#market-state'),null);
 assert.equal($('#journal-dropdown').hasAttribute('open'),false);assert.equal($('.sidebar #log'),null);
 assert.equal(document.querySelectorAll('.industry-resources.beer img').length,2);

 assert.ok($('.market-cube.filled[data-resource="coal"]').classList.contains('resource-piece'));assert.ok($('.market-cube.filled[data-resource="iron"]').classList.contains('resource-piece'));assert.ok($('.industry-resources.beer img').classList.contains('resource-piece'));
 const beer=$('[data-beer-merchant]');assert.ok(beer);const merchant=$(`[data-merchant="${beer.dataset.beerMerchant}"]`),handler=merchant.onclick;let clicks=0;merchant.onclick=()=>clicks++;beer.click();assert.equal(clicks,1);beer.onkeydown({key:'Enter',preventDefault:()=>{}});assert.equal(clicks,2);merchant.onclick=handler;
 assert.equal($('#player-reserve').parentElement.className,'mat-workspace');assert.ok($('link[href^="refinement.css"]'));assert.ok($('link[href^="tabletop.css"]'));assert.equal($('#hand-toggle'),null);assert.ok(document.querySelectorAll('img[src*="piece-coin"]').length>0);assert.ok($('link[href^="legibility.css"]'));assert.ok(document.querySelectorAll('img[src*="beer-white.svg"]').length>0);
 $('[data-pile="draw"]').onmouseenter();assert.equal($('#card-catalogue').hidden,false);assert.match($('#catalogue-heading').textContent,/普通牌 40张/);
 assert.ok(document.querySelectorAll('.catalogue-card .in-hand').length>0);$('#catalogue-close').onclick();assert.equal($('#card-catalogue').hidden,true);
 $('#menu-btn').onclick();assert.ok($('#pass-menu-btn'));$('#pass-menu-btn').onclick();assert.equal($('#modal').open,false);assert.match($('#flow-text').textContent,/跳过/);$('#flow-cancel').onclick();
 $('#action-buttons [data-type="develop"]').onclick();assert.ok($('[data-mat-type="coalMine"][data-level="1"]').classList.contains('flow-target'));
 let before=$('[data-mat-type="coalMine"][data-level="1"]').dataset.count;$('[data-mat-type="coalMine"][data-level="1"]').onclick();assert.equal($('[data-mat-type="coalMine"][data-level="1"]').dataset.count,before);
 assert.ok($('[data-card="0"]').classList.contains('discard-allowed'));$('[data-card="0"]').onclick();assert.equal($('[data-mat-type="coalMine"][data-level="1"]').dataset.count,before);$('#flow-finish').onclick();
 assert.equal($('[data-mat-type="coalMine"][data-level="1"]').dataset.count,'0');assert.equal(JSON.parse(store.get('brass-night-save-v1')).players[0].stacks.coalMine[0],2);assert.ok($('[data-mat-type="coalMine"][data-level="2"]').classList.contains('unlocked'));
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
