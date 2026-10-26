// Interaction sandbox only. This is intentionally separate from the rules adapter.
import {maps, cells, bonusNames} from './maps.mjs';
import {tileName, label} from './zh.mjs';
import {scorePlayer} from './scoring.mjs';
import {runPolicyTurn} from './ai_policy.mjs';
export {cells};
export const cards = ['projects', 'forest', 'water', 'rock'];
export const key = c => c.join(',');
const adjacent = (a, b) => Math.max(Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), Math.abs(a[0]+a[1]-b[0]-b[1])) === 1;
const continents = ['africa', 'americas', 'asia', 'australia', 'europe'];
const animals = ['predator', 'herbivore', 'bird', 'reptile', 'primate', 'pet'];
const types = [...continents, ...animals];
const directions = {top:[0,1], 'upper-right':[1,0], 'lower-right':[1,-1], bottom:[0,-1], 'lower-left':[-1,0], 'upper-left':[-1,1]};
export class DemoGame {
  constructor(catalog, random = Math.random, mapSide = 'A', firstPlayer = 0) {
    const mapSides=Array.isArray(mapSide)?mapSide:[mapSide,mapSide];
    if (mapSides.length!==2||mapSides.some(side=>!maps[side]?.verified)) throw Error('该地图尚未录入核对，不能开始对局');
    this.random=random;
    this.mapSides = [...mapSides]; this.pendingBonus = null;
    this.tiles = Object.fromEntries(catalog.tiles.map(t => [t.tile_id, t]));
    this.deck = catalog.tiles.map(t => t.tile_id);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.market = this.deck.splice(0, 6);
    this.objectives = [...catalog.objectives];
    for (let i = this.objectives.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.objectives[i], this.objectives[j]] = [this.objectives[j], this.objectives[i]];
    }
    this.objectives = this.objectives.slice(0, 5);
    this.players = [0, 1].map(() => ({hand: [], placed: {}, openAreas: {}, conservation: 0, pouch: 0, cards: [], upgraded:[], upgradeUsed:[], achievements:{}, supportedThisTurn:false, endBonus:0, turns:0}));
    this.setupActionCards(firstPlayer);
    this.current = firstPlayer; this.phase = 'draft'; this.turn = firstPlayer ? 0 : 1; this.usedBuilding = false; this.followup = null;
    this.pendingEffect = null; this.pendingAfterOpen = null; this.effectQueue = []; this.effectSourceQueue = [];
    this.deferredShiftEffects = []; this.queuedBonuses = []; this.queuedBonusSources = [];
    this.pendingBonusSource = null; this.deferredShiftBonuses = []; this.endTriggeredBy = null; this.scores = null;
    this.discard = []; this.logs = ['保护区已开放。先从展示区拿取你的第一张版块。'];
  }
  get mapSide(){return this.mapSides[this.current];}
  get map(){return maps[this.mapSide];}
  mapSideFor(playerIndex){return this.mapSides[playerIndex];}
  mapFor(playerIndex){return maps[this.mapSideFor(playerIndex)];}
  setupActionCards(firstPlayer = 0) {
    if (![0,1].includes(firstPlayer)) throw Error('先手玩家编号无效');
    for (let playerIndex=0;playerIndex<2;playerIndex++) {
      const others=['forest','water','rock'];
      for (let i=others.length-1;i>0;i--) {
        const j=Math.floor(this.random()*(i+1));
        [others[i],others[j]]=[others[j],others[i]];
      }
      const projectIndex=playerIndex===firstPlayer?0:1;
      const arranged=[];
      for (let slot=0;slot<4;slot++) arranged.push(slot===projectIndex?'projects':others.shift());
      this.players[playerIndex].cards=arranged;
    }
  }
  get player() { return this.players[this.current]; }
  snapshot() {
    const keys=['deck','market','objectives','players','mapSides','current','phase','turn','usedBuilding','followup','pendingEffect','pendingAfterOpen','effectQueue','effectSourceQueue','deferredShiftEffects','queuedBonuses','queuedBonusSources','pendingBonus','pendingBonusSource','deferredShiftBonuses','endTriggeredBy','scores','discard','logs'];
    return structuredClone(Object.fromEntries(keys.map(name=>[name,this[name]])));
  }
  restore(snapshot, cloneValues = true) {
    Object.assign(this, cloneValues ? structuredClone(snapshot) : snapshot);
  }
  strength(card) { return this.player.cards.indexOf(card) + 1 + (this.player.upgraded.includes(card) ? 1 : 0); }
  reachable() { return this.strength('projects'); }
  iconCounts(player = this.player) {
    const counts = {};
    for (const id of Object.values(player.placed)) for (const [icon,n] of Object.entries(this.tiles[id].icons || {})) counts[icon] = (counts[icon] || 0) + n;
    return counts;
  }
  availableUpgrades(player = this.player) {
    const placed = Object.entries(player.placed).map(([at,id]) => ({at:at.split(',').map(Number), tile:this.tiles[id]}));
    const habitats = ['forest','water','rock'];
    const connected3 = habitats.some(h => placed.some(start => {
      const seen = new Set([key(start.at)]), queue = [start];
      for (let i=0;i<queue.length;i++) for (const other of placed) {
        const at=key(other.at);
        if (!seen.has(at) && other.tile.icons?.[h] && adjacent(queue[i].at,other.at)) {seen.add(at);queue.push(other);}
      }
      return start.tile.icons?.[h] && queue.length>=3;
    }));
    const counts=this.iconCounts(player);
    const conditions=[Object.keys(player.achievements).length>=1, placed.filter(e=>e.tile.kind==='project').length>=2, connected3, animals.filter(a=>counts[a]).length>=4];
    return conditions.flatMap((met,i)=>met&&!player.upgradeUsed.includes(i)?[i]:[]);
  }
  upgrade(card, condition) {
    if (this.phase!=='building' || !cards.includes(card) || this.player.upgraded.includes(card) || !this.availableUpgrades().includes(condition)) throw Error('当前不符合这张行动牌的升级条件');
    this.player.upgradeUsed.push(condition); this.player.upgraded.push(card);
    this.logs.unshift(`${this.current ? '电脑' : '你'}升级了${label(card)}行动`);
  }
  support(objectiveId, marker) {
    if (this.phase!=='building' || this.player.supportedThisTurn) throw Error('每回合至多支持一个保护目标');
    const objective=this.objectives.find(o=>o.objective_id===objectiveId);
    if (!objective || this.player.achievements[objectiveId] || ![2,3,4,5].includes(marker) || Object.values(this.player.achievements).includes(marker)) throw Error('请选择未使用的目标和成就标记');
    const have=this.iconCounts()[objective.icon]||0, spend=Math.max(0,marker-have);
    if (!have || spend>this.player.conservation) throw Error('图标和保护标记不足，无法支持这个目标');
    this.player.conservation-=spend; this.player.achievements[objectiveId]=marker; this.player.supportedThisTurn=true;
    this.logs.unshift(`${this.current ? '电脑' : '你'}支持了${label(objective.icon)}目标（${marker} 图标，消耗 ${spend} 个保护标记）`);
  }
  effectiveLevel(tile) {
    let reduction=0;
    for (const id of Object.values(this.player.placed)) {
      const t=this.tiles[id], effect=t.ongoing_effect;
      if (!effect || tile.kind==='building') continue;
      let m;
      if ((m=/^tiles with an? (water|rock|forest|africa|asia|europe|americas|australia) icon require (\d+) less action strength$/.exec(effect)) && tile.icons?.[m[1]]) reduction+=Number(m[2]);
      else if ((m=/^tiles of level (2 or 3|4 or 5) require 1 less action strength$/.exec(effect)) && (m[1]==='2 or 3'?tile.level<=3:tile.level>=4)) reduction++;
    }
    return Math.max(0,tile.level-reduction);
  }
  draft(index, projectAction = false) {
    if (this.phase !== (projectAction ? 'action' : 'draft')) throw Error('当前不能拿取展示版块');
    if (!Number.isInteger(index) || index < 0 || index >= this.market.length || !this.market[index]) throw Error('该位置没有版块');
    if (!projectAction && index >= this.reachable()) throw Error('超出项目行动的拿取范围');
    const id = this.market[index]; this.market[index] = null; this.player.hand.push(id);
    this.logs.unshift(projectAction
      ? `${this.current ? '电脑' : '你'}使用项目行动，从展示区拿取了 ${tileName(this.tiles[id])}`
      : `${this.current ? '电脑' : '你'}完成开局拿取：${tileName(this.tiles[id])}`);
    if (projectAction) {
      if (this.player.upgraded.includes('projects')) {this.followup={type:'project-draft'};this.phase='second-project';}
      else this.consume('projects');
    } else this.phase = 'action';
  }
  secondProject(index = null) {
    if (this.phase!=='second-project' || this.followup?.type!=='project-draft') throw Error('当前不能再次拿取项目版块');
    if (index !== null) {
      if (!Number.isInteger(index) || !this.market[index]) throw Error('请选择展示区有版块的位置');
      const id=this.market[index];this.market[index]=null;this.player.hand.push(id);
      this.logs.unshift(`${this.current?'电脑':'你'}使用升级项目行动，再次从展示区拿取了 ${tileName(this.tiles[id])}`);
    }
    this.followup=null;this.consume('projects');
  }
  endAnimalAction() {
    if (this.phase!=='second-animal' || this.followup?.type!=='animal') throw Error('当前没有待完成的第二只动物');
    const card=this.followup.card;this.followup=null;this.consume(card);this.nextEffect();
  }
  consume(card) {
    const list = this.player.cards; list.splice(list.indexOf(card), 1); list.unshift(card); this.phase = 'building';
  }
  draw(card) {
    if (this.phase !== 'action' || !cards.includes(card) || card === 'projects') throw Error('选择栖息地行动以抽取两张版块');
    const drawn = this.deck.splice(0, 2); this.player.hand.push(...drawn); this.consume(card);
    this.logs.unshift(`${this.current ? '电脑' : '你'}使用${label(card)}行动，从牌堆抽取了 ${drawn.length} 张版块`);
  }
  canPlay(id, card) {
    const t = this.tiles[id];
    if (!t || !this.player.hand.includes(id)) return false;
    if (t.kind === 'building') return this.phase === 'building' && !this.usedBuilding;
    if (this.phase === 'second-animal') return t.kind==='animal' && card===this.followup?.card && t.habitats.includes(card) && this.effectiveLevel(t)<=this.followup.remaining;
    if (this.phase !== 'action' || !cards.includes(card) || this.effectiveLevel(t) > this.strength(card)) return false;
    return t.kind === 'project' ? card === 'projects' : card !== 'projects' && t.habitats.includes(card);
  }
  placementError(id, coordinate, relocation = false) {
    const tile = this.tiles[id];
    if (!tile || tile.kind !== 'building') return null;
    const requirement = tile.placement_requirement;
    if (relocation && requirement !== 'by the River' && !requirement?.startsWith('next to ')) return null;
    const placed = Object.entries(this.player.placed).map(([at, tileId]) => ({coordinate: at.split(',').map(Number), tile: this.tiles[tileId]}));
    const near = placed.filter(entry => adjacent(entry.coordinate, coordinate));
    const nearIcons = icon => near.reduce((sum, entry) => sum + (entry.tile?.icons?.[icon] || 0), 0);
    const globalIcons = new Set(placed.flatMap(entry => Object.keys(entry.tile?.icons || {})));
    let match;
    if ((match = /^next to (\d+) (africa|americas|asia|australia|europe|predator|primate|bird|reptile|herbivore|Water|Forest|Rock) icons?$/.exec(requirement))) {
      if (nearIcons(match[2].toLowerCase()) < Number(match[1])) return `需要相邻至少 ${match[1]} 个${label(match[2].toLowerCase())}图标。`;
    } else if ((match = /^next to a connected (Forest|Rock|Water) area of at least (\d+) tiles$/.exec(requirement))) {
      const habitat = match[1].toLowerCase();
      const matching = placed.filter(entry => entry.tile?.icons?.[habitat]);
      const visited = new Set();
      let found = false;
      for (const entry of matching) {
        const start = key(entry.coordinate);
        if (visited.has(start)) continue;
        const group = [entry]; visited.add(start);
        for (let i = 0; i < group.length; i++) for (const other of matching) {
          const otherKey = key(other.coordinate);
          if (!visited.has(otherKey) && adjacent(group[i].coordinate, other.coordinate)) { visited.add(otherKey); group.push(other); }
        }
        if (group.length >= Number(match[2]) && group.some(member => adjacent(member.coordinate, coordinate))) found = true;
      }
      if (!found) return `需要相邻一片至少 ${match[2]} 格连通的${label(habitat)}栖息地。`;
    } else if (requirement === 'next to 4 different adjacent animal and/or continent icons') {
      const distinct = new Set(near.flatMap(entry => Object.keys(entry.tile?.icons || {}).filter(icon => types.includes(icon))));
      if (distinct.size < 4) return '需要相邻版块上至少 4 种不同的动物或大陆图标。';
    } else if (requirement === 'next to 2 Buildings') {
      if (near.filter(entry => entry.tile?.kind === 'building').length < 2) return '需要相邻至少 2 座建筑。';
    } else if (requirement === 'next to 2 Large Animals') {
      if (near.filter(entry => entry.tile?.kind === 'animal' && entry.tile.level >= 4).length < 2) return '需要相邻至少 2 只大型动物。';
    } else if (requirement === 'next to 2 placement-bonus spaces') {
      if (Object.keys(this.map.bonuses).filter(at => adjacent(at.split(',').map(Number), coordinate)).length < 2) return '需要相邻至少 2 个地图放置奖励格。';
    } else if (requirement === 'have 5 different continent icons') {
      if (continents.filter(icon => globalIcons.has(icon)).length < 5) return '需要保护区内有 5 种不同的大陆图标。';
    } else if (requirement === 'have 5 different animal icons') {
      if (animals.filter(icon => globalIcons.has(icon)).length < 5) return '需要保护区内有 5 种不同的动物图标。';
    } else if (requirement === 'have 10 different animal and/or continent icons') {
      if (types.filter(icon => globalIcons.has(icon)).length < 10) return '需要保护区内有 10 种不同的动物或大陆图标。';
    } else if (requirement === 'next to 2 Projects') {
      if (near.filter(entry => entry.tile?.kind === 'project').length < 2) return '需要相邻至少 2 个项目。';
    } else if (requirement === 'have at least 7 tiles in hand') {
      if (this.player.hand.length < 7) return '手牌至少需要 7 张版块。';
    } else if (requirement === 'discard 4 tiles') {
      if (this.player.hand.length < 5) return '打出雕像还需另外弃置 4 张手牌。';
    } else if (requirement && requirement !== 'by the River' && requirement !== 'have tiles on all spaces by the River') {
      return `尚未支持这张建筑的条件：${requirement}`;
    }
    if (requirement === 'by the River' && !this.map.riverCells.some(c => key(c) === key(coordinate))) return '这张版块必须放在临河格：地图最左侧或最右侧的三个格子。';
    if (requirement === 'have tiles on all spaces by the River' && !this.map.riverCells.every(c => this.player.placed[key(c)] || this.player.openAreas[key(c)])) return '必须先在六个临河格全部放置版块，才能建造喷泉。';
    return null;
  }
  openNeeds(id, coordinate) {
    const needs=[];
    for (const edge of this.tiles[id]?.open_area_edges || []) {
      const offset=directions[edge];
      if (!offset) throw Error(`未知开放区域方向：${edge}`);
      const at=[coordinate[0]+offset[0],coordinate[1]+offset[1]], k=key(at);
      if (!this.map.cells.some(c=>key(c)===k) || this.player.placed[k]) return null;
      if (!this.map.openAreas.some(c=>key(c)===k) && !this.player.openAreas[k]) needs.push(at);
    }
    return needs;
  }
  spaces(id = null, relocation = false) {
    const release=this.tiles[id]?.placement_requirement?.match(/^release 1 Animal with the (\w+) icon$/);
    if (release && !relocation) return this.canPlay(id,'projects') ? Object.entries(this.player.placed).filter(([,tileId])=>this.tiles[tileId].kind==='animal' && this.tiles[tileId].icons?.[release[1]]).map(([at])=>at.split(',').map(Number)) : [];
    const occupied = [...Object.keys(this.player.placed), ...Object.keys(this.player.openAreas)].map(s => s.split(',').map(Number));
    return this.map.cells.filter(c => {
      if (this.map.openAreas.some(a => key(a) === key(c)) || this.player.placed[key(c)] || this.player.openAreas[key(c)] || ![[0, 0], ...occupied].some(a => adjacent(a,c)) || this.placementError(id,c,relocation)) return false;
      if (!id) return true;
      const needs=this.openNeeds(id,c);
      return needs !== null && (relocation ? needs.length===0 : this.player.hand.length >= needs.length+1);
    });
  }
  relocationSpaces(source) {
    const id = this.player.placed[source] || this.player.openAreas[source];
    if (!id) return [];
    const area = Boolean(this.player.openAreas[source]);
    const collection = area ? this.player.openAreas : this.player.placed;
    const field=area?'openAreas':'placed';
    this.player[field]={...collection};
    delete this.player[field][source];
    try { return this.spaces(area ? null : id, true).filter(c => key(c) !== source); }
    finally { this.player[field] = collection; }
  }
  triggerBonus(coordinate, defer = false) {
    const bonus = this.map.bonuses[key(coordinate)];
    if (bonus === 'draw') {
      this.player.hand.push(...this.deck.splice(0,1));
      this.logs.unshift(`${this.current ? '电脑' : '你'}获得地图奖励：抽取 1 张`);
    } else if (bonus === 'pouch') {
      this.player.pouch++;
      this.logs.unshift(`${this.current ? '电脑' : '你'}获得地图奖励：1 个育儿袋标记`);
    } else if (bonus === 'wheel') {
      this.player.conservation++;
      this.logs.unshift(`${this.current ? '电脑' : '你'}获得地图奖励：1 个保护标记`);
    } else if (bonus === 'tile') {
      this.effectQueue.push('place 1 Open Area from the pile in your zoo');
      this.logs.unshift(`${this.current ? '电脑' : '你'}触发地图奖励：放置开放区域`);
      if (!defer) this.nextEffect();
    } else if (bonus === 'shift') {
      this.deferredShiftBonuses ??= [];
      this.deferredShiftBonuses.push('地图放置奖励');
      if (!this.pendingEffect && !defer) this.nextEffect();
      this.logs.unshift(`${this.current ? '电脑' : '你'}触发地图奖励：${bonusNames[bonus]}（行动结束后结算）`);
    } else if (['market','building','animal'].includes(bonus)) {
      const effect=bonus;
      this.queuedBonusSources ??= [];
      if (this.pendingBonus) {this.queuedBonuses.push(effect);this.queuedBonusSources.push('地图放置奖励');}
      else {this.pendingBonus = effect;this.pendingBonusSource='地图放置奖励';}
      if (!this.pendingEffect && !defer) this.phase = 'bonus';
      this.logs.unshift(`${this.current ? '电脑' : '你'}触发地图奖励：${bonusNames[bonus]}`);
    }
  }
  marketEffectEligible(id, kind = null) {
    if (!id) return false;
    const tile=this.tiles[id];
    return !kind || kind===tile.kind || kind==='small-animal' && tile.kind==='animal' && tile.level<=3 || kind==='large-animal' && tile.kind==='animal' && tile.level>=4 || kind.startsWith('icon:') && tile.icons?.[kind.slice(5)]>0;
  }
  queueTileEffects(tile) {
    this.effectSourceQueue ??= []; this.deferredShiftEffects ??= [];
    const enqueue=(effect,origin)=>{
      if (effect === 'move 1 Action to strength 1') this.deferredShiftEffects.push(origin);
      else {this.effectQueue.push(effect);this.effectSourceQueue.push(origin);}
    };
    if (tile.immediate_effect && !tile.placement_requirement?.startsWith('release 1 Animal')) enqueue(tile.immediate_effect,`${tileName(tile)}的即时效果`);
    for (const id of Object.values(this.player.placed)) {
      const source=this.tiles[id], ongoing=source.ongoing_effect;
      const match=ongoing?.match(/^after playing a tile with a (\w+) icon: (.+)$/);
      if (match && tile.icons?.[match[1]]) enqueue(match[2],`${tileName(source)}的持续效果`);
    }
    this.nextEffect();
  }
  nextEffect() {
    this.effectSourceQueue ??= []; this.deferredShiftEffects ??= []; this.deferredShiftBonuses ??= [];
    while (!this.pendingEffect && this.effectQueue.length) {
      const effect=this.effectQueue.shift(), origin=this.effectSourceQueue.shift()||'版块效果';
      if (effect === 'move 1 Action to strength 1') {this.deferredShiftEffects.push(origin);continue;}
      this.startEffect({immediate_effect:effect},origin);
    }
    if (this.pendingEffect) return;
    if (this.followup?.type==='animal') {this.phase='second-animal';return;}
    if (this.deferredShiftEffects.length) {
      const origin=this.deferredShiftEffects.shift();
      this.startEffect({immediate_effect:'move 1 Action to strength 1'},origin);
      return;
    }
    if (this.pendingBonus) {this.phase='bonus';return;}
    if (this.deferredShiftBonuses.length) {
      this.pendingBonus='shift';this.pendingBonusSource=this.deferredShiftBonuses.shift();this.phase='bonus';return;
    }
    this.phase='building';
  }
  startEffect(tile, origin = '版块效果') {
    const effect = tile.immediate_effect;
    if (!effect) return;
    const who = this.current ? '电脑' : '你';
    let match;
    if (effect === 'gain 1 conservation marker' || effect === 'gain 2 conservation markers') {const n=effect.includes('2 ') ? 2 : 1;this.player.conservation+=n;this.logs.unshift(`${who}获得 ${n} 个保护标记`);}
    else if ((match = /^draw (\d+) tiles? from the pile$/.exec(effect))) {
      const drawn = this.deck.splice(0, Number(match[1])); this.player.hand.push(...drawn);
      this.logs.unshift(`${who}从牌堆抽取了 ${drawn.length} 张版块`);
    } else if (effect === 'draw 3 tiles from the pile; keep 1 Animal') {
      const revealed = this.deck.splice(0,3);
      if (revealed.some(id => this.tiles[id].kind === 'animal')) this.pendingEffect = {type:'choose-animal', revealed};
      else {this.discard.push(...revealed); this.logs.unshift(`${who}展示了 ${revealed.length} 张，未抽到动物版块`);}
    } else if (effect === 'take all Projects from the display' || effect === 'take all Buildings from the display') {
      const kind = effect.includes('Projects') ? 'project' : 'building';
      const taken = this.market.filter(id => id && this.tiles[id].kind === kind);
      this.market = this.market.map(id => id && this.tiles[id].kind === kind ? null : id);
      this.player.hand.push(...taken); this.logs.unshift(`${who}从展示区拿取了 ${taken.length} 张${label(kind)}版块`);
    } else if (effect === 'take 1 tile from the display' || /^take 1 (Building|Animal|Project|Small Animal|Large Animal) from the display$/.test(effect) || /^take 1 tile with an? \w+ icon from the display$/.test(effect)) {
      const type=effect.match(/^take 1 (Building|Animal|Project|Small Animal|Large Animal)/)?.[1];
      const icon=effect.match(/^take 1 tile with an? (\w+) icon/)?.[1];
      const kind=icon ? `icon:${icon}` : ({Building:'building',Animal:'animal',Project:'project','Small Animal':'small-animal','Large Animal':'large-animal'})[type] || null;
      if (this.market.some(id=>this.marketEffectEligible(id,kind))) this.pendingEffect = {type:'market', kind};
      else this.logs.unshift('展示区没有符合条件的版块，效果结束');
    } else if (effect === 'place 1 Open Area from the pile in your zoo' || effect === 'place 2 Open Areas from the pile in your zoo') {
      if (this.deck.length && this.spaces().length) this.pendingEffect = {type:'open-area', remaining:effect.includes('2 Open') ? 2 : 1};
      else this.logs.unshift('没有可放置的开放区域或牌堆已空，效果结束');
    } else if (effect === 'discard up to 2 tiles; gain 1 pouch marker for each') {
      if (this.player.hand.length) this.pendingEffect = {type:'pouch', remaining:2};
    } else if (effect === 'discard 1 tile to gain 1 pouch marker') {
      if (this.player.hand.length) this.pendingEffect={type:'pouch',remaining:1};
    } else if (effect === 'take 1 Project from the display; gain 1 conservation marker') {
      this.player.conservation++; this.startEffect({immediate_effect:'take 1 Project from the display'});
    } else if (effect === 'move 1 Action to strength 1') this.pendingEffect = {type:'shift'};
    else if (effect === 'relocate 1 tile in your zoo') {
      if (Object.keys(this.player.placed).some(source => this.relocationSpaces(source).length) || Object.keys(this.player.openAreas).some(source => this.relocationSpaces(source).length)) this.pendingEffect = {type:'relocate', source:null};
      else this.logs.unshift('当前没有可移动到新位置的版块，效果结束');
    } else throw Error(`未识别的动物效果：${effect}`);
    if (this.pendingEffect) {this.pendingEffect.origin=origin;this.phase = 'effect';}
  }
  finishEffect() {
    this.pendingEffect = null; this.phase = this.pendingBonus ? 'bonus' : this.followup?.type==='animal'?'second-animal':'building';
    if (this.pendingAfterOpen) {
      const id=this.pendingAfterOpen; this.pendingAfterOpen=null;
      this.queueTileEffects(this.tiles[id]);
    } else this.nextEffect();
  }
  selectOpenTarget(coordinate) {
    const effect = this.pendingEffect;
    if (this.phase !== 'effect' || effect?.type !== 'open-cost') throw Error('当前不需要选择开放区域位置');
    if (!Array.isArray(coordinate) || !effect.targets.some(target => key(target) === key(coordinate))) throw Error('请选择亮起的开放区域位置');
    effect.selectedTarget = [...coordinate];
  }
  resolveEffect(choice = null) {
    if (this.phase !== 'effect' || !this.pendingEffect) throw Error('当前没有待结算的动物效果');
    const effect = this.pendingEffect;
    if (choice === null) {
      if (effect.type === 'statue-discard') throw Error('雕像必须弃置另外四张手牌，不能跳过');
      if (effect.type === 'open-cost') throw Error('必须从手牌选择版块，完成所需开放区域');
      if (effect.type === 'choose-animal') this.discard.push(...effect.revealed);
      this.logs.unshift(`${this.current ? '电脑' : '你'}放弃了剩余动物效果`); this.finishEffect(); return;
    }
    if (effect.type === 'statue-discard') {
      if (!this.player.hand.includes(choice)) throw Error('请选择要为雕像弃置的手牌');
      this.player.hand.splice(this.player.hand.indexOf(choice),1); this.discard.push(choice); effect.remaining--;
      this.logs.unshift(`${this.current ? '电脑' : '你'}为雕像弃置了 ${tileName(this.tiles[choice])}，还需弃置 ${effect.remaining} 张`);
      if (!effect.remaining) {
        this.pendingEffect=null; this.phase='building';
        this.triggerBonus(effect.coordinate,true);
        this.queueTileEffects(this.tiles['135']);
      }
    } else if (effect.type === 'open-cost') {
      if (!this.player.hand.includes(choice)) throw Error('请选择一张手牌作为开放区域');
      const targetIndex=effect.selectedTarget ? effect.targets.findIndex(target => key(target) === key(effect.selectedTarget)) : 0;
      if (targetIndex < 0) throw Error('所选开放区域位置已不可用');
      const [coordinate]=effect.targets.splice(targetIndex,1); effect.selectedTarget=null;
      this.player.hand.splice(this.player.hand.indexOf(choice),1); this.player.openAreas[key(coordinate)]=choice;
      this.logs.unshift(`${this.current ? '电脑' : '你'}用手牌放置了所需开放区域`);
      this.triggerBonus(coordinate);
      if (!effect.targets.length) this.finishEffect();
    } else if (effect.type === 'market') {
      if (!Number.isInteger(choice) || !this.marketEffectEligible(this.market[choice],effect.kind)) throw Error('请选择展示区符合条件的版块');
      const id = this.market[choice]; this.player.hand.push(id); this.market[choice] = null;
      this.logs.unshift(`${this.current ? '电脑' : '你'}通过动物效果拿取了 ${tileName(this.tiles[id])}`); this.finishEffect();
    } else if (effect.type === 'choose-animal') {
      if (!effect.revealed.includes(choice) || this.tiles[choice].kind !== 'animal') throw Error('请选择展示出的动物版块');
      this.player.hand.push(choice); this.discard.push(...effect.revealed.filter(id => id !== choice));
      this.logs.unshift(`${this.current ? '电脑' : '你'}保留了 ${tileName(this.tiles[choice])}，弃置其余版块`); this.finishEffect();
    } else if (effect.type === 'pouch') {
      if (!this.player.hand.includes(choice)) throw Error('请选择要弃置的手牌');
      this.player.hand.splice(this.player.hand.indexOf(choice),1); this.discard.push(choice); this.player.pouch++; effect.remaining--;
      this.logs.unshift(`${this.current ? '电脑' : '你'}弃置 1 张手牌，获得 1 个育儿袋标记`);
      if (!effect.remaining || !this.player.hand.length) this.finishEffect();
    } else if (effect.type === 'shift') {
      if (!cards.includes(choice)) throw Error('请选择一张行动牌');
      const list = this.player.cards; list.splice(list.indexOf(choice),1); list.unshift(choice);
      this.logs.unshift(`${this.current ? '电脑' : '你'}将${label(choice)}行动移至强度 1`); this.finishEffect();
    } else if (effect.type === 'open-area') {
      const coordinate = choice;
      if (!Array.isArray(coordinate) || !this.spaces().some(c => key(c) === key(coordinate))) throw Error('请选择可放置开放区域的相邻空格');
      if (!this.deck.length) {this.finishEffect(); return;}
      this.player.openAreas[key(coordinate)] = this.deck.shift(); effect.remaining--;
      this.logs.unshift(`${this.current ? '电脑' : '你'}放置了 1 个开放区域`);
      this.triggerBonus(coordinate);
      if (!effect.remaining || !this.deck.length || !this.spaces().length) this.finishEffect();
    } else if (effect.type === 'relocate') {
      if (!effect.source) {
        if (typeof choice !== 'string' || !this.relocationSpaces(choice).length) throw Error('请选择保护区内可移动的版块');
        effect.source = choice; return;
      }
      const destination = choice;
      if (!Array.isArray(destination) || !this.relocationSpaces(effect.source).some(c => key(c) === key(destination))) throw Error('请选择移动后合法的空格');
       const from = effect.source, area = Boolean(this.player.openAreas[from]);
       const collection = area ? this.player.openAreas : this.player.placed;
       collection[key(destination)] = collection[from]; delete collection[from]; this.finishEffect();
       if (this.player.released?.[from]) {this.player.released[key(destination)]=this.player.released[from];delete this.player.released[from];}
      this.triggerBonus(destination);
      this.logs.unshift(`${this.current ? '电脑' : '你'}移动了保护区中的一张版块`);
    } else throw Error('未知动物效果');
  }
  place(id, card, coordinate) {
    if (!this.canPlay(id, card)) throw Error('版块类型、等级或回合阶段不符合当前行动');
    const release=this.tiles[id].placement_requirement?.match(/^release 1 Animal with the (\w+) icon$/);
    if (release) {
      const at=key(coordinate), oldId=this.player.placed[at];
      if (!oldId || this.tiles[oldId].kind!=='animal' || !this.tiles[oldId].icons?.[release[1]]) throw Error('请选择具有相应图标的动物进行放归');
      this.player.hand.splice(this.player.hand.indexOf(id),1);
      this.player.released ||= {};this.player.released[at]=oldId;
      this.player.placed[at]=id;this.player.conservation+=this.tiles[oldId].level>=4?3:2;
      this.logs.unshift(`${this.current ? '电脑' : '你'}使用项目行动，放归了 ${tileName(this.tiles[oldId])}`);
      this.consume(card);this.queueTileEffects(this.tiles[id]);return;
    }
    const error = this.placementError(id, coordinate);
    if (error) throw Error(error);
    if (!this.spaces(id).some(c => key(c) === key(coordinate))) throw Error('请选择满足条件且与入口或现有版块相邻的空格');
    const openNeeds=this.openNeeds(id,coordinate);
    const pair=this.tiles[id].kind==='animal' && this.tiles[id].pair_key && Object.entries(this.player.placed).some(([at,oldId])=>adjacent(at.split(',').map(Number),coordinate) && this.tiles[oldId].kind==='animal' && this.tiles[oldId].pair_key===this.tiles[id].pair_key && oldId!==id);
    this.player.hand.splice(this.player.hand.indexOf(id), 1); this.player.placed[key(coordinate)] = id;
    if (pair) {this.player.conservation++;this.logs.unshift('相邻动物配对：获得 1 个保护标记');}
    const actionDescription=this.tiles[id].kind==='building'?'建筑阶段':`${label(card)}行动`;
    this.logs.unshift(`${this.current ? '电脑' : '你'}使用${actionDescription}，放置了 ${tileName(this.tiles[id])}`);
    if (this.tiles[id].kind === 'building') this.usedBuilding = true;
    else if (this.phase==='second-animal') this.endAnimalAction();
    else if (this.tiles[id].kind==='animal' && this.player.upgraded.includes(card)) {this.followup={type:'animal',card,remaining:this.strength(card)-this.effectiveLevel(this.tiles[id])};this.phase='second-animal';}
    else this.consume(card);
    if (id === '135') {
      this.pendingEffect={type:'statue-discard',remaining:4,coordinate:[...coordinate],origin:'雕像的打出条件'};
      this.phase='effect'; return;
    }
    this.triggerBonus(coordinate, true);
    if (openNeeds.length) {this.pendingEffect={type:'open-cost',targets:openNeeds};this.pendingAfterOpen=id;this.phase='effect';}
    else this.queueTileEffects(this.tiles[id]);
  }
  resolveBonus(choice) {
    if (this.phase !== 'bonus') throw Error('当前没有待结算的地图奖励');
    if (choice !== null && ['market','building','animal'].includes(this.pendingBonus)) {
      if (!Number.isInteger(choice) || !this.market[choice]
          || this.pendingBonus==='building' && this.tiles[this.market[choice]].kind!=='building'
          || this.pendingBonus==='animal' && this.tiles[this.market[choice]].kind!=='animal') throw Error('请选择展示区符合条件的版块');
      this.player.hand.push(this.market[choice]); this.market[choice] = null;
    } else if (choice !== null && this.pendingBonus === 'shift') {
      if (!cards.includes(choice)) throw Error('请选择行动牌');
      this.consume(choice);
    }
    this.logs.unshift(`${this.current ? '电脑' : '你'}${choice === null ? '放弃' : '领取'}地图奖励`);
    this.pendingBonus = this.queuedBonuses.shift() || null;
    this.pendingBonusSource = this.pendingBonus ? (this.queuedBonusSources?.shift() || '地图放置奖励') : null;
    if (this.pendingBonus) this.phase='bonus'; else this.nextEffect();
  }
  discardTile(id) {
    if (this.phase==='effect' && this.pendingEffect?.type==='statue-discard') return this.resolveEffect(id);
    if (this.phase !== 'building' || this.player.hand.length <= 6 || !this.player.hand.includes(id)) throw Error('仅在整理时弃置超出六张的手牌');
    this.player.hand.splice(this.player.hand.indexOf(id), 1); this.discard.push(id);
    this.logs.unshift(`${this.current ? '电脑' : '你'}弃置了 ${tileName(this.tiles[id])}`);
  }
  finish() {
    if (this.phase !== 'building') throw Error('请先完成本回合的拿牌和行动');
    if (this.player.hand.length > 6) throw Error('请点击多余手牌，弃至六张');
    this.player.turns=(this.player.turns||0)+1;
    this.market = this.market.filter(Boolean);
    this.market.push(...this.deck.splice(0, 6 - this.market.length));
    const full=Object.keys(this.player.placed).length + Object.keys(this.player.openAreas).length >= this.map.cells.length-this.map.openAreas.length;
    const supported=Object.keys(this.player.achievements).length>=4;
    if (this.endTriggeredBy === null && (full || supported)) {
       this.endTriggeredBy=this.current; this.player.endBonus=10;
       this.logs.unshift(`${this.current ? '电脑' : '你'}触发终局，获得 10 分终局标记；对手再行动一回合`);
       if (!this.deck.length && this.discard.length) {
         this.deck.push(...this.discard.splice(0));
         for (let i=this.deck.length-1;i>0;i--) {const j=Math.floor(this.random()*(i+1));[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}
       }
    } else if (this.endTriggeredBy !== null && this.current !== this.endTriggeredBy) {
      if (full || supported) this.player.endBonus=5;
      this.endGame(); return;
    } else if (!this.deck.length && this.endTriggeredBy === null) {this.endGame();return;}
    this.current = 1 - this.current; if (!this.current) this.turn++;
    this.phase = 'draft'; this.usedBuilding = false; this.player.supportedThisTurn=false;
  }
  endGame() {
    this.scores=this.players.map((p,index)=>scorePlayer(p,this.tiles,this.mapFor(index)));
    const [human,ai]=this.scores;
    const outcome=human.total===ai.total ? human.animals===ai.animals ? '平局' : human.animals>ai.animals ? '你获胜' : '电脑获胜' : human.total>ai.total ? '你获胜' : '电脑获胜';
    this.phase='ended'; this.logs.unshift(`终局：你 ${human.total} 分，电脑 ${ai.total} 分。${outcome}。`);
  }
  aiTurn(onDecision = null) {
    if (this.current !== 1 || this.phase !== 'draft') return;
    runPolicyTurn(this,undefined,onDecision);
  }
}
