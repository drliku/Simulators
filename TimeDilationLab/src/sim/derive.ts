import {
  distanceLightYears, distanceMetres, earthReadingSimultaneousInShipFrame, lorentzFactor,
  properTime, simultaneityGap, speedKmPerSecond, timeDifference,
} from '../physics/relativity';
import { unitForDuration, type TimeUnit } from '../physics/format';
import type { SimEngine } from './engine';

/** Every displayed number, derived from the engine's single clock and β. */
export interface Derived {
  beta: number;
  gamma: number;
  kmPerSecond: number;
  /** Earth-frame time Δt between departure and the ship's current event. */
  earthTime: number;
  /** Ship proper time Δτ = Δt/γ. */
  shipTime: number;
  /** Δt − Δτ, computed without cancellation. */
  difference: number;
  distanceLy: number;
  distanceM: number;
  /** Ship frame: Earth-clock reading simultaneous with the ship's event, τ/γ. */
  earthInShipFrame: number;
  /** γβ²τ: how far apart the two frames' choice of "Earth now" is. */
  simultaneityGap: number;
  duration: number;
  progress: number;
  unit: TimeUnit;
}

export function derive(e: SimEngine): Derived {
  const t = e.earthTime;
  const beta = e.beta;
  const tau = properTime(t, beta);
  return {
    beta,
    gamma: lorentzFactor(beta),
    kmPerSecond: speedKmPerSecond(beta),
    earthTime: t,
    shipTime: tau,
    difference: timeDifference(t, beta),
    distanceLy: distanceLightYears(t, beta),
    distanceM: distanceMetres(t, beta),
    earthInShipFrame: earthReadingSimultaneousInShipFrame(tau, beta),
    simultaneityGap: simultaneityGap(tau, beta),
    duration: e.durationSeconds,
    progress: e.durationSeconds > 0 ? t / e.durationSeconds : 0,
    unit: unitForDuration(e.durationSeconds),
  };
}
