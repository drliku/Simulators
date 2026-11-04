/**
 * Special-relativity kinematics for a ship moving at constant velocity relative to Earth.
 *
 * Everything works with the normalized velocity β = v / c. Formulas are written in
 * numerically stable forms so that everyday speeds (β ≈ 10⁻⁷, where γ − 1 ≈ 10⁻¹⁵)
 * still produce meaningful digits instead of rounding to zero.
 *
 * Events: O = the ship passes Earth and both clocks read zero.
 *         E = an event on the ship's worldline (the ship's "now").
 * Δt is the Earth-frame time between O and E; Δτ is the ship's proper time between them.
 */

/** Speed of light in m/s (exact, by definition of the metre). */
export const C = 299_792_458;
/** Julian year in seconds (365.25 days), the year used for the light-year. */
export const JULIAN_YEAR = 365.25 * 86_400;
/** One light-year in metres. */
export const LIGHT_YEAR = C * JULIAN_YEAR;
/** Highest velocity the controls allow. Anything with mass stays strictly below c. */
export const BETA_MAX = 0.999;

export function assertSubluminal(beta: number): void {
  if (!(beta >= 0 && beta < 1)) {
    throw new RangeError(`β must satisfy 0 ≤ β < 1 (got ${beta}); nothing with mass reaches c.`);
  }
}

/** √(1 − β²), computed as √((1 − β)(1 + β)) to keep precision near β = 1. */
export function inverseGamma(beta: number): number {
  assertSubluminal(beta);
  return Math.sqrt((1 - beta) * (1 + beta));
}

/** Lorentz factor γ = 1 / √(1 − β²). */
export function lorentzFactor(beta: number): number {
  return 1 / inverseGamma(beta);
}

/** γ − 1 without cancellation: β² / (s (1 + s)) with s = √(1 − β²). */
export function gammaMinusOne(beta: number): number {
  const s = inverseGamma(beta);
  return (beta * beta) / (s * (1 + s));
}

/** 1 − 1/γ without cancellation: β² / (1 + s). The fraction of Earth time the ship clock "loses". */
export function oneMinusInverseGamma(beta: number): number {
  const s = inverseGamma(beta);
  return (beta * beta) / (1 + s);
}

/** Proper time on the ship, Δτ = Δt / γ. */
export function properTime(earthTime: number, beta: number): number {
  return earthTime * inverseGamma(beta);
}

/** Δt − Δτ, computed directly so tiny differences survive. */
export function timeDifference(earthTime: number, beta: number): number {
  return earthTime * oneMinusInverseGamma(beta);
}

/** Distance covered in Earth's frame, in light-years, for Earth-frame time in seconds. */
export function distanceLightYears(earthTime: number, beta: number): number {
  return (beta * earthTime) / JULIAN_YEAR;
}

/** Distance covered in Earth's frame, in metres. */
export function distanceMetres(earthTime: number, beta: number): number {
  return beta * C * earthTime;
}

export function speedKmPerSecond(beta: number): number {
  return (beta * C) / 1000;
}

export function betaFromKmPerHour(kmh: number): number {
  return kmh / 3.6 / C;
}

/**
 * Ship-frame comparison.
 *
 * In the ship's rest frame the ship clock is at rest and Earth moves at −v. For the ship
 * event with proper time τ, the Earth event that is simultaneous *in the ship frame* has
 * Earth-clock reading τ / γ: Earth's clock is the moving one there, so it runs slow by
 * the same factor.
 */
export function earthReadingSimultaneousInShipFrame(shipProperTime: number, beta: number): number {
  return shipProperTime * inverseGamma(beta);
}

/**
 * The Earth event simultaneous with the same ship event *in Earth's frame* has reading γτ.
 * The gap γτ − τ/γ = γβ²τ is the relativity of simultaneity: the two frames pick different
 * Earth events as "now", so there is no contradiction in each seeing the other run slow.
 */
export function simultaneityGap(shipProperTime: number, beta: number): number {
  return lorentzFactor(beta) * beta * beta * shipProperTime;
}

/** Light-clock geometry in Earth's frame: one leg between mirrors separated by L. */
export function lightClockLeg(beta: number, separation: number) {
  const gamma = lorentzFactor(beta);
  return {
    /** Path length of one mirror-to-mirror leg of the photon. */
    pathLength: gamma * separation,
    /** Horizontal distance the clock moves during one leg. */
    horizontalShift: beta * gamma * separation,
    /** Vertical component, unchanged: separation is perpendicular to the motion. */
    verticalSeparation: separation,
  };
}
