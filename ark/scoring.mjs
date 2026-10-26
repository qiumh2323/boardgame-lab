const key = c => c.join(',');
const adjacent = (a,b) => Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[0]+a[1]-b[0]-b[1])) === 1;
const iconTypes = new Set(['africa','americas','asia','australia','europe','predator','herbivore','bird','reptile','primate','pet']);
export const achievementPoints = {2:5,3:7,4:10,5:14};

export function scorePlayer(player, tiles, map) {
  const entries = Object.entries(player.placed).map(([at,id])=>({at:at.split(',').map(Number),tile:tiles[id]}));
  const attribute = s => s === 'mountain' ? 'rock' : s;
  const icons = (entry, attr) => entry.tile.icons?.[attribute(attr)] || 0;
  const openCount = Object.keys(player.openAreas).length + map.openAreas.length;
  const globalCount = attr => attr === 'open' ? openCount : entries.reduce((sum,e)=>sum+icons(e,attr),0);
  const connectedCount = (start,attr) => {
    if (!icons(start,attr)) return 0;
    const seen=new Set([key(start.at)]), queue=[start];
    for (let i=0;i<queue.length;i++) for (const other of entries) {
      const at=key(other.at);
      if (!seen.has(at) && icons(other,attr) && adjacent(queue[i].at,other.at)) {seen.add(at);queue.push(other);}
    }
    return queue.reduce((sum,e)=>sum+icons(e,attr),0);
  };
  const tilePointsByKind={animal:0,building:0,project:0};
  for (const entry of entries) {
    const scoring=entry.tile.scoring;
    if (!scoring || scoring.type==='pet-set') continue;
    let points=0;
    if (scoring.type==='fixed') points=scoring.points;
    else if (scoring.type==='per-hand-tile') points=player.hand.length*scoring.multiplier;
    else if (scoring.type==='per-adjacent-icon') {
      const near=entries.filter(e=>adjacent(e.at,entry.at));
      const count=scoring.attribute==='different' ? new Set(near.flatMap(e=>Object.keys(e.tile.icons||{}).filter(i=>iconTypes.has(i)))).size : near.reduce((sum,e)=>sum+icons(e,scoring.attribute),0);
      points=count*scoring.multiplier;
    } else if (scoring.type==='per-attribute') points=(scoring.connected ? connectedCount(entry,scoring.attribute) : globalCount(scoring.attribute))*scoring.multiplier;
    else throw Error(`未支持的计分方式：${scoring.type}`);
    tilePointsByKind[entry.tile.kind]+=points;
  }
  const pets=entries.filter(e=>e.tile.icons?.pet), visited=new Set();
  for (const start of pets) {
    if (visited.has(key(start.at))) continue;
    const queue=[start];visited.add(key(start.at));
    for (let i=0;i<queue.length;i++) for (const other of pets) {
      const at=key(other.at);
      if (!visited.has(at) && adjacent(queue[i].at,other.at)) {visited.add(at);queue.push(other);}
    }
    tilePointsByKind.animal+=queue.length>=3?18:queue.length===2?9:3;
  }
  const tilePoints=Object.values(tilePointsByKind).reduce((sum,points)=>sum+points,0);
  const achievements=Object.values(player.achievements).reduce((sum,n)=>sum+achievementPoints[n],0);
  const markers=(player.conservation+player.pouch)*2;
  const openAreas=openCount;
  return {tilePoints,animalPoints:tilePointsByKind.animal,buildingPoints:tilePointsByKind.building,projectPoints:tilePointsByKind.project,achievements,markers,openAreas,endBonus:player.endBonus,total:tilePoints+achievements+markers+openAreas+player.endBonus,animals:entries.filter(e=>e.tile.kind==='animal').length};
}
