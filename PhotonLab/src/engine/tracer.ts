/**
 * Physically based 2D ray tracer.
 *
 * Rays are processed breadth-first from a queue so that every primary ray is
 * resolved before deep branches consume the segment budget. At every surface
 * the energy of the incoming ray is split exactly into reflected, transmitted
 * and absorbed parts, so in non-absorbing scenes
 *   emitted = escaped + absorbed + detected + truncated.
 */
import type { Polarization, SceneObject, SimSettings } from '../scene/types';
import { type Compiled, type Optic, compileObject } from './compile';
import { type Hit, intersectPiece, pointInPieces, rayHitsAABB } from './geometry';
import { cauchyIndex, fresnelReflectance, reflect, refract } from './optics';
import { emitRays } from './sources';

/** Minimum parametric distance for a valid hit (mm). */
export const T_MIN = 1e-7;
/** Distance new rays are pushed off a surface to avoid self-intersection (mm). */
export const SURFACE_OFFSET = 1e-5;
/** Normal offset used to probe the media on each side of an interface (mm). */
const MEDIUM_PROBE = 1e-4;
/** Length used for rays that escape the scene. */
export const FAR = 1e6;
/** Maximum stratified scatter angle scale (radians, at roughness = 1). */
const SCATTER_SIGMA = 0.5;

/** Segment buffer stride: x1, y1, x2, y2, i0, i1, r, g, b */
export const SEG_STRIDE = 9;

export interface HitRecord {
  x: number;
  y: number;
  /** Surface normal facing the incoming ray. */
  nx: number;
  ny: number;
  /** Incoming direction. */
  dx: number;
  dy: number;
  /** Reflected direction (if any). */
  rx: number;
  ry: number;
  hasR: boolean;
  /** Transmitted / refracted direction (if any). */
  tx: number;
  ty: number;
  hasT: boolean;
  tir: boolean;
  n1: number;
  n2: number;
  intensity: number;
  source: string;
  optic: string;
  kind: Optic['type'];
}

export interface DetectorReading {
  power: number;
  rays: number;
}

export interface TraceStats {
  primaryRays: number;
  segments: number;
  interactions: number;
  emitted: number;
  escaped: number;
  absorbed: number;
  detected: number;
  truncated: number;
  tirEvents: number;
  limitReached: boolean;
}

export interface TraceResult {
  segs: Float64Array;
  segCount: number;
  hits: HitRecord[];
  detectors: Record<string, DetectorReading>;
  stats: TraceStats;
  timeMs: number;
}

interface Ray {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  I: number;
  wl: number;
  r: number;
  g: number;
  b: number;
  depth: number;
  medium: Optic | null;
  src: string;
}

export type TraceOptions = Pick<SimSettings, 'maxDepth' | 'minIntensity' | 'polarization' | 'whiteSamples' | 'scatterRays' | 'maxSegments'> & {
  maxHitRecords?: number;
};

/** Stratified quantiles of a unit normal distribution (logistic approximation). */
function scatterOffsets(k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k;
    out.push(Math.log(u / (1 - u)) * 0.5513);
  }
  return out;
}

export function ior(medium: Optic | null, wl: number): number {
  if (!medium || !medium.material) return 1;
  return cauchyIndex(medium.material.ior, medium.material.dispersion, wl);
}

export function traceScene(objects: SceneObject[], opts: TraceOptions): TraceResult {
  return traceCompiled(objects.map(compileObject), opts);
}

