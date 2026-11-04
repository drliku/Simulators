/**
 * Dynamic weather: a seasonal Markov chain of weather spells with smoothly blended intensities.
 *
 * Weather has its own random stream (derived from the seed), so turning it on or off never
 * changes which random numbers the animals draw. A run is still fully reproducible.
 *
 * Ecological effects (all modest):
 * - Rain and storms water the plants (faster growth) and let deer drink from puddles.
 * - Fog, rain and snow shorten how far animals can see or smell.
 * - Snow and storms slow movement; snow stops plant growth and makes deer easier to catch.
 */
import type { Params } from './params';
import { Rng } from './rng';
import { TICKS_PER_DAY, YEAR_DAYS } from './world';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: 'Clear', cloudy: 'Overcast', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog', snow: 'Snow',
};
export const WEATHER_ICON: Record<WeatherKind, string> = {
  clear: '☀', cloudy: '☁', rain: '🌧', storm: '⛈', fog: '🌫', snow: '❄',
};

/** Blended weather amounts (0–1), eased toward the current spell's targets. */
export interface WeatherMix { cloud: number; rain: number; storm: number; fog: number; snow: number; wind: number }

const TARGET: Record<WeatherKind, WeatherMix> = {
  clear: { cloud: 0.05, rain: 0, storm: 0, fog: 0, snow: 0, wind: 0.2 },
  cloudy: { cloud: 0.6, rain: 0, storm: 0, fog: 0, snow: 0, wind: 0.35 },
  rain: { cloud: 0.85, rain: 0.75, storm: 0, fog: 0.15, snow: 0, wind: 0.45 },
  storm: { cloud: 1, rain: 1, storm: 1, fog: 0.1, snow: 0, wind: 1 },
  fog: { cloud: 0.5, rain: 0, storm: 0, fog: 1, snow: 0, wind: 0.05 },
  snow: { cloud: 0.8, rain: 0, storm: 0, fog: 0.25, snow: 1, wind: 0.4 },
};

/** Fraction of the year (0 = start of spring) that counts as cold enough for snow. */
function coldness(day: number) {
  const f = (((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) / YEAR_DAYS;
  // Coldest at f = 0.75 (mid-winter), zero from mid-spring to mid-autumn.
  return Math.max(0, Math.cos(2 * Math.PI * (f - 0.75)) * 1.6 - 0.6);
}

export class Weather {
  kind: WeatherKind = 'clear';
  mix: WeatherMix = { ...TARGET.clear };
  /** Wind direction in radians (drifts slowly). */
  windDir = 0;
  private ticksLeft = 0;
  private rng: Rng;

  constructor(seed: number) {
    this.rng = new Rng((seed ^ 0x5eed_beef) >>> 0);
    this.windDir = this.rng.range(-Math.PI, Math.PI);
    this.ticksLeft = Math.round(this.rng.range(0.6, 1.4) * TICKS_PER_DAY);
  }

  /** Advance one tick. Returns the new kind when a new spell begins, else null. */
  step(day: number, p: Params): WeatherKind | null {
    let changed: WeatherKind | null = null;
    if (p.weather <= 0) {
      if (this.kind !== 'clear') { this.kind = 'clear'; changed = 'clear'; }
    } else if (--this.ticksLeft <= 0) {
      const next = this.pick(day, p);
      if (next !== this.kind) changed = next;
      this.kind = next;
      const len = next === 'storm' ? 0.25 : next === 'fog' ? 0.35 : next === 'clear' ? 1.2 : 0.7;
      this.ticksLeft = Math.max(20, Math.round(len * this.rng.range(0.5, 1.6) * TICKS_PER_DAY));
    }
    // Ease toward the targets (about a fifth of a day to settle), scaled by the weather slider.
    const t = TARGET[this.kind];
    const k = 1 / (TICKS_PER_DAY * 0.06);
    const s = Math.min(1, p.weather / 0.6);
    for (const key of Object.keys(t) as (keyof WeatherMix)[]) this.mix[key] += (t[key] * s - this.mix[key]) * k;
    this.windDir += (this.rng.next() - 0.5) * 0.004;
    return changed;
  }

  private pick(day: number, p: Params): WeatherKind {
    const cold = coldness(day) * p.seasonality / 0.35;
    const wet = Math.max(0.05, (1 - 0.8 * p.drought)) * (0.4 + p.weather);
    const w: [WeatherKind, number][] = [
      ['clear', 3.2 * (1 + p.drought)],
      ['cloudy', 2.2],
      ['rain', 2.0 * wet * Math.max(0, 1 - cold)],
      ['storm', 0.7 * wet * Math.max(0, 1 - cold) * (this.kind === 'rain' || this.kind === 'cloudy' ? 1.8 : 0.6)],
      ['fog', 0.9 * (this.kind === 'rain' ? 1.6 : 1)],
      ['snow', 2.4 * wet * Math.min(1, cold)],
    ];
    let total = 0;
    for (const [, x] of w) total += x;
    let r = this.rng.next() * total;
    for (const [k, x] of w) { r -= x; if (r <= 0) return k; }
    return 'clear';
  }

  // ---- ecological effects

  /** Multiplier on sight and smell ranges. */
  get visibility() { const m = this.mix; return 1 - 0.4 * m.fog - 0.2 * m.rain - 0.15 * m.snow; }
  /** Multiplier on movement speed. */
  get mobility() { const m = this.mix; return 1 - 0.12 * m.snow - 0.08 * m.storm; }
  /** Multiplier on plant growth. */
  get growth() { const m = this.mix; return (1 + 0.6 * m.rain) * (1 - 0.8 * m.snow); }
  /** Multiplier on deer water loss (puddles and wet grass). */
  get thirst() { return 1 - 0.6 * this.mix.rain; }
  /** Multiplier on wolves' capture chance (deer flounder in snow). */
  get capture() { return 1 + 0.3 * this.mix.snow; }
}
