import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const layout=JSON.parse(fs.readFileSync(new URL('../brass-birmingham/layout.json',import.meta.url)));
function rect([x,y],w,h,angle=0){
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);
}
function overlaps(a,b){
 for(const shape of [a,b])for(let i=0;i<4;i++){
  const p=shape[i],q=shape[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]],project=shape=>shape.map(p=>p[0]*axis[0]+p[1]*axis[1]);
  const aa=project(a),bb=project(b);
  if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;
 }
 return true;
}
test('all canal and rail pieces leave industry, merchant and market resource slots unobstructed',()=>{
 const obstacles=[];
 for(const [kind,groups,size] of [['industry',layout.slots,.0425],['merchant',layout.merchants,.0425],['market',layout.markets,.0148],['beer',layout.merchantBeer,.031]])
  for(const [key,positions] of Object.entries(groups))positions.forEach((pos,i)=>obstacles.push({name:`${kind}:${key}:${i}`,shape:rect(pos,size,size)}));
 for(const [key,[x1,y1,x2,y2]] of Object.entries(layout.routeKeepouts))obstacles.push({name:'label:'+key,shape:rect([(x1+x2)/2,(y1+y2)/2],x2-x1,y2-y1)});
 for(const [key,route] of Object.entries(layout.routes))for(const [era,pose] of Object.entries(route.eras)){
  const width=(pose.width||5.4)/100,shape=rect(pose.center,width,width*5/9,pose.angle);
  for(const obstacle of obstacles)assert.equal(overlaps(shape,obstacle.shape),false,`${era} ${key} overlaps ${obstacle.name}`);
 }
});
test('placed connection pieces do not cover another connection in either era',()=>{
 for(const era of ['canal','rail']){
  const pieces=Object.entries(layout.routes).flatMap(([key,r])=>{const p=r.eras[era];return p?[{key,shape:rect(p.center,(p.width||5.4)/100,(p.width||5.4)/180,p.angle)}]:[];});
  for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++)assert.equal(overlaps(pieces[i].shape,pieces[j].shape),false,`${era}: ${pieces[i].key} overlaps ${pieces[j].key}`);
 }
});
