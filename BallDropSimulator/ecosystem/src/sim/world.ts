/**
 * The static landscape: terrain height, stream and pond, forest canopy, trees, rocks and
 * bushes. Generated once from a fixed world seed so every experiment runs on the same land;
 * the simulation seed only affects the animals.
 */
import { ValueNoise } from './noise';
import { Rng } from './rng';

export const WORLD_SIZE = 360;
export const HALF = WORLD_SIZE / 2;
/** Vegetation / habitat grid resolution (cells per side) and cell size in metres. */
export const VEG_N = 112;
export const CELL = WORLD_SIZE / VEG_N;
export const TICKS_PER_DAY = 120;
export const YEAR_DAYS = 100;
/** Model time at tick 0, as a fraction of a day (07:00). */
export const DAY_START = 7 / 24;

const WORLD_SEED = 917_331;
const HEIGHT_N = 361;

export type ObstacleKind = 'conifer' | 'broadleaf' | 'rock';
export interface Obstacle { x: number; z: number; r: number; kind: ObstacleKind; scale: number; tint: number; rot: number }
export interface Bush { x: number; z: number; s: number; tint: number }
export interface Point { x: number; z: number }

export interface World {
  heights: Float32Array;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  /** Per vegetation cell: canopy density 0–1. */
  forest: Float32Array;
  /**
   * Per vegetation cell: distance (m) to the nearest stream centre line, and to the nearest pond
   * measured as if every pond had the reference radius of 10 m (so one water-level rule fits all).
   */
  streamDist: Float32Array;
  pondDist: Float32Array;
  /** The river (first) and its tributaries, as centre lines. */
  streams: Point[][];
  /** Lakes and ponds; `r` is the radius at full water. */
  ponds: { x: number; z: number; r: number }[];
  obstacles: Obstacle[];
  bushes: Bush[];
  /** Static obstacle grid for neighbourhood queries. */
  obstacleGrid: number[][];
  obstacleCell: number;
  obstacleN: number;
}

export const cellIndex = (x: number, z: number) => {
  const cx = Math.min(VEG_N - 1, Math.max(0, Math.floor((x + HALF) / CELL)));
  const cz = Math.min(VEG_N - 1, Math.max(0, Math.floor((z + HALF) / CELL)));
  return cz * VEG_N + cx;
};
export const cellCenter = (i: number): Point => ({
  x: -HALF + ((i % VEG_N) + 0.5) * CELL,
  z: -HALF + (Math.floor(i / VEG_N) + 0.5) * CELL,
});

