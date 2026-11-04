import { useEngine, useSim } from '../sim/context';
import { L0_MAX, L0_MIN, PRESETS, CEILING_GAP } from '../sim/engine';
import { BETA_MAX, lorentzFactor, speedKmPerSecond } from '../physics/mirror';
import { Term } from './Term';
import { TIPS } from './tips';

export const pctText = (beta: number) => `${(beta * 100).toFixed(1)}%`;

export function ControlsPanel() {
  const engine = useEngine();
  const beta = useSim((e) => e.beta);
  const L0 = useSim((e) => e.L0);
  const orientation = useSim((e) => e.orientation);
  const pct = Math.round(beta * 1000) / 10;

  return (
    <section className="glass flex flex-col gap-5 p-5" aria-label="Experiment controls">
      <h2 className="panel-title">Controls</h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="velocity" className="text-[13px] font-medium text-ink-muted">Train velocity</label>
          <span className="font-mono text-xl font-semibold tabular-nums text-coral-soft">{pctText(beta)} <span className="text-sm text-ink-muted">of c</span></span>
        </div>
        <input
          id="velocity"
          type="range"
          min={0}
          max={BETA_MAX * 100}
          step={0.1}
          value={pct}
          style={{ ['--pct' as string]: `${(pct / (BETA_MAX * 100)) * 100}%` }}
          onChange={(ev) => engine.setBeta(Number(ev.target.value) / 100)}
          aria-valuetext={`${pctText(beta)} of light speed`}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Velocity presets">
          {PRESETS.map((p) => (
            <button
              key={p.pct}
              type="button"
              className="chip"
              title={p.label}
              aria-pressed={Math.abs(beta * 100 - p.pct) < 1e-9}
              onClick={() => engine.setBeta(p.pct / 100)}
            >
              {p.pct}%
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-faint">
          {PRESETS.find((p) => Math.abs(beta * 100 - p.pct) < 1e-9)?.label ?? 'Custom speed'} ·{' '}
          {speedKmPerSecond(beta).toLocaleString('en-US', { maximumFractionDigits: 0 })} km/s ·{' '}
          <Term tip={TIPS.gamma}>γ</Term> = {lorentzFactor(beta).toFixed(3)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-muted" id="orientLabel">Mirror position</span>
        <div className="seg" role="group" aria-labelledby="orientLabel">
          <button type="button" aria-pressed={orientation === 'front'} onClick={() => engine.setOrientation('front')}>In front</button>
          <button type="button" aria-pressed={orientation === 'above'} onClick={() => engine.setOrientation('above')}>Above (light clock)</button>
        </div>
        <p className="text-[12px] text-ink-faint">
          {orientation === 'front'
            ? 'Light travels along the direction of motion.'
            : 'In the train, light travels across the direction of motion.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="distance" className="text-[13px] font-medium text-ink-muted">Distance to the mirror (train frame)</label>
          <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">{(orientation === 'front' ? L0 : CEILING_GAP).toFixed(2)} m</span>
        </div>
        <input
          id="distance"
          type="range"
          min={L0_MIN}
          max={L0_MAX}
          step={0.1}
          value={L0}
          disabled={orientation === 'above'}
          style={{ ['--pct' as string]: `${((L0 - L0_MIN) / (L0_MAX - L0_MIN)) * 100}%` }}
          onChange={(ev) => engine.setL0(Number(ev.target.value))}
          className="disabled:opacity-40"
        />
        <p className="text-[12px] text-ink-faint">
          {orientation === 'front' ? 'Move the passenger closer to or farther from the mirror.' : `The ceiling mirror is fixed ${CEILING_GAP.toFixed(2)} m above his eyes.`}
          {' '}Changing velocity, distance or mirror position starts a new trip.
        </p>
      </div>
    </section>
  );
}
