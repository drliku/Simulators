import { elementByZ, ISOTOPE_NAMES } from './elements';
import type { ElementData } from './elements';

export interface AtomCounts {
  protons: number;
  neutrons: number;
  electrons: number;
}

export const MAX_NEUTRONS = 60;
/** Most negative ion the builder allows: Z + 3 electrons (e.g. N³⁻). */
export const EXTRA_ELECTRONS = 3;
export const maxElectrons = (protons: number) => protons + EXTRA_ELECTRONS;

export const SHELL_LETTERS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

// ---------------------------------------------------------------------------
// Electron configuration
// ---------------------------------------------------------------------------

export interface Subshell {
  n: number;
  l: number; // 0 s, 1 p, 2 d, 3 f
  count: number;
}

const L_LETTER = ['s', 'p', 'd', 'f'];
const capacity = (l: number) => 2 * (2 * l + 1);

/** Aufbau (Madelung) filling order, enough for 39 electrons and more. */
const AUFBAU: [number, number][] = [
  [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1], [5, 0], [4, 2], [5, 1], [6, 0],
];

/** Ground-state configuration of a neutral atom, including the Cr and Cu exceptions. */
function neutralConfiguration(z: number): Subshell[] {
  const shells: Subshell[] = [];
  let left = z;
  for (const [n, l] of AUFBAU) {
    if (left <= 0) break;
    const c = Math.min(capacity(l), left);
    shells.push({ n, l, count: c });
    left -= c;
  }
  // Half-filled / filled d-subshell exceptions in period 4.
  if (z === 24 || z === 29) {
    const s4 = shells.find((s) => s.n === 4 && s.l === 0)!;
    const d3 = shells.find((s) => s.n === 3 && s.l === 2)!;
    s4.count -= 1;
    d3.count += 1;
  }
  return shells;
}

/**
 * Configuration for any electron count around nucleus Z.
 * Cations lose electrons from the highest n first (4p, then 4s, before 3d);
 * anions gain electrons following the aufbau order.
 */
export function electronConfiguration(z: number, electrons: number): Subshell[] {
  const base = neutralConfiguration(z).map((s) => ({ ...s }));
  if (electrons < z) {
    let remove = z - electrons;
    while (remove > 0) {
      const candidates = base.filter((s) => s.count > 0);
      candidates.sort((a, b) => b.n - a.n || b.l - a.l);
      candidates[0].count -= 1;
      remove -= 1;
    }
  } else if (electrons > z) {
    let add = electrons - z;
    for (const [n, l] of AUFBAU) {
      if (add <= 0) break;
      let sub = base.find((s) => s.n === n && s.l === l);
      if (!sub) {
        sub = { n, l, count: 0 };
        base.push(sub);
      }
      const room = capacity(l) - sub.count;
      const c = Math.min(room, add);
      sub.count += c;
      add -= c;
    }
  }
  return base.filter((s) => s.count > 0).sort((a, b) => a.n - b.n || a.l - b.l);
}

/** Electrons per Bohr shell (K, L, M, …), derived from the configuration. */
export function shellCounts(config: Subshell[]): number[] {
  const out: number[] = [];
  for (const s of config) {
    while (out.length < s.n) out.push(0);
    out[s.n - 1] += s.count;
  }
  return out;
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
export const superscript = (s: string) => s.split('').map((c) => SUP[c] ?? c).join('');

/** e.g. "1s² 2s² 2p⁶ 3s¹", in order of n then l (standard notation). */
export function formatConfiguration(config: Subshell[]): string {
  if (config.length === 0) return '—';
  return config.map((s) => `${s.n}${L_LETTER[s.l]}${superscript(String(s.count))}`).join(' ');
}

// ---------------------------------------------------------------------------
// Atom summary
// ---------------------------------------------------------------------------

export type IonType = 'neutral' | 'cation' | 'anion';
export type Stability = 'stable' | 'long-lived' | 'unstable';

export interface AtomSummary {
  element: ElementData;
  massNumber: number;
  charge: number;
  ionType: IonType;
  /** e.g. "Na⁺", "O²⁻", "C" */
  ionSymbol: string;
  /** e.g. "sodium ion", "oxide ion", "neutral carbon atom" */
  ionName: string;
  isotopeName: string;
  isotopeAlias?: string;
  stability: Stability;
  /** For ions: is this a charge the element commonly has? */
  commonIon: boolean;
  config: Subshell[];
  shells: number[];
  valence: number;
}

export function chargeText(charge: number): string {
  if (charge === 0) return '0';
  return `${charge > 0 ? '+' : '−'}${Math.abs(charge)}`;
}

export function chargeSuperscript(charge: number): string {
  if (charge === 0) return '';
  const mag = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  return superscript(mag + (charge > 0 ? '+' : '-'));
}

export function summarize({ protons, neutrons, electrons }: AtomCounts): AtomSummary {
  const element = elementByZ(protons)!;
  const massNumber = protons + neutrons;
  const charge = protons - electrons;
  const ionType: IonType = charge === 0 ? 'neutral' : charge > 0 ? 'cation' : 'anion';
  const config = electronConfiguration(protons, electrons);
  const shells = shellCounts(config);
  const lower = element.name.toLowerCase();

  let ionName: string;
  if (ionType === 'neutral') ionName = `neutral ${lower} atom`;
  else if (ionType === 'cation') ionName = `${lower} ion`;
  else ionName = element.anion ? `${element.anion} ion` : `${lower} anion`;

  const stability: Stability = element.stable.includes(massNumber)
    ? 'stable'
    : element.longLived?.includes(massNumber)
      ? 'long-lived'
      : 'unstable';

  return {
    element,
    massNumber,
    charge,
    ionType,
    ionSymbol: element.symbol + chargeSuperscript(charge),
    ionName,
    isotopeName: `${element.name}-${massNumber}`,
    isotopeAlias: ISOTOPE_NAMES[`${protons}-${massNumber}`],
    stability,
    commonIon: charge !== 0 && (element.ions ?? []).includes(charge),
    config,
    shells,
    valence: shells.length ? shells[shells.length - 1] : 0,
  };
}

/** Bohr-model capacity of shell n (2n²). */
export const shellCapacity = (n: number) => 2 * n * n;
