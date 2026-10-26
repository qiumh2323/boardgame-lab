// A decision boundary for the playable PVE rules engine. No hidden deck order
// or opponent hand contents are used by the policy.
import {achievementPoints} from './scoring.mjs';

export const FEATURE_NAMES = Object.freeze([
  'tile_value', 'goal_icons', 'action_strength', 'map_bonus', 'open_cost',
  'adjacent_tiles', 'hand_pressure', 'objective_points', 'upgrade_value',
  'draw_value', 'turn_progress', 'marker_value', 'play_bias', 'draw_bias',
  'project_draft_bias', 'support_bias', 'upgrade_bias', 'discard_bias',
  'finish_bias', 'bonus_bias', 'effect_bias', 'open_cost_bias',
]);

export const BASELINE_WEIGHTS = Object.freeze({
  tile_value:1, goal_icons:2.5, action_strength:0.1, map_bonus:2,
  open_cost:-2, adjacent_tiles:0.15, hand_pressure:-1.5,
  objective_points:1, upgrade_value:1, draw_value:1,
  turn_progress:0.2, marker_value:1, play_bias:10, draw_bias:1,
  project_draft_bias:1, support_bias:10, upgrade_bias:8,
  discard_bias:-12, finish_bias:-20, bonus_bias:10,
  effect_bias:10, open_cost_bias:20,
});

const key = at => at.join(',');
const adjacent = (a,b) => Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[0]+a[1]-b[0]-b[1])) === 1;
const cards = ['projects','forest','water','rock'];

export function tilePotential(game, id) {
  const tile=game.tiles[id];
  if (!tile) return 0;
  const scoring=tile.scoring || {};
  const printed=scoring.type==='fixed' ? scoring.points : scoring.type==='per-attribute' ? scoring.multiplier*2 : scoring.type==='per-hand-tile' ? scoring.multiplier*3 : 3;
  return printed+(tile.kind==='project'&&tile.ongoing_effect?4:0)+(tile.immediate_effect?2:0)-Math.max(0,tile.level-3);
}

export function legalDecisions(game) {
  const player=game.player, phase=game.phase, decisions=[];
  if (phase==='draft') {
    game.market.forEach((id,index)=>{if(id&&index<game.reachable()) decisions.push({type:'draft',index,id});});
  } else if (phase==='action' || phase==='second-animal' || phase==='building') {
    const actionCards=phase==='action'?player.cards:phase==='second-animal'?[game.followup.card]:[null];
    for (const card of actionCards) for (const id of player.hand) if(game.canPlay(id,card)) {
      for (const at of game.spaces(id)) decisions.push({type:'place',card,id,at});
    }
    if (phase==='action') {
      for (const card of player.cards) if(card!=='projects') decisions.push({type:'draw',card});
      game.market.forEach((id,index)=>{if(id) decisions.push({type:'project-draft',index,id});});
    } else if (phase==='second-animal') decisions.push({type:'complete-animal'});
    else {
      if (!player.supportedThisTurn) {
        const counts=game.iconCounts();
        for (const objective of game.objectives) if(!player.achievements[objective.objective_id]) {
          const have=counts[objective.icon]||0;
          for (const marker of [2,3,4,5]) if(have && have+player.conservation>=marker && !Object.values(player.achievements).includes(marker))
            decisions.push({type:'support',objectiveId:objective.objective_id,marker,spend:Math.max(0,marker-have)});
        }
      }
      for (const condition of game.availableUpgrades()) for (const card of cards) if(!player.upgraded.includes(card)) decisions.push({type:'upgrade',card,condition});
      if(player.hand.length>6) for (const id of player.hand) decisions.push({type:'discard',id});
      else decisions.push({type:'finish'});
    }
  } else if (phase==='second-project') {
    game.market.forEach((id,index)=>{if(id) decisions.push({type:'second-project',index,id});});
    decisions.push({type:'complete-project'});
  } else if (phase==='bonus') {
    if(game.pendingBonus==='shift') for(const card of player.cards) decisions.push({type:'bonus',choice:card});
    else game.market.forEach((id,index)=>{if(id
      && (game.pendingBonus!=='building'||game.tiles[id].kind==='building')
      && (game.pendingBonus!=='animal'||game.tiles[id].kind==='animal')) decisions.push({type:'bonus',choice:index,id});});
    decisions.push({type:'bonus',choice:null});
  } else if (phase==='effect') {
    const effect=game.pendingEffect;
    if(effect.type==='statue-discard') for(const id of player.hand) decisions.push({type:'discard',id});
    else if(effect.type==='open-cost' || effect.type==='pouch') for(const id of player.hand) decisions.push({type:'effect',choice:id,id,effectType:effect.type});
    else if(effect.type==='market') game.market.forEach((id,index)=>{if(game.marketEffectEligible(id,effect.kind)) decisions.push({type:'effect',choice:index,id,effectType:'market'});});
    else if(effect.type==='choose-animal') {
      for(const id of effect.revealed) if(game.tiles[id].kind==='animal')
        decisions.push({type:'effect',choice:id,id,effectType:'choose-animal'});
    }
    else if(effect.type==='shift') for(const card of player.cards) decisions.push({type:'effect',choice:card,effectType:'shift'});
    else if(effect.type==='open-area') for(const at of game.spaces()) decisions.push({type:'effect',choice:at,at,effectType:'open-area'});
    else if(effect.type==='relocate') {
      if(effect.source) for(const at of game.relocationSpaces(effect.source))
        decisions.push({type:'effect',choice:at,at,effectType:'relocate',source:effect.source});
      else for(const source of [...Object.keys(player.placed),...Object.keys(player.openAreas)])
        if(game.relocationSpaces(source).length) decisions.push({type:'effect',choice:source,effectType:'relocate',source});
    }
    if(!['open-cost','statue-discard'].includes(effect.type)) decisions.push({type:'effect',choice:null,effectType:effect.type});
  }
  return decisions;
}