export function traceCompiled(compiled: Compiled[], opts: TraceOptions): TraceResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const optics: Optic[] = [];
  const bodies: Optic[] = [];
  for (const c of compiled) {
    if (!c.optic) continue;
    optics.push(c.optic);
    if (c.optic.type === 'body') bodies.push(c.optic);
  }

  const maxDepth = Math.max(1, opts.maxDepth);
  const minI = Math.max(1e-7, opts.minIntensity);
  const maxSegs = Math.max(10, opts.maxSegments);
  const maxHits = opts.maxHitRecords ?? 3000;
  const pol: Polarization = opts.polarization;
  const offsets = scatterOffsets(Math.max(1, Math.round(opts.scatterRays)));

  let segs = new Float64Array(Math.min(maxSegs, 4096) * SEG_STRIDE);
  let segCount = 0;
  const hits: HitRecord[] = [];
  const detectors: Record<string, DetectorReading> = {};
  const stats: TraceStats = {
    primaryRays: 0,
    segments: 0,
    interactions: 0,
    emitted: 0,
    escaped: 0,
    absorbed: 0,
    detected: 0,
    truncated: 0,
    tirEvents: 0,
    limitReached: false,
  };
  for (const c of compiled) if (c.obj.kind === 'detector') detectors[c.obj.id] = { power: 0, rays: 0 };

  /** Topmost body containing the point (later objects are on top), or null for air. */
  const mediumAt = (x: number, y: number): Optic | null => {
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (pointInPieces(b.pieces, b.aabb, x, y)) return b;
    }
    return null;
  };

  const queue: Ray[] = [];
  let head = 0;

  const push = (parent: Ray, ox: number, oy: number, dx: number, dy: number, I: number, medium: Optic | null) => {
    if (I < minI) {
      stats.truncated += I;
      return;
    }
    queue.push({ ox, oy, dx, dy, I, wl: parent.wl, r: parent.r, g: parent.g, b: parent.b, depth: parent.depth + 1, medium, src: parent.src });
  };

  const addSeg = (x1: number, y1: number, x2: number, y2: number, i0: number, i1: number, ray: Ray) => {
    if ((segCount + 1) * SEG_STRIDE > segs.length) {
      const n = new Float64Array(segs.length * 2);
      n.set(segs);
      segs = n;
    }
    const o = segCount * SEG_STRIDE;
    segs[o] = x1;
    segs[o + 1] = y1;
    segs[o + 2] = x2;
    segs[o + 3] = y2;
    segs[o + 4] = i0;
    segs[o + 5] = i1;
    segs[o + 6] = ray.r;
    segs[o + 7] = ray.g;
    segs[o + 8] = ray.b;
    segCount++;
  };

  // Emit primary rays
  for (const c of compiled) {
    const s = c.obj;
    if (s.kind !== 'source') continue;
    for (const e of emitRays(s, opts.whiteSamples)) {
      stats.primaryRays++;
      stats.emitted += e.intensity;
      queue.push({
        ox: e.ox,
        oy: e.oy,
        dx: e.dx,
        dy: e.dy,
        I: e.intensity,
        wl: e.wavelength,
        r: e.r,
        g: e.g,
        b: e.b,
        depth: 0,
        medium: mediumAt(e.ox, e.oy),
        src: s.id,
      });
    }
  }

  const hit: Hit = { t: 0, nx: 0, ny: 0 };

  while (head < queue.length) {
    if (segCount >= maxSegs) {
      stats.limitReached = true;
      for (let i = head; i < queue.length; i++) stats.truncated += queue[i].I;
      break;
    }
    const ray = queue[head++];
    // Release processed rays periodically to bound memory.
    if (head > 50000) {
      queue.splice(0, head);
      head = 0;
    }
    const { ox, oy, dx, dy, medium } = ray;

    // A ray inside an opaque body is absorbed immediately.
    if (medium?.material && medium.material.transmission <= 0) {
      stats.absorbed += ray.I;
      continue;
    }

    // ── Nearest intersection ──
    let bestT = FAR;
    let best: Optic | null = null;
    let bnx = 0;
    let bny = 0;
    for (let k = 0; k < optics.length; k++) {
      const op = optics[k];
      if (!rayHitsAABB(op.aabb, ox, oy, dx, dy, bestT)) continue;
      const pcs = op.pieces;
      for (let j = 0; j < pcs.length; j++) {
        if (intersectPiece(pcs[j], ox, oy, dx, dy, T_MIN, bestT, hit)) {
          bestT = hit.t;
          best = op;
          bnx = hit.nx;
          bny = hit.ny;
        }
      }
    }

    const alpha = medium?.material ? medium.material.absorption / 10 : 0; // 1/cm → 1/mm
    if (!best) {
      if (alpha > 0) {
        stats.absorbed += ray.I;
        addSeg(ox, oy, ox + dx * FAR, oy + dy * FAR, ray.I, 0, ray);
      } else {
        stats.escaped += ray.I;
        addSeg(ox, oy, ox + dx * FAR, oy + dy * FAR, ray.I, ray.I, ray);
      }
      continue;
    }

    const px = ox + dx * bestT;
    const py = oy + dy * bestT;
    const I = alpha > 0 ? ray.I * Math.exp(-alpha * bestT) : ray.I;
    stats.absorbed += ray.I - I;
    addSeg(ox, oy, px, py, ray.I, I, ray);

    if (I < minI || ray.depth >= maxDepth) {
      stats.truncated += I;
      continue;
    }
    stats.interactions++;

    const record = hits.length < maxHits && I >= 0.01;

    // ── Detector: absorbs and measures ──
    if (best.type === 'detector') {
      const d = detectors[best.id];
      if (d) {
        d.power += I;
        d.rays++;
      }
      stats.detected += I;
      if (record) {
        const facing = dx * bnx + dy * bny < 0 ? 1 : -1;
        hits.push(makeRecord(px, py, bnx * facing, bny * facing, dx, dy, ray, best, 1, 1));
      }
      continue;
    }

    // ── Ideal thin lens ──
    if (best.type === 'thinlens') {
      let s = dx * best.axx + dy * best.axy;
      const sign = s >= 0 ? 1 : -1;
      s = Math.abs(s);
      let ndx = dx;
      let ndy = dy;
      if (best.f !== 0 && s > 1e-9) {
        const Px = best.cx + (dx * best.f) / s;
        const Py = best.cy + (dy * best.f) / s;
        const fs = best.f > 0 ? 1 : -1;
        ndx = (Px - px) * fs;
        ndy = (Py - py) * fs;
        const l = Math.hypot(ndx, ndy);
        if (l < 1e-12) {
          ndx = dx;
          ndy = dy;
        } else {
          ndx /= l;
          ndy /= l;
        }
      }
      const ax = best.axx * sign;
      const ay = best.axy * sign;
      // Offset along the outgoing ray so the emitted line passes exactly through the hit point.
      const off = SURFACE_OFFSET / Math.max(1e-3, ndx * ax + ndy * ay);
      push(ray, px + ndx * off, py + ndy * off, ndx, ndy, I, medium);
      if (record) {
        const r = makeRecord(px, py, -ax, -ay, dx, dy, ray, best, 1, 1);
        r.tx = ndx;
        r.ty = ndy;
        r.hasT = true;
        hits.push(r);
      }
      continue;
    }

    // ── Mirror ──
    if (best.type === 'mirror') {
      const front = dx * bnx + dy * bny < 0;
      if (!front && !best.twoSided) {
        stats.absorbed += I;
        continue;
      }
      const nfx = front ? bnx : -bnx;
      const nfy = front ? bny : -bny;
      const R = Math.min(1, Math.max(0, best.reflectivity));
      const T = best.partial ? 1 - R : 0;
      stats.absorbed += I * Math.max(0, 1 - R - T);
      if (R > 0) scatterReflect(ray, px, py, nfx, nfy, I * R, best.roughness, medium);
      if (T > 0) push(ray, px - nfx * SURFACE_OFFSET, py - nfy * SURFACE_OFFSET, dx, dy, I * T, medium);
      if (record) {
        const rec = makeRecord(px, py, nfx, nfy, dx, dy, ray, best, 1, 1);
        if (R > 0) {
          [rec.rx, rec.ry] = reflect(dx, dy, nfx, nfy);
          rec.hasR = true;
        }
        if (T > 0) {
          rec.tx = dx;
          rec.ty = dy;
          rec.hasT = true;
        }
        hits.push(rec);
      }
      continue;
    }

    // ── Material boundary ──
    const mat = best.material!;
    const entering = dx * bnx + dy * bny < 0;
    const mIn = mediumAt(px - bnx * MEDIUM_PROBE, py - bny * MEDIUM_PROBE);
    const mOut = mediumAt(px + bnx * MEDIUM_PROBE, py + bny * MEDIUM_PROBE);
    const near = entering ? mOut : mIn;
    const far = entering ? mIn : mOut;
    const nfx = entering ? bnx : -bnx;
    const nfy = entering ? bny : -bny;

    if (near === far) {
      // Boundary hidden inside an overlapping body — no optical interface here.
      push(ray, px - nfx * SURFACE_OFFSET, py - nfy * SURFACE_OFFSET, dx, dy, I, far);
      stats.interactions--;
      continue;
    }

    const n1 = ior(near, ray.wl);
    const n2 = ior(far, ray.wl);
    // Surface properties come from the body whose boundary was hit, unless we enter an opaque body.
    const surf = far?.material && far.material.transmission <= 0 ? far.material : mat;
    const Rs = Math.min(1, Math.max(0, surf.reflectivity));
    const tr = Math.min(1, Math.max(0, surf.transmission));
    const rough = surf.roughness;
    const K = rough > 1e-3 ? offsets.length : 1;
    const w = 1 / K;
    let tirHappened = false;

    for (let k = 0; k < K; k++) {
      let mx = nfx;
      let my = nfy;
      if (K > 1) {
        const ang = offsets[k] * rough * SCATTER_SIGMA;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        mx = nfx * c - nfy * s;
        my = nfx * s + nfy * c;
      }
      let cosi = -(dx * mx + dy * my);
      if (cosi <= 1e-9) {
        mx = nfx;
        my = nfy;
        cosi = -(dx * mx + dy * my);
      }
      const F = tr > 0 ? fresnelReflectance(n1, n2, cosi, pol) : 0;
      if (F >= 1) tirHappened = true;
      const Rtot = Rs + (1 - Rs) * tr * F;
      const Ttot = (1 - Rs) * tr * (1 - F);
      stats.absorbed += I * w * (1 - Rs) * (1 - tr);

      if (Rtot > 0) {
        let [rx, ry] = reflect(dx, dy, mx, my);
        const side = rx * nfx + ry * nfy;
        if (side <= 1e-9) {
          // Facet sent the ray into the surface: fold it back to the incident side.
          rx -= 2 * side * nfx;
          ry -= 2 * side * nfy;
          if (rx * nfx + ry * nfy <= 1e-9) {
            rx += nfx * 1e-6;
            ry += nfy * 1e-6;
          }
          const l = Math.hypot(rx, ry);
          rx /= l;
          ry /= l;
        }
        push(ray, px + nfx * SURFACE_OFFSET, py + nfy * SURFACE_OFFSET, rx, ry, I * w * Rtot, near);
      }
      if (Ttot > 0) {
        const t = refract(dx, dy, mx, my, n1, n2);
        if (t) {
          let [tx, ty] = t;
          const side = tx * nfx + ty * nfy;
          if (side >= -1e-9) {
            tx -= 2 * side * nfx;
            ty -= 2 * side * nfy;
            if (tx * nfx + ty * nfy >= -1e-9) {
              tx -= nfx * 1e-6;
              ty -= nfy * 1e-6;
            }
            const l = Math.hypot(tx, ty);
            tx /= l;
            ty /= l;
          }
          push(ray, px - nfx * SURFACE_OFFSET, py - nfy * SURFACE_OFFSET, tx, ty, I * w * Ttot, far);
        } else {
          stats.absorbed += I * w * Ttot;
        }
      }
    }
    if (tirHappened && K === 1) stats.tirEvents++;

    if (record) {
      const rec = makeRecord(px, py, nfx, nfy, dx, dy, ray, best, n1, n2);
      const cosi = -(dx * nfx + dy * nfy);
      const F = tr > 0 ? fresnelReflectance(n1, n2, cosi, pol) : 0;
      if (Rs + (1 - Rs) * tr * F > 0) {
        [rec.rx, rec.ry] = reflect(dx, dy, nfx, nfy);
        rec.hasR = true;
      }
      if (tr > 0) {
        const t = refract(dx, dy, nfx, nfy, n1, n2);
        if (t) {
          [rec.tx, rec.ty] = t;
          rec.hasT = true;
        } else rec.tir = true;
      }
      hits.push(rec);
    }
  }

  function scatterReflect(ray: Ray, px: number, py: number, nfx: number, nfy: number, I: number, rough: number, medium: Optic | null) {
    const K = rough > 1e-3 ? offsets.length : 1;
    for (let k = 0; k < K; k++) {
      let mx = nfx;
      let my = nfy;
      if (K > 1) {
        const ang = offsets[k] * rough * SCATTER_SIGMA;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        mx = nfx * c - nfy * s;
        my = nfx * s + nfy * c;
      }
      if (-(ray.dx * mx + ray.dy * my) <= 1e-9) {
        mx = nfx;
        my = nfy;
      }
      let [rx, ry] = reflect(ray.dx, ray.dy, mx, my);
      const side = rx * nfx + ry * nfy;
      if (side <= 1e-9) {
        rx -= 2 * side * nfx;
        ry -= 2 * side * nfy;
        if (rx * nfx + ry * nfy <= 1e-9) {
          rx += nfx * 1e-6;
          ry += nfy * 1e-6;
        }
        const l = Math.hypot(rx, ry);
        rx /= l;
        ry /= l;
      }
      push(ray, px + nfx * SURFACE_OFFSET, py + nfy * SURFACE_OFFSET, rx, ry, I / K, medium);
    }
  }

  stats.segments = segCount;
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { segs, segCount, hits, detectors, stats, timeMs: t1 - t0 };
}

function makeRecord(
  x: number,
  y: number,
  nx: number,
  ny: number,
  dx: number,
  dy: number,
  ray: Ray,
  optic: Optic,
  n1: number,
  n2: number,
): HitRecord {
  return {
    x,
    y,
    nx,
    ny,
    dx,
    dy,
    rx: 0,
    ry: 0,
    hasR: false,
    tx: 0,
    ty: 0,
    hasT: false,
    tir: false,
    n1,
    n2,
    intensity: ray.I,
    source: ray.src,
    optic: optic.id,
    kind: optic.type,
  };
}
