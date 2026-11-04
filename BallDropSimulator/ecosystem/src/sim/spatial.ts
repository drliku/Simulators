import { HALF, WORLD_SIZE } from './world';

/**
 * Uniform-grid spatial hash for neighbour queries. Rebuilt each tick from the agent array,
 * so results come back in a deterministic order (cell by cell, insertion order within).
 */
export class SpatialHash {
  readonly cell: number;
  readonly n: number;
  private cells: number[][];
  private used: number[] = [];

  constructor(cell = 8) {
    this.cell = cell;
    this.n = Math.ceil(WORLD_SIZE / cell);
    this.cells = Array.from({ length: this.n * this.n }, () => []);
  }

  clear() { for (const k of this.used) this.cells[k].length = 0; this.used.length = 0; }

  private idx(v: number) { return Math.min(this.n - 1, Math.max(0, Math.floor((v + HALF) / this.cell))); }

  insert(i: number, x: number, z: number) {
    const k = this.idx(z) * this.n + this.idx(x);
    const list = this.cells[k];
    if (!list.length) this.used.push(k);
    list.push(i);
  }

  /** Calls fn(index) for every item in cells overlapping the query circle (caller filters by distance). */
  query(x: number, z: number, r: number, fn: (i: number) => void) {
    const x0 = this.idx(x - r), x1 = this.idx(x + r), z0 = this.idx(z - r), z1 = this.idx(z + r);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const list = this.cells[gz * this.n + gx];
      for (let k = 0; k < list.length; k++) fn(list[k]);
    }
  }
}
