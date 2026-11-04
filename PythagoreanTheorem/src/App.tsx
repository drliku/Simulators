import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TriangleCanvas } from './components/TriangleCanvas';
import { FormulaPanel } from './components/FormulaPanel';
import { Slider } from './components/Slider';
import { Toggle } from './components/Toggle';
import { AreaBars } from './components/AreaBars';
import { CLASSIC, MAX_LEG, MIN_LEG, round2, toDeg } from './lib/geometry';
import type { TriangleState } from './lib/geometry';
import { fmtLength, fmtTenThousandths, hypotenuse, squareTenThousandths } from './lib/format';
import { COLORS } from './lib/theme';
import { DEMO_PHASES, useDemo } from './hooks/useDemo';
import type { DemoFrame } from './hooks/useDemo';

const PRESETS: { label: string; a: number; b: number }[] = [
  { label: '3 · 4 · 5', a: 3, b: 4 },
  { label: '5 · 12 · 13', a: 5, b: 12 },
  { label: '6 · 8 · 10', a: 6, b: 8 },
  { label: '8 · 15 · 17', a: 8, b: 15 },
  { label: '1 · 1 · √2', a: 1, b: 1 },
];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function captionFor(frame: DemoFrame | null, s: TriangleState): string | null {
  if (!frame) return null;
  const a2 = fmtTenThousandths(squareTenThousandths(s.a));
  const b2 = fmtTenThousandths(squareTenThousandths(s.b));
  const c2 = fmtTenThousandths(hypotenuse(s.a, s.b).c2);
  switch (frame.phase) {
    case 'highlightA':
      return `The square on side a has area a² = ${a2}`;
    case 'highlightB':
      return `The square on side b has area b² = ${b2}`;
    case 'highlightC':
      return `The square on the hypotenuse c has area c² = ${c2}`;
    case 'shear1':
      return '① Shear — sliding one side along its line keeps the area the same';
    case 'rotate':
      return '② Rotate 90° — turning a shape never changes its area';
    case 'shear2':
      return '③ Shear again — the two pieces fill c² exactly';
    case 'conclude':
      return `a² + b² = c²   ·   ${a2} + ${b2} = ${c2}`;
  }
}

