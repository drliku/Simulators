export const TWO_PI = Math.PI * 2;

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Wrap an angle to [0, 2π). */
export function wrap2pi(a: number): number {
  a %= TWO_PI;
  return a < 0 ? a + TWO_PI : a;
}

/** Wrap degrees to (-180, 180]. */
export function wrapDeg(d: number): number {
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** Rotate (x, y) by angle a (radians). */
export function rot(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Local → world transform for an object at (ox, oy) with rotation a (radians). */
export function toWorld(ox: number, oy: number, a: number, lx: number, ly: number): [number, number] {
  const [rx, ry] = rot(lx, ly, a);
  return [ox + rx, oy + ry];
}

/** World → local transform. */
export function toLocal(ox: number, oy: number, a: number, wx: number, wy: number): [number, number] {
  return rot(wx - ox, wy - oy, -a);
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
  t = clamp(t, 0, 1);
  const dx = ax + t * ex - px;
  const dy = ay + t * ey - py;
  return Math.hypot(dx, dy);
}
