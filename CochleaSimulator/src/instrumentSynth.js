import { midiFreq } from './notes.js';

// Small synthesized voices for each instrument. What you play goes to the speakers and into the
// cochlea's input, so the cochlea responds to every note.
const MAX_VOICES = 28;

const partialsWave = (ctx, amps) => {
  const real = new Float32Array(amps.length + 1);
  const imag = new Float32Array(amps.length + 1);
  amps.forEach((a, i) => { imag[i + 1] = a; });
  return ctx.createPeriodicWave(real, imag);
};

// Each preset: the sound sources, a low-pass, an envelope; optional extras:
//   sweep   – filter starts brighter and settles (plucks)
//   drive   – overdrive + amp-like tone (electric guitar)
//   vibrato – delayed pitch wobble, body – resonance peaks (bowed strings)
const PRESETS = {
  piano: {
    wave: [1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04],
    oscs: [[1, 0], [1, 4]],
    cutoff: (f, v) => f * (3 + 6 * v) + 800,
    env: (m) => ({ attack: 0.006, peak: 0.18, sustain: 0.35, decay: 0.25 + 1.6 * Math.exp(-(m - 21) / 30), fade: true, hold: true }),
  },
  marimba: {
    sine: [[1, 1], [4, 0.22], [9.8, 0.05]],
    cutoff: (f) => f * 12 + 2000,
    env: (m) => ({ attack: 0.002, peak: 0.24, sustain: 0, decay: 0.12 + 0.55 * Math.exp(-(m - 45) / 22) }),
  },
  harp: {
    wave: [1, 0.6, 0.4, 0.28, 0.2, 0.14, 0.1, 0.07, 0.05, 0.03],
    oscs: [[1, 0]],
    cutoff: (f, v) => f * (4 + 5 * v) + 600,
    env: (m) => ({ attack: 0.003, peak: 0.2, sustain: 0, decay: 0.3 + 1.4 * Math.exp(-(m - 24) / 30) }),
  },
  organ: {
    wave: [1, 0.65, 0.35, 0.45, 0, 0.2, 0, 0.25],
    oscs: [[1, 0], [0.5, 0, 0.35]],
    cutoff: (f) => f * 10 + 3000,
    env: () => ({ attack: 0.035, peak: 0.12, sustain: 1, hold: true, release: 0.09 }),
  },
  bells: {
    sine: [[1, 1], [2.0, 0.5], [2.76, 0.42], [5.4, 0.22], [8.93, 0.1], [0.5, 0.25]],
    cutoff: (f) => f * 14 + 3000,
    env: () => ({ attack: 0.002, peak: 0.13, sustain: 0, decay: 2.4 }),
  },
  synth: {
    saw: [[1, -7], [1, 7], [0.5, 0, 0.35]],
    cutoff: (f, v) => f * (2.5 + 5 * v) + 400,
    q: 3,
    sweep: 2.2,
    env: () => ({ attack: 0.012, peak: 0.1, sustain: 0.7, decay: 0.35, hold: true, release: 0.28 }),
  },
  guitar: {
    wave: [1, 0.85, 0.62, 0.5, 0.38, 0.3, 0.22, 0.16, 0.11, 0.07, 0.05, 0.03],
    oscs: [[1, 0], [1, 3, 0.4]],
    cutoff: (f, v) => f * (2.5 + 3 * v) + 500,
    sweep: 3,
    env: (m) => ({ attack: 0.002, peak: 0.2, sustain: 0, decay: 0.45 + 1.8 * Math.exp(-(m - 40) / 20) }),
  },
  electric: {
    saw: [[1, -4], [1, 4], [2, 0, 0.25]],
    cutoff: () => 3600,
    q: 1.2,
    drive: 5,
    env: (m) => ({ attack: 0.004, peak: 0.09, sustain: 0.55, decay: 0.6 + Math.exp(-(m - 40) / 20), hold: true, release: 0.12 }),
  },
  violin: {
    saw: [[1, 0], [1, 5, 0.5]],
    cutoff: (f) => Math.min(9000, f * 9 + 1500),
    vibrato: { rate: 5.6, cents: 14, delay: 0.25 },
    body: [[480, 4, 6], [1100, 3, 4], [2900, 2, 5]],
    env: () => ({ attack: 0.09, peak: 0.075, sustain: 0.85, decay: 0.3, hold: true, release: 0.22 }),
  },
  cello: {
    saw: [[1, 0], [1, 4, 0.5]],
    cutoff: (f) => Math.min(6000, f * 10 + 900),
    vibrato: { rate: 5.0, cents: 12, delay: 0.3 },
    body: [[220, 3, 6], [600, 3, 4], [1600, 2, 3]],
    env: () => ({ attack: 0.12, peak: 0.1, sustain: 0.85, decay: 0.35, hold: true, release: 0.3 }),
  },
};

