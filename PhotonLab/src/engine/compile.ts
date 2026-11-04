/**
 * Converts scene objects into world-space optical surfaces (for the tracer)
 * and sampled outlines (for rendering and hit-testing). Results are cached
 * per object reference — scene objects are immutable.
 */
import type {
  BodyObject,
  Material,
  MirrorObject,
  SceneObject,
  SourceObject,
} from '../scene/types';
import {
  type AABB,
  type Piece,
  boundsOf,
  finalizeLoop,
  mirrorPieceY,
  pieceNormalAt,
  samplePiece,
  transformPiece,
} from './geometry';
import { deg2rad, toWorld } from './vec';

export type OpticType = 'mirror' | 'body' | 'thinlens' | 'detector';

export interface Optic {
  id: string;
  type: OpticType;
  pieces: Piece[];
  aabb: AABB;
  // mirror
  reflectivity: number;
  roughness: number;
  twoSided: boolean;
  partial: boolean;
  // body
  material: Material | null;
  // thin lens: centre, optical axis, focal length
  cx: number;
  cy: number;
  axx: number;
  axy: number;
  f: number;
}

export interface Outline {
  pts: number[];
  closed: boolean;
}

export interface Compiled {
  obj: SceneObject;
  optic: Optic | null;
  outlines: Outline[];
  /** Front-normal samples for mirrors: [x, y, nx, ny, ...]. */
  frontNormals: number[];
  /** Focal points to display (world). */
  foci: [number, number][];
  bounds: AABB;
  /** Max distance of the outline from the object origin. */
  extent: number;
  /** Notes about clamped/invalid parameters. */
  warnings: string[];
}

const cache = new WeakMap<SceneObject, Compiled>();

export function compileObject(obj: SceneObject): Compiled {
  let c = cache.get(obj);
  if (!c) {
    c = build(obj);
    cache.set(obj, c);
  }
  return c;
}

function blankOptic(id: string, type: OpticType): Optic {
  return {
    id,
    type,
    pieces: [],
    aabb: [0, 0, 0, 0],
    reflectivity: 1,
    roughness: 0,
    twoSided: false,
    partial: false,
    material: null,
    cx: 0,
    cy: 0,
    axx: 1,
    axy: 0,
    f: 0,
  };
}

function finish(
  obj: SceneObject,
  optic: Optic | null,
  local: Piece[],
  closed: boolean,
  extra: Partial<Compiled> = {},
  localFoci: [number, number][] = [],
): Compiled {
  const a = deg2rad(obj.rotation);
  const pieces = local.map((p) => transformPiece(p, obj.x, obj.y, a));
  const pts: number[] = [];
  pieces.forEach((p, i) => samplePiece(p, pts, closed && i > 0));
  if (closed) pts.length -= 2;
  const bounds = boundsOf(pts, 0.5);
  if (optic) {
    optic.pieces = pieces;
    optic.aabb = bounds;
  }
  let extent = 0;
  for (let i = 0; i < pts.length; i += 2) extent = Math.max(extent, Math.hypot(pts[i] - obj.x, pts[i + 1] - obj.y));
  const foci = localFoci.map(([lx, ly]) => toWorld(obj.x, obj.y, a, lx, ly));
  return {
    obj,
    optic,
    outlines: pts.length ? [{ pts, closed }] : [],
    frontNormals: [],
    foci,
    bounds,
    extent,
    warnings: [],
    ...extra,
  };
}

// ───────────────────────── Mirrors ─────────────────────────

