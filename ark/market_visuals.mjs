export function refillKeyframes(computedOpacity) {
  const parsed = Number.parseFloat(computedOpacity);
  const opacity = Number.isFinite(parsed) ? parsed : 1;
  return [
    {transform:'translateY(24px) scale(.94)',opacity:0},
    {transform:'translateY(0) scale(1)',opacity}
  ];
}
