/**
 * Deterministic pseudo-random numbers (sfc32). Every random decision in the simulation
 * draws from one seeded stream in a fixed order, so the same seed and inputs reproduce
 * the same run exactly. Rendering never touches this stream.
 */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;

  constructor(seed: number) {
    // Spread the seed over the 128-bit state with splitmix32.
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }

  range(lo: number, hi: number): number { return lo + (hi - lo) * this.next(); }
  int(lo: number, hiInclusive: number): number { return lo + Math.floor(this.next() * (hiInclusive - lo + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  /** Roughly normal, mean 0, sd 1 (sum of uniforms). */
  gauss(): number { return this.next() + this.next() + this.next() + this.next() - 2; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

export const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);
