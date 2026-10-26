export function collectComputerPickups(before, after) {
  const held = new Set(before.players[1].hand);
  return after.players[1].hand.filter(id => !held.has(id)).map(id => {
    const index = before.market.indexOf(id);
    return {id, source:index >= 0 ? 'market' : 'deck', index};
  });
}
