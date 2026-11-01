// Detect the actual input device, not the browser's primary-device media query.
export function createHoverPreview({onHide,delay=550,pointerEvents=typeof PointerEvent!=='undefined',setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null;
 function cancel(){if(timer!==null)clearTimer(timer);timer=null;}
 function hide(){cancel();onHide();}
 function schedule(target,show){cancel();timer=setTimer(()=>{timer=null;if(target.isConnected!==false)show();},delay);}
 function bind(target,show){
  target.onpointerenter=e=>{if((e.pointerType==='mouse'||e.pointerType==='pen')&&!e.buttons)schedule(target,show);};
  target.onpointerleave=hide;
  // Old browsers without Pointer Events still get a mouse-only fallback.
  target.onmouseenter=e=>{if(!pointerEvents&&!e.sourceCapabilities?.firesTouchEvents)schedule(target,show);};
  target.onmouseleave=hide;
  target.onfocus=()=>{if(target.matches(':focus-visible'))schedule(target,show);};
  target.onblur=hide;
 }
 return {bind,hide,cancel};
}
