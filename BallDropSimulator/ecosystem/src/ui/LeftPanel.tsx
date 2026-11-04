import { Fragment, useState } from 'react';
import { useUi } from '../runtime/context';
import { EXPERIMENTS } from '../sim/experiments';
import { PARAM_META, type ParamGroup, type Params } from '../sim/params';
import { experimentOutcomes } from './outcomes';
import { WEATHER_ICON, WEATHER_LABEL } from '../sim/weather';
import { FAUNA_IDS, SPECIES } from '../sim/species';

type Tab = 'experiments' | 'populations' | 'biology' | 'environment' | 'runs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'experiments', label: 'Experiments' },
  { id: 'populations', label: 'Animals' },
  { id: 'biology', label: 'Biology' },
  { id: 'environment', label: 'Environment' },
  { id: 'runs', label: 'Seed & runs' },
];

export function Slider({ label, value, min, max, step, format, onChange, help }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; help?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5" title={help}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className="font-mono text-[12px] text-ink">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

function ParamGroupPanel({ group }: { group: ParamGroup }) {
  const ctl = useUi();
  const keys = (Object.keys(PARAM_META) as (keyof Params)[]).filter((k) => PARAM_META[k].group === group);
  return (
    <div className="flex flex-col gap-3">
      {group === 'environment' && <WeatherCard />}
      <p className="text-[12px] leading-snug text-ink-faint">These sliders change the running model immediately. Hover a slider for what it does.</p>
      {keys.map((k) => {
        const m = PARAM_META[k];
        return <Slider key={k} label={m.label} help={m.help} value={ctl.sim.params[k]} min={m.min} max={m.max} step={m.step} format={m.format} onChange={(v) => ctl.setParams({ [k]: v })} />;
      })}
      <button type="button" className="btn self-start" onClick={() => ctl.restoreDefaults()}>Restore default parameters</button>
    </div>
  );
}

function WeatherCard() {
  const ctl = useUi();
  const w = ctl.sim.weather;
  const pct = (v: number) => `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(0)}%`;
  return (
    <div className="rounded-lg border border-white/[0.07] p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[22px]" aria-hidden="true">{WEATHER_ICON[w.kind]}</span>
        <div>
          <div className="font-display text-[15px] uppercase tracking-[0.05em]">{WEATHER_LABEL[w.kind]}</div>
          <div className="text-[11.5px] text-ink-muted">Wind {(3 + 12 * w.mix.wind).toFixed(0)} m/s</div>
        </div>
      </div>
      <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 font-mono text-[11.5px]">
        <dt className="text-ink-muted">Sight and smell</dt><dd className="m-0 text-right">{pct(w.visibility)}</dd>
        <dt className="text-ink-muted">Movement</dt><dd className="m-0 text-right">{pct(w.mobility)}</dd>
        <dt className="text-ink-muted">Plant growth</dt><dd className="m-0 text-right">{pct(w.growth)}</dd>
        <dt className="text-ink-muted">Deer thirst</dt><dd className="m-0 text-right">{pct(w.thirst)}</dd>
        <dt className="text-ink-muted">Wolf capture chance</dt><dd className="m-0 text-right">{pct(w.capture)}</dd>
      </dl>
    </div>
  );
}

function Populations() {
  const ctl = useUi();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="h-title text-[14px]">Initial populations</h3>
        <Slider label="Initial wolves" value={ctl.setup.initialWolves} min={0} max={100} step={1} format={(v) => String(v)} onChange={(v) => ctl.setSetup({ initialWolves: v })} />
        <Slider label="Initial deer" value={ctl.setup.initialDeer} min={0} max={500} step={5} format={(v) => String(v)} onChange={(v) => ctl.setSetup({ initialDeer: v })} />
        <button type="button" className="btn btn-primary" onClick={() => ctl.reset()}>Reset with these populations</button>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="h-title text-[14px]">Change the current run</h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={() => ctl.addWolves(1)}>+1 wolf</button>
          <button type="button" className="btn" onClick={() => ctl.addWolves(10)}>+10 wolves</button>
          <button type="button" className="btn" onClick={() => ctl.addDeer(10)}>+10 deer</button>
          <button type="button" className="btn" onClick={() => ctl.addDeer(50)}>+50 deer</button>
          <button type="button" className="btn" onClick={() => ctl.remove('wolf', 'all')}>Remove wolves</button>
          <button type="button" className="btn" onClick={() => ctl.remove('deer', 'all')}>Remove deer</button>
          <button type="button" className="btn" onClick={() => ctl.remove('wolf', 5)}>Remove 5 wolves</button>
          <button type="button" className="btn" onClick={() => ctl.remove('deer', 25)}>Remove 25 deer</button>
        </div>
        <p className="text-[12px] text-ink-faint">Added wolves arrive as new packs; added deer as small herds. Removals are recorded separately from deaths.</p>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="h-title text-[14px]">Other species</h3>
        <p className="text-[12px] leading-snug text-ink-faint">Starting numbers apply at the next reset; the buttons act on the current run.</p>
        {FAUNA_IDS.map((id) => {
          const S = SPECIES[id];
          const now = ctl.sim.count(id);
          return (
            <div key={id} className="rounded-md border border-white/[0.06] px-2 py-1.5" title={S.blurb}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: S.color }} /><span className="truncate">{S.name}</span><span className="font-mono text-ink-faint">({now})</span></span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="chip h-6 px-1.5" onClick={() => ctl.addFauna(id, S.groupSize[1] > 2 ? 4 : 2)} aria-label={`Add ${S.plural}`}>+{S.groupSize[1] > 2 ? 4 : 2}</button>
                  <button type="button" className="chip h-6 px-1.5" onClick={() => ctl.remove(id, 'all')} aria-label={`Remove all ${S.plural}`} disabled={now === 0}>✕</button>
                </span>
              </div>
              <input type="range" min={0} max={S.maxInitial} step={1} value={ctl.setup.fauna[id]} aria-label={`Initial ${S.plural}`}
                style={{ ['--pct' as string]: `${(ctl.setup.fauna[id] / S.maxInitial) * 100}%` }} onChange={(e) => ctl.setFauna(id, Number(e.target.value))} />
              <div className="-mt-1 text-right font-mono text-[10.5px] text-ink-faint">start with {ctl.setup.fauna[id]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Runs() {
  const ctl = useUi();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="h-title text-[14px]">Random seed</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={ctl.setup.seed}
            onChange={(e) => ctl.setSetup({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 font-mono text-[13px] text-ink"
            aria-label="Seed"
          />
          <button type="button" className="btn" onClick={() => ctl.newSeed()}>New seed</button>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => ctl.reset()}>Restart with this seed</button>
        <p className="text-[12px] leading-snug text-ink-faint">
          The same seed, parameters and actions reproduce a run exactly. The landscape is the same for every seed; the seed sets the animals and every chance event.
          Running: seed <b className="font-mono text-ink">{ctl.sim.setup.seed}</b>.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="h-title text-[14px]">Compare runs</h3>
        <button type="button" className="btn" onClick={() => ctl.saveRun()}>Save this run to the graph</button>
        {ctl.savedRuns.length === 0 && <p className="text-[12px] text-ink-faint">Saved runs appear as dashed lines on the population graph. Up to four are kept.</p>}
        {ctl.savedRuns.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-white/[0.07] px-2 py-1.5">
            <span className="flex items-center gap-2 text-[12px] text-ink-muted"><i className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: r.color }} />{r.label}</span>
            <button type="button" className="text-[12px] text-ink-faint hover:text-ink" onClick={() => ctl.removeRun(r.id)} aria-label={`Remove ${r.label}`}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Experiments() {
  const ctl = useUi();
  const active = ctl.experiment?.id;
  const outcomes = experimentOutcomes(ctl);
  return (
    <div className="flex flex-col gap-3">
      {EXPERIMENTS.map((e) => {
        const on = active === e.id;
        return (
          <article key={e.id} className={`rounded-lg border p-3 ${on ? 'border-forest/60 bg-forest/[0.08]' : 'border-white/[0.07]'}`}>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded bg-forest font-display text-[14px] text-char-950">{e.letter}</span>
              <h3 className="font-display text-[16px] uppercase tracking-[0.04em]">{e.title}</h3>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">{e.summary}</p>
            {on && (
              <div className="mt-2 flex flex-col gap-2 text-[12px]">
                <div>
                  <div className="font-medium text-ink">Hypotheses to test</div>
                  <ul className="ml-4 list-disc text-ink-muted">{e.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                <div>
                  <div className="font-medium text-ink">Measured so far (since the experiment began)</div>
                  <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                    {outcomes.map((o) => (<Fragment key={o.label}><dt className="text-ink-muted">{o.label}</dt><dd className="m-0 text-right font-mono text-ink">{o.value}</dd></Fragment>))}
                  </dl>
                </div>
                {e.id === 'reintroduce' && (
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => ctl.addWolves(6)}>Reintroduce 6 wolves</button>
                    <button type="button" className="btn" onClick={() => ctl.addWolves(12)}>+12</button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className={`btn mt-2 w-full ${on ? '' : 'btn-primary'}`} onClick={() => ctl.runExperiment(e.id)}>
              {e.inPlace ? 'Apply to current run' : on ? 'Restart experiment' : 'Run experiment'}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('experiments');
  return (
    <aside className="panel flex min-h-0 flex-col" aria-label="Simulation controls">
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] p-2" role="tablist">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'experiments' && <Experiments />}
        {tab === 'populations' && <Populations />}
        {tab === 'biology' && <ParamGroupPanel group="biology" />}
        {tab === 'environment' && <ParamGroupPanel group="environment" />}
        {tab === 'runs' && <Runs />}
      </div>
    </aside>
  );
}
