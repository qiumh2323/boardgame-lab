export function availableSupportMarkers(game, player, objective) {
  if (player.supportedThisTurn || player.achievements[objective.objective_id]) return [];
  const counts=game.iconCounts(player), have=counts[objective.icon]||0;
  if (!have) return [];
  const used=new Set(Object.values(player.achievements));
  return [2,3,4,5].filter(marker=>!used.has(marker) && have+player.conservation>=marker);
}

export function endTurnOpportunities(game) {
  if (game.current!==0 || game.phase!=='building') return {objectives:[],upgrades:[]};
  const player=game.players[0];
  return {
    objectives:game.objectives.filter(objective=>availableSupportMarkers(game,player,objective).length),
    upgrades:player.cards.some(card=>!player.upgraded.includes(card)) ? game.availableUpgrades(player) : []
  };
}
