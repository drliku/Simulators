/**
 * Primary producers on a 64 × 64 grid of 3.125 m cells.
 *
 * Each cell holds plant biomass B (arbitrary units) with a carrying capacity K set by
 * habitat quality, canopy cover and open water. Growth is resource-limited logistic growth
 * scaled by moisture and season, plus a small regrowth term from roots and seed so grazed
 * cells can recover:
 *
 *   dB/dt = r · S(t) · M · [ B (1 − B/K) + ρ K (1 − B/K) ]
 *
 * r = growth rate, S = seasonal factor ≥ 0, M = local moisture (0–1), ρ = 0.015.
 * If r, S or M is zero, nothing grows.
 */
import type { Params } from './params';
import { CELL, HALF, VEG_N, YEAR_DAYS, cellCenter, type World } from './world';

export const REGROWTH_SEED = 0.015;

export function waterLevel(p: Params): number {
  return Math.max(0, Math.min(1, p.water * (1 - 0.55 * p.drought)));
}

/** Half-width of the stream and radius of the pond for a water level. */
export function waterGeometry(level: number) {
  return {
    streamHalfWidth: level < 0.04 ? 0 : 0.4 + 2.3 * level,
    pondRadius: level < 0.02 ? 0 : 1.5 + 8.2 * level,
  };
}

export function seasonFactor(day: number, seasonality: number): number {
  // Peak growth in "summer" (day 25 of each 100-day year), minimum in "winter" (day 75).
  return Math.max(0, 1 + seasonality * Math.sin((2 * Math.PI * day) / YEAR_DAYS));
}

export function seasonName(day: number): string {
  const f = (((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) / YEAR_DAYS;
  return f < 0.125 || f >= 0.875 ? 'Spring' : f < 0.375 ? 'Summer' : f < 0.625 ? 'Autumn' : 'Winter';
}

export class Vegetation {
  readonly n = VEG_N * VEG_N;
  B = new Float32Array(this.n);
  K = new Float32Array(this.n);
  moisture = new Float32Array(this.n);
  /** 1 where the cell is currently open water. */
  water = new Uint8Array(this.n);
  /** Distance (m) to the nearest open water, and that water's position. */
  waterDist = new Float32Array(this.n);
  nearestWaterX = new Float32Array(this.n);
  nearestWaterZ = new Float32Array(this.n);
  level = -1;
  /** Biomass grown in the last update (for energy-flow accounting). */
  lastProduction = 0;
  private world: World;
  private paramKey = '';

  constructor(world: World) {
    this.world = world;
  }

  /** Recompute water, moisture and capacity when environmental parameters change. */
  refresh(p: Params, force = false) {
    const key = `${p.water}|${p.drought}|${p.habitat}|${p.vegCapacity}`;
    if (!force && key === this.paramKey) return;
    this.paramKey = key;
    const level = waterLevel(p);
    this.level = level;
    const { streamHalfWidth, pondRadius } = waterGeometry(level);
    const w = this.world;
    const waterCells: number[] = [];
    for (let c = 0; c < this.n; c++) {
      const isWater = (streamHalfWidth > 0 && w.streamDist[c] < streamHalfWidth) || (pondRadius > 0 && w.pondDist[c] < pondRadius);
      this.water[c] = isWater ? 1 : 0;
      if (isWater) waterCells.push(c);
    }
    // Nearest open water for every cell (brute force; only on parameter changes).
    const wx = waterCells.map((c) => cellCenter(c).x), wz = waterCells.map((c) => cellCenter(c).z);
    for (let c = 0; c < this.n; c++) {
      const { x, z } = cellCenter(c);
      let best = Infinity, bx = 0, bz = 0;
      for (let k = 0; k < waterCells.length; k++) {
        const d = (wx[k] - x) ** 2 + (wz[k] - z) ** 2;
        if (d < best) { best = d; bx = wx[k]; bz = wz[k]; }
      }
      this.waterDist[c] = waterCells.length ? Math.sqrt(best) : Infinity;
      this.nearestWaterX[c] = bx;
      this.nearestWaterZ[c] = bz;
      // Moisture: rainfall (cut by drought) plus seepage near open water.
      const seep = Number.isFinite(this.waterDist[c]) ? 0.65 * Math.exp(-this.waterDist[c] / 14) : 0;
      this.moisture[c] = Math.min(1, 0.92 * (1 - p.drought) + seep);
      // Capacity: open meadow holds the most; canopy shades out ground plants; water holds none.
      const cover = 1 - 0.68 * w.forest[c];
      this.K[c] = this.water[c] ? 0 : p.vegCapacity * p.habitat * cover;
    }
  }

  /** Start every cell at a fraction of its capacity. */
  fill(fraction: number) {
    for (let c = 0; c < this.n; c++) this.B[c] = this.K[c] * fraction;
  }

  /** Advance plant growth by dtDays. Returns biomass produced. */
  grow(dtDays: number, day: number, p: Params, weatherMul = 1): number {
    const S = seasonFactor(day, p.seasonality);
    const r = p.vegGrowth * S * weatherMul;
    let produced = 0;
    for (let c = 0; c < this.n; c++) {
      const K = this.K[c];
      const B = this.B[c];
      if (K <= 0) { this.B[c] = 0; continue; }
      if (B > K) {
        // Capacity fell (e.g. habitat slider): die back toward K.
        this.B[c] = B - (B - K) * Math.min(1, 0.2 * dtDays);
        continue;
      }
      const room = 1 - B / K;
      const g = r * this.moisture[c] * (B * room + REGROWTH_SEED * K * room) * dtDays;
      if (g > 0) { this.B[c] = Math.min(K, B + g); produced += this.B[c] - B; }
    }
    this.lastProduction = produced;
    return produced;
  }

  /** Remove up to `amount` biomass from the cell at (x, z); returns what was actually eaten. */
  consume(c: number, amount: number): number {
    const eaten = Math.min(this.B[c], amount);
    this.B[c] -= eaten;
    return eaten;
  }

  total(): number {
    let s = 0;
    for (let c = 0; c < this.n; c++) s += this.B[c];
    return s;
  }

  totalCapacity(): number {
    let s = 0;
    for (let c = 0; c < this.n; c++) s += this.K[c];
    return s;
  }

  /** Best grazing cell within a radius, preferring more biomass and closer cells. */
  bestFoodNear(x: number, z: number, radius: number): number {
    const cr = Math.ceil(radius / CELL);
    const cx = Math.floor((x + HALF) / CELL), cz = Math.floor((z + HALF) / CELL);
    let best = -1, bestScore = 0;
    for (let dz = -cr; dz <= cr; dz++) {
      const gz = cz + dz;
      if (gz < 0 || gz >= VEG_N) continue;
      for (let dx = -cr; dx <= cr; dx++) {
        const gx = cx + dx;
        if (gx < 0 || gx >= VEG_N) continue;
        const c = gz * VEG_N + gx;
        const b = this.B[c];
        if (b < 1) continue;
        const d = Math.hypot(dx, dz) * CELL;
        if (d > radius) continue;
        const score = b / (1 + d * 0.12);
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
    return best;
  }
}
