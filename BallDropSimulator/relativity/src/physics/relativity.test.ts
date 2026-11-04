import { describe, expect, it } from 'vitest';
import {
  C, JULIAN_YEAR, BETA_MAX, lorentzFactor, properTime, timeDifference, gammaMinusOne,
  distanceLightYears, betaFromKmPerHour, earthReadingSimultaneousInShipFrame, simultaneityGap,
  lightClockLeg, speedKmPerSecond,
} from './relativity';
import { formatGamma, formatPercentC, preciseClockPair, unitForDuration, formatAdaptiveDuration } from './format';
import { SimEngine, BASE_RATE } from '../sim/engine';

const YEARS = (y: number) => y * JULIAN_YEAR;

describe('time dilation at 80% of c (the reference example)', () => {
  const beta = 0.8;
  it('γ ≈ 1.667', () => {
    expect(lorentzFactor(beta)).toBeCloseTo(5 / 3, 12);
  });
  it('10 Earth years → 6 ship years, a 4-year difference', () => {
    expect(properTime(YEARS(10), beta) / JULIAN_YEAR).toBeCloseTo(6, 12);
    expect(timeDifference(YEARS(10), beta) / JULIAN_YEAR).toBeCloseTo(4, 12);
  });
  it('covers 8 light-years in Earth’s frame', () => {
    expect(distanceLightYears(YEARS(10), beta)).toBeCloseTo(8, 12);
  });
});

describe('near light speed', () => {
  it('99% of c over 50 Earth years gives about 7.05 ship years', () => {
    expect(properTime(YEARS(50), 0.99) / JULIAN_YEAR).toBeCloseTo(50 * Math.sqrt(1 - 0.99 ** 2), 10);
    expect(lorentzFactor(0.99)).toBeCloseTo(7.0888, 4);
  });
  it('the slider maximum stays below c', () => {
    expect(BETA_MAX).toBeLessThan(1);
    expect(lorentzFactor(BETA_MAX)).toBeCloseTo(22.366, 3);
  });
  it('refuses β ≥ 1', () => {
    expect(() => lorentzFactor(1)).toThrow(RangeError);
    expect(() => lorentzFactor(1.2)).toThrow(RangeError);
  });
});

describe('everyday speeds keep their digits', () => {
  const beta = betaFromKmPerHour(100);
  it('γ − 1 matches β²/2 to leading order', () => {
    expect(gammaMinusOne(beta) / (beta * beta / 2)).toBeCloseTo(1, 9);
    expect(gammaMinusOne(beta)).toBeGreaterThan(4e-15);
  });
  it('one year at 100 km/h loses about 135 ns', () => {
    const d = timeDifference(YEARS(1), beta);
    expect(d * 1e9).toBeCloseTo(135.4, 0);
  });
  it('the precise readout shows the nanosecond difference', () => {
    const d = timeDifference(YEARS(1), beta);
    const p = preciseClockPair(YEARS(1), d);
    expect(p.earth).toBe('31,557,600.000000000 s');
    expect(p.ship).toMatch(/^31,557,599\.99999986\d s$/);
  });
  it('formats', () => {
    expect(formatGamma(beta)).toMatch(/^1 \+ 4\.29\d×10⁻¹⁵$/);
    expect(formatPercentC(beta)).toMatch(/×10⁻⁶%$/);
    expect(formatAdaptiveDuration(135.4e-9)).toBe('135.4 ns');
  });
});

describe('ship frame symmetry and simultaneity', () => {
  it('Earth’s clock runs slow in the ship frame by the same γ', () => {
    const tau = YEARS(6);
    expect(earthReadingSimultaneousInShipFrame(tau, 0.8) / JULIAN_YEAR).toBeCloseTo(3.6, 12);
  });
  it('the two frames’ Earth readings differ by γβ²τ', () => {
    const tau = YEARS(6), beta = 0.8;
    const earthFrame = lorentzFactor(beta) * tau;          // 10 years
    const shipFrame = earthReadingSimultaneousInShipFrame(tau, beta); // 3.6 years
    expect((earthFrame - shipFrame) / JULIAN_YEAR).toBeCloseTo(simultaneityGap(tau, beta) / JULIAN_YEAR, 12);
  });
});

describe('light clock', () => {
  it('each leg is γL long and the vertical separation is unchanged', () => {
    const leg = lightClockLeg(0.6, 1);
    expect(leg.pathLength).toBeCloseTo(1.25, 12);
    expect(leg.horizontalShift).toBeCloseTo(0.75, 12);
    expect(leg.verticalSeparation).toBe(1);
    // Photon covers the hypotenuse at c: √(shift² + L²) = γL.
    expect(Math.hypot(leg.horizontalShift, leg.verticalSeparation)).toBeCloseTo(leg.pathLength, 12);
  });
});

describe('units and helpers', () => {
  it('speed of light constant and km/s', () => {
    expect(C).toBe(299_792_458);
    expect(speedKmPerSecond(0.8)).toBeCloseTo(239_833.9664, 4);
  });
  it('unit choice follows the experiment length', () => {
    expect(unitForDuration(86_400)).toBe('hours');
    expect(unitForDuration(30 * 86_400)).toBe('days');
    expect(unitForDuration(YEARS(10))).toBe('years');
  });
});

describe('simulation engine', () => {
  it('stops exactly at the chosen duration and reproduces 10 → 6 years', () => {
    const e = new SimEngine({ autoStart: false });
    e.setDurationYears(10);
    e.setBeta(0.8);
    e.setSpeed(1000);
    e.play();
    // Feed large uneven frame deltas; elapsed time must depend on time, not frame count.
    for (let i = 0; i < 400; i++) e.step(0.05 + (i % 3) * 0.01);
    expect(e.running).toBe(false);
    expect(e.finished).toBe(true);
    expect(e.earthTime).toBe(YEARS(10));
    expect(properTime(e.earthTime, e.beta) / JULIAN_YEAR).toBeCloseTo(6, 12);
  });
  it('advances by real delta time × speed × base rate', () => {
    const e = new SimEngine({ autoStart: false });
    e.setDurationYears(50);
    e.setSpeed(10);
    e.play();
    e.step(0.5);
    expect(e.earthTime).toBeCloseTo(0.5 * 10 * BASE_RATE, 9);
  });
  it('changing velocity restarts the experiment', () => {
    const e = new SimEngine({ autoStart: false });
    e.play();
    e.step(0.5);
    expect(e.earthTime).toBeGreaterThan(0);
    e.setBeta(0.5);
    expect(e.earthTime).toBe(0);
  });
  it('in the ship frame the ship clock advances at the chosen rate', () => {
    const e = new SimEngine({ autoStart: false });
    e.setBeta(0.8);
    e.setFrame('ship');
    e.setSpeed(1);
    e.play();
    e.step(1);
    expect(properTime(e.earthTime, 0.8)).toBeCloseTo(BASE_RATE, 6);
  });
});