export class InstrumentSynth {
  // outputs: where played notes go (speakers and the cochlea's input)
  constructor(ctx, outputs) {
    this.ctx = ctx;
    this.waves = {};
    for (const [id, p] of Object.entries(PRESETS)) if (p.wave) this.waves[id] = partialsWave(ctx, p.wave);
    this.out = ctx.createGain();
    this.out.gain.value = 0.6;
    for (const t of outputs) this.out.connect(t);
    this.driveCurve = (() => {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
      return c;
    })();
    this.voices = new Map(); // midi -> voice
    this.preset = 'piano';
  }

  setPreset(id) {
    if (PRESETS[id]) this.preset = id;
  }

  setVolume(v) {
    this.out.gain.value = 0.65 * v;
  }

  noteOn(midi, velocity = 0.8) {
    const p = PRESETS[this.preset];
    this.noteOff(midi, 0.03);
    if (this.voices.size >= MAX_VOICES) this.noteOff(this.voices.keys().next().value, 0.03);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = midiFreq(midi);

    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(18000, p.cutoff(f, velocity));
    lp.Q.value = p.q ?? 0.4;
    let tail = lp;
    if (p.drive) {
      const pre = ctx.createGain();
      pre.gain.value = p.drive;
      const ws = ctx.createWaveShaper();
      ws.curve = this.driveCurve;
      ws.oversample = '2x';
      const cab = ctx.createBiquadFilter();
      cab.type = 'peaking';
      cab.frequency.value = 1800;
      cab.gain.value = 4;
      lp.connect(pre); pre.connect(ws); ws.connect(cab);
      tail = cab;
    }
    if (p.body) {
      for (const [freq, q, g] of p.body) {
        const pk = ctx.createBiquadFilter();
        pk.type = 'peaking';
        pk.frequency.value = freq;
        pk.Q.value = q;
        pk.gain.value = g;
        tail.connect(pk);
        tail = pk;
      }
    }
    tail.connect(gain);
    gain.connect(this.out);

    const oscs = [];
    const add = (o, level) => {
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g);
      g.connect(lp);
      o.start(t);
      oscs.push(o);
    };
    if (p.wave) {
      for (const [ratio, cents, level = 1] of p.oscs) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.waves[this.preset]);
        o.frequency.value = f * ratio;
        o.detune.value = cents;
        add(o, level);
      }
    }
    if (p.sine) {
      for (const [ratio, level] of p.sine) {
        if (f * ratio > 18000) continue;
        const o = ctx.createOscillator();
        o.frequency.value = f * ratio;
        add(o, level);
      }
    }
    if (p.saw) {
      for (const [ratio, cents, level = 1] of p.saw) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * ratio;
        o.detune.value = cents;
        add(o, level * 0.5);
      }
    }
    if (p.sweep) {
      lp.frequency.setValueAtTime(Math.min(18000, lp.frequency.value * p.sweep), t);
      lp.frequency.setTargetAtTime(lp.frequency.value, t, 0.12);
    }
    if (p.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = p.vibrato.rate;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(p.vibrato.cents, t + p.vibrato.delay + 0.3);
      lfo.connect(depth);
      for (const o of oscs) depth.connect(o.detune);
      lfo.start(t);
      oscs.push(lfo);
    }

    const e = p.env(midi);
    const peak = e.peak * (0.35 + 0.65 * velocity) * (midi > 88 ? 0.7 : 1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + e.attack);
    if (e.sustain >= 1) {
      // organ: holds until released
    } else if (e.sustain > 0) {
      gain.gain.setTargetAtTime(peak * e.sustain, t + e.attack, e.decay * 0.35);
      if (e.fade) gain.gain.setTargetAtTime(0, t + 0.3, e.decay * 1.4);
    } else {
      gain.gain.setTargetAtTime(0, t + e.attack, e.decay / 3);
    }
    const life = e.hold ? 60 : Math.min(10, e.decay * 5 + 0.5);
    for (const o of oscs) o.stop(t + life);
    this.voices.set(midi, { oscs, gain, release: e.release ?? 0.18, hold: !!e.hold });
  }

  // Release a note. Struck and plucked instruments ring on by themselves; held ones fade out.
  noteOff(midi, release) {
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    if (!v.hold && release === undefined) return;
    const r = release ?? v.release;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.setTargetAtTime(0, t, r / 3);
    for (const o of v.oscs) o.stop(t + r * 2 + 0.05);
  }

  allOff() {
    for (const m of [...this.voices.keys()]) this.noteOff(m, 0.1);
  }
}
