// Detect the actual input device, not the browser's primary-device media query.
export function createHoverPreview({onHide,delay=350,pointerEvents=typeof PointerEvent!=='undefined',setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,owner=null,visible=false,source=null;
 function cancel(){if(timer!==null)clearTimer(timer);timer=null;}
 function hide(){cancel();owner=null;visible=false;source=null;onHide();}
 function leave(target){if(owner===target&&source==='pointer')hide();}
 function schedule(target,show,origin='pointer'){
  if(owner===target&&(timer!==null||visible))return;
  cancel();owner=target;visible=false;source=origin;
  timer=setTimer(()=>{timer=null;if(owner===target&&target.isConnected!==false){visible=true;show();}},delay);
 }
 function bind(target,show){
  const recover=e=>{if((e.pointerType==='mouse'||e.pointerType==='pen')&&!e.buttons)schedule(target,show);};
  target.onpointerenter=recover;
  target.addEventListener?.('pointermove',recover);
  target.onpointerleave=()=>leave(target);
  // Old browsers without Pointer Events still get a mouse-only fallback.
  target.onmouseenter=e=>{if(!pointerEvents&&!e.sourceCapabilities?.firesTouchEvents)schedule(target,show);};
  target.onmouseleave=()=>leave(target);
  target.onfocus=()=>{if(target.matches(':focus-visible'))schedule(target,show,'keyboard');};
  target.onblur=()=>{if(owner===target&&source==='keyboard')hide();};
 }
 return {bind,hide,cancel};
}
