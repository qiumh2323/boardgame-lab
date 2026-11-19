import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boardPieces,routePieces,playerReserve,coins} from '../brass-birmingham/table-pieces.js';
import {configure,createGame,applyAction,current,publicView} from '../brass-birmingham/engine.js';
const facts=JSON.parse(fs.readFileSync(new URL('../brass-birmingham/facts.json',import.meta.url)));
const layout=JSON.parse(fs.readFileSync(new URL('../brass-birmingham/layout.json',import.meta.url)));
configure(facts);
function checkArt(html){for(let [,src] of html.matchAll(/src="([^"]+)"/g))assert.ok(fs.existsSync(new URL('../brass-birmingham/'+src,import.meta.url)),src);}
test('track has 100 unique spaces and every printed route has a calibrated placement',()=>{
 assert.equal(Object.keys(layout.track).length,100);
 assert.equal(new Set(Object.values(layout.track).map(p=>p.join(','))).size,100);
 for(let c of facts.connections)assert.ok(layout.routes[c.id],c.id);
 for(let pos of [...Object.values(layout.track),...layout.turnOrder])assert.ok(pos.every(n=>n>0&&n<1));
});
test('coin denominations always represent the exact cash or round expenditure',()=>{
 for(let n=0;n<500;n++)assert.equal(coins(n).reduce((a,b)=>a+b,0),n);
});
test('four players get four portraits, four VP and four income tokens with real artwork',()=>{
 let s=createGame(['A','B','C','D'],[false,false,false,false],43),html=boardPieces(publicView(s,0),layout);
 assert.equal((html.match(/class="turn-character/g)||[]).length,4);assert.equal((html.match(/class="track-token vp"/g)||[]).length,4);assert.equal((html.match(/class="track-token income"/g)||[]).length,4);checkArt(html);
});
test('placing a link reduces reserve, renders matching owner and era artwork and records coins',()=>{
 let s=createGame(['A','B'],[false,false],43),id=current(s);let r=applyAction(s,id,{type:'network',card:0,edges:['birmingham-oxford']});assert.ok(r.ok,r.error);s=r.state;
 let html=routePieces(publicView(s,id),layout,facts.connections),reserve=playerReserve(s.players[id],s.era);
 assert.equal((html.match(/route-placed/g)||[]).length,1);assert.equal((reserve.match(/alt="备用连接板块"/g)||[]).length,13);assert.equal(s.players[id].spent,3);assert.ok(boardPieces(s,layout).includes('本轮花费 £1'));checkArt(html+reserve);
});
test('tokens follow loans, income spaces, score laps, and round expenditure resets',()=>{
 let s=createGame(['A','B'],[false,false],43),id=current(s),r=applyAction(s,id,{type:'loan',card:0});assert.ok(r.ok);s=r.state;let html=boardPieces(s,layout);assert.ok(html.includes(`class="track-token income" data-track-space="7" data-player="${id}"`));s.players[id].vp=137;html=boardPieces(s,layout);assert.ok(html.includes('data-track-space="37"'));assert.ok(html.includes('+100'));
 s.players.forEach(p=>p.spent=7);r=applyAction(s,current(s),{type:'pass',card:0});assert.ok(r.ok);assert.ok(r.state.players.every(p=>p.spent===0));
});
test('rail reserve and placed railway use the reverse artwork',()=>{
 let s=createGame(['A','B'],[false,false],43);s.era='rail';s.links['birmingham-oxford']={owner:0};s.players[0].linkCount=1;
 let html=routePieces(s,layout,facts.connections)+playerReserve(s.players[0],'rail');assert.ok(html.includes('piece-link-yellow-rail.webp'));checkArt(html);
});
