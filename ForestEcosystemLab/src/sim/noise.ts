import { Rng } from './rng';

/** Seeded 2D value noise with fractal sums, for terrain and habitat patterns. */
export class ValueNoise {
  private perm: Uint16Array;
  private values: Float32Array;

  constructor(seed: number) {
    const rng = new Rng(seed);
    this.values = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.values[i] = rng.next();
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = rng.int(0, i); [p[i], p[j]] = [p[j], p[i]]; }
    this.perm = new Uint16Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private v(ix: number, iz: number) {
    return this.values[this.perm[(ix & 255) + this.perm[iz & 255]]];
  }

  /** Smoothly interpolated noise in [0, 1]. */
  noise(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = this.v(ix, iz), b = this.v(ix + 1, iz), c = this.v(ix, iz + 1), d = this.v(ix + 1, iz + 1);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
  }

  /** Fractal Brownian motion: octaves of noise, result in roughly [0, 1]. */
  fbm(x: number, z: number, octaves = 4): number {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }
}
