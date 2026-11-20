export const PLAYER_COLORS = {
  yellow: {label:'黄色', tint:'#e8bd55', portrait:'watt'},
  purple: {label:'紫色', tint:'#c284e6', portrait:'brunel'},
  red: {label:'红色', tint:'#eb8678', portrait:'arkwright'},
  gray: {label:'白色', tint:'#b3c7d1', portrait:'bessemer'}
};
export const COLOR_NAMES = Object.keys(PLAYER_COLORS);
export const isPlayerColor = color => typeof color==='string' && Object.hasOwn(PLAYER_COLORS,color);
export const playerColor = player => isPlayerColor(player?.color) ? player.color : COLOR_NAMES[player?.id??player?.seat] || COLOR_NAMES[0];

export function assignColors(count, preferences) {
  const taken = new Set();
  const colors = Array.from({length:count},(_,i)=>{
    const preferred = preferences[i];
    if (!isPlayerColor(preferred) || taken.has(preferred)) return null;
    taken.add(preferred);
    return preferred;
  });
  return colors.map(color=>{
    if (color) return color;
    const available = COLOR_NAMES.find(candidate=>!taken.has(candidate));
    taken.add(available);
    return available;
  });
}
