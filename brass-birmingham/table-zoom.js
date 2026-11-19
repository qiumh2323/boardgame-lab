const paths={
 expand:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6',
 shrink:'M3 3l6 6M4 9h5V4M21 3l-6 6M15 4v5h5M3 21l6-6M4 15h5v5M21 21l-6-6M15 20v-5h5'
};
export function zoomButton(button,expanded,subject){
 const state=expanded?'shrink':'expand',label=(expanded?'缩小':'放大')+subject;
 button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[state]}"/></svg>`;
 button.dataset.zoomState=state;button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',label);button.title=label;
}

// Leave normal board clicks intact; only a deliberate drag pans and suppresses a click.
export function installDragPan(viewport,active){
 let start=null,suppress=false;
 const down=e=>{
  suppress=false;
  if(!active()||e.button!==0||e.pointerType==='touch'||e.target.closest?.('.corner-zoom'))return;
  start={id:e.pointerId,x:e.clientX,y:e.clientY,top:viewport.scrollTop||0,left:viewport.scrollLeft||0,dragged:false};
 };
 const move=e=>{
  if(!start||e.pointerId!==start.id||!active())return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(!start.dragged&&Math.hypot(dx,dy)<5)return;
  if(!start.dragged){start.dragged=true;viewport.setPointerCapture?.(e.pointerId);viewport.classList.add('is-panning');}
  suppress=true;e.preventDefault();viewport.scrollTop=start.top-dy;viewport.scrollLeft=start.left-dx;
 };
 const up=e=>{
  if(!start||e.pointerId!==start.id)return;
  if(start.dragged){e.preventDefault();if(viewport.hasPointerCapture?.(e.pointerId))viewport.releasePointerCapture(e.pointerId);}
  start=null;viewport.classList.remove('is-panning');
 };
 const click=e=>{if(suppress){suppress=false;e.preventDefault();e.stopImmediatePropagation();}};
 const nativeDrag=e=>{if(active())e.preventDefault();};
 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move,{passive:false});viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);viewport.addEventListener('click',click,true);viewport.addEventListener('dragstart',nativeDrag);
 return ()=>{viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',up);viewport.removeEventListener('pointercancel',up);viewport.removeEventListener('click',click,true);viewport.removeEventListener('dragstart',nativeDrag);};
}
