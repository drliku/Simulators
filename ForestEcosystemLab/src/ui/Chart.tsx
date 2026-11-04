import { useEffect, useRef, useState } from 'react';
import { useUi } from '../runtime/context';
import { FAUNA_IDS, SPECIES, type FaunaId } from '../sim/species';

type Key = 'wolves' | 'deer' | 'vegPct';
const SERIES: { key: Key; label: string; color: string; axis: 'left' | 'right' }[] = [
  { key: 'wolves', label: 'Wolves', color: '#e5534b', axis: 'left' },
  { key: 'deer', label: 'Deer', color: '#4c8eda', axis: 'left' },
  { key: 'vegPct', label: 'Vegetation %', color: '#58b368', axis: 'right' },
];
const RANGES = [{ label: 'All', days: 0 }, { label: '100 d', days: 100 }, { label: '50 d', days: 50 }, { label: '20 d', days: 20 }];

function niceMax(v: number) {
  if (v <= 10) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Live population graph: wolves and deer on the left axis, vegetation % of capacity on the right. */
export function Chart() {
  const ctl = useUi();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState<Record<Key, boolean>>({ wolves: true, deer: true, vegPct: true });
  const [extra, setExtra] = useState<FaunaId[]>([]);
  const [range, setRange] = useState(0);
  const [hover, setHover] = useState<number | null>(null); // x in CSS px
  const [tip, setTip] = useState<{ x: number; day: number; vals: { label: string; color: string; v: string }[] } | null>(null);

  // When the graph is paused it shows a frozen copy (the simulation keeps running).
  const snap = useRef<{ day: number[]; deer: number[]; wolves: number[]; vegPct: number[]; species: Record<FaunaId, number[]>; frozen: boolean } | null>(null);
  if (!ctl.chartPaused || !snap.current?.frozen) {
    const h = ctl.sim.history, d = h.data;
    const sp = h.species as Record<FaunaId, number[]>;
    snap.current = ctl.chartPaused
      ? { day: d.day.slice(), deer: d.deer.slice(), wolves: d.wolves.slice(), vegPct: d.vegPct.slice(), species: Object.fromEntries(FAUNA_IDS.map((k) => [k, sp[k].slice()])) as Record<FaunaId, number[]>, frozen: true }
      : { day: d.day, deer: d.deer, wolves: d.wolves, vegPct: d.vegPct, species: sp, frozen: false };
  }
  const version = ctl.chartPaused ? -1 : ctl.uiVersion;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const pad = { l: 40, r: 40, t: 8, b: 20 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const data = snap.current!;
    const n = data.day.length;
    if (n === 0 || pw <= 10 || ph <= 10) return;
    const lastDay = data.day[n - 1];
    const d0 = range ? Math.max(data.day[0], lastDay - range) : data.day[0];
    const d1 = Math.max(d0 + 1, range ? d0 + range : lastDay);
    const i0 = Math.max(0, data.day.findIndex((d) => d >= d0));

    // Left axis covers visible animal counts, including saved runs.
    let maxL = 10;
    for (const k of ['wolves', 'deer'] as const) {
      if (!show[k]) continue;
      for (let i = i0; i < n; i++) maxL = Math.max(maxL, data[k][i]);
      for (const r of ctl.savedRuns) for (let i = 0; i < r.data.day.length; i++) if (r.data.day[i] >= d0 && r.data.day[i] <= d1) maxL = Math.max(maxL, r.data[k][i]);
    }
    for (const id of extra) for (let i = i0; i < n; i++) maxL = Math.max(maxL, data.species[id][i] ?? 0);
    maxL = niceMax(maxL * 1.05);
    const X = (d: number) => pad.l + ((d - d0) / (d1 - d0)) * pw;
    const YL = (v: number) => pad.t + ph - (v / maxL) * ph;
    const YR = (v: number) => pad.t + ph - (v / 100) * ph;

    // Grid and axes
    g.font = '10px "JetBrains Mono", monospace';
    g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = pad.t + (ph * k) / 4;
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + pw, y); g.stroke();
      g.fillStyle = '#a3b0a6'; g.textAlign = 'right';
      g.fillText(String(Math.round(maxL * (1 - k / 4))), pad.l - 5, y + 3);
      g.fillStyle = '#58b368'; g.textAlign = 'left';
      g.fillText(`${Math.round(100 * (1 - k / 4))}%`, pad.l + pw + 5, y + 3);
    }
    const span = d1 - d0;
    const step = span > 400 ? 100 : span > 150 ? 50 : span > 60 ? 20 : span > 25 ? 10 : 5;
    g.fillStyle = '#6f7d73'; g.textAlign = 'center';
    for (let d = Math.ceil(d0 / step) * step; d <= d1; d += step) {
      const x = X(d);
      g.strokeStyle = 'rgba(255,255,255,0.04)';
      g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + ph); g.stroke();
      g.fillText(`d${d}`, x, H - 6);
    }

    g.save();
    g.beginPath(); g.rect(pad.l, pad.t, pw, ph); g.clip();
    const line = (days: number[], vals: number[], from: number, color: string, right: boolean, dashed: boolean, width: number) => {
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dashed ? [5, 4] : []);
      g.beginPath();
      let started = false;
      for (let i = Math.max(0, from - 1); i < days.length; i++) {
        if (days[i] > d1 + 1) break;
        const x = X(days[i]), y = right ? YR(vals[i]) : YL(vals[i]);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
    };
    for (const r of ctl.savedRuns) for (const s of SERIES) if (show[s.key]) line(r.data.day, r.data[s.key], 0, r.color, s.axis === 'right', true, 1.2);
    for (const id of extra) line(data.day, data.species[id], i0, SPECIES[id].color, false, false, 1.5);
    for (const s of SERIES) if (show[s.key]) line(data.day, data[s.key], i0, s.color, s.axis === 'right', false, 2);
    g.setLineDash([]);

    // Hover
    if (hover !== null && hover >= pad.l && hover <= pad.l + pw) {
      const day = d0 + ((hover - pad.l) / pw) * (d1 - d0);
      let bi = i0;
      for (let i = i0; i < n; i++) if (Math.abs(data.day[i] - day) < Math.abs(data.day[bi] - day)) bi = i;
      const x = X(data.day[bi]);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + ph); g.stroke();
      for (const s of SERIES) if (show[s.key]) {
        const v = data[s.key][bi];
        g.fillStyle = s.color; g.beginPath(); g.arc(x, s.axis === 'right' ? YR(v) : YL(v), 3.5, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      setTip({ x, day: data.day[bi], vals: [
        ...SERIES.filter((s) => show[s.key]).map((s) => ({ label: s.label, color: s.color, v: s.key === 'vegPct' ? `${data[s.key][bi].toFixed(0)}%` : String(data[s.key][bi]) })),
        ...extra.map((id) => ({ label: SPECIES[id].plural[0].toUpperCase() + SPECIES[id].plural.slice(1), color: SPECIES[id].color, v: String(data.species[id][bi] ?? 0) })),
      ] });
      return;
    }
    g.restore();
    setTip(null);
  }, [version, show, extra, range, hover, ctl.savedRuns, ctl.savedRuns.length]);

  return (
    <section className="panel flex min-h-0 min-w-0 flex-col" aria-label="Population graph">
      <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto whitespace-nowrap border-b border-white/[0.06] px-3 py-1.5 [&>*]:shrink-0">
        <h2 className="h-title mr-2 text-[14px]">Populations over time</h2>
        {SERIES.map((s) => (
          <button key={s.key} type="button" className="chip flex items-center gap-1.5" aria-pressed={show[s.key]} onClick={() => setShow({ ...show, [s.key]: !show[s.key] })}>
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color, opacity: show[s.key] ? 1 : 0.3 }} />{s.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {RANGES.map((r) => <button key={r.label} type="button" className="chip" aria-pressed={range === r.days} onClick={() => setRange(r.days)}>{r.label}</button>)}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button type="button" className="chip" aria-pressed={ctl.chartPaused} onClick={() => ctl.setChartPaused(!ctl.chartPaused)}>{ctl.chartPaused ? 'Resume graph' : 'Pause graph'}</button>
        <button type="button" className="chip" onClick={() => ctl.resetHistory()}>Clear history</button>
      </div>
      <div className="scroll-thin flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-white/[0.06] px-3 py-1 [&>*]:shrink-0" aria-label="Show other species on the graph">
        <span className="mr-1 text-[11px] text-ink-faint">Also plot:</span>
        {FAUNA_IDS.map((id) => {
          const on = extra.includes(id);
          return (
            <button key={id} type="button" className="chip flex h-6 items-center gap-1 px-1.5 text-[11px]" aria-pressed={on} onClick={() => setExtra(on ? extra.filter((e) => e !== id) : [...extra, id])}>
              <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: SPECIES[id].color, opacity: on ? 1 : 0.4 }} />{SPECIES[id].plural}
            </button>
          );
        })}
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full"
          onMouseMove={(e) => setHover(e.clientX - e.currentTarget.getBoundingClientRect().left)}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Graph of wolves, deer and vegetation. Currently ${ctl.sim.count('wolf')} wolves, ${ctl.sim.count('deer')} deer.`}
        />
        {tip && (
          <div className="pointer-events-none absolute top-2 rounded-md border border-white/10 bg-char-950/95 px-2 py-1 text-[11px] shadow-lg"
            style={{ left: tip.x + 10, transform: tip.x > 400 ? 'translateX(calc(-100% - 20px))' : undefined }}>
            <div className="font-mono text-ink-muted">day {tip.day.toFixed(1)}</div>
            {tip.vals.map((v) => <div key={v.label} className="flex justify-between gap-3"><span style={{ color: v.color }}>{v.label}</span><span className="font-mono text-ink">{v.v}</span></div>)}
          </div>
        )}
      </div>
    </section>
  );
}
