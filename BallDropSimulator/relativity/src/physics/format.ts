import { JULIAN_YEAR, gammaMinusOne, lorentzFactor } from './relativity';

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'years';

export const UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86_400,
  years: JULIAN_YEAR,
};

export const UNIT_SHORT: Record<TimeUnit, string> = {
  seconds: 's',
  minutes: 'min',
  hours: 'h',
  days: 'd',
  years: 'yr',
};

/** Pick the unit that reads naturally for an experiment of the given length. */
export function unitForDuration(seconds: number): TimeUnit {
  if (seconds < 120) return 'seconds';
  if (seconds < 2 * 3600) return 'minutes';
  if (seconds < 2 * 86_400) return 'hours';
  if (seconds < JULIAN_YEAR) return 'days';
  return 'years';
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** 4.291×10⁻¹⁵ style scientific notation. */
export function sci(x: number, digits = 3): string {
  if (x === 0) return '0';
  const [mant, exp] = x.toExponential(digits).split('e');
  const e = String(Number(exp));
  return `${mant}×10${[...e].map((ch) => SUPERSCRIPT[ch] ?? ch).join('')}`;
}

export function withThousands(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Velocity as a percentage of c, with enough digits for everyday speeds. */
export function formatPercentC(beta: number): string {
  if (beta === 0) return '0%';
  const pct = beta * 100;
  if (pct < 0.01) return `${sci(pct, 3)}%`;
  if (pct >= 99.5) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

/** γ, written as 1 + ε when it is too close to 1 to show as a decimal. */
export function formatGamma(beta: number, decimals = 4): string {
  const gm1 = gammaMinusOne(beta);
  if (gm1 === 0) return '1';
  if (gm1 < 1e-4) return `1 + ${sci(gm1, 3)}`;
  return lorentzFactor(beta).toFixed(decimals);
}

/** A value in the experiment's unit, e.g. "6.0000". */
export function formatInUnit(seconds: number, unit: TimeUnit, decimals = 4): string {
  return withThousands(seconds / UNIT_SECONDS[unit], decimals);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** "6 y 000 d 00:00:00" breakdown in Julian years. */
export function formatBreakdown(seconds: number): string {
  let s = Math.max(0, seconds);
  const y = Math.floor(s / JULIAN_YEAR);
  s -= y * JULIAN_YEAR;
  const d = Math.floor(s / 86_400);
  s -= d * 86_400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const sec = Math.floor(s);
  const parts = [];
  if (y > 0) parts.push(`${y} y`);
  if (y > 0 || d > 0) parts.push(`${pad(d, 3)} d`);
  parts.push(`${pad(h)}:${pad(m)}:${pad(sec)}`);
  return parts.join(' ');
}

/** A small or large duration with a fitting unit: ns, µs, ms, s, min, h, d, yr. */
export function formatAdaptiveDuration(seconds: number, sig = 4): string {
  const a = Math.abs(seconds);
  if (a === 0) return '0 s';
  const fmt = (v: number, unit: string) => `${Number(v.toPrecision(sig)).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${unit}`;
  if (a < 1e-6) return fmt(seconds * 1e9, 'ns');
  if (a < 1e-3) return fmt(seconds * 1e6, 'µs');
  if (a < 1) return fmt(seconds * 1e3, 'ms');
  if (a < 120) return fmt(seconds, 's');
  if (a < 7200) return fmt(seconds / 60, 'min');
  if (a < 2 * 86_400) return fmt(seconds / 3600, 'h');
  if (a < JULIAN_YEAR) return fmt(seconds / 86_400, 'days');
  return fmt(seconds / JULIAN_YEAR, 'years');
}

/** Distance in light-years, or in km when that reads better. */
export function formatDistance(lightYears: number, metres: number): string {
  if (metres === 0) return '0 km';
  if (lightYears < 0.001) {
    const km = metres / 1000;
    if (km < 1e9) return `${withThousands(km, km < 100 ? 2 : 0)} km`;
    return `${sci(km, 3)} km`;
  }
  return `${lightYears.toFixed(lightYears < 10 ? 4 : 3)} ly`;
}

/**
 * Earth and ship readings in seconds to 9 decimals (nanoseconds), exact enough to show a
 * difference of a few nanoseconds on clocks reading tens of millions of seconds. Float64
 * cannot hold 3×10¹⁶ ns exactly, so the subtraction is done in BigInt nanoseconds.
 */
export function preciseClockPair(earthSeconds: number, differenceSeconds: number): { earth: string; ship: string } {
  const whole = Math.floor(earthSeconds);
  const fracNs = Math.round((earthSeconds - whole) * 1e9);
  const earthNs = BigInt(whole) * 1_000_000_000n + BigInt(fracNs);
  const diffNs = BigInt(Math.round(differenceSeconds * 1e9));
  const toStr = (ns: bigint) => {
    const s = ns / 1_000_000_000n;
    const f = ns % 1_000_000_000n;
    return `${Number(s).toLocaleString('en-US')}.${f.toString().padStart(9, '0')} s`;
  };
  return { earth: toStr(earthNs), ship: toStr(earthNs - diffNs) };
}
