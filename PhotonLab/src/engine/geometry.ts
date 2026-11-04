/**
 * Ray / surface intersection primitives.
 *
 * Every optical surface is decomposed into pieces: line segments, circular
 * arcs and parabolic arcs. Each piece has a "natural" normal and a sign `ns`
 * that orients it (outward for closed bodies, toward the reflective front for mirrors).
 *
 *   seg  natural normal: right-hand perpendicular of (b − a)
 *   arc  natural normal: radial, pointing away from the centre
 *   para natural normal: toward the focus side, ∝ (1, −y/2f) in the local frame
 */
import { TWO_PI, wrap2pi } from './vec';

export interface SegPiece {
  t: 'seg';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ns: number;
}

export interface ArcPiece {
  t: 'arc';
  cx: number;
  cy: number;
  r: number;
  /** Start angle (radians). */
  a0: number;
  /** Signed angular extent (radians); negative = traversed clockwise. */
  sweep: number;
  ns: number;
}

/** Parabola x = y²/(4f) in a local frame with origin at the vertex and axis u. */
export interface ParaPiece {
  t: 'para';
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  f: number;
  /** Half aperture: |y| ≤ h. */
  h: number;
  ns: number;
  /** Traversal direction for path building (y from +h to −h). */
  rev: boolean;
}

export type Piece = SegPiece | ArcPiece | ParaPiece;

export type AABB = [number, number, number, number];

export interface Hit {
  t: number;
  nx: number;
  ny: number;
}

const ANG_EPS = 1e-10;

export function angleInArc(a: number, a0: number, sweep: number): boolean {
  if (Math.abs(sweep) >= TWO_PI - ANG_EPS) return true;
  if (sweep >= 0) return wrap2pi(a - a0) <= sweep + ANG_EPS;
  return wrap2pi(a0 - a) <= -sweep + ANG_EPS;
}

/** Numerically stable real roots of A t² + B t + C = 0 (ascending). */
function quadRoots(A: number, B: number, C: number, out: number[]): number {
  if (Math.abs(A) < 1e-14) {
    if (Math.abs(B) < 1e-14) return 0;
    out[0] = -C / B;
    return 1;
  }
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 0;
  const sq = Math.sqrt(disc);
  const q = -0.5 * (B + (B >= 0 ? sq : -sq));
  let t1 = q / A;
  let t2 = q !== 0 ? C / q : t1;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }
  out[0] = t1;
  out[1] = t2;
  return 2;
}

const roots = [0, 0];

/**
 * Nearest intersection of the ray o + t·d (|d| = 1) with a piece for t in (tMin, tMax).
 * Writes the oriented normal into `out` and returns true on hit.
 */
export function intersectPiece(
  p: Piece,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  tMin: number,
  tMax: number,
  out: Hit,
): boolean {
  if (p.t === 'seg') {
    const ex = p.bx - p.ax;
    const ey = p.by - p.ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-14) return false;
    const wx = p.ax - ox;
    const wy = p.ay - oy;
    const t = (wx * ey - wy * ex) / denom;
    if (t <= tMin || t >= tMax) return false;
    const s = (wx * dy - wy * dx) / denom;
    if (s < 0 || s > 1) return false;
    const l = Math.hypot(ex, ey);
    out.t = t;
    out.nx = (ey / l) * p.ns;
    out.ny = (-ex / l) * p.ns;
    return true;
  }
  if (p.t === 'arc') {
    const fx = ox - p.cx;
    const fy = oy - p.cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - p.r * p.r;
    const disc = b * b - c;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    for (let k = 0; k < 2; k++) {
      const t = k === 0 ? -b - sq : -b + sq;
      if (t <= tMin || t >= tMax) continue;
      const px = fx + t * dx;
      const py = fy + t * dy;
      if (!angleInArc(Math.atan2(py, px), p.a0, p.sweep)) continue;
      out.t = t;
      out.nx = (px / p.r) * p.ns;
      out.ny = (py / p.r) * p.ns;
      return true;
    }
    return false;
  }
  // parabola
  const rx = ox - p.ox;
  const ry = oy - p.oy;
  const lox = rx * p.ux + ry * p.uy;
  const loy = -rx * p.uy + ry * p.ux;
  const ldx = dx * p.ux + dy * p.uy;
  const ldy = -dx * p.uy + dy * p.ux;
  const n = quadRoots(ldy * ldy, 2 * loy * ldy - 4 * p.f * ldx, loy * loy - 4 * p.f * lox, roots);
  for (let k = 0; k < n; k++) {
    const t = roots[k];
    if (t <= tMin || t >= tMax) continue;
    const y = loy + t * ldy;
    if (Math.abs(y) > p.h) continue;
    let nlx = 1;
    let nly = -y / (2 * p.f);
    const l = Math.hypot(nlx, nly);
    nlx /= l;
    nly /= l;
    out.t = t;
    out.nx = (nlx * p.ux - nly * p.uy) * p.ns;
    out.ny = (nlx * p.uy + nly * p.ux) * p.ns;
    return true;
  }
  return false;
}

