/**
 * Simplified educational acid–base model (ideal dilute aqueous solution, 25 °C).
 *
 * A solution is described by its volume and its net amount of strong acid:
 *   netAcid = n(H⁺ from strong acid) − n(OH⁻ from strong base)   [mol]
 * Positive = excess strong acid, negative = excess strong base.
 *
 * With C = netAcid / V, charge balance plus the water equilibrium give
 *   [H⁺] − [OH⁻] = C,   [H⁺][OH⁻] = Kw = 1.0 × 10⁻¹⁴
 *   ⇒ [H⁺] = (C + √(C² + 4Kw)) / 2
 * so pure water is exactly pH 7 and any dilution moves the pH toward 7.
 */

export const KW = 1e-14;
export const PKW = 14;

export interface Solution {
  /** Volume in litres. */
  volume: number;
  /** Net strong-acid amount in moles (negative for excess base). */
  netAcid: number;
}

export function hydrogenConcentration(s: Solution): number {
  const c = s.netAcid / s.volume;
  // Numerically stable form of (c + √(c² + 4Kw)) / 2 for large negative c.
  const root = Math.sqrt(c * c + 4 * KW);
  return c >= 0 ? (c + root) / 2 : (2 * KW) / (root - c);
}

export function phOf(s: Solution): number {
  return -Math.log10(hydrogenConcentration(s));
}

/** Net strong-acid concentration (mol/L) that gives exactly this pH. */
export function netConcentrationForPh(ph: number): number {
  return Math.pow(10, -ph) - Math.pow(10, ph - PKW);
}

export function solutionWithPh(ph: number, volume: number): Solution {
  return { volume, netAcid: netConcentrationForPh(ph) * volume };
}

export interface Reading {
  ph: number;
  poh: number;
  h: number;
  oh: number;
}

export function readingForPh(ph: number): Reading {
  return { ph, poh: PKW - ph, h: Math.pow(10, -ph), oh: Math.pow(10, ph - PKW) };
}

export function reading(s: Solution): Reading {
  return readingForPh(phOf(s));
}

/** Add `volumeL` of a strong acid (+) or strong base (−) of molarity `molarity`. */
export function addReagent(s: Solution, kind: 'acid' | 'base', molarity: number, volumeL: number): Solution {
  const n = molarity * volumeL * (kind === 'acid' ? 1 : -1);
  return { volume: s.volume + volumeL, netAcid: s.netAcid + n };
}

