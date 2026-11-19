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
test('Chinese labels cover every region and avoid board targets, names, connections and other Chinese labels',()=>{
 assert.deepEqual(Object.keys(layout.cityLabels).sort(),Object.keys(layout.anchors).filter(k=>!['northern','southern'].includes(k)).sort());
 const obstacles=[];
 for(const [groups,size] of [[layout.slots,.0465],[layout.merchants,.0445],[layout.markets,.0168],[layout.merchantBeer,.033]])
  for(const [key,positions] of Object.entries(groups))positions.forEach((pos,i)=>obstacles.push({name:`${key}:${i}`,shape:rect(pos,size,size)}));
 for(const [key,[x1,y1,x2,y2]] of Object.entries(layout.routeKeepouts))obstacles.push({name:'English:'+key,shape:rect([(x1+x2)/2,(y1+y2)/2],x2-x1,y2-y1)});
 for(const [key,route] of Object.entries(layout.routes))for(const [era,p] of Object.entries(route.eras))obstacles.push({name:`${key}:${era}`,shape:rect(p.center,(p.width||5.4)/100,(p.width||5.4)/180,p.angle)});
 for(const [key,pos] of Object.entries(layout.track))obstacles.push({name:'track:'+key,shape:rect(pos,.0215,.0215)});
 for(const [key,pos] of layout.turnOrder.entries())obstacles.push({name:'portrait:'+key,shape:rect(pos,.074,.074)});
 for(const [key,pos] of layout.turnSpend.entries())obstacles.push({name:'spent:'+key,shape:rect(pos,.061,.061)});
 for(const pile of layout.decks)obstacles.push({name:'pile:'+pile.kind,shape:rect(pile.center,...pile.size)});
 for(const [key,p] of Object.entries(layout.cityLabels)){
  assert.ok(p.font>=17,`${key} Chinese name must remain enlarged`);
  const shape=rect(p.center,p.width,p.height);
  for(const obstacle of obstacles)assert.equal(overlaps(shape,obstacle.shape),false,`${key} label overlaps ${obstacle.name}`);
  obstacles.push({name:'Chinese:'+key,shape});
 }
});
