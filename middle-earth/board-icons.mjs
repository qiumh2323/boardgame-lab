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
const pawnFrames=[
 [[725,121,184,329],'8% 91%,3% 59%,8% 5%,13% 1%,24% 0,33% 7%,38% 33%,53% 30%,67% 32%,80% 41%,97% 48%,100% 60%,94% 83%,88% 97%,72% 100%,16% 99%'],
 [[291,48,212,400],'11% 53%,14% 33%,9% 22%,13% 3%,18% 0,30% 0,33% 4%,44% 4%,46% 0,58% 0,63% 4%,72% 4%,75% 0,85% 0,90% 3%,98% 13%,97% 26%,89% 39%,77% 39%,77% 90%,86% 95%,83% 100%,13% 99%,2% 94%,0 86%'],
 [[1021,121,188,329],'2% 68%,6% 55%,19% 45%,27% 35%,42% 28%,57% 32%,58% 14%,63% 4%,69% 1%,80% 0,89% 7%,93% 35%,97% 58%,100% 84%,90% 98%,72% 100%,12% 98%,4% 92%'],
 [[1623,46,245,404],'7% 21%,5% 12%,12% 2%,26% 1%,29% 5%,38% 5%,42% 1%,53% 1%,58% 5%,67% 5%,72% 0,78% 1%,82% 5%,85% 16%,85% 25%,77% 32%,87% 59%,99% 87%,91% 97%,79% 100%,24% 99%,17% 95%,15% 85%,13% 46%,7% 38%']
];
const soldierFaces=[
 [[121,154,168,295],'0% 60%,3% 56%,21% 50%,30% 38%,36% 34%,48% 34%,61% 39%,63% 7%,67% 2%,73% 0,83% 0,94% 4%,98% 11%,100% 91%,97% 96%,89% 99%,14% 100%,9% 97%,10% 91%,3% 74%'],
 [[370,140,158,291],'0% 65%,2% 58%,10% 55%,26% 49%,36% 38%,42% 34%,53% 34%,66% 40%,71% 7%,75% 2%,83% 0,92% 2%,98% 7%,100% 15%,96% 91%,91% 98%,81% 100%,11% 99%,4% 96%,8% 90%,2% 74%']
];
export function originalPawn(side,fort){
 const [box,outline]=fort?pawnFrames[side*2+1]:soldierFaces[side];
 const svg=shape('svg',{class:'piece-sprite pawn-photo'+(fort?'':' pawn-front'),viewBox:box.join(' '),'aria-hidden':'true'});
 const img=shape('image',fort?{href:'./original-art/pawn-tiles.jpg',width:1920,height:495}:{href:'./original-art/soldier-fronts.jpg',width:1200,height:635});
 svg.style.clipPath='polygon('+outline+')';svg.style.aspectRatio=box[2]+'/'+box[3];img.addEventListener('error',()=>svg.replaceWith(pawnIcon(side,fort)),{once:true});
 svg.append(img);return svg;
}
