export type SwipePoint = { x: number; y: number };

export function swipeDirection(start: SwipePoint, end: SwipePoint): "NEXT" | "PREVIOUS" | null {
  const horizontal = end.x - start.x;
  const vertical = end.y - start.y;
  if (Math.abs(horizontal) < 54 || Math.abs(horizontal) <= Math.abs(vertical) * 1.25) return null;
  return horizontal < 0 ? "NEXT" : "PREVIOUS";
}
