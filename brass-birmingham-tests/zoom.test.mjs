import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {zoomButton,installDragPan} from '../brass-birmingham/table-zoom.js';

test('map and mat share expand/shrink icons and update their accessible button labels',()=>{
 const {document}=parseHTML('<html><body><button id="map"></button><button id="mat"></button></body></html>');
 const map=document.querySelector('#map'),mat=document.querySelector('#mat');
 zoomButton(map,false,'地图');zoomButton(mat,false,'玩家面板');const small=map.innerHTML;assert.equal(map.innerHTML,mat.innerHTML);
 zoomButton(map,true,'地图');zoomButton(mat,true,'玩家面板');assert.equal(map.innerHTML,mat.innerHTML);assert.notEqual(map.innerHTML,small);
 assert.equal(map.getAttribute('aria-label'),'缩小地图');assert.equal(mat.getAttribute('aria-label'),'缩小玩家面板');assert.equal(map.dataset.zoomState,'shrink');
 zoomButton(map,false,'地图');assert.equal(map.innerHTML,small);assert.equal(map.getAttribute('aria-pressed'),'false');
});

test('enlarged map pans by dragging, preserves normal clicks and suppresses a click after dragging',()=>{
 const {document,window}=parseHTML('<html><body><section id="viewport"><button class="corner-zoom"></button></section></body></html>');
 const viewport=document.querySelector('#viewport');viewport.scrollTop=100;viewport.scrollLeft=10;let active=false;
 installDragPan(viewport,()=>active);
 const event=(type,x,y,target=viewport)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y});target.dispatchEvent(e);return e;};
 event('pointerdown',100,100);event('pointermove',100,50);event('pointerup',100,50);assert.equal(viewport.scrollTop,100);
 active=true;event('pointerdown',100,100);event('pointermove',102,101);event('pointerup',102,101);assert.equal(event('click',102,101).defaultPrevented,false);assert.equal(viewport.scrollTop,100);
 event('pointerdown',100,100);assert.equal(event('pointermove',100,50).defaultPrevented,true);assert.equal(viewport.scrollTop,150);assert.ok(viewport.classList.contains('is-panning'));
 event('pointerup',100,50);assert.ok(!viewport.classList.contains('is-panning'));assert.equal(event('click',100,50).defaultPrevented,true);
 event('pointerdown',100,100,viewport.querySelector('.corner-zoom'));event('pointermove',100,20);event('pointerup',100,20);assert.equal(viewport.scrollTop,150);assert.equal(event('click',100,20).defaultPrevented,false);
});
