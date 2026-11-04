// Real-time port of the `coch_rebuild` bake script from EarProject.blend.
// Same stages, but streaming instead of whole-song:
//   FFT power -> ERB-wide gaussian filter per hair cell -> dB -> adaptive range
//   -> attack/release envelope -> slow adaptation -> spring-damper (visible motion)

const ABS_FLOOR_DB = -100; // below this a band is treated as silence
const TOP_DECAY_DB_PER_S = 0.8; // how fast a band's "loudest recent" level relaxes
const TOP_RISE_TAU = 0.08;

const ATTACK_TAU = 0.025;
const RELEASE_TAU = 0.16;
const SLOW_TAU = 2.5;
const ADAPT = 0.45;
const AD_PEAK_TAU = 6.0;

const RELATIVE_RANGE_DB = 30; // places this far below the loudest one respond at the minimum (20%)

const SPRING_W = 2 * Math.PI * 5.0;
const SPRING_Z = 0.42;

export class CochleaModel {
  constructor(cells) {
    const N = (this.N = cells.length);
    this.freqs = Float32Array.from(cells, (c) => c.f);
    this.places = Float32Array.from(cells, (c) => c.p);

    this.db = new Float32Array(N);
    this.top = new Float32Array(N).fill(ABS_FLOOR_DB);
    this.env = new Float32Array(N);
    this.slow = new Float32Array(N);
    this.adPeak = new Float32Array(N).fill(0.25);
    this.drive = new Float32Array(N); // adapted, normalised input to the spring (0..1)
    this.pos = new Float32Array(N); // spring position = hair-bundle deflection S
    this.vel = new Float32Array(N);
    this.vv = new Float32Array(N); // display activity 0..1 (membrane / colour)

    this.filters = null;
    this.power = null;
  }

  // Build one gaussian filter per hair cell, 0.8 x ERB wide, centred on its best frequency.
  configure(sampleRate, fftSize) {
    const nb = fftSize / 2;
    const binHz = sampleRate / fftSize;
    this.power = new Float32Array(nb);
    this.filters = Array.from(this.freqs, (cf) => {
      const sd = 0.8 * 24.7 * ((4.37 * cf) / 1000 + 1);
      const lo = Math.max(1, Math.floor((cf - 4 * sd) / binHz));
      const hi = Math.min(nb - 1, Math.ceil((cf + 4 * sd) / binHz));
      const w = new Float32Array(Math.max(1, hi - lo + 1));
      let sum = 0;
      for (let k = 0; k < w.length; k++) {
        const f = (lo + k) * binHz;
        w[k] = Math.exp(-0.5 * ((f - cf) / sd) ** 2);
        sum += w[k];
      }
      for (let k = 0; k < w.length; k++) w[k] /= sum || 1;
      return { lo, w };
    });
  }

  // `power` must already hold linear power per FFT bin (or zeros for silence).
  step(dt) {
    const { N, filters, power, db, top, env, slow, adPeak, drive, pos, vel, vv } = this;
    if (!filters) return;

    let g = ABS_FLOOR_DB;
    const rise = 1 - Math.exp(-dt / TOP_RISE_TAU);
    for (let i = 0; i < N; i++) {
      const { lo, w } = filters[i];
      let e = 0;
      for (let k = 0; k < w.length; k++) e += w[k] * power[lo + k];
      const d = (db[i] = 10 * Math.log10(e + 1e-14));
      if (d > top[i]) top[i] += (d - top[i]) * rise;
      else top[i] = Math.max(ABS_FLOOR_DB, top[i] - TOP_DECAY_DB_PER_S * dt);
      if (top[i] > g) g = top[i];
    }

    const aa = 1 - Math.exp(-dt / ATTACK_TAU);
    const ar = 1 - Math.exp(-dt / RELEASE_TAU);
    const as = 1 - Math.exp(-dt / SLOW_TAU);
    const ap = 1 - Math.exp(-dt / AD_PEAK_TAU);
    // loudest place right now: much quieter places (e.g. a note's overtones) respond more weakly
    let gNow = ABS_FLOOR_DB;
    for (let i = 0; i < N; i++) if (db[i] > gNow) gNow = db[i];
    for (let i = 0; i < N; i++) {
      const floor = Math.max(top[i] - 30, g - 80, ABS_FLOOR_DB);
      let v = (db[i] - floor) / Math.max(top[i] - floor, 1);
      v = v <= 0 ? 0 : v >= 1 ? 1 : v ** 1.4;

      env[i] += (v - env[i]) * (v > env[i] ? aa : ar);
      slow[i] += (env[i] - slow[i]) * as;

      let ad = env[i] - ADAPT * slow[i];
      ad = ad < 0 ? 0 : ad > 1 ? 1 : ad;
      adPeak[i] = ad > adPeak[i] ? ad : adPeak[i] + (ad - adPeak[i]) * ap;
      const rel = Math.min(Math.max(1 - (gNow - db[i]) / RELATIVE_RANGE_DB, 0), 1);
      drive[i] = Math.min(ad / Math.max(adPeak[i], 0.25), 1) * (0.2 + 0.8 * rel);
    }

    const sub = Math.max(1, Math.ceil(dt * 240));
    const h = dt / sub;
    const w2 = SPRING_W * SPRING_W;
    const damp = 2 * SPRING_Z * SPRING_W;
    for (let i = 0; i < N; i++) {
      let p = pos[i], u = vel[i];
      for (let s = 0; s < sub; s++) {
        u += (w2 * (drive[i] - p) - damp * u) * h;
        p += u * h;
      }
      pos[i] = p;
      vel[i] = u;
      vv[i] = Math.min(Math.max(p, 0), 1.3) / 1.3;
    }
  }
}