/** Number of crossings of the half-line o + t·d (t > 0) with a piece. */
export function countCrossings(p: Piece, ox: number, oy: number, dx: number, dy: number): number {
  if (p.t === 'seg') {
    const ex = p.bx - p.ax;
    const ey = p.by - p.ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-14) return 0;
    const wx = p.ax - ox;
    const wy = p.ay - oy;
    const t = (wx * ey - wy * ex) / denom;
    const s = (wx * dy - wy * dx) / denom;
    return t > 0 && s >= 0 && s < 1 ? 1 : 0;
  }
  let count = 0;
  if (p.t === 'arc') {
    const fx = ox - p.cx;
    const fy = oy - p.cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - p.r * p.r;
    const disc = b * b - c;
    if (disc <= 0) return 0;
    const sq = Math.sqrt(disc);
    for (const t of [-b - sq, -b + sq]) {
      if (t <= 0) continue;
      if (angleInArc(Math.atan2(fy + t * dy, fx + t * dx), p.a0, p.sweep)) count++;
    }
    return count;
  }
  const rx = ox - p.ox;
  const ry = oy - p.oy;
  const lox = rx * p.ux + ry * p.uy;
  const loy = -rx * p.uy + ry * p.ux;
  const ldx = dx * p.ux + dy * p.uy;
  const ldy = -dx * p.uy + dy * p.ux;
  const n = quadRoots(ldy * ldy, 2 * loy * ldy - 4 * p.f * ldx, loy * loy - 4 * p.f * lox, roots);
  for (let k = 0; k < n; k++) {
    if (roots[k] > 0 && Math.abs(loy + roots[k] * ldy) <= p.h) count++;
  }
  return count;
}

// An irrational-ish direction makes it very unlikely to graze a vertex exactly.
const PIP_DX = Math.cos(0.7123581);
const PIP_DY = Math.sin(0.7123581);

/** Even–odd point-in-region test for a closed loop of pieces. */
export function pointInPieces(pieces: Piece[], aabb: AABB, px: number, py: number): boolean {
  if (px < aabb[0] || px > aabb[2] || py < aabb[1] || py > aabb[3]) return false;
  let c = 0;
  for (const p of pieces) c += countCrossings(p, px, py, PIP_DX, PIP_DY);
  return (c & 1) === 1;
}

/** Slab test: does the ray reach the box before tMax? */
export function rayHitsAABB(b: AABB, ox: number, oy: number, dx: number, dy: number, tMax: number): boolean {
  let t0 = 0;
  let t1 = tMax;
  if (Math.abs(dx) < 1e-15) {
    if (ox < b[0] || ox > b[2]) return false;
  } else {
    const inv = 1 / dx;
    let ta = (b[0] - ox) * inv;
    let tb = (b[2] - ox) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dy) < 1e-15) {
    if (oy < b[1] || oy > b[3]) return false;
  } else {
    const inv = 1 / dy;
    let ta = (b[1] - oy) * inv;
    let tb = (b[3] - oy) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Start/end points of a piece in traversal order. */
export function pieceEndpoints(p: Piece): [number, number, number, number] {
  if (p.t === 'seg') return [p.ax, p.ay, p.bx, p.by];
  if (p.t === 'arc') {
    const a1 = p.a0 + p.sweep;
    return [p.cx + p.r * Math.cos(p.a0), p.cy + p.r * Math.sin(p.a0), p.cx + p.r * Math.cos(a1), p.cy + p.r * Math.sin(a1)];
  }
  const pt = (y: number): [number, number] => {
    const x = (y * y) / (4 * p.f);
    return [p.ox + x * p.ux - y * p.uy, p.oy + x * p.uy + y * p.ux];
  };
  const s = pt(p.rev ? p.h : -p.h);
  const e = pt(p.rev ? -p.h : p.h);
  return [s[0], s[1], e[0], e[1]];
}

/** Append sampled points of a piece (traversal order) to `out`. Skips the first point if `skipFirst`. */
export function samplePiece(p: Piece, out: number[], skipFirst = false): void {
  if (p.t === 'seg') {
    if (!skipFirst) out.push(p.ax, p.ay);
    out.push(p.bx, p.by);
    return;
  }
  if (p.t === 'arc') {
    const n = Math.max(2, Math.ceil(Math.abs(p.sweep) / (Math.PI / 64)));
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const a = p.a0 + (p.sweep * i) / n;
      out.push(p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a));
    }
    return;
  }
  const n = 64;
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    let y = -p.h + (2 * p.h * i) / n;
    if (p.rev) y = -y;
    const x = (y * y) / (4 * p.f);
    out.push(p.ox + x * p.ux - y * p.uy, p.oy + x * p.uy + y * p.ux);
  }
}

