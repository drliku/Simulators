import type { ViewState } from '../state/store';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 40;

export function worldToScreen(v: ViewState, w: number, h: number, x: number, y: number): [number, number] {
  return [w / 2 + (x - v.cx) * v.zoom, h / 2 - (y - v.cy) * v.zoom];
}

export function screenToWorld(v: ViewState, w: number, h: number, sx: number, sy: number): [number, number] {
  return [v.cx + (sx - w / 2) / v.zoom, v.cy - (sy - h / 2) / v.zoom];
}

/** Minor grid step (mm) from a 1-2-5 sequence giving at least ~16 px spacing. */
export function gridStep(zoom: number): number {
  const raw = 16 / zoom;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/** Zoom about a screen point, keeping the world point under it fixed. */
export function zoomAt(v: ViewState, w: number, h: number, sx: number, sy: number, factor: number): ViewState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
  const [wx, wy] = screenToWorld(v, w, h, sx, sy);
  return { zoom, cx: wx - (sx - w / 2) / zoom, cy: wy + (sy - h / 2) / zoom };
}