export default function App() {
  const [tri, setTri] = useState<TriangleState>(CLASSIC);
  const [showSquares, setShowSquares] = useState(true);
  const [showUnitGrid, setShowUnitGrid] = useState(true);
  const demo = useDemo();
  const tween = useRef(0);

  const cancelTween = () => cancelAnimationFrame(tween.current);

  /** Smoothly animate to a new triangle (used by Reset and presets). */
  const animateTo = useCallback((target: TriangleState) => {
    cancelAnimationFrame(tween.current);
    let from: TriangleState | null = null;
    const start = performance.now();
    const step = (now: number) => {
      const t = easeOut(Math.min(1, (now - start) / 650));
      setTri((cur) => {
        from ??= cur;
        if (t >= 1) return target;
        return {
          a: round2(from.a + (target.a - from.a) * t),
          b: round2(from.b + (target.b - from.b) * t),
          rot: from.rot + shortestAngle(from.rot, target.rot) * t,
          origin: {
            x: from.origin.x + (target.origin.x - from.origin.x) * t,
            y: from.origin.y + (target.origin.y - from.origin.y) * t,
          },
        };
      });
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  const interact = () => {
    cancelTween();
    if (demo.frame) demo.stop();
  };

  const setSide = (key: 'a' | 'b', value: number) => {
    interact();
    setTri((t) => ({ ...t, [key]: value }));
  };

  const reset = () => {
    demo.stop();
    setShowSquares(true);
    animateTo(CLASSIC);
  };

  const playDemo = () => {
    cancelTween();
    demo.play();
  };

  const hyp = hypotenuse(tri.a, tri.b);
  const alpha = toDeg(Math.atan2(tri.a, tri.b)); // angle at A, opposite side a
  const beta = 90 - alpha;

  const stats = [
    { key: 'a', name: 'Leg a', len: fmtLength(tri.a), area: fmtTenThousandths(squareTenThousandths(tri.a)), color: COLORS.a, approx: false },
    { key: 'b', name: 'Leg b', len: fmtLength(tri.b), area: fmtTenThousandths(squareTenThousandths(tri.b)), color: COLORS.b, approx: false },
    { key: 'c', name: 'Hyp. c', len: hyp.text, area: fmtTenThousandths(hyp.c2), color: COLORS.c, approx: !hyp.exact },
  ];

  const demoActive = demo.frame !== null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-2 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {/* Wordmark laid out like The Brain Maze logo: big word, rule + word, coral icon block */}
        <div className="flex items-stretch gap-3 sm:gap-4">
          <div className="flex flex-col justify-center leading-none">
            <h1 className="font-display text-[36px] font-extrabold uppercase leading-[0.9] tracking-wide text-coral sm:text-[58px]">
              Pythagorean
            </h1>
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <span className="h-[3px] flex-1 bg-coral sm:h-1" />
              <span className="font-display text-[36px] font-extrabold uppercase leading-[0.9] tracking-wide text-coral sm:text-[58px]">
                Lab
              </span>
            </div>
          </div>
          <div className="grid aspect-square w-[64px] shrink-0 place-items-center bg-coral sm:w-[104px]">
            <svg viewBox="0 0 32 32" className="h-3/4 w-3/4" aria-hidden>
              <path d="M7 26 L7 7 L26 26 Z" fill="none" stroke={COLORS.ink} strokeWidth="2.8" strokeLinejoin="round" />
              <rect x="7" y="21" width="5" height="5" fill="none" stroke={COLORS.ink} strokeWidth="2" />
            </svg>
          </div>
        </div>
        <p className="hidden max-w-sm text-right text-sm font-medium text-slate-500 md:block">
          Experiment with right triangles and see&nbsp;why <span className="whitespace-nowrap font-math font-bold text-navy">a² + b² = c²</span>.
        </p>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:px-8">
        {/* Left: the laboratory */}
        <section className="flex min-w-0 flex-col gap-5">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <ChipToggle label="Squares" checked={showSquares} onChange={(v) => { demo.stop(); setShowSquares(v); }} />
                <ChipToggle label="Unit grid" checked={showUnitGrid} onChange={setShowUnitGrid} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {demoActive ? (
                  <button type="button" className="btn-ghost" onClick={demo.stop}>
                    <StopIcon /> {demo.running ? 'Stop' : 'Close proof'}
                  </button>
                ) : null}
                <button type="button" className="btn-primary" onClick={playDemo}>
                  <PlayIcon /> {demoActive ? 'Replay' : 'Animate proof'}
                </button>
                <button type="button" className="btn-ghost" onClick={reset} title="Return to the classic 3-4-5 triangle">
                  <ResetIcon /> Reset
                </button>
              </div>
            </div>

            {/* Demo progress */}
            <div className="h-1 w-full bg-slate-100/60">
              <div
                className="h-full bg-coral transition-opacity duration-300"
                style={{ width: `${(demo.frame?.overall ?? 0) * 100}%`, opacity: demoActive ? 1 : 0 }}
              />
            </div>

            <div className="relative h-[420px] sm:h-[520px] lg:h-[600px]">
              <TriangleCanvas
                state={tri}
                onChange={setTri}
                onInteract={interact}
                showSquares={showSquares}
                showUnitGrid={showUnitGrid}
                demo={demo.frame}
                caption={captionFor(demo.frame, tri)}
              />
              {!demoActive && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[11px] text-slate-500 sm:text-xs">
                  <span className="sm:hidden">
                    <Hint dot={COLORS.ink}>Drag the vertices A, B and C</Hint>
                  </span>
                  <span className="hidden flex-wrap gap-2 sm:flex">
                    <Hint dot={COLORS.b}>Drag A to change b</Hint>
                    <Hint dot={COLORS.a}>Drag B to change a</Hint>
                    <Hint dot={COLORS.ink}>Drag C to swing around the hypotenuse</Hint>
                  </span>
                </div>
              )}
            </div>

            {demoActive && (
              <ol className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2.5 text-[11px] font-medium text-slate-400 sm:px-4">
                {DEMO_PHASES.map((p, i) => (
                  <li
                    key={p.id}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1 font-math font-bold transition-colors duration-300 ${
                      demo.frame && i === demo.frame.index
                        ? 'bg-coral text-white'
                        : demo.frame && i < demo.frame.index
                          ? 'text-slate-600'
                          : ''
                    }`}
                  >
                    {PHASE_LABELS[p.id]}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <FormulaPanel a={tri.a} b={tri.b} highlight={demo.frame?.phase === 'conclude'} />
        </section>

        {/* Right: controls + measurements */}
        <aside className="flex min-w-0 flex-col gap-5">
          <div className="card p-5">
            <PanelTitle>Adjust the legs</PanelTitle>
            <div className="space-y-4">
              <Slider id="side-a" label="Side" symbol="a" value={tri.a} min={MIN_LEG} max={MAX_LEG} step={0.01} color={COLORS.a} onChange={(v) => setSide('a', v)} />
              <Slider id="side-b" label="Side" symbol="b" value={tri.b} min={MIN_LEG} max={MAX_LEG} step={0.01} color={COLORS.b} onChange={(v) => setSide('b', v)} />
            </div>
            <div className="mt-5">
              <p className="mb-2 font-display text-[15px] font-bold uppercase tracking-wider text-slate-500">Pythagorean triples</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const active = tri.a === p.a && tri.b === p.b;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        demo.stop();
                        animateTo({ ...tri, a: p.a, b: p.b });
                      }}
                      className={`rounded-lg border-2 px-3 py-1 font-mono text-xs font-semibold transition duration-200 ${
                        active
                          ? 'border-navy bg-navy text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-navy hover:text-navy'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <PanelTitle>Measurements</PanelTitle>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy text-left font-display text-[14px] uppercase tracking-wider text-white">
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 text-right font-medium">Length</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Square area</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.key} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2 whitespace-nowrap font-medium text-slate-700">
                          <span className="h-2.5 w-2.5" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                        {s.approx && <span className="text-slate-400">≈</span>}
                        {s.len}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums" style={{ color: s.color }}>
                        {s.area}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Angle label="∠A" value={alpha} />
              <Angle label="∠B" value={beta} />
              <Angle label="∠C" value={90} exact />
            </div>
          </div>

          <div className="card p-5">
            <PanelTitle>Area balance</PanelTitle>
            <AreaBars a={tri.a} b={tri.b} />
          </div>

          <div className="rounded-3xl bg-navy p-5 text-sm leading-relaxed text-slate-200">
            <p className="section-title mb-2">Try this</p>
            <ul className="list-disc space-y-1 pl-4 marker:text-coral">
              <li>Turn on the unit grid and count: 9 + 16 small squares fill exactly 25.</li>
              <li>Drag vertex C — the hypotenuse stays fixed, so c² never changes, even though a and b do.</li>
              <li>Press <em>Animate proof</em> to watch Euclid’s shear-and-rotate argument.</li>
            </ul>
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
        <span className="mx-auto mb-3 block h-[3px] w-10 bg-coral" />
        For a right triangle with legs a, b and hypotenuse c: a² + b² = c².
      </footer>
    </div>
  );
}

const PHASE_LABELS: Record<DemoFrame['phase'], string> = {
  highlightA: 'a²',
  highlightB: 'b²',
  highlightC: 'c²',
  shear1: '① SHEAR',
  rotate: '② ROTATE',
  shear2: '③ SHEAR',
  conclude: 'a² + b² = c²',
};

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title mb-4">{children}</h2>;
}

function Angle({ label, value, exact }: { label: string; value: number; exact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2 py-2">
      <div className="font-display text-[14px] font-bold text-coral">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums text-slate-800">
        {exact ? '90' : value.toFixed(2)}°
      </div>
    </div>
  );
}

function Hint({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 backdrop-blur">
      <span className="h-2 w-2" style={{ backgroundColor: dot }} />
      {children}
    </span>
  );
}

function ChipToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-lg border-2 border-slate-200 bg-white px-3 py-0.5">
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M6.3 3.9A1 1 0 0 0 4.8 4.8v10.4a1 1 0 0 0 1.5.9l8.6-5.2a1 1 0 0 0 0-1.8L6.3 3.9Z" />
  </svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
    <rect x="5" y="5" width="10" height="10" rx="2" />
  </svg>
);
const ResetIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
    <path d="M3.5 3.5v3.5H7" />
  </svg>
);
