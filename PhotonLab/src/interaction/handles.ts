/**
 * Manipulation handles (rotate / resize / endpoints) and hit testing for scene objects.
 */
import type { Compiled } from '../engine/compile';
import { prismVertices } from '../engine/compile';
import { deg2rad, distToSegment, rad2deg, toLocal, toWorld, wrapDeg } from '../engine/vec';
import type { SceneObject } from '../scene/types';
import type { ObjectPatch } from '../state/store';

export type HandleId = 'rotate' | 'resize' | 'start' | 'end' | 'arm1' | 'arm2';

export interface Handle {
  id: HandleId;
  x: number;
  y: number;
  /** Anchor the handle line is drawn from (rotation handle). */
  ax?: number;
  ay?: number;
}

/** Local position of the primary resize handle, or null if the object has none. */
function resizeLocal(o: SceneObject): [number, number] | null {
  switch (o.kind) {
    case 'source':
      return o.emitter === 'beam' ? [0, o.width / 2 + 4] : null;
    case 'mirror': {
      const h = o.length / 2;
      if (o.shape === 'flat') return [0, h];
      if (o.shape === 'concave' || o.shape === 'convex') {
        const R = Math.max(o.radius, h + 1e-6);
        const sag = R - Math.sqrt(R * R - h * h);
        return [o.shape === 'concave' ? sag : -sag, h];
      }
      if (o.shape === 'parabolic') return [(h * h) / (4 * Math.max(1, o.focalLength)), h];
      return [-o.radius, 0];
    }
    case 'thinlens':
      return [0, o.aperture / 2];
    case 'detector':
      return [0, o.length / 2];
    case 'body':
      switch (o.shape) {
        case 'rect':
          return [o.width / 2, o.height / 2];
        case 'circle':
          return [o.radius, 0];
        case 'prism':
          return prismVertices(o.size, o.apexAngle)[2];
        case 'lens':
          return [0, o.diameter / 2];
        default:
          return null;
      }
    default:
      return null;
  }
}

export function getHandles(c: Compiled, zoom: number): Handle[] {
  const o = c.obj;
  const a = deg2rad(o.rotation);
  const hs: Handle[] = [];
  if (o.kind === 'ruler') {
    hs.push({ id: 'start', x: o.x, y: o.y });
    const [ex, ey] = toWorld(o.x, o.y, a, o.length, 0);
    hs.push({ id: 'end', x: ex, y: ey });
    return hs;
  }
  if (o.kind === 'protractor') {
    const [x1, y1] = toWorld(o.x, o.y, a, o.radius, 0);
    const [x2, y2] = toWorld(o.x, o.y, a + deg2rad(o.angle), o.radius, 0);
    hs.push({ id: 'arm1', x: x1, y: y1 }, { id: 'arm2', x: x2, y: y2 });
    return hs;
  }
  const r = resizeLocal(o);
  if (r) {
    const [x, y] = toWorld(o.x, o.y, a, r[0], r[1]);
    hs.push({ id: 'resize', x, y });
  }
  const dist = c.extent + 30 / zoom;
  const [rx, ry] = toWorld(o.x, o.y, a, 0, dist);
  hs.push({ id: 'rotate', x: rx, y: ry, ax: o.x, ay: o.y });
  return hs;
}

export interface HandleMods {
  shift: boolean;
  snap: boolean;
  step: number;
}

const snapAngle = (deg: number, m: HandleMods) => {
  if (m.shift) return Math.round(deg / 15) * 15;
  if (m.snap) return Math.round(deg / 5) * 5;
  return Math.round(deg * 10) / 10;
};

const snapLen = (v: number, m: HandleMods) => (m.snap ? Math.max(m.step, Math.round(v / m.step) * m.step) : Math.round(v * 10) / 10);

