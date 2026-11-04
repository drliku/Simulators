import { describe, expect, it } from 'vitest';
import {
  C, addVelocities, contractedLength, legSpeeds, lorentzFactor, makeTrip, photonInTrain, photonOnTrack, toTrain,
} from './mirror';
import { MirrorEngine, PRESETS, TRIP_PLAYBACK_SECONDS } from '../sim/engine';

const BETAS = [0, 0.25, 0.5, 0.8, 0.95, 0.99, 0.999];

describe('mirror in front (light parallel to the motion)', () => {
  for (const beta of BETAS) {
    const trip = makeTrip(beta, 2, 'front');
    const g = lorentzFactor(beta);
    it(`β = ${beta}: train round trip 2L₀/c, track round trip γ·2L₀/c`, () => {
      expect(trip.trainRoundTrip).toBeCloseTo((2 * 2) / C, 20);
      expect(trip.trackRoundTrip / ((g * 2 * 2) / C)).toBeCloseTo(1, 12);
    });
    it(`β = ${beta}: light moves at c on both legs in both frames`, () => {
      for (const s of [...legSpeeds(trip.train), ...legSpeeds(trip.track)]) expect(s / C).toBeCloseTo(1, 12);
    });
    it(`β = ${beta}: track-frame legs are γ(1+β)L₀/c out and γ(1−β)L₀/c back`, () => {
      const out = trip.track[1].t - trip.track[0].t;
      const back = trip.track[2].t - trip.track[1].t;
      expect(out / ((g * (1 + beta) * 2) / C)).toBeCloseTo(1, 12);
      if (beta < 0.999) expect(back / ((g * (1 - beta) * 2) / C)).toBeCloseTo(1, 9);
    });
    it(`β = ${beta}: the photon meets the moving mirror and the moving passenger`, () => {
      const v = beta * C;
      const [, refl, ret] = trip.track;
      // Mirror worldline in the track frame: x = v t + L₀/γ (contracted separation).
      expect(refl.x / (v * refl.t + 2 / g)).toBeCloseTo(1, 12);
      // Passenger's eye: x = v t.
      expect(ret.x - v * ret.t).toBeCloseTo(0, 6);
    });
    it(`β = ${beta}: transforming back recovers the train-frame events`, () => {
      trip.track.forEach((e, i) => {
        const back = toTrain(beta, e);
        expect(back.t).toBeCloseTo(trip.train[i].t, 20);
        expect(back.x).toBeCloseTo(trip.train[i].x, 9);
      });
    });
  }
});

describe('mirror above (light clock)', () => {
  it('diagonal legs, still at c, and the same γ·2L₀/c total', () => {
    const beta = 0.8, trip = makeTrip(beta, 1.5, 'above');
    const g = lorentzFactor(beta);
    expect(trip.track[1].x).toBeCloseTo(g * beta * 1.5, 12);
    expect(trip.track[1].y).toBe(1.5);
    for (const s of legSpeeds(trip.track)) expect(s / C).toBeCloseTo(1, 12);
    expect(trip.trackRoundTrip / ((g * 3) / C)).toBeCloseTo(1, 12);
  });
});

describe('photon state along the path', () => {
  it('is halfway to the mirror at a quarter of the train round trip', () => {
    const trip = makeTrip(0.9, 2, 'front');
    const p = photonInTrain(trip, trip.trainRoundTrip / 4);
    expect(p.leg).toBe('outbound');
    expect(p.x).toBeCloseTo(1, 12);
  });
  it('arrives back at the eye on the track at x = vt', () => {
    const trip = makeTrip(0.9, 2, 'front');
    const p = photonOnTrack(trip, trip.trackRoundTrip);
    expect(p.leg).toBe('arrived');
    expect(p.x).toBeCloseTo(0.9 * C * trip.trackRoundTrip, 6);
  });
});

describe('kinematics helpers', () => {
  it('light emitted at c in the train is seen at c from the track', () => {
    for (const b of BETAS) expect(addVelocities(b, C) / C).toBeCloseTo(1, 12);
    expect(addVelocities(0.5, -C) / C).toBeCloseTo(-1, 12);
  });
  it('a 160 m train at 0.8c measures 96 m from the track', () => {
    expect(contractedLength(160, 0.8)).toBeCloseTo(96, 9);
  });
  it('never reaches c', () => {
    expect(() => lorentzFactor(1)).toThrow(RangeError);
  });
});

describe('engine', () => {
  it('plays one trip over a fixed real duration and loops', () => {
    const e = new MirrorEngine();
    e.setBeta(0.999);
    for (let i = 0; i < TRIP_PLAYBACK_SECONDS * 20; i++) e.step(0.05);
    expect(e.t).toBe(e.trip.trackRoundTrip);
    expect(e.tPrime / e.trip.trainRoundTrip).toBeCloseTo(1, 12);
    for (let i = 0; i < 40; i++) e.step(0.05);
    expect(e.t).toBeLessThan(e.trip.trackRoundTrip);
  });
  it('slow motion changes playback only', () => {
    const a = new MirrorEngine(), b = new MirrorEngine();
    b.setSlow(true);
    a.step(0.5); b.step(0.5);
    expect(b.t / a.t).toBeCloseTo(0.15, 9);
    expect(a.trip.trackRoundTrip).toBe(b.trip.trackRoundTrip);
  });
  it('experiment 1 walks through every preset, one trip each', () => {
    const e = new MirrorEngine();
    e.startAcceleration();
    const seen = new Set<number>();
    for (let i = 0; i < 4000 && e.accelerating !== null; i++) { seen.add(e.beta); e.step(0.05); }
    expect([...seen].map((b) => Math.round(b * 1000) / 10)).toEqual(PRESETS.map((p) => p.pct));
  });
  it('stepping pauses and moves a fixed fraction of the trip', () => {
    const e = new MirrorEngine();
    e.stepFrame(1);
    expect(e.playing).toBe(false);
    expect(e.progress).toBeCloseTo(1 / 48, 12);
  });
});