export function addWater(s: Solution, volumeL: number): Solution {
  return { volume: s.volume + volumeL, netAcid: s.netAcid };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type Kind = 'acidic' | 'neutral' | 'basic';

/** Neutral when the pH rounds to 7.00. */
export function classify(ph: number): Kind {
  const r = Math.round(ph * 100) / 100;
  return r < 7 ? 'acidic' : r > 7 ? 'basic' : 'neutral';
}

export type Band = 'Strong acid' | 'Weak acid' | 'Neutral' | 'Weak base' | 'Strong base';

export const BANDS: { band: Band; from: number; to: number }[] = [
  { band: 'Strong acid', from: 0, to: 3 },
  { band: 'Weak acid', from: 3, to: 6.5 },
  { band: 'Neutral', from: 6.5, to: 7.5 },
  { band: 'Weak base', from: 7.5, to: 11 },
  { band: 'Strong base', from: 11, to: 14 },
];

export function bandOf(ph: number): Band {
  const r = Math.round(ph * 100) / 100;
  if (r === 7) return 'Neutral';
  return (BANDS.find((b) => r >= b.from && r < b.to) ?? BANDS[BANDS.length - 1]).band;
}

export function explain(ph: number): string {
  const r = Math.round(ph * 100) / 100;
  const factor = Math.pow(10, Math.abs(7 - r));
  const times = formatFactor(factor);
  if (r === 7) return 'Neutral: hydrogen and hydroxide ions are balanced, [H⁺] = [OH⁻] = 1.0 × 10⁻⁷ mol/L, like pure water at 25 °C.';
  if (r < 3) return `Strongly acidic: [H⁺] is about ${times} times higher than in pure water. Solutions like this can be corrosive.`;
  if (r < 6.5) return `Weakly to moderately acidic: [H⁺] is about ${times} times higher than in pure water — the range of many foods and drinks.`;
  if (r < 7) return `Slightly acidic: [H⁺] is about ${times} times higher than in pure water.`;
  if (r <= 7.5) return `Slightly basic: [OH⁻] is about ${times} times higher than in pure water.`;
  if (r < 11) return `Weakly to moderately basic (alkaline): [OH⁻] is about ${times} times higher than in pure water, as in many cleaners.`;
  return `Strongly basic (alkaline): [OH⁻] is about ${times} times higher than in pure water. Solutions like this can be caustic.`;
}

export function formatFactor(f: number): string {
  if (f < 10) return f.toFixed(1);
  if (f < 1e6) return Math.round(f).toLocaleString('en-US');
  return formatSci(f, 1).replace(' mol/L', '');
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const sup = (s: string) => s.split('').map((c) => SUP[c] ?? c).join('');

/** 3.2e-5 → "3.2 × 10⁻⁵" */
export function formatSci(x: number, digits = 1): string {
  if (x === 0) return '0';
  let exp = Math.floor(Math.log10(x));
  let mant = x / Math.pow(10, exp);
  if (Number(mant.toFixed(digits)) >= 10) {
    mant /= 10;
    exp += 1;
  }
  return `${mant.toFixed(digits)} × 10${sup(String(exp))}`;
}

// ---------------------------------------------------------------------------
// Substances (approximate typical pH values)
// ---------------------------------------------------------------------------

export interface Substance {
  id: string;
  name: string;
  ph: number;
  note: string;
}

export const SUBSTANCES: Substance[] = [
  { id: 'lemon', name: 'Lemon juice', ph: 2, note: 'Contains citric acid.' },
  { id: 'vinegar', name: 'Vinegar', ph: 3, note: 'Contains acetic acid.' },
  { id: 'coffee', name: 'Coffee', ph: 5, note: 'Mildly acidic.' },
  { id: 'water', name: 'Pure water', ph: 7, note: 'Neutral at 25 °C.' },
  { id: 'baking-soda', name: 'Baking soda solution', ph: 8.3, note: 'Sodium bicarbonate in water.' },
  { id: 'soap', name: 'Soapy water', ph: 10, note: 'Mildly alkaline.' },
  { id: 'bleach', name: 'Household bleach', ph: 12.5, note: 'Strongly alkaline.' },
];

// ---------------------------------------------------------------------------
// Universal indicator colours
// ---------------------------------------------------------------------------

/** Typical universal-indicator colour chart, one stop per whole pH unit. */
export const INDICATOR_STOPS = [
  '#d7191c', // 0
  '#e8401c', // 1
  '#f26522', // 2
  '#f7941d', // 3
  '#fbb817', // 4
  '#f4e01d', // 5
  '#b8d433', // 6
  '#4cb848', // 7
  '#1fa36b', // 8
  '#16a0a0', // 9
  '#2479c1', // 10
  '#3a4fa6', // 11
  '#5a3a99', // 12
  '#6c2c8e', // 13
  '#521b6e', // 14
];

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Indicator colour for a pH, interpolated in linear light. Returns sRGB components 0–1. */
export function indicatorRgb(ph: number): [number, number, number] {
  const p = Math.min(14, Math.max(0, ph));
  const i = Math.min(13, Math.floor(p));
  const t = p - i;
  const a = hexToRgb(INDICATOR_STOPS[i]).map(toLinear);
  const b = hexToRgb(INDICATOR_STOPS[i + 1]).map(toLinear);
  return a.map((v, k) => toSrgb(v + (b[k] - v) * t)) as [number, number, number];
}

export function indicatorCss(ph: number): string {
  const [r, g, b] = indicatorRgb(ph);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export const INDICATOR_GRADIENT = `linear-gradient(90deg, ${INDICATOR_STOPS.map((c, i) => `${c} ${(i / 14) * 100}%`).join(', ')})`;
