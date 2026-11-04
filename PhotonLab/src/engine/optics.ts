/**
 * Core optical formulas. All direction and normal vectors are unit length.
 * Normals passed to these functions face the incoming ray (d · n < 0).
 */
import type { Polarization } from '../scene/types';

/** Law of reflection: R = I − 2(I·N)N */
export function reflect(dx: number, dy: number, nx: number, ny: number): [number, number] {
  const k = 2 * (dx * nx + dy * ny);
  return [dx - k * nx, dy - k * ny];
}

/**
 * Vector form of Snell's law  n₁ sin θ₁ = n₂ sin θ₂.
 * Returns null on total internal reflection.
 */
export function refract(
  dx: number,
  dy: number,
  nx: number,
  ny: number,
  n1: number,
  n2: number,
): [number, number] | null {
  const eta = n1 / n2;
  const cosi = -(dx * nx + dy * ny);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  const tx = eta * dx + f * nx;
  const ty = eta * dy + f * ny;
  const l = Math.hypot(tx, ty);
  return [tx / l, ty / l];
}

export interface FresnelTerms {
  /** Power reflectance for s and p polarisation. */
  Rs: number;
  Rp: number;
  /** Power transmittance for s and p polarisation (includes the n₂cosθₜ / n₁cosθᵢ beam factor). */
  Ts: number;
  Tp: number;
  tir: boolean;
}

/** Full Fresnel equations for a dielectric interface. */
export function fresnelTerms(n1: number, n2: number, cosi: number): FresnelTerms {
  cosi = Math.min(1, Math.abs(cosi));
  const sin2t = (n1 / n2) ** 2 * (1 - cosi * cosi);
  if (sin2t >= 1) return { Rs: 1, Rp: 1, Ts: 0, Tp: 0, tir: true };
  const cost = Math.sqrt(1 - sin2t);
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
  const rp = (n2 * cosi - n1 * cost) / (n2 * cosi + n1 * cost);
  const ts = (2 * n1 * cosi) / (n1 * cosi + n2 * cost);
  const tp = (2 * n1 * cosi) / (n2 * cosi + n1 * cost);
  const beam = (n2 * cost) / (n1 * cosi);
  return { Rs: rs * rs, Rp: rp * rp, Ts: beam * ts * ts, Tp: beam * tp * tp, tir: false };
}

/** Reflectance for the chosen polarisation assumption. */
export function fresnelReflectance(n1: number, n2: number, cosi: number, pol: Polarization): number {
  const f = fresnelTerms(n1, n2, cosi);
  if (f.tir) return 1;
  if (pol === 's') return f.Rs;
  if (pol === 'p') return f.Rp;
  return 0.5 * (f.Rs + f.Rp);
}

/** Critical angle (radians) for light going from n1 into n2, or null if none exists. */
export function criticalAngle(n1: number, n2: number): number | null {
  return n1 > n2 ? Math.asin(n2 / n1) : null;
}

/** Brewster angle (radians). */
export function brewsterAngle(n1: number, n2: number): number {
  return Math.atan2(n2, n1);
}

const LAMBDA_D = 0.5893; // µm

/** Cauchy dispersion: n(λ) = A + B/λ² with A chosen so n(589.3 nm) = nD. */
export function cauchyIndex(nD: number, B: number, wavelengthNm: number): number {
  if (B === 0) return nD;
  const l = wavelengthNm / 1000;
  return nD - B / (LAMBDA_D * LAMBDA_D) + B / (l * l);
}

/** Abbe number V_d = (n_d − 1)/(n_F − n_C) for a Cauchy material. */
export function abbeNumber(nD: number, B: number): number {
  const nF = cauchyIndex(nD, B, 486.1);
  const nC = cauchyIndex(nD, B, 656.3);
  const d = nF - nC;
  return d > 0 ? (nD - 1) / d : Infinity;
}

/**
 * Thick-lens lensmaker's equation. r1/r2 use the simulator convention
 * (+ convex, − concave, 0 flat) and are converted to the standard sign convention.
 */
export function lensmakerFocalLength(n: number, r1: number, r2: number, thickness: number, nMedium = 1): number {
  const nr = n / nMedium;
  const c1 = r1 === 0 ? 0 : 1 / r1;
  const c2 = r2 === 0 ? 0 : -1 / r2;
  const p = (nr - 1) * (c1 - c2 + ((nr - 1) * thickness * c1 * c2) / nr);
  return p === 0 ? Infinity : 1 / p;
}
