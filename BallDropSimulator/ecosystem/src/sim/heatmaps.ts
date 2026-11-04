import type { Ecosystem } from './ecosystem';
import { HALF, VEG_N, WORLD_SIZE } from './world';

export type HeatKind = 'vegetation' | 'deer' | 'wolves' | 'resources' | 'predation';

/**
 * Spatial summaries on a 56 × 56 grid, all derived from the simulated state:
 * vegetation density, smoothed deer and wolf densities, resource availability
 * (food × water access) and decaying predation hotspots.
 */
export class HeatMaps {
  static N = 56;
  readonly cell = WORLD_SIZE / HeatMaps.N;
  vegetation = new Float32Array(HeatMaps.N ** 2);
  deer = new Float32Array(HeatMaps.N ** 2);
  wolves = new Float32Array(HeatMaps.N ** 2);
  resources = new Float32Array(HeatMaps.N ** 2);
  predation = new Float32Array(HeatMaps.N ** 2);
  version = 0;
  private lastDecayTick = 0;

  private idx(x: number, z: number) {
    const N = HeatMaps.N;
    const gx = Math.min(N - 1, Math.max(0, Math.floor((x + HALF) / this.cell)));
    const gz = Math.min(N - 1, Math.max(0, Math.floor((z + HALF) / this.cell)));
    return gz * N + gx;
  }

  addKill(x: number, z: number) { this.predation[this.idx(x, z)] += 1; }

  update(sim: Ecosystem, initial = false) {
    const N = HeatMaps.N;
    const ratio = VEG_N / N;
    const veg = sim.veg;
    for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
      let b = 0, access = 0;
      for (let sz = 0; sz < ratio; sz++) for (let sx = 0; sx < ratio; sx++) {
        const c = (gz * ratio + sz) * VEG_N + gx * ratio + sx;
        b += veg.B[c];
        access += Number.isFinite(veg.waterDist[c]) ? Math.exp(-veg.waterDist[c] / 45) : 0;
      }
      b /= ratio * ratio; access /= ratio * ratio;
      const i = gz * N + gx;
      this.vegetation[i] = b / Math.max(1e-6, sim.params.vegCapacity * Math.max(0.3, sim.params.habitat));
      this.resources[i] = this.vegetation[i] * access;
    }
    const k = initial ? 1 : 0.25;
    const dc = new Float32Array(N * N), wc = new Float32Array(N * N);
    for (const a of sim.animals) {
      if (a.species === 'deer') dc[this.idx(a.x, a.z)] += 1;
      else if (a.species === 'wolf') wc[this.idx(a.x, a.z)] += 1;
    }
    for (let i = 0; i < N * N; i++) {
      this.deer[i] += (dc[i] - this.deer[i]) * k;
      this.wolves[i] += (wc[i] - this.wolves[i]) * k;
    }
    // Hotspots fade with a ~20-day half-life.
    const days = (sim.tick - this.lastDecayTick) / 120;
    this.lastDecayTick = sim.tick;
    const f = Math.pow(0.5, days / 20);
    for (let i = 0; i < N * N; i++) this.predation[i] *= f;
    this.version++;
  }

  /** The centre of the cell with the most deer scent within `radius` of (x, z). */
  bestDeerCell(x: number, z: number, radius: number) {
    const N = HeatMaps.N;
    let best = -1, score = 0.05;
    const r = Math.ceil(radius / this.cell);
    const cx = Math.floor((x + HALF) / this.cell), cz = Math.floor((z + HALF) / this.cell);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const gx = cx + dx, gz = cz + dz;
      if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
      const v = this.deer[gz * N + gx] / (1 + 0.15 * Math.hypot(dx, dz));
      if (v > score) { score = v; best = gz * N + gx; }
    }
    if (best < 0) return null;
    return { x: -HALF + ((best % N) + 0.5) * this.cell, z: -HALF + (Math.floor(best / N) + 0.5) * this.cell };
  }

  grid(kind: HeatKind) {
    return kind === 'vegetation' ? this.vegetation : kind === 'deer' ? this.deer : kind === 'wolves' ? this.wolves : kind === 'resources' ? this.resources : this.predation;
  }
}
