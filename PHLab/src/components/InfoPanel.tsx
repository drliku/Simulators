import type { ReactNode } from 'react';
import { bandOf, classify, explain, formatFactor, formatSci, indicatorCss, readingForPh } from '../lib/chemistry';
import { fmtMl } from '../lib/lab';

export interface LogEntry {
  id: number;
  text: string;
  ph: number;
}

interface Props {
  ph: number;
  volume: number;
  label: string;
  log: LogEntry[];
}

const KIND_STYLE = {
  acidic: { text: 'Acidic', cls: 'border-[#f26522]/50 bg-[#f26522]/15 text-[#ffa27a]' },
  neutral: { text: 'Neutral', cls: 'border-[#4cb848]/50 bg-[#4cb848]/15 text-[#8be08a]' },
  basic: { text: 'Basic (alkaline)', cls: 'border-[#6c4bd6]/60 bg-[#6c4bd6]/20 text-[#c2b2ff]' },
} as const;

function Row({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <span className="text-sm text-lab-300">{label}</span>
      <span className="text-right">
        <span className="font-mono text-sm font-semibold tabular-nums text-white">{value}</span>
        {sub && <span className="block text-[11px] text-lab-400">{sub}</span>}
      </span>
    </div>
  );
}

export function InfoPanel({ ph, volume, label, log }: Props) {
  const r = readingForPh(ph);
  const kind = KIND_STYLE[classify(ph)];
  const vsWater = Math.pow(10, Math.abs(7 - Math.round(ph * 100) / 100));
  const k = classify(ph);

  return (
    <div className="panel p-5">
      <h2 className="panel-title mb-4">Chemistry readout</h2>

      <div className="flex items-center gap-4">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center border-2 border-white/30 font-display text-3xl font-bold text-white shadow-lg transition-colors duration-500"
          style={{ background: indicatorCss(ph), textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}
        >
          {ph.toFixed(2)}
        </div>
        <div className="min-w-0">
          <span className={`inline-flex rounded-md border px-2.5 py-0.5 font-display text-sm font-bold uppercase tracking-wide ${kind.cls}`}>{kind.text}</span>
          <div className="mt-1.5 font-display text-2xl font-bold uppercase tracking-wide text-coral">{bandOf(ph)}</div>
          <div className="truncate text-xs text-lab-300">{label}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3">
        <Row label="pH" value={r.ph.toFixed(2)} sub="pH = −log₁₀[H⁺]" />
        <Row label="pOH" value={r.poh.toFixed(2)} sub="pOH = 14 − pH" />
        <Row label={<>Hydrogen ions [H⁺]</>} value={`${formatSci(r.h, 2)} M`} />
        <Row label={<>Hydroxide ions [OH⁻]</>} value={`${formatSci(r.oh, 2)} M`} />
        <Row label="Volume" value={`${fmtMl(volume)} mL`} />
        <Row
          label="Compared with pure water"
          value={k === 'neutral' ? 'same' : `${formatFactor(vsWater)}×`}
          sub={k === 'acidic' ? 'more H⁺' : k === 'basic' ? 'more OH⁻' : '[H⁺] = [OH⁻]'}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-lab-200">{explain(ph)}</p>

      {log.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-lab-200">Lab notebook</h3>
          <ol className="space-y-1.5">
            {log.map((e) => (
              <li key={e.id} className="animate-rise flex items-center gap-2 text-xs text-lab-200">
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: indicatorCss(e.ph) }} />
                <span className="min-w-0 flex-1">{e.text}</span>
                <span className="font-mono text-lab-300">pH {e.ph.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