function distToPolyline(x: number, z: number, pts: Point[]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const ex = a.x + dx * t - x, ez = a.z + dz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

let cached: World | null = null;

export function getWorld(): World {
  if (cached) return cached;
  const noise = new ValueNoise(WORLD_SEED);
  const rng = new Rng(WORLD_SEED + 1);

  // River: meanders from the north edge to the south edge. A tributary joins it from the east.
  const river: Point[] = [];
  for (let z = -HALF - 4; z <= HALF + 4; z += 2.5) {
    river.push({ x: -30 + 42 * Math.sin(z * 0.014 + 0.7) + 12 * Math.sin(z * 0.043 + 2.1), z });
  }
  const join = river[Math.round(river.length * 0.58)];
  const creek: Point[] = [];
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const x = HALF + 4 + (join.x - HALF - 4) * t;
    const z = -40 + (join.z + 40) * t + 16 * Math.sin(t * 7.5);
    creek.push({ x, z });
  }
  const streams = [river, creek];
  const ponds = [{ x: 96, z: -92, r: 17 }, { x: -118, z: 104, r: 10 }, { x: 52, z: 118, r: 8 }];
  const streamDistAt = (x: number, z: number) => Math.min(distToPolyline(x, z, river), distToPolyline(x, z, creek) + 1.2);
  const pondDistAt = (x: number, z: number) => {
    let best = Infinity;
    for (const p of ponds) best = Math.min(best, Math.hypot(x - p.x, z - p.z) - (p.r - 10));
    return best;
  };

  // Fine heightmap: rolling hills, a rocky ridge along the west edge, carved valleys and basins.
  const heights = new Float32Array(HEIGHT_N * HEIGHT_N);
  const step = WORLD_SIZE / (HEIGHT_N - 1);
  for (let j = 0; j < HEIGHT_N; j++) {
    for (let i = 0; i < HEIGHT_N; i++) {
      const x = -HALF + i * step, z = -HALF + j * step;
      let h = (noise.fbm(x / 70 + 3.1, z / 70 - 1.7, 5) - 0.5) * 20;
      h += (noise.fbm(x / 22 - 7, z / 22 + 5, 3) - 0.5) * 2.4;
      // Ridge: rises toward the west edge, strongest in the north-west.
      const ridge = Math.max(0, (-x - 95) / 85);
      h += ridge * ridge * (26 + 14 * noise.fbm(z / 40 + 9, x / 40, 3)) * (0.75 + 0.25 * Math.max(0, -z / HALF));
      const ds = streamDistAt(x, z);
      h = h * (0.3 + 0.7 * Math.min(1, ds / 34)) - 2.8 * Math.exp(-((ds / 8) ** 2));
      for (const p of ponds) {
        const dp = Math.hypot(x - p.x, z - p.z);
        const k = p.r / 10;
        h = h * (0.4 + 0.6 * Math.min(1, dp / (24 * k))) - 2.6 * Math.exp(-((dp / (12 * k)) ** 2));
      }
      heights[j * HEIGHT_N + i] = h;
    }
  }
  const heightAt = (x: number, z: number) => {
    const fx = Math.min(HEIGHT_N - 1.001, Math.max(0, (x + HALF) / step));
    const fz = Math.min(HEIGHT_N - 1.001, Math.max(0, (z + HALF) / step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = heights[j * HEIGHT_N + i], b = heights[j * HEIGHT_N + i + 1];
    const c = heights[(j + 1) * HEIGHT_N + i], d = heights[(j + 1) * HEIGHT_N + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const slopeAt = (x: number, z: number) => {
    const e = 1.2;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };

  // Per-cell fields
  const n2 = VEG_N * VEG_N;
  const forest = new Float32Array(n2);
  const streamDist = new Float32Array(n2);
  const pondDist = new Float32Array(n2);
  for (let c = 0; c < n2; c++) {
    const { x, z } = cellCenter(c);
    streamDist[c] = streamDistAt(x, z);
    pondDist[c] = pondDistAt(x, z);
    const n = noise.fbm(x / 50 + 11, z / 50 - 4, 4);
    // Conifer forest thickens up the ridge; meadows elsewhere.
    const ridge = Math.max(0, (-x - 110) / 70);
    let f = Math.min(1, Math.max(0, (n - 0.5 + 0.25 * ridge) / 0.1));
    f *= Math.min(1, Math.max(0, (streamDist[c] - 5) / 8)) * Math.min(1, Math.max(0, (pondDist[c] - 13) / 8));
    forest[c] = f;
  }

  // Trees: dense in forest patches, a few lone trees in meadows. Minimum spacing via a grid.
  const obstacles: Obstacle[] = [];
  const occ = new Map<string, Point[]>();
  const key = (x: number, z: number) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  const free = (x: number, z: number, minD: number) => {
    const kx = Math.floor(x / 4), kz = Math.floor(z / 4);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const p of occ.get(`${kx + dx},${kz + dz}`) ?? []) if (Math.hypot(p.x - x, p.z - z) < minD) return false;
    }
    return true;
  };
  const place = (x: number, z: number) => { const k = key(x, z); (occ.get(k) ?? occ.set(k, []).get(k)!).push({ x, z }); };

  for (let tries = 0; tries < 40000 && obstacles.length < 1450; tries++) {
    const x = rng.range(-HALF + 3, HALF - 3), z = rng.range(-HALF + 3, HALF - 3);
    const c = cellIndex(x, z);
    const f = forest[c];
    const accept = f > 0.05 ? rng.chance(0.25 + 0.75 * f) : rng.chance(0.012) && streamDist[c] > 8 && pondDist[c] > 14;
    if (!accept || !free(x, z, f > 0.05 ? 3.4 : 6)) continue;
    place(x, z);
    const conifer = noise.noise(x / 30 + 40, z / 30) > 0.45 || x < -110 ? rng.chance(0.8) : rng.chance(0.25);
    const scale = rng.range(0.75, 1.35);
    obstacles.push({ x, z, r: (conifer ? 0.45 : 0.55) * scale, kind: conifer ? 'conifer' : 'broadleaf', scale, tint: rng.next(), rot: rng.range(0, Math.PI * 2) });
  }
  // Rocks: scattered, more on slopes, hilltops and the ridge.
  let rocks = 0;
  for (let tries = 0; tries < 12000 && rocks < 260; tries++) {
    const x = rng.range(-HALF + 4, HALF - 4), z = rng.range(-HALF + 4, HALF - 4);
    const c = cellIndex(x, z);
    if (streamDist[c] < 5 || pondDist[c] < 12) continue;
    if (!rng.chance(0.12 + Math.min(0.7, slopeAt(x, z) * 1.6))) continue;
    const scale = rng.range(0.6, 2.1);
    if (!free(x, z, 2 + scale * 1.4)) continue;
    place(x, z);
    obstacles.push({ x, z, r: 0.75 * scale, kind: 'rock', scale, tint: rng.next(), rot: rng.range(0, Math.PI * 2) });
    rocks++;
  }
  // Bushes (no collision, provide cover visually) along forest edges and scattered.
  const bushes: Bush[] = [];
  for (let tries = 0; tries < 24000 && bushes.length < 1000; tries++) {
    const x = rng.range(-HALF + 2, HALF - 2), z = rng.range(-HALF + 2, HALF - 2);
    const c = cellIndex(x, z);
    const edge = forest[c] > 0.05 && forest[c] < 0.7;
    if (streamDist[c] < 3.2 || pondDist[c] < 11) continue;
    if (!rng.chance(edge ? 0.6 : 0.06)) continue;
    if (!free(x, z, 1.6)) continue;
    bushes.push({ x, z, s: rng.range(0.5, 1.2), tint: rng.next() });
  }

  // Obstacle grid (5 m cells)
  const obstacleCell = 5;
  const obstacleN = Math.ceil(WORLD_SIZE / obstacleCell);
  const obstacleGrid: number[][] = Array.from({ length: obstacleN * obstacleN }, () => []);
  obstacles.forEach((o, idx) => {
    const minX = Math.floor((o.x - o.r + HALF) / obstacleCell), maxX = Math.floor((o.x + o.r + HALF) / obstacleCell);
    const minZ = Math.floor((o.z - o.r + HALF) / obstacleCell), maxZ = Math.floor((o.z + o.r + HALF) / obstacleCell);
    for (let gz = Math.max(0, minZ); gz <= Math.min(obstacleN - 1, maxZ); gz++)
      for (let gx = Math.max(0, minX); gx <= Math.min(obstacleN - 1, maxX); gx++) obstacleGrid[gz * obstacleN + gx].push(idx);
  });

  cached = { heights, heightAt, slopeAt, forest, streamDist, pondDist, streams, ponds, obstacles, bushes, obstacleGrid, obstacleCell, obstacleN };
  return cached;
}

export const HEIGHT_RES = HEIGHT_N;
