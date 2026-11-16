const ns='http://www.w3.org/2000/svg';
function shape(tag,props){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(props))node.setAttribute(k,v);return node;}
const scenes={
 Lindon:['#365e74','M5 30h54 M16 28V16h5v12m2-8 9-11v19m2-8h6v8m4-2 7-7v9','M4 34q7-4 14 0t14 0t14 0t14 0'],
 Arnor:['#506443','M6 30h52 M12 29V20l9-7 8 7v9m3 0V21l8-7 8 7v8m3 0v-8h5v8','M8 34a36 36 0 0 1 48 0'],
 Rhovanion:['#516184','M5 29 19 13l5 4 11-11 24 23H5zm22 0v-7h10v7','M8 34h48'],
 Enedwaith:['#68516d','M7 31h50 M25 28l2-15-3-4 5 1 3-5 3 5 5-1-3 4 2 15Z','M10 34h44'],
 Rohan:['#386d58','M5 28 17 13l9 9 13-13 20 19 M15 29h34V18h-6v4h-5v-4h-6v4h-5v-4h-6v11','M8 34h48'],
 Gondor:['#376682','M8 31h48M13 28h38v-4H18v-4h29v-4H23v-4h19V8h-6V4h-4v4h-6v4','M11 34h42'],
 Mordor:['#874638','M5 31 19 18l7 6 10-10 22 17M28 26l2-11 1-7 3 4 4-4 1 7 3 11','M46 12q6-5 12 0-6 5-12 0zm6-2v4']
};
export function landmarkIcon(region){
 const [color,scene,detail]=scenes[region];
 const svg=shape('svg',{class:'landmark-icon',viewBox:'0 0 64 38','aria-hidden':'true'});
 svg.append(shape('rect',{width:64,height:38,rx:4,fill:color}),shape('circle',{cx:49,cy:10,r:5,fill:'#f5d79b',opacity:'.65'}));
 for(const [d,stroke] of [[scene,'#fff0ca'],[detail,'#e1bd82']])svg.append(shape('path',{d,fill:'none',stroke,'stroke-width':'1.4','stroke-linejoin':'round','stroke-linecap':'round'}));
 return svg;
}
export function pawnIcon(side,fort){
 const svg=shape('svg',{class:'piece-sprite',viewBox:'0 0 28 32','aria-hidden':'true'});
 const fill=side?'#873830':'#24577b',rim=side?'#f4d0a0':'#dcecf3';
 const d=fort?'M4 3h5v5h3V3h4v5h3V3h5v10l-3 4v8l4 3v2H3v-2l4-3v-8l-3-4Z':'M14 3c3 0 5 2 5 5v2l4 3v6c0 5-4 9-9 11-5-2-9-6-9-11v-6l4-3V8c0-3 2-5 5-5Z';
 svg.append(shape('path',{d,fill,stroke:rim,'stroke-width':1.5,'stroke-linejoin':'round'}),shape('path',{d:fort?'M12 27v-7a2 2 0 0 1 4 0v7M8 13h12':'M9 16h10m-5-4v13',fill:'none',stroke:rim,'stroke-width':1.5,'stroke-linecap':'round'}));
 return svg;
}