export function applyHandle(o: SceneObject, id: HandleId, wx: number, wy: number, m: HandleMods): ObjectPatch | null {
  const a = deg2rad(o.rotation);
  if (id === 'rotate') {
    return { rotation: wrapDeg(snapAngle(rad2deg(Math.atan2(wy - o.y, wx - o.x)) - 90, m)) };
  }
  if (o.kind === 'ruler') {
    if (id === 'end') {
      const rot = snapAngle(rad2deg(Math.atan2(wy - o.y, wx - o.x)), m);
      const len = Math.hypot(wx - o.x, wy - o.y);
      return { rotation: wrapDeg(rot), length: Math.max(1, snapLen(len, m)) };
    }
    if (id === 'start') {
      const [ex, ey] = toWorld(o.x, o.y, a, o.length, 0);
      return {
        x: wx,
        y: wy,
        rotation: wrapDeg(rad2deg(Math.atan2(ey - wy, ex - wx))),
        length: Math.max(1, Math.hypot(ex - wx, ey - wy)),
      };
    }
  }
  if (o.kind === 'protractor') {
    const ang = snapAngle(rad2deg(Math.atan2(wy - o.y, wx - o.x)), m);
    const radius = Math.max(15, Math.hypot(wx - o.x, wy - o.y));
    if (id === 'arm1') {
      const arm2 = o.rotation + o.angle;
      return { rotation: wrapDeg(ang), angle: (((arm2 - ang) % 360) + 360) % 360, radius };
    }
    if (id === 'arm2') return { angle: (((ang - o.rotation) % 360) + 360) % 360, radius };
  }
  if (id !== 'resize') return null;
  const [lx, ly] = toLocal(o.x, o.y, a, wx, wy);
  const ax = Math.abs(lx);
  const ay = Math.abs(ly);
  switch (o.kind) {
    case 'source':
      return { width: Math.max(2, snapLen(2 * Math.max(0, ay - 4), m)) };
    case 'mirror': {
      if (o.shape === 'arc') return { radius: Math.max(5, snapLen(Math.hypot(lx, ly), m)) };
      let L = Math.max(5, snapLen(2 * ay, m));
      if (o.shape === 'concave' || o.shape === 'convex') L = Math.min(L, 2 * o.radius * 0.999);
      return { length: L };
    }
    case 'thinlens':
      return { aperture: Math.max(5, snapLen(2 * ay, m)) };
    case 'detector':
      return { length: Math.max(5, snapLen(2 * ay, m)) };
    case 'body':
      switch (o.shape) {
        case 'rect':
          return { width: Math.max(2, snapLen(2 * ax, m)), height: Math.max(2, snapLen(2 * ay, m)) };
        case 'circle':
          return { radius: Math.max(2, snapLen(Math.hypot(lx, ly), m)) };
        case 'prism': {
          const H = Math.max(3, 1.5 * ly);
          return { size: Math.max(5, snapLen(H / Math.cos(deg2rad(o.apexAngle) / 2), m)) };
        }
        case 'lens': {
          let D = Math.max(5, snapLen(2 * ay, m));
          const lim = Math.min(o.r1 ? 2 * Math.abs(o.r1) : Infinity, o.r2 ? 2 * Math.abs(o.r2) : Infinity) * 0.999;
          D = Math.min(D, lim);
          return { diameter: D };
        }
        default:
          return null;
      }
    default:
      return null;
  }
}

function distToPolyline(pts: number[], closed: boolean, x: number, y: number): number {
  let d = Infinity;
  const n = pts.length / 2;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % n;
    d = Math.min(d, distToSegment(x, y, pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1]));
  }
  if (n === 1) d = Math.hypot(pts[0] - x, pts[1] - y);
  return d;
}

function pointInPolygon(pts: number[], x: number, y: number): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[2 * i];
    const yi = pts[2 * i + 1];
    const xj = pts[2 * j];
    const yj = pts[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance-based hit test; returns 0 for interior hits, Infinity for misses. */
export function hitDistance(c: Compiled, x: number, y: number, tol: number): number {
  const o = c.obj;
  if (x < c.bounds[0] - tol || x > c.bounds[2] + tol || y < c.bounds[1] - tol || y > c.bounds[3] + tol) {
    if (o.kind !== 'protractor') return Infinity;
  }
  let best = Infinity;
  for (const ol of c.outlines) {
    if (ol.closed && (o.kind === 'body' || o.kind === 'source') && pointInPolygon(ol.pts, x, y)) return 0;
    best = Math.min(best, distToPolyline(ol.pts, ol.closed, x, y));
  }
  if (o.kind === 'source') best = Math.min(best, Math.hypot(x - o.x, y - o.y) - 6);
  if (o.kind === 'protractor') {
    // Also allow grabbing the arc
    const r = Math.hypot(x - o.x, y - o.y);
    const ang = ((rad2deg(Math.atan2(y - o.y, x - o.x)) - o.rotation) % 360 + 360) % 360;
    if (ang <= o.angle) best = Math.min(best, Math.abs(r - o.radius * 0.35));
  }
  return best <= tol ? Math.max(0, best) : Infinity;
}

/** Topmost hit object. Thin objects (mirrors, sources, tools) win over the bodies they sit on. */
export function hitTest(compiled: Compiled[], x: number, y: number, tol: number): string | null {
  let bestThin: { id: string; d: number } | null = null;
  for (let i = compiled.length - 1; i >= 0; i--) {
    const c = compiled[i];
    if (c.obj.kind === 'body') continue;
    const d = hitDistance(c, x, y, tol);
    if (d < Infinity && (!bestThin || d < bestThin.d)) bestThin = { id: c.obj.id, d };
  }
  if (bestThin) return bestThin.id;
  for (let i = compiled.length - 1; i >= 0; i--) {
    const c = compiled[i];
    if (c.obj.kind !== 'body') continue;
    if (hitDistance(c, x, y, tol) < Infinity) return c.obj.id;
  }
  return null;
}