/** Local mirror geometry. Reflective front faces local +x, aperture along local y. */
export function mirrorPieces(m: MirrorObject): { pieces: Piece[]; foci: [number, number][]; warnings: string[] } {
  const L = Math.max(1, m.length);
  const warnings: string[] = [];
  switch (m.shape) {
    case 'flat':
      return { pieces: [{ t: 'seg', ax: 0, ay: -L / 2, bx: 0, by: L / 2, ns: 1 }], foci: [], warnings };
    case 'concave':
    case 'convex': {
      let R = Math.max(1, m.radius);
      if (R < L / 2) {
        R = L / 2 + 1e-6;
        warnings.push('Radius is smaller than half the aperture; clamped.');
      }
      const phi = Math.asin(Math.min(1, L / 2 / R));
      if (m.shape === 'concave')
        return { pieces: [{ t: 'arc', cx: R, cy: 0, r: R, a0: Math.PI - phi, sweep: 2 * phi, ns: -1 }], foci: [[R / 2, 0]], warnings };
      return { pieces: [{ t: 'arc', cx: -R, cy: 0, r: R, a0: -phi, sweep: 2 * phi, ns: 1 }], foci: [[-R / 2, 0]], warnings };
    }
    case 'parabolic': {
      const f = Math.max(1, m.focalLength);
      return { pieces: [{ t: 'para', ox: 0, oy: 0, ux: 1, uy: 0, f, h: L / 2, ns: 1, rev: false }], foci: [[f, 0]], warnings };
    }
    case 'arc': {
      const R = Math.max(1, m.radius);
      const span = deg2rad(Math.min(360, Math.max(1, m.arcAngle)));
      return { pieces: [{ t: 'arc', cx: 0, cy: 0, r: R, a0: Math.PI - span / 2, sweep: span, ns: -1 }], foci: [[0, 0]], warnings };
    }
  }
}

function buildMirror(m: MirrorObject): Compiled {
  const optic = blankOptic(m.id, 'mirror');
  optic.reflectivity = m.reflectivity;
  optic.roughness = m.roughness;
  optic.twoSided = m.twoSided || m.partial;
  optic.partial = m.partial;
  const { pieces, foci, warnings } = mirrorPieces(m);
  const c = finish(m, optic, pieces, false, {}, m.shape === 'arc' ? [] : foci);
  c.warnings = warnings;
  const fn: number[] = [];
  for (const p of optic.pieces) {
    const n = 24;
    for (let i = 0; i <= n; i++) fn.push(...pieceNormalAt(p, i / n));
  }
  c.frontNormals = fn;
  return c;
}

// ───────────────────────── Bodies ─────────────────────────

export interface LensGeometry {
  pieces: Piece[];
  thickness: number;
  diameter: number;
  warnings: string[];
}

export function lensPieces(b: Pick<BodyObject, 'diameter' | 'thickness' | 'r1' | 'r2'>): LensGeometry {
  const warnings: string[] = [];
  let D = Math.max(1, b.diameter);
  const maxD = Math.min(b.r1 !== 0 ? 2 * Math.abs(b.r1) : Infinity, b.r2 !== 0 ? 2 * Math.abs(b.r2) : Infinity);
  if (D > maxD * 0.999) {
    D = maxD * 0.999;
    warnings.push('Diameter limited by surface radius.');
  }
  const h = D / 2;
  const sag = (r: number) => (r === 0 ? 0 : Math.abs(r) - Math.sqrt(r * r - h * h));
  const s1 = sag(b.r1);
  const s2 = sag(b.r2);
  // Edge position offsets: convex surfaces pull the edge inward, concave push it outward.
  const e1 = b.r1 > 0 ? s1 : b.r1 < 0 ? -s1 : 0;
  const e2 = b.r2 > 0 ? s2 : b.r2 < 0 ? -s2 : 0;
  let tc = Math.max(0.5, b.thickness);
  if (tc < e1 + e2) {
    tc = e1 + e2;
    warnings.push('Centre thickness increased to keep a valid edge.');
  }
  const xL = -tc / 2 + e1;
  const xR = tc / 2 - e2;
  const pieces: Piece[] = [];
  // Left surface, top → bottom
  if (b.r1 === 0) pieces.push({ t: 'seg', ax: xL, ay: h, bx: xL, by: -h, ns: 1 });
  else {
    const R = Math.abs(b.r1);
    const phi = Math.asin(Math.min(1, h / R));
    if (b.r1 > 0) pieces.push({ t: 'arc', cx: -tc / 2 + R, cy: 0, r: R, a0: Math.PI - phi, sweep: 2 * phi, ns: 1 });
    else pieces.push({ t: 'arc', cx: -tc / 2 - R, cy: 0, r: R, a0: phi, sweep: -2 * phi, ns: 1 });
  }
  if (xR - xL > 1e-9) pieces.push({ t: 'seg', ax: xL, ay: -h, bx: xR, by: -h, ns: 1 });
  // Right surface, bottom → top
  if (b.r2 === 0) pieces.push({ t: 'seg', ax: xR, ay: -h, bx: xR, by: h, ns: 1 });
  else {
    const R = Math.abs(b.r2);
    const phi = Math.asin(Math.min(1, h / R));
    if (b.r2 > 0) pieces.push({ t: 'arc', cx: tc / 2 - R, cy: 0, r: R, a0: -phi, sweep: 2 * phi, ns: 1 });
    else pieces.push({ t: 'arc', cx: tc / 2 + R, cy: 0, r: R, a0: Math.PI + phi, sweep: -2 * phi, ns: 1 });
  }
  if (xR - xL > 1e-9) pieces.push({ t: 'seg', ax: xR, ay: h, bx: xL, by: h, ns: 1 });
  finalizeLoop(pieces);
  return { pieces, thickness: tc, diameter: D, warnings };
}

