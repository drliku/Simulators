import { BETA_MAX, JULIAN_YEAR, assertSubluminal, lorentzFactor } from '../physics/relativity';

/** At 1× the frame being viewed advances one day per real second; 1000× ≈ 2.7 years per second. */
export const BASE_RATE = 86_400;

export const SPEEDS = [1, 10, 100, 1000] as const;
export type Speed = (typeof SPEEDS)[number];
export type Frame = 'earth' | 'ship';

/** Durations in Earth-frame years. The short ones show how units adapt. */
export const DURATIONS: { years: number; label: string }[] = [
  { years: 1 / 365.25, label: '1 day' },
  { years: 30 / 365.25, label: '30 days' },
  { years: 1, label: '1 yr' },
  { years: 5, label: '5 yr' },
  { years: 10, label: '10 yr' },
  { years: 50, label: '50 yr' },
];

type Listener = () => void;
type FrameCallback = (realDt: number) => void;

/**
 * The single authoritative simulation clock.
 *
 * `earthTime` is the Earth-frame time Δt between the departure event O and the ship's
 * current event E. Every other quantity (ship proper time, distance, the ship-frame
 * readings) is derived from it and β, so the two clocks can never drift apart.
 *
 * Velocity is constant for the whole experiment: changing it restarts the run, so the ship
 * stays inertial and both reference frames remain well defined.
 */
export class SimEngine {
  earthTime = 0;
  beta = 0.8;
  speed: Speed = 1000;
  durationYears = 10;
  frame: Frame = 'earth';
  running = false;
  finished = false;
  /** Bumped whenever the experiment restarts, so views can clear trails and history. */
  epoch = 0;
  /** Bumped on every change; the React store keys snapshots on it. */
  version = 0;

  private listeners = new Set<Listener>();
  private frameCallbacks = new Set<FrameCallback>();
  private raf = 0;
  private last = 0;

  constructor({ autoStart = true }: { autoStart?: boolean } = {}) {
    if (autoStart && typeof window !== 'undefined') this.start();
  }

  get durationSeconds(): number {
    return this.durationYears * JULIAN_YEAR;
  }

  get gamma(): number {
    return lorentzFactor(this.beta);
  }

  // ---- loop

  start(): void {
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

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Advance by a real-time delta (seconds). Elapsed time depends on time, never on frame count. */
  step(realDt: number): void {
    if (this.running) {
      // The rate applies to the coordinate time of the frame being viewed: in the ship
      // frame that is the ship's proper time, so Earth-frame time advances γ times faster.
      const frameRate = this.speed * BASE_RATE;
      const dEarth = realDt * frameRate * (this.frame === 'ship' ? this.gamma : 1);
      const remaining = this.durationSeconds - this.earthTime;
      if (dEarth >= remaining) {
        this.earthTime = this.durationSeconds;
        this.running = false;
        this.finished = true;
      } else {
        this.earthTime += dEarth;
      }
    }
    this.emit();
  }

  // ---- subscriptions

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onFrame(fn: FrameCallback): () => void {
    this.frameCallbacks.add(fn);
    return () => this.frameCallbacks.delete(fn);
  }

  private emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  // ---- actions

  play(): void {
    if (this.finished) this.restart();
    this.running = true;
    this.emit();
  }

  pause(): void {
    this.running = false;
    this.emit();
  }

  toggle(): void {
    if (this.running) this.pause(); else this.play();
  }

  /** Clocks back to zero, ship back at Earth, history cleared. Keeps play state. */
  restart(): void {
    this.earthTime = 0;
    this.finished = false;
    this.epoch++;
    this.emit();
  }

  reset(): void {
    this.running = false;
    this.restart();
  }

  setBeta(beta: number): void {
    const b = Math.min(BETA_MAX, Math.max(0, beta));
    assertSubluminal(b);
    if (b === this.beta) return;
    this.beta = b;
    // Constant-velocity experiment: a new velocity means a new inertial ship, so start over.
    this.restart();
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.emit();
  }

  setDurationYears(years: number): void {
    this.durationYears = years;
    if (this.earthTime >= this.durationSeconds) {
      this.earthTime = this.durationSeconds;
      this.running = false;
      this.finished = true;
    } else {
      this.finished = false;
    }
    this.epoch++;
    this.emit();
  }

  setFrame(frame: Frame): void {
    this.frame = frame;
    this.emit();
  }
}