export function decisionFeatures(game, decision) {
  const f=Object.fromEntries(FEATURE_NAMES.map(name=>[name,0]));
  const player=game.player, id=decision.id;
  if(id) {
    f.tile_value=tilePotential(game,id);
    f.goal_icons=game.objectives.filter(o=>!player.achievements[o.objective_id]).reduce((n,o)=>n+(game.tiles[id].icons?.[o.icon]||0),0);
  }
  if(decision.card) f.action_strength=game.strength(decision.card);
  if(decision.at) {
    f.map_bonus=game.map.bonuses[key(decision.at)]?1:0;
    if(decision.type==='place') f.open_cost=game.openNeeds(id,decision.at)?.length||0;
    f.adjacent_tiles=Object.keys(player.placed).filter(at=>adjacent(at.split(',').map(Number),decision.at)).length;
  }
  if(decision.type==='draw') f.draw_value=Math.min(2,game.deck.length)*2+(player.hand.length?0:2);
  if(decision.type==='support') {
    f.objective_points=achievementPoints[decision.marker]-2*decision.spend;
    f.marker_value=-decision.spend;
  }
  if(decision.type==='upgrade') f.upgrade_value=decision.card==='projects'?7:decision.card==='water'||decision.card==='forest'?6:5;
  if(decision.type==='discard' || decision.effectType==='pouch' || decision.effectType==='open-cost') {
    f.tile_value=-f.tile_value;
    f.goal_icons=-f.goal_icons;
  }
  if(decision.effectType==='pouch') f.marker_value=2;
  if(decision.type==='finish' || decision.type==='complete-animal' || decision.type==='complete-project') f.turn_progress=1;
  if(decision.type==='place' && game.phase==='building') f.turn_progress=2;
  if(decision.type==='place' && game.phase==='second-animal') f.turn_progress=2;
  if(decision.type==='place') f.play_bias=game.phase==='action'?1:game.phase==='building'?.7:.8;
  if(decision.type==='draw') f.draw_bias=player.hand.length?0:4;
  if(decision.type==='project-draft') f.project_draft_bias=player.hand.length<5?3:-5;
  if(decision.type==='support') f.support_bias=1;
  if(decision.type==='upgrade') f.upgrade_bias=1;
  if(decision.type==='discard') f.discard_bias=1;
  if(['finish','complete-animal','complete-project'].includes(decision.type)) f.finish_bias=1;
  if(decision.type==='bonus' && decision.choice!==null) f.bonus_bias=1;
  if(decision.type==='effect' && decision.choice!==null) f.effect_bias=decision.effectType==='pouch'?-.8:1;
  if(decision.effectType==='open-cost') f.open_cost_bias=1;
  if(decision.type==='draft' || decision.type==='project-draft' || decision.type==='second-project' || decision.type==='bonus' || decision.effectType==='market')
    f.hand_pressure=Math.max(0,player.hand.length-4);
  return f;
}

export function scoreDecision(game, decision, weights=BASELINE_WEIGHTS) {
  const features=decisionFeatures(game,decision);
  return FEATURE_NAMES.reduce((sum,name)=>sum+features[name]*(weights[name]||0),0);
}

export function rankDecisions(game, weights=BASELINE_WEIGHTS) {
  return legalDecisions(game).map(decision=>({decision,features:decisionFeatures(game,decision),score:scoreDecision(game,decision,weights)}))
    .sort((a,b)=>b.score-a.score||JSON.stringify(a.decision).localeCompare(JSON.stringify(b.decision)));
}

export function chooseDecision(game, weights=BASELINE_WEIGHTS) {
  return rankDecisions(game,weights)?.[0] || null;
}

export function applyDecision(game, decision) {
  switch(decision.type) {
    case 'draft': return game.draft(decision.index);
    case 'project-draft': return game.draft(decision.index,true);
    case 'place': return game.place(decision.id,decision.card,decision.at);
    case 'draw': return game.draw(decision.card);
    case 'support': return game.support(decision.objectiveId,decision.marker);
    case 'upgrade': return game.upgrade(decision.card,decision.condition);
    case 'discard': return game.discardTile(decision.id);
    case 'finish': return game.finish();
    case 'complete-animal': return game.endAnimalAction();
    case 'second-project': return game.secondProject(decision.index);
    case 'complete-project': return game.secondProject();
    case 'bonus': return game.resolveBonus(decision.choice);
    case 'effect': return game.resolveEffect(decision.choice);
    default: throw Error(`未知 AI 决策：${decision.type}`);
  }
}

export function runPolicyTurn(game, weights=BASELINE_WEIGHTS, onDecision=null) {
  const player=game.current;
  if(game.phase!=='draft' || game.phase==='ended') throw Error('策略回合必须从拿牌阶段开始');
  for(let step=0;step<100 && game.current===player && game.phase!=='ended';step++) {
    const ranked=rankDecisions(game,weights), choice=ranked[0];
    if(!choice) {
      if(game.phase==='draft' && !game.market.some(Boolean)) {game.endGame();return;}
      throw Error(`玩家 ${player} 在 ${game.phase} 阶段没有合法决策`);
    }
    onDecision?.({turn:game.turn,player,phase:game.phase,decision:choice.decision,features:choice.features,score:choice.score,candidates:ranked});
    applyDecision(game,choice.decision);
  }
  if(game.current===player && game.phase!=='ended') throw Error('策略回合超过 100 个决策步骤');
}