/** Fiber: entrance face centred at the local origin, initially heading +x, with an optional bend. */
export function fiberPieces(b: Pick<BodyObject, 'length' | 'fiberWidth' | 'bendRadius' | 'bendAngle'>): Piece[] {
  const w = Math.max(1, b.fiberWidth);
  const a = Math.max(1, b.length) / 2;
  const beta = deg2rad(Math.min(300, Math.abs(b.bendAngle)));
  const Rb = Math.max(w / 2 + 1, b.bendRadius);
  const pieces: Piece[] = [];
  const hw = w / 2;
  if (beta < 1e-6) {
    const L = 2 * a;
    pieces.push(
      { t: 'seg', ax: 0, ay: -hw, bx: L, by: -hw, ns: 1 },
      { t: 'seg', ax: L, ay: -hw, bx: L, by: hw, ns: 1 },
      { t: 'seg', ax: L, ay: hw, bx: 0, by: hw, ns: 1 },
      { t: 'seg', ax: 0, ay: hw, bx: 0, by: -hw, ns: 1 },
    );
  } else {
    const cx = a;
    const cy = Rb;
    const ro = Rb + hw;
    const ri = Rb - hw;
    const sb = Math.sin(beta);
    const cb = Math.cos(beta);
    const R2x = cx + ro * sb;
    const R2y = cy - ro * cb;
    const R3x = R2x + a * cb;
    const R3y = R2y + a * sb;
    const L2x = cx + ri * sb;
    const L2y = cy - ri * cb;
    const L3x = L2x + a * cb;
    const L3y = L2y + a * sb;
    pieces.push(
      { t: 'seg', ax: 0, ay: -hw, bx: a, by: -hw, ns: 1 },
      { t: 'arc', cx, cy, r: ro, a0: -Math.PI / 2, sweep: beta, ns: 1 },
      { t: 'seg', ax: R2x, ay: R2y, bx: R3x, by: R3y, ns: 1 },
      { t: 'seg', ax: R3x, ay: R3y, bx: L3x, by: L3y, ns: 1 },
      { t: 'seg', ax: L3x, ay: L3y, bx: L2x, by: L2y, ns: 1 },
      { t: 'arc', cx, cy, r: ri, a0: -Math.PI / 2 + beta, sweep: -beta, ns: 1 },
      { t: 'seg', ax: a, ay: hw, bx: 0, by: hw, ns: 1 },
      { t: 'seg', ax: 0, ay: hw, bx: 0, by: -hw, ns: 1 },
    );
  }
  const out = b.bendAngle < 0 ? pieces.map(mirrorPieceY) : pieces;
  finalizeLoop(out);
  return out;
}

export function prismVertices(size: number, apexDeg: number): [number, number][] {
  const L = Math.max(1, size);
  const al = deg2rad(Math.min(170, Math.max(5, apexDeg)));
  const b = L * Math.sin(al / 2);
  const H = L * Math.cos(al / 2);
  return [
    [-b, -H / 3],
    [b, -H / 3],
    [0, (2 * H) / 3],
  ];
}

