import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BeakerScene } from './components/BeakerScene';
import type { DropEvent, PourEvent } from './components/BeakerScene';
import { PhScale } from './components/PhScale';
import { InfoPanel } from './components/InfoPanel';
import type { LogEntry } from './components/InfoPanel';
import { ComparePanel } from './components/ComparePanel';
import {
  addReagent,
  addWater,
  bandOf,
  classify,
  formatSci,
  INDICATOR_GRADIENT,
  indicatorCss,
  phOf,
  readingForPh,
  solutionWithPh,
  SUBSTANCES,
} from './lib/chemistry';
import type { Solution } from './lib/chemistry';
import {
  CAPACITY_L,
  DROP_VOLUME_L,
  DROPS_PER_DOSE,
  fmtMl,
  fmtMolarity,
  MOLARITIES,
  START_VOLUME_L,
  WATER_STEP_L,
} from './lib/lab';
import type { Molarity } from './lib/lab';

type Mode = 'experiment' | 'compare';

const WATER = SUBSTANCES.find((s) => s.id === 'water')!;
const POUR_SECONDS = 1.4;

interface DropMeta {
  kind: 'acid' | 'base';
  molarity: number;
}

export default function App() {
  const [solution, setSolution] = useState<Solution>(() => solutionWithPh(7, START_VOLUME_L));
  const [label, setLabel] = useState(WATER.name);
  const [substanceId, setSubstanceId] = useState<string | null>('water');
  const [molarity, setMolarity] = useState<Molarity>(0.1);
  const [drops, setDrops] = useState<DropEvent[]>([]);
  const [pours, setPours] = useState<PourEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<Mode>('experiment');
  const [compareIds, setCompareIds] = useState<[string, string]>(['lemon', 'coffee']);
  const [log, setLog] = useState<LogEntry[]>([]);

  const nextId = useRef(1);
  const dropMeta = useRef(new Map<number, DropMeta>());
  const doseLanded = useRef(new Map<number, { left: number; kind: 'acid' | 'base'; molarity: number }>());
  const dropDose = useRef(new Map<number, number>());

  // Mirror of `solution` so animation callbacks always build on the latest state.
  const solRef = useRef(solution);
  const apply = useCallback((f: (s: Solution) => Solution) => {
    const next = f(solRef.current);
    solRef.current = next;
    setSolution(next);
    return next;
  }, []);

  const ph = phOf(solution);

  const pushLog = useCallback((text: string, value: number) => {
    setLog((l) => [{ id: nextId.current++, text, ph: value }, ...l].slice(0, 6));
  }, []);

  // Volume already committed to droplets in flight and water being poured.
  const pendingL = drops.length * DROP_VOLUME_L + pours.length * WATER_STEP_L;
  const doseL = DROPS_PER_DOSE * DROP_VOLUME_L;
  const canDose = solution.volume + pendingL + doseL <= CAPACITY_L + 1e-9;
  const canWater = solution.volume + pendingL + WATER_STEP_L <= CAPACITY_L + 1e-9;
  const busy = drops.length > 0 || pours.length > 0;

  // ---- actions --------------------------------------------------------------

  const clearQueue = () => {
    setDrops([]);
    setPours([]);
    dropMeta.current.clear();
    dropDose.current.clear();
    doseLanded.current.clear();
  };

  const setPh = (value: number) => {
    const v = Math.min(14, Math.max(0, value));
    apply((s) => solutionWithPh(v, s.volume));
    setLabel('Custom solution');
    setSubstanceId(null);
  };

  const chooseSubstance = (id: string) => {
    const s = SUBSTANCES.find((x) => x.id === id)!;
    clearQueue();
    apply(() => solutionWithPh(s.ph, START_VOLUME_L));
    setLabel(s.name);
    setSubstanceId(s.id);
    pushLog(`Filled beaker with ${fmtMl(START_VOLUME_L)} mL of ${s.name.toLowerCase()}`, s.ph);
  };

  const dose = (kind: 'acid' | 'base') => {
    if (!canDose) return;
    const doseId = nextId.current++;
    const created: DropEvent[] = [];
    for (let i = 0; i < DROPS_PER_DOSE; i++) {
      const id = nextId.current++;
      dropMeta.current.set(id, { kind, molarity });
      dropDose.current.set(id, doseId);
      created.push({ id, beaker: 0, kind, delay: 0.35 + i * 0.32 });
    }
    doseLanded.current.set(doseId, { left: DROPS_PER_DOSE, kind, molarity });
    setDrops((d) => [...d, ...created]);
  };

  const onDropLanded = useCallback(
    (id: number) => {
      const meta = dropMeta.current.get(id);
      if (!meta) return;
      dropMeta.current.delete(id);
      setDrops((d) => d.filter((x) => x.id !== id));
      const next = apply((s) => addReagent(s, meta.kind, meta.molarity, DROP_VOLUME_L));
      const doseId = dropDose.current.get(id);
      dropDose.current.delete(id);
      const dl = doseId !== undefined ? doseLanded.current.get(doseId) : undefined;
      if (dl) {
        dl.left -= 1;
        if (dl.left === 0) {
          doseLanded.current.delete(doseId!);
          const what = meta.kind === 'acid' ? 'HCl (strong acid)' : 'NaOH (strong base)';
          pushLog(`Added ${fmtMl(DROPS_PER_DOSE * DROP_VOLUME_L)} mL of ${fmtMolarity(meta.molarity)} M ${what}`, phOf(next));
        }
      }
      setLabel((l) => (l.endsWith('(mixed)') || l === 'Custom solution' ? l : `${l} (mixed)`));
      setSubstanceId(null);
    },
    [apply, pushLog],
  );

  const pourWater = () => {
    if (!canWater) return;
    const id = nextId.current++;
    setPours((p) => [...p, { id, beaker: 0, duration: POUR_SECONDS }]);
  };

  const onPourStep = useCallback(
    (id: number, fraction: number, done: boolean) => {
      const next = apply((s) => addWater(s, WATER_STEP_L * fraction));
      if (done) pushLog(`Added ${fmtMl(WATER_STEP_L)} mL of pure water (dilution)`, phOf(next));
      if (done) setPours((p) => p.filter((x) => x.id !== id));
      setLabel((l) => (l.endsWith('(diluted)') || l === 'Custom solution' || l === WATER.name ? l : `${l.replace(' (mixed)', '')} (diluted)`));
    },
    [apply, pushLog],
  );

  const pourOutHalf = () => {
    if (busy) return;
    apply((s) => ({ volume: s.volume / 2, netAcid: s.netAcid / 2 }));
    pushLog(`Poured out half (${fmtMl(solution.volume / 2)} mL left) — pH unchanged`, ph);
  };

  const reset = () => {
    clearQueue();
    apply(() => solutionWithPh(7, START_VOLUME_L));
    setLabel(WATER.name);
    setSubstanceId('water');
    setMolarity(0.1);
    setMode('experiment');
    setPaused(false);
    setLog([]);
  };

  // ---- derived for render ------------------------------------------------------

  const compareA = SUBSTANCES.find((s) => s.id === compareIds[0])!;
  const compareB = SUBSTANCES.find((s) => s.id === compareIds[1])!;

  const beakers = useMemo(
    () =>
      mode === 'experiment'
        ? [{ ph, volume: solution.volume }]
        : [
            { ph: compareA.ph, volume: START_VOLUME_L * 2, label: `A · ${compareA.name}` },
            { ph: compareB.ph, volume: START_VOLUME_L * 2, label: `B · ${compareB.name}` },
          ],
    [mode, ph, solution.volume, compareA, compareB],
  );

  const reagentLabel = { acid: `${fmtMolarity(molarity)} M HCl`, base: `${fmtMolarity(molarity)} M NaOH` };
  const kind = classify(ph);
  const reading = readingForPh(ph);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 lg:px-8">
        {/* Wordmark laid out like The Brain Maze logo; "pH" stays in Saira to keep its lowercase p */}
        <div className="flex items-stretch gap-3 sm:gap-4">
          <h1 className="flex flex-col justify-center text-coral">
            <span className="flex items-baseline gap-2 leading-[0.9]">
              <span className="font-math text-[36px] font-extrabold sm:text-[54px]">pH</span>
              <span className="font-display text-[34px] font-bold uppercase tracking-wide sm:text-[52px]">Scale</span>
            </span>
            <span className="mt-1 flex items-center gap-2 sm:gap-3">
              <span className="h-[3px] flex-1 bg-coral sm:h-1" />
              <span className="font-display text-[34px] font-bold uppercase leading-[0.9] tracking-wide sm:text-[52px]">Lab</span>
            </span>
          </h1>
          <Logo />
          <p className="hidden max-w-[210px] self-center text-sm leading-snug text-lab-300 lg:block">
            Mix acids, bases and water and watch the <span className="font-math">pH</span> scale come alive.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border-2 border-white/15 bg-white/[0.04] p-1" role="tablist" aria-label="Mode">
            {(['experiment', 'compare'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded px-3.5 py-1.5 font-display text-base font-bold uppercase tracking-wide transition duration-200 ${
                  mode === m ? 'bg-coral text-white shadow' : 'text-lab-200 hover:text-white'
                }`}
              >
                {m === 'experiment' ? 'Experiment' : 'Compare two'}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? 'Resume animation' : 'Pause animation'}
          </button>
          <button type="button" className="btn-coral" onClick={reset}>
            <ResetIcon /> Reset
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 pb-10 pt-2 sm:px-6 lg:px-8 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        {/* Stage */}
        <section className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <div className="panel relative overflow-hidden">
            <div className="relative h-[420px] sm:h-[520px] xl:h-[600px]">
              <Suspense fallback={null}>
                <BeakerScene
                  beakers={beakers}
                  drops={mode === 'experiment' ? drops : []}
                  pours={mode === 'experiment' ? pours : []}
                  paused={paused}
                  onDropLanded={onDropLanded}
                  onPourStep={onPourStep}
                  reagentLabel={reagentLabel}
                />
              </Suspense>

              {/* Headline pH */}
              {mode === 'experiment' ? (
                <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-col items-center sm:top-5">
                  <div className="flex items-baseline gap-2 rounded-lg border-2 border-white/15 bg-lab-950/60 px-5 py-2 backdrop-blur-md">
                    <span className="font-math text-xl font-bold text-coral sm:text-2xl">pH</span>
                    <span className="font-display text-5xl font-bold tabular-nums text-white sm:text-6xl" style={{ textShadow: `0 0 30px ${indicatorCss(ph)}` }}>
                      {ph.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="rounded-md px-3 py-1 font-display text-base font-bold uppercase tracking-wide text-white shadow-lg transition-colors duration-500"
                      style={{ background: indicatorCss(ph), textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
                    >
                      {kind === 'acidic' ? 'Acidic' : kind === 'basic' ? 'Basic (alkaline)' : 'Neutral'}
                    </span>
                    {kind !== 'neutral' && (
                      <span className="rounded-md border border-white/15 bg-lab-950/70 px-3 py-1 font-display text-base font-bold uppercase tracking-wide text-lab-200 backdrop-blur">
                        {bandOf(ph)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center gap-3 sm:top-5">
                  {[compareA, compareB].map((s, i) => (
                    <div key={i} className="rounded-lg border-2 border-white/15 bg-lab-950/65 px-4 py-2 text-center backdrop-blur-md">
                      <div className="font-display text-sm font-bold text-coral">{i === 0 ? 'A' : 'B'}</div>
                      <div className="font-display text-3xl font-bold tabular-nums text-white" style={{ textShadow: `0 0 24px ${indicatorCss(s.ph)}` }}>
                        {s.ph.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Volume + status */}
              {mode === 'experiment' && (
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-2xl border border-white/10 bg-lab-950/60 px-3 py-2 text-xs backdrop-blur sm:bottom-4 sm:left-4">
                  <div className="font-display text-sm font-bold uppercase tracking-wide text-white">{label}</div>
                  <div className="font-mono text-lab-300">
                    {fmtMl(solution.volume)} / {CAPACITY_L * 1000} mL
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute bottom-3 right-3 max-w-[230px] text-right text-[11px] leading-snug text-lab-400 sm:bottom-4 sm:right-4">
                Drag to look around · scroll or pinch to zoom
                {paused && <div className="mt-1 font-display text-sm font-bold uppercase tracking-wide text-coral">Animation paused</div>}
              </div>
            </div>
          </div>

          <div className="panel p-5 pt-6 sm:p-6">
            <PhScale
              markers={mode === 'experiment' ? [{ ph }] : [{ ph: compareA.ph, label: 'A' }, { ph: compareB.ph, label: 'B' }]}
              onPick={mode === 'experiment' ? setPh : undefined}
            />
            <p className="mt-3 text-center text-[11px] leading-relaxed text-lab-400">
              Colours show a <b className="text-lab-200">universal indicator</b> added to the solution — they are not the natural colours of the substances.
            </p>
          </div>

          {mode === 'compare' && (
            <ComparePanel
              a={compareA}
              b={compareB}
              onChange={(slot, id) => setCompareIds((ids) => (slot === 0 ? [id, ids[1]] : [ids[0], id]))}
            />
          )}
        </section>

        {/* Controls */}
        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          {mode === 'compare' && (
            <Panel title="Compare mode">
              <p className="text-sm leading-relaxed text-lab-300">
                Two beakers of the same volume, each holding a different substance. Pick them below the pH scale and see how far apart
                their hydrogen ion concentrations are.
              </p>
              <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setMode('experiment')}>
                Back to the experiment
              </button>
            </Panel>
          )}
          {mode === 'experiment' && (
          <>
          <Panel title={<><Ph /> slider</>}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-lab-300">Set the solution’s pH</span>
              <span className="font-mono text-lg font-semibold text-white">{ph.toFixed(2)}</span>
            </div>
            <input
              id="ph-slider"
              type="range"
              min={0}
              max={14}
              step={0.01}
              value={Math.min(14, Math.max(0, ph))}
              onChange={(e) => setPh(parseFloat(e.target.value))}
              className="ph-range mt-2"
              disabled={mode !== 'experiment'}
              aria-label="pH"
              style={{ '--track': INDICATOR_GRADIENT, '--thumb': indicatorCss(ph) } as CSSProperties}
            />
            <div className="flex justify-between font-mono text-[10px] text-lab-400">
              <span>0</span>
              <span>7</span>
              <span>14</span>
            </div>
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-lab-300">[H⁺]</span>
                <span className="font-mono font-semibold text-white">{formatSci(reading.h, 2)} mol/L</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-lab-300">[OH⁻]</span>
                <span className="font-mono text-lab-200">{formatSci(reading.oh, 2)} mol/L</span>
              </div>
            </div>
          </Panel>

          <Panel title="Neutralization experiment">
            <p className="mb-3 text-xs leading-relaxed text-lab-300">
              Each click releases {DROPS_PER_DOSE} drops ({fmtMl(doseL)} mL) of a strong acid or strong base. Choose its concentration:
            </p>
            <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1" role="radiogroup" aria-label="Reagent concentration">
              {MOLARITIES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={molarity === m}
                  onClick={() => setMolarity(m)}
                  className={`rounded-xl py-1.5 font-mono text-xs font-semibold transition ${
                    molarity === m ? 'bg-coral text-white' : 'text-lab-200 hover:bg-white/[0.06]'
                  }`}
                >
                  {fmtMolarity(m)} M
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => dose('acid')}
                disabled={!canDose || mode !== 'experiment'}
                className="btn border border-[#f26522]/50 bg-gradient-to-b from-[#f26522]/30 to-[#d7191c]/20 text-white hover:from-[#f26522]/45"
              >
                <DropIcon /> Add Acid
              </button>
              <button
                type="button"
                onClick={() => dose('base')}
                disabled={!canDose || mode !== 'experiment'}
                className="btn border border-[#6c4bd6]/60 bg-gradient-to-b from-[#6c4bd6]/35 to-[#2479c1]/20 text-white hover:from-[#6c4bd6]/50"
              >
                <DropIcon /> Add Base
              </button>
            </div>
            <p className="mt-2 text-[11px] text-lab-400">
              Acid: {reagentLabel.acid} · Base: {reagentLabel.base}
            </p>
          </Panel>

          <Panel title="Dilution experiment">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={pourWater}
                disabled={!canWater || mode !== 'experiment'}
                className="btn border border-aqua/50 bg-gradient-to-b from-aqua/25 to-aqua/10 text-white hover:from-aqua/40"
              >
                <WaterIcon /> Add Water
              </button>
              <button type="button" onClick={pourOutHalf} disabled={busy || mode !== 'experiment' || solution.volume < 0.02} className="btn-ghost">
                Pour out half
              </button>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-lab-300">
                <span>Volume</span>
                <span className="font-mono">
                  {fmtMl(solution.volume)} / {CAPACITY_L * 1000} mL
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-white/10">
                <div className="h-full rounded-sm bg-aqua transition-[width] duration-300" style={{ width: `${(solution.volume / CAPACITY_L) * 100}%` }} />
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-lab-300">
              {canWater
                ? `Adds ${fmtMl(WATER_STEP_L)} mL of pure water. Diluting spreads the same ions through more water, so acids and bases move toward pH 7.`
                : 'The beaker is full. Pour out half to keep diluting — that leaves the pH unchanged.'}
            </p>
          </Panel>

          </>
          )}
          <Panel title="Choose a substance">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {SUBSTANCES.map((s) => {
                const active = substanceId === s.id && mode === 'experiment';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setMode('experiment');
                      chooseSubstance(s.id);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60 ${
                      active ? 'border-coral bg-coral/15' : 'border-white/[0.08] bg-white/[0.025] hover:border-coral/60 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="h-7 w-7 shrink-0 rounded-lg shadow-inner" style={{ background: indicatorCss(s.ph) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold uppercase leading-tight tracking-wide text-white">{s.name}</span>
                      <span className="block text-[11px] text-lab-400">{s.note}</span>
                    </span>
                    <span className="font-display text-xl font-bold text-lab-100">{s.ph}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Info */}
        <div className="order-3 flex min-w-0 flex-col gap-5">
          {mode === 'experiment' && <InfoPanel ph={ph} volume={solution.volume} label={label} log={log} />}
          <Panel title="About this model">
            <ul className="space-y-2 text-xs leading-relaxed text-lab-300">
              <li>
                <b className="text-lab-100">Formulas:</b> pH = −log₁₀[H⁺], pH + pOH = 14, [H⁺][OH⁻] = 1.0 × 10⁻¹⁴ — ideal dilute solutions at 25 °C.
              </li>
              <li>
                <b className="text-lab-100">Mixing:</b> a simplified strong-acid / strong-base model. Each drop adds a defined amount of HCl or NaOH;
                the pH is solved from the moles and total volume, so it changes on a logarithmic scale — not by a fixed amount per drop.
              </li>
              <li>
                <b className="text-lab-100">Substances</b> use typical approximate pH values and are treated as strong-acid or strong-base
                equivalents. Real lemon juice, vinegar or baking soda contain weak acids, bases and buffers, so they dilute and neutralize
                differently, and pH also changes with temperature.
              </li>
              <li>
                <b className="text-lab-100">Colours</b> represent a universal indicator added to the solution, not the substances’ real colours.
              </li>
            </ul>
          </Panel>
        </div>

        {/* Learn */}
        <section className="order-4 grid gap-4 sm:grid-cols-3 xl:col-span-3">
          <Learn color="#f26522" title={<>Acids · <Ph /> below 7</>}>
            Acids release hydrogen ions (H⁺) in water. The more H⁺, the lower the pH. Lemon juice and vinegar are everyday acids.
          </Learn>
          <Learn color="#4cb848" title={<>Neutral · <Ph /> 7</>}>
            In pure water at 25 °C, [H⁺] and [OH⁻] are equal at 1.0 × 10⁻⁷ mol/L. Mixing equal amounts of a strong acid and strong base also gives pH 7.
          </Learn>
          <Learn color="#6c4bd6" title={<>Bases · <Ph /> above 7</>}>
            Bases (alkalis) increase hydroxide ions (OH⁻) and lower [H⁺]. Soapy water and bleach are basic.
          </Learn>
        </section>
      </main>
    </div>
  );
}

/** "pH" inside Brain-set (caps-only) headings: keep the lowercase p. */
const Ph = () => <span className="font-math normal-case">pH</span>;

function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="panel-title mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Learn({ color, title, children }: { color: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
        <span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-lab-300">{children}</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="grid aspect-square w-[68px] shrink-0 place-items-center bg-coral sm:w-[110px]">
      <svg viewBox="0 0 32 32" className="h-[74%] w-[74%]" aria-hidden>
        <path d="M10 5h12M12 5v7l-5 12a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3l-5-12V5" fill="none" stroke="#232F5B" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9.2 19h13.6l2 4.6a1.4 1.4 0 0 1-1.3 2H8.5a1.4 1.4 0 0 1-1.3-2Z" fill="#232F5B" />
      </svg>
    </div>
  );
}

const iconProps = { viewBox: '0 0 20 20', className: 'h-4 w-4', 'aria-hidden': true } as const;
const PauseIcon = () => (
  <svg {...iconProps} fill="currentColor">
    <rect x="5" y="4" width="3.5" height="12" rx="1" />
    <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
  </svg>
);
const PlayIcon = () => (
  <svg {...iconProps} fill="currentColor">
    <path d="M6.3 3.9A1 1 0 0 0 4.8 4.8v10.4a1 1 0 0 0 1.5.9l8.6-5.2a1 1 0 0 0 0-1.8L6.3 3.9Z" />
  </svg>
);
const ResetIcon = () => (
  <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
    <path d="M3.5 3.5v3.5H7" />
  </svg>
);
const DropIcon = () => (
  <svg {...iconProps} fill="currentColor">
    <path d="M10 2.5c-.3 0-.5.1-.7.4C7.6 5.3 5 9 5 12a5 5 0 0 0 10 0c0-3-2.6-6.7-4.3-9.1-.2-.3-.4-.4-.7-.4Z" />
  </svg>
);
const WaterIcon = () => (
  <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0" />
    <path d="M3 9c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0" />
    <path d="M10 2v4" />
  </svg>
);
