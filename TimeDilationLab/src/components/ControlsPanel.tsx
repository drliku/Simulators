import { useEngine, useSim } from '../sim/context';
import { DURATIONS, SPEEDS, type Frame } from '../sim/engine';
import { BETA_MAX, speedKmPerSecond } from '../physics/relativity';
import { formatGamma, formatPercentC, withThousands } from '../physics/format';
import { Term } from './Term';
import { TIPS } from './tips';

const PRESETS = [0, 50, 80, 90, 95, 99, 99.9];

export function ControlsPanel() {
  const engine = useEngine();
  const running = useSim((e) => e.running);
  const finished = useSim((e) => e.finished);
  const started = useSim((e) => e.earthTime > 0);
  const beta = useSim((e) => e.beta);
  const speed = useSim((e) => e.speed);
  const durationYears = useSim((e) => e.durationYears);
  const frame = useSim((e) => e.frame);

  const pct = Math.round(beta * 1000) / 10;
  const sliderPct = `${(pct / (BETA_MAX * 100)) * 100}%`;
  const playLabel = running ? 'Pause' : finished ? 'Run again' : started ? 'Resume' : 'Start';

  return (
    <section className="glass flex flex-col gap-5 p-5" aria-label="Experiment controls">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Controls</h2>
        <span className="font-mono text-[11px] text-ink-faint">Space · R</span>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={() => engine.toggle()}
          aria-pressed={running}
          className={`btn h-12 text-[15px] font-semibold ${running
            ? 'border-ship/50 bg-ship/10 text-ship-soft hover:bg-ship/20'
            : 'border-transparent bg-gradient-to-r from-ship to-ship-deep text-space-950 shadow-[0_8px_30px_rgba(243,112,100,0.35)] hover:brightness-110'}`}
        >
          {running ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
          )}
          {playLabel}
        </button>
        <button type="button" className="btn h-12" onClick={() => engine.reset()} title="Return both clocks to zero (R)">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" /></svg>
          Reset
        </button>
      </div>

      {/* Velocity */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="velocity" className="text-[13px] font-medium text-ink-muted">
            Ship velocity <Term tip={TIPS.beta}>(β)</Term>
          </label>
          <span className="font-mono text-xl font-semibold tabular-nums text-ship-soft">{formatPercentC(beta)} <span className="text-sm text-ink-muted">c</span></span>
        </div>
        <input
          id="velocity"
          type="range"
          min={0}
          max={BETA_MAX * 100}
          step={0.1}
          value={pct}
          style={{ ['--pct' as string]: sliderPct }}
          onChange={(ev) => engine.setBeta(Number(ev.target.value) / 100)}
          aria-valuetext={`${formatPercentC(beta)} of light speed`}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Velocity presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => engine.setBeta(p / 100)}
              aria-pressed={Math.abs(beta * 100 - p) < 1e-9}
              className="h-7 rounded-md border border-white/10 px-2 font-mono text-[11.5px] text-ink-muted transition hover:border-ship/50 hover:text-ink aria-pressed:border-ship/60 aria-pressed:bg-ship/15 aria-pressed:text-ship-soft"
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2">
            <div className="text-[11px] text-ink-faint"><Term tip={TIPS.gamma}>Lorentz factor γ</Term></div>
            <div className="font-mono text-[17px] font-semibold tabular-nums text-ink">{formatGamma(beta)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2">
            <div className="text-[11px] text-ink-faint">Speed</div>
            <div className="font-mono text-[15px] tabular-nums text-ink">{withThousands(speedKmPerSecond(beta), beta < 0.001 ? 6 : 0)} <span className="text-[11px] text-ink-muted">km/s</span></div>
          </div>
        </div>
        <p className="text-[11.5px] leading-snug text-ink-faint">
          Changing velocity restarts the experiment, so the ship moves at one constant velocity and stays an inertial observer.
        </p>
      </div>

      {/* Simulation speed */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-muted" id="speedLabel">Simulation speed</span>
        <div className="seg" role="group" aria-labelledby="speedLabel">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => engine.setSpeed(s)}>
              {s.toLocaleString('en-US')}×
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-faint">
          1× = one {frame === 'earth' ? 'Earth-frame' : 'ship-frame'} day per real second. Playback rate only; it has nothing to do with the ship's velocity.
        </p>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-muted" id="durLabel">Experiment duration (Earth frame)</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.07] bg-black/30 p-1" role="group" aria-labelledby="durLabel">
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              aria-pressed={Math.abs(durationYears - d.years) < 1e-12}
              onClick={() => engine.setDurationYears(d.years)}
              className="h-8 rounded-md font-mono text-[12px] text-ink-muted transition-colors hover:text-ink aria-pressed:bg-white/10 aria-pressed:text-ink"
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-faint">The run stops automatically when Earth's frame reaches this time.</p>
      </div>

      {/* Reference frame */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-muted" id="frameLabel">
          <Term tip={TIPS.frame}>Reference frame</Term>
        </span>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.07] bg-black/30 p-1" role="group" aria-labelledby="frameLabel">
          {(['earth', 'ship'] as Frame[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={frame === f}
              onClick={() => engine.setFrame(f)}
              className={`h-9 rounded-md text-[13px] font-medium transition-colors ${frame === f
                ? f === 'earth' ? 'bg-earth/15 text-earth-soft shadow-[inset_0_0_0_1px_rgba(159,176,255,0.4)]' : 'bg-ship/15 text-ship-soft shadow-[inset_0_0_0_1px_rgba(243,112,100,0.45)]'
                : 'text-ink-muted hover:text-ink'}`}
            >
              {f === 'earth' ? 'Earth frame' : 'Ship frame'}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-muted">
          {frame === 'earth' ? (
            <>Earth is at rest; the ship's clock is the moving one. Over the same two events it records Δτ = Δt/γ.</>
          ) : (
            <>
              The ship is at rest and Earth moves at −v, so Earth's clock is the moving one and runs slow by the same γ. The Earth
              reading shown is the one the ship's frame calls simultaneous with the ship's current event, a different Earth event
              from the one Earth's frame picks. See <Term tip={TIPS.simultaneity}>relativity of simultaneity</Term>.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