function polygonPieces(v: [number, number][]): Piece[] {
  const pieces: Piece[] = v.map(([ax, ay], i) => {
    const [bx, by] = v[(i + 1) % v.length];
    return { t: 'seg', ax, ay, bx, by, ns: 1 };
  });
  finalizeLoop(pieces);
  return pieces;
}

export function bodyLocalPieces(b: BodyObject): { pieces: Piece[]; warnings: string[] } {
  switch (b.shape) {
    case 'rect': {
      const w = Math.max(0.5, b.width) / 2;
      const h = Math.max(0.5, b.height) / 2;
      return { pieces: polygonPieces([[-w, -h], [w, -h], [w, h], [-w, h]]), warnings: [] };
    }
    case 'circle':
      return { pieces: [{ t: 'arc', cx: 0, cy: 0, r: Math.max(0.5, b.radius), a0: 0, sweep: Math.PI * 2, ns: 1 }], warnings: [] };
    case 'prism':
      return { pieces: polygonPieces(prismVertices(b.size, b.apexAngle)), warnings: [] };
    case 'lens': {
      const g = lensPieces(b);
      return { pieces: g.pieces, warnings: g.warnings };
    }
    case 'fiber':
      return { pieces: fiberPieces(b), warnings: [] };
  }
}

function buildBody(b: BodyObject): Compiled {
  const optic = blankOptic(b.id, 'body');
  optic.material = b.material;
  const { pieces, warnings } = bodyLocalPieces(b);
  const c = finish(b, optic, pieces, true);
  c.warnings = warnings;
  return c;
}

// ───────────────────────── Others ─────────────────────────

export function sourceHousing(s: SourceObject): [number, number][] {
  if (s.emitter === 'beam') {
    const h = Math.max(1, s.width) / 2 + 4;
    return [[-12, -h], [0, -h], [0, h], [-12, h]];
  }
  if (s.emitter === 'point' || s.emitter === 'fan') {
    const r = 8;
    const pts: [number, number][] = [];
    for (let i = 0; i < 20; i++) pts.push([r * Math.cos((i / 20) * Math.PI * 2), r * Math.sin((i / 20) * Math.PI * 2)]);
    return pts;
  }
  return [[-34, -7], [0, -7], [0, 7], [-34, 7]];
}

function build(obj: SceneObject): Compiled {
  switch (obj.kind) {
    case 'mirror':
      return buildMirror(obj);
    case 'body':
      return buildBody(obj);
    case 'thinlens': {
      const optic = blankOptic(obj.id, 'thinlens');
      const a = deg2rad(obj.rotation);
      optic.cx = obj.x;
      optic.cy = obj.y;
      optic.axx = Math.cos(a);
      optic.axy = Math.sin(a);
      optic.f = obj.focalLength;
      const A = Math.max(1, obj.aperture);
      return finish(obj, optic, [{ t: 'seg', ax: 0, ay: -A / 2, bx: 0, by: A / 2, ns: 1 }], false, {}, [
        [obj.focalLength, 0],
        [-obj.focalLength, 0],
      ]);
    }
    case 'detector': {
      const optic = blankOptic(obj.id, 'detector');
      const L = Math.max(1, obj.length);
      return finish(obj, optic, [{ t: 'seg', ax: 0, ay: -L / 2, bx: 0, by: L / 2, ns: 1 }], false);
    }
    case 'source': {
      const v = sourceHousing(obj);
      const pieces: Piece[] = v.map(([ax, ay], i) => {
        const [bx, by] = v[(i + 1) % v.length];
        return { t: 'seg', ax, ay, bx, by, ns: 1 };
      });
      return finish(obj, null, pieces, true);
    }
    case 'ruler': {
      const L = Math.max(1, obj.length);
      return finish(obj, null, [{ t: 'seg', ax: 0, ay: 0, bx: L, by: 0, ns: 1 }], false);
    }
    case 'protractor': {
      const R = Math.max(5, obj.radius);
      const span = deg2rad(obj.angle);
      const pieces: Piece[] = [
        { t: 'seg', ax: R, ay: 0, bx: 0, by: 0, ns: 1 },
        { t: 'seg', ax: 0, ay: 0, bx: R * Math.cos(span), by: R * Math.sin(span), ns: 1 },
      ];
      return finish(obj, null, pieces, false);
    }
  }
}
