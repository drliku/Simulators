import { BETA_MAX, lorentzFactor, makeTrip, type Orientation, type Trip } from '../physics/mirror';

export type View = 'both' | 'train' | 'track';

/** Train-frame geometry, metres. The passenger's eye is the origin; heights are above the floor. */
export const EYE_HEIGHT = 1.62;
export const CEILING_HEIGHT = 2.85;
/** Eye-to-mirror distance when the mirror is on the ceiling. */
export const CEILING_GAP = 1.1;
export const L0_MIN = 0.8;
export const L0_MAX = 4;
/** Rest length of the whole train (8 cars), used for the contraction readout. */
export const TRAIN_REST_LENGTH = 160;

/** Purely visual scenery speed, in arbitrary screen units per second. Not to scale. */
export const scenerySpeed = (beta: number) => 0.25 + 9 * Math.pow(beta, 1.6);

export const PRESETS: { pct: number; label: string }[] = [
  { pct: 0, label: 'Stationary' },
  { pct: 25, label: 'Slow relativistic speed' },
  { pct: 50, label: 'Half light speed' },
  { pct: 80, label: 'Strong time dilation' },
  { pct: 95, label: 'Near light speed' },
  { pct: 99, label: 'Extreme relativity' },
  { pct: 99.9, label: 'Almost light speed' },
];

/** One full round trip plays over this many real seconds (normal speed), whatever β and L₀ are. */
export const TRIP_PLAYBACK_SECONDS = 4.5;
export const SLOW_FACTOR = 0.15;
/** Pause at the return event before the next trip starts, in real seconds. */
const HOLD_SECONDS = 1.1;
/** Frame stepping moves this fraction of a round trip. */
export const STEP_FRACTION = 1 / 48;

type Listener = () => void;
type FrameCallback = (realDt: number) => void;

/**
 * The single authoritative clock is track-frame time `t` since the departure event.
 *
 * The track view shows the track frame at time t. The train view shows the train frame at
 * the passenger's proper time t/γ (his clock reading at the same event on his worldline),
 * so both views start at the departure event and finish at the return event together.
 * Between those events the views' "now" slices differ: that is the relativity of
 * simultaneity, and it is why the reflection happens at different moments in each view.
 *
 * Playback is normalised so one trip lasts TRIP_PLAYBACK_SECONDS. Slow motion and stepping
 * only change how fast `t` advances on screen; the physics never changes.
 */
export class MirrorEngine {
  beta = 0;
  L0 = 2;
  orientation: Orientation = 'front';
  view: View = 'both';
  playing = true;
  slow = false;

  t = 0;
  private hold = 0;
  /** Real-time accumulators for purely visual motion. */
  scenery = 0;
  realTime = 0;
  blinkUntil = 0;
  private nextBlink = 2.5;

  /** Experiment 1: step through the presets, one round trip each. */
  accelerating: number | null = null;
  /** Experiment 1 reached 99.9% of c and finished. */
  accelerationDone = false;

  version = 0;
  private trip_: Trip | null = null;
  private listeners = new Set<Listener>();
  private frameCallbacks = new Set<FrameCallback>();
  private raf = 0;
  private last = 0;

  get trip(): Trip {
    const tr = this.trip_;
    const L = this.orientation === 'above' ? CEILING_GAP : this.L0;
    if (tr && tr.beta === this.beta && tr.L0 === L && tr.orientation === this.orientation) return tr;
    this.trip_ = makeTrip(this.beta, this.orientation === 'above' ? CEILING_GAP : this.L0, this.orientation);
    return this.trip_;
  }

  get gamma(): number { return lorentzFactor(this.beta); }
  /** Train-frame time shown in the train view. */
  get tPrime(): number { return this.t / this.gamma; }
  get progress(): number { return this.t / this.trip.trackRoundTrip; }
  get blinking(): boolean { return this.realTime < this.blinkUntil; }

  // ---- loop
  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.step(dt);
      for (const cb of this.frameCallbacks) cb(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  step(realDt: number) {
    this.realTime += realDt;
    if (this.realTime > this.nextBlink) {
      this.blinkUntil = this.realTime + 0.14;
      this.nextBlink = this.realTime + 2.2 + Math.random() * 3.5;
    }
    if (this.playing) {
      const total = this.trip.trackRoundTrip;
      this.scenery += realDt * scenerySpeed(this.beta);
      if (this.t >= total) {
        this.hold += realDt;
        if (this.hold >= HOLD_SECONDS) this.completeTrip();
      } else {
        const rate = (total / TRIP_PLAYBACK_SECONDS) * (this.slow ? SLOW_FACTOR : 1);
        const next = this.t + realDt * rate;
        // Snap to the return event when within rounding error of it.
        this.t = next >= total * (1 - 1e-9) ? total : next;
      }
    }
    this.emit();
  }

  private completeTrip() {
    this.t = 0;
    this.hold = 0;
    if (this.accelerating !== null) {
      const next = this.accelerating + 1;
      if (next < PRESETS.length) {
        this.accelerating = next;
        this.beta = Math.min(BETA_MAX, PRESETS[next].pct / 100);
      } else {
        this.accelerating = null;
        this.accelerationDone = true;
      }
    }
  }

  // ---- subscriptions
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  onFrame(fn: FrameCallback) { this.frameCallbacks.add(fn); return () => { this.frameCallbacks.delete(fn); }; }
  private emit() { this.version++; for (const fn of this.listeners) fn(); }

  // ---- actions
  private restartTrip() { this.t = 0; this.hold = 0; }

  setBeta(beta: number, fromExperiment = false) {
    const b = Math.min(BETA_MAX, Math.max(0, beta));
    if (!fromExperiment) { this.accelerating = null; this.accelerationDone = false; }
    if (b === this.beta) return;
    this.beta = b;
    // A new velocity is a new inertial train: start a fresh trip.
    this.restartTrip();
    this.emit();
  }
  setL0(L0: number) { this.L0 = Math.min(L0_MAX, Math.max(L0_MIN, L0)); this.restartTrip(); this.emit(); }
  setOrientation(o: Orientation) { this.orientation = o; this.restartTrip(); this.emit(); }
  setView(v: View) { this.view = v; this.emit(); }
  setSlow(on: boolean) { this.slow = on; this.emit(); }
  play() { this.playing = true; this.emit(); }
  pause() { this.playing = false; this.emit(); }
  toggle() { this.playing = !this.playing; this.emit(); }
  reset() { this.playing = false; this.accelerating = null; this.restartTrip(); this.emit(); }

  /** Jump to a track-frame time inside the trip (pauses playback). */
  seek(t: number) {
    this.playing = false;
    this.hold = 0;
    this.t = Math.min(this.trip.trackRoundTrip, Math.max(0, t));
    this.emit();
  }
  stepFrame(dir: 1 | -1) { this.seek(this.t + dir * STEP_FRACTION * this.trip.trackRoundTrip); }

  startAcceleration() {
    this.orientation = 'front';
    this.accelerating = 0;
    this.accelerationDone = false;
    this.beta = 0;
    this.restartTrip();
    this.playing = true;
    this.emit();
  }
}
