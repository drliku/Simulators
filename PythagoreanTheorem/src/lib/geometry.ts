/**
 * Pure geometry for the simulator. All coordinates are in "world units"
 * (one unit = one unit of length) with the y-axis pointing UP.
 */

export interface Vec {
  x: number;
  y: number;
}

/** The full state needed to place a right triangle in the plane. */
export interface TriangleState {
  /** Leg a — the side from the right angle C to vertex B. */
  a: number;
  /** Leg b — the side from the right angle C to vertex A. */
  b: number;
  /** Rotation (radians) of leg b, measured from the +x axis. */
  rot: number;
  /** Position of the right-angle vertex C. */
  origin: Vec;
}

export const MIN_LEG = 1;
export const MAX_LEG = 15;
export const CLASSIC: TriangleState = { a: 3, b: 4, rot: 0, origin: { x: 0, y: 0 } };

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (p: Vec, q: Vec): Vec => v(p.x + q.x, p.y + q.y);
export const sub = (p: Vec, q: Vec): Vec => v(p.x - q.x, p.y - q.y);
export const scale = (p: Vec, k: number): Vec => v(p.x * k, p.y * k);
export const dot = (p: Vec, q: Vec): number => p.x * q.x + p.y * q.y;
export const cross = (p: Vec, q: Vec): number => p.x * q.y - p.y * q.x;
export const len = (p: Vec): number => Math.hypot(p.x, p.y);
export const lerp = (p: Vec, q: Vec, t: number): Vec => v(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
export const mid = (p: Vec, q: Vec): Vec => lerp(p, q, 0.5);
export const norm = (p: Vec): Vec => {
  const l = len(p) || 1;
  return v(p.x / l, p.y / l);
};
export const rotate = (p: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return v(p.x * c - p.y * s, p.x * s + p.y * c);
};
export const rotateAround = (p: Vec, pivot: Vec, angle: number): Vec => add(pivot, rotate(sub(p, pivot), angle));

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Round to two decimals (the precision used for all side lengths). */
export const round2 = (x: number) => Math.round(x * 100) / 100;

/** Round a dragged length and gently snap it to whole numbers. */
export function snapLength(x: number): number {
  const nearest = Math.round(x);
  const snapped = Math.abs(x - nearest) < 0.08 ? nearest : x;
  return round2(clamp(snapped, MIN_LEG, MAX_LEG));
}

export interface Square {
  /** Corners in order: side start, side end, then the two outer corners. */
  pts: [Vec, Vec, Vec, Vec];
  center: Vec;
  /** Outward unit normal of the side the square sits on. */
  normal: Vec;
  side: number;
}

export interface Geometry {
  A: Vec;
  B: Vec;
  C: Vec;
  a: number;
  b: number;
  c: number;
  /** Foot of the altitude from C onto the hypotenuse. */
  H: Vec;
  squareA: Square;
  squareB: Square;
  squareC: Square;
  centroid: Vec;
}

/**
 * Square built outward on the directed edge P → Q of a counter-clockwise
 * triangle. The outward normal of such an edge is (dy, −dx).
 */
function outwardSquare(P: Vec, Q: Vec): Square {
  const d = sub(Q, P);
  const n = v(d.y, -d.x);
  const pts: [Vec, Vec, Vec, Vec] = [P, Q, add(Q, n), add(P, n)];
  return { pts, center: add(mid(P, Q), scale(n, 0.5)), normal: norm(n), side: len(d) };
}

export function buildGeometry(s: TriangleState): Geometry {
  const u = v(Math.cos(s.rot), Math.sin(s.rot)); // direction of leg b
  const w = v(-u.y, u.x); // direction of leg a (u rotated +90°)
  const C = s.origin;
  const A = add(C, scale(u, s.b));
  const B = add(C, scale(w, s.a));
  const c = Math.hypot(s.a, s.b);

  // C → A → B is counter-clockwise by construction.
  const squareB = outwardSquare(C, A);
  const squareC = outwardSquare(A, B);
  const squareA = outwardSquare(B, C);

  // Altitude foot: H = A + ((C − A)·AB̂) AB̂
  const ab = norm(sub(B, A));
  const H = add(A, scale(ab, dot(sub(C, A), ab)));

  return {
    A,
    B,
    C,
    a: s.a,
    b: s.b,
    c,
    H,
    squareA,
    squareB,
    squareC,
    centroid: scale(add(add(A, B), C), 1 / 3),
  };
}

export type Quad = [Vec, Vec, Vec, Vec];

/**
 * Keyframes for Euclid's proof (Elements I.47) applied to one leg square.
 *
 *  K0  the square on the leg, anchored at hypotenuse vertex P
 *  K1  shear: slide the far side along line C–Other (area unchanged)
 *  K2  rotate 90° about P (area unchanged)
 *  K3  shear again so the shape becomes the rectangle P–H inside c²
 */
export interface EuclidKeys {
  k0: Quad;
  k1: Quad;
  k3: Quad;
  pivot: Vec;
  angle: number;
}

function euclidKeys(P: Vec, Other: Vec, C: Vec, H: Vec, legSquare: Square, hypSquare: Square): EuclidKeys {
  const nLeg = scale(legSquare.normal, legSquare.side);
  const nHyp = scale(hypSquare.normal, hypSquare.side);

  const k0: Quad = [P, add(P, nLeg), add(C, nLeg), C];
  const k1: Quad = [P, add(P, nLeg), add(Other, nLeg), Other];

  // Pick the quarter turn that carries P→Other onto the hypotenuse-square side.
  const po = sub(Other, P);
  const ccw = rotate(po, Math.PI / 2);
  const angle = dot(ccw, nHyp) > 0 ? Math.PI / 2 : -Math.PI / 2;

  const k3: Quad = [P, H, add(H, nHyp), add(P, nHyp)];
  return { k0, k1, k3, pivot: P, angle };
}

export function euclidFrames(g: Geometry) {
  return {
    a: euclidKeys(g.B, g.A, g.C, g.H, g.squareA, g.squareC),
    b: euclidKeys(g.A, g.B, g.C, g.H, g.squareB, g.squareC),
  };
}

/** Interpolate one Euclid morph. `stage` ∈ {0..3}, `t` ∈ [0,1] within it. */
export function euclidQuad(k: EuclidKeys, stage: number, t: number): Quad {
  const lerpQuad = (p: Quad, q: Quad, s: number) => p.map((pt, i) => lerp(pt, q[i], s)) as Quad;
  const rot = (q: Quad, ang: number) => q.map((pt) => rotateAround(pt, k.pivot, ang)) as Quad;
  if (stage <= 0) return k.k0;
  if (stage === 1) return lerpQuad(k.k0, k.k1, t);
  if (stage === 2) return rot(k.k1, k.angle * t);
  const k2 = rot(k.k1, k.angle);
  if (stage === 3) return lerpQuad(k2, k.k3, t);
  return k.k3;
}

/** Signed area of a polygon (positive for counter-clockwise). */
export function polygonArea(pts: Vec[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += cross(pts[i], pts[(i + 1) % pts.length]);
  return s / 2;
}

/**
 * Drag the right-angle vertex C while A and B stay put. By Thales' theorem C
 * must stay on the circle with diameter AB, so the angle at C stays 90°.
 * Returns null when the move would make a leg too short or too long.
 */
export function dragRightAngle(A: Vec, B: Vec, start: TriangleState, pointer: Vec): TriangleState | null {
  const M = mid(A, B);
  const r = len(sub(B, A)) / 2;
  let d = sub(pointer, M);
  if (len(d) < 1e-6) return null;

  // Keep C on the same side of AB as it started (preserves orientation).
  const startC = start.origin;
  const side = Math.sign(cross(sub(B, A), sub(startC, A)));
  const ab = norm(sub(B, A));
  if (Math.sign(cross(sub(B, A), d)) !== side) {
    // Reflect across the line AB.
    const along = scale(ab, dot(d, ab));
    d = sub(scale(along, 2), d);
  }
  const C = add(M, scale(norm(d), r));
  const a = len(sub(B, C));
  const b = len(sub(A, C));
  if (a < MIN_LEG || b < MIN_LEG || a > MAX_LEG || b > MAX_LEG) return null;
  const ra = round2(a);
  const rb = round2(b);
  const rot = Math.atan2(A.y - C.y, A.x - C.x);
  return { a: ra, b: rb, rot, origin: C };
}

/** Axis-aligned bounds of a set of points. */
export function bounds(pts: Vec[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export const toDeg = (r: number) => (r * 180) / Math.PI;
