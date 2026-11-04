/**
 * Einstein's mirror: a passenger at rest in a train sends light to a mirror a distance L₀
 * away (in the train frame) and receives it back.
 *
 * Coordinates (metres, seconds):
 *   Train frame S′: x′ along the direction of travel, y′ up, origin at the passenger's eye.
 *   Track frame S:  the train moves at +v; at t = 0 the eye is at x = 0.
 * Both frames agree on the departure event E₀ = (0, 0). The Lorentz transformation is
 *   t = γ(t′ + v x′ / c²),   x = γ(x′ + v t′),   y = y′.
 *
 * Light travels at c in both frames. Nothing here ever uses c − v as the speed of light;
 * c − v only appears as the rate at which the gap between photon and mirror closes,
 * measured in the track frame.
 */

export const C = 299_792_458;
export const BETA_MAX = 0.999;

export type Orientation = 'front' | 'above';

export interface Event { t: number; x: number; y: number }

export function assertSubluminal(beta: number) {
  if (!(beta >= 0 && beta < 1)) throw new RangeError(`β must satisfy 0 ≤ β < 1 (got ${beta})`);
}

/** γ = 1/√(1 − β²), written as 1/√((1 − β)(1 + β)) for accuracy near β = 1. */
export function lorentzFactor(beta: number): number {
  assertSubluminal(beta);
  return 1 / Math.sqrt((1 - beta) * (1 + beta));
}

/** Train-frame event → track-frame event. */
export function toTrack(beta: number, e: Event): Event {
  const g = lorentzFactor(beta);
  const v = beta * C;
  return { t: g * (e.t + (v * e.x) / (C * C)), x: g * (e.x + v * e.t), y: e.y };
}

/** Track-frame event → train-frame event (the inverse transformation). */
export function toTrain(beta: number, e: Event): Event {
  const g = lorentzFactor(beta);
  const v = beta * C;
  return { t: g * (e.t - (v * e.x) / (C * C)), x: g * (e.x - v * e.t), y: e.y };
}

/** Relativistic velocity addition: an object moving at u′ in the train is seen at this speed from the track. */
export function addVelocities(beta: number, uPrime: number): number {
  const v = beta * C;
  return (uPrime + v) / (1 + (uPrime * v) / (C * C));
}

export interface Trip {
  beta: number;
  gamma: number;
  /** Passenger-to-mirror distance in the train frame (proper distance). */
  L0: number;
  orientation: Orientation;
  /** Departure, reflection, return, in the train frame. */
  train: [Event, Event, Event];
  /** The same three events in the track frame. */
  track: [Event, Event, Event];
  /** t′ = 2L₀/c. */
  trainRoundTrip: number;
  /** t = γ·2L₀/c, between the same departure and return events. */
  trackRoundTrip: number;
}

export function makeTrip(beta: number, L0: number, orientation: Orientation): Trip {
  const g = lorentzFactor(beta);
  const half = L0 / C;
  const train: [Event, Event, Event] = orientation === 'front'
    ? [{ t: 0, x: 0, y: 0 }, { t: half, x: L0, y: 0 }, { t: 2 * half, x: 0, y: 0 }]
    : [{ t: 0, x: 0, y: 0 }, { t: half, x: 0, y: L0 }, { t: 2 * half, x: 0, y: 0 }];
  const track = train.map((e) => toTrack(beta, e)) as [Event, Event, Event];
  return { beta, gamma: g, L0, orientation, train, track, trainRoundTrip: 2 * half, trackRoundTrip: track[2].t };
}

export type Leg = 'outbound' | 'returning' | 'arrived';

export interface PhotonState { x: number; y: number; leg: Leg; distance: number }

/** Photon position along a two-leg path through three events, at that frame's time t. */
function along(events: [Event, Event, Event], t: number): PhotonState {
  const [a, b, c] = events;
  const lerp = (p: Event, q: Event, s: number) => ({ x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s });
  const seg = (p: Event, q: Event) => Math.hypot(q.x - p.x, q.y - p.y);
  if (t <= a.t) return { x: a.x, y: a.y, leg: 'outbound', distance: 0 };
  if (t < b.t) {
    const s = (t - a.t) / (b.t - a.t);
    return { ...lerp(a, b, s), leg: 'outbound', distance: seg(a, b) * s };
  }
  if (t < c.t) {
    const s = (t - b.t) / (c.t - b.t);
    return { ...lerp(b, c, s), leg: 'returning', distance: seg(a, b) + seg(b, c) * s };
  }
  return { x: c.x, y: c.y, leg: 'arrived', distance: seg(a, b) + seg(b, c) };
}

export const photonInTrain = (trip: Trip, tPrime: number) => along(trip.train, tPrime);
export const photonOnTrack = (trip: Trip, t: number) => along(trip.track, t);

/** Speed of light measured on each leg in a frame: path length ÷ elapsed time. Always c. */
export function legSpeeds(events: [Event, Event, Event]): [number, number] {
  const [a, b, c] = events;
  return [
    Math.hypot(b.x - a.x, b.y - a.y) / (b.t - a.t),
    Math.hypot(c.x - b.x, c.y - b.y) / (c.t - b.t),
  ];
}

/** Length of something with rest length L₀ along the motion, measured from the track: L₀/γ. */
export function contractedLength(restLength: number, beta: number): number {
  return restLength / lorentzFactor(beta);
}

export const speedKmPerSecond = (beta: number) => (beta * C) / 1000;