/** Oriented normal at a parameter s ∈ [0,1] along the piece (traversal order). */
export function pieceNormalAt(p: Piece, s: number): [number, number, number, number] {
  if (p.t === 'seg') {
    const ex = p.bx - p.ax;
    const ey = p.by - p.ay;
    const l = Math.hypot(ex, ey) || 1;
    return [p.ax + ex * s, p.ay + ey * s, (ey / l) * p.ns, (-ex / l) * p.ns];
  }
  if (p.t === 'arc') {
    const a = p.a0 + p.sweep * s;
    const c = Math.cos(a);
    const si = Math.sin(a);
    return [p.cx + p.r * c, p.cy + p.r * si, c * p.ns, si * p.ns];
  }
  let y = -p.h + 2 * p.h * s;
  if (p.rev) y = -y;
  const x = (y * y) / (4 * p.f);
  let nlx = 1;
  let nly = -y / (2 * p.f);
  const l = Math.hypot(nlx, nly);
  nlx /= l;
  nly /= l;
  return [
    p.ox + x * p.ux - y * p.uy,
    p.oy + x * p.uy + y * p.ux,
    (nlx * p.ux - nly * p.uy) * p.ns,
    (nlx * p.uy + nly * p.ux) * p.ns,
  ];
}

/** Rigid transform (rotation a, then translation) of a piece. */
export function transformPiece(p: Piece, tx: number, ty: number, a: number): Piece {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const X = (x: number, y: number) => tx + x * c - y * s;
  const Y = (x: number, y: number) => ty + x * s + y * c;
  if (p.t === 'seg') return { ...p, ax: X(p.ax, p.ay), ay: Y(p.ax, p.ay), bx: X(p.bx, p.by), by: Y(p.bx, p.by) };
  if (p.t === 'arc') return { ...p, cx: X(p.cx, p.cy), cy: Y(p.cx, p.cy), a0: p.a0 + a };
  return { ...p, ox: X(p.ox, p.oy), oy: Y(p.ox, p.oy), ux: p.ux * c - p.uy * s, uy: p.ux * s + p.uy * c };
}

/** Mirror a (seg/arc) piece across the local x axis. */
export function mirrorPieceY(p: Piece): Piece {
  if (p.t === 'seg') return { ...p, ay: -p.ay, by: -p.by };
  if (p.t === 'arc') return { ...p, cy: -p.cy, a0: -p.a0, sweep: -p.sweep };
  return { ...p, oy: -p.oy, uy: -p.uy };
}

/** Signed area of a flat [x0,y0,x1,y1,...] polygon (positive = counter-clockwise). */
export function signedArea(pts: number[]): number {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return a / 2;
}

/**
 * Given an ordered, connected loop of pieces, set every piece's `ns` so its
 * normal points out of the enclosed region. Returns the sampled outline.
 */
export function finalizeLoop(pieces: Piece[]): number[] {
  const pts: number[] = [];
  pieces.forEach((p, i) => samplePiece(p, pts, i > 0));
  pts.length -= 2; // closing point duplicates the first
  const ccw = signedArea(pts) > 0 ? 1 : -1;
  for (const p of pieces) {
    const base = p.t === 'seg' ? 1 : p.t === 'arc' ? Math.sign(p.sweep) || 1 : p.rev ? -1 : 1;
    p.ns = base * ccw;
  }
  return pts;
}

export function boundsOf(pts: number[], pad = 0): AABB {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i];
    const y = pts[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
