import { formatFactor, formatSci, indicatorCss, readingForPh, SUBSTANCES, sup } from '../lib/chemistry';
import type { Substance } from '../lib/chemistry';

interface Props {
  a: Substance;
  b: Substance;
  onChange: (slot: 0 | 1, id: string) => void;
}

function Picker({ slot, value, onChange }: { slot: 0 | 1; value: Substance; onChange: Props['onChange'] }) {
  return (
    <div>
      <div className="mb-2 font-display text-base font-bold uppercase tracking-wide text-lab-100">Beaker {slot === 0 ? 'A' : 'B'}</div>
      <div className="flex flex-wrap gap-1.5">
        {SUBSTANCES.map((s) => {
          const active = s.id === value.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(slot, s.id)}
              aria-pressed={active}
              className={`chip ${active ? 'border-coral bg-coral/20 text-white' : ''}`}
            >
              <span className="h-2.5 w-2.5" style={{ background: indicatorCss(s.ph) }} />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ComparePanel({ a, b, onChange }: Props) {
  const ra = readingForPh(a.ph);
  const rb = readingForPh(b.ph);
  const diff = Math.abs(a.ph - b.ph);
  const ratio = Math.pow(10, diff);
  const [more, less] = a.ph <= b.ph ? [a, b] : [b, a];

  return (
    <div className="panel p-5">
      <h2 className="panel-title mb-4">Compare two solutions</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Picker slot={0} value={a} onChange={onChange} />
        <Picker slot={1} value={b} onChange={onChange} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          { s: a, r: ra, tag: 'A' },
          { s: b, r: rb, tag: 'B' },
        ].map(({ s, r, tag }) => (
          <div key={tag} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center font-display text-2xl font-bold text-white"
              style={{ background: indicatorCss(s.ph), textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}
            >
              {s.ph}
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-display text-base font-bold uppercase tracking-wide text-white">
                {tag}: {s.name}
              </div>
              <div className="font-mono text-xs text-lab-300">[H⁺] ≈ {formatSci(r.h, 1)} M</div>
              <div className="font-mono text-xs text-lab-300">[OH⁻] ≈ {formatSci(r.oh, 1)} M</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-coral/40 bg-coral/[0.07] p-4 text-sm leading-relaxed text-lab-100">
        {diff < 0.005 ? (
          <>Both solutions have the same pH, so they have the same hydrogen ion concentration.</>
        ) : (
          <>
            The pH values differ by <b className="text-white">{diff.toFixed(1)}</b> unit{diff === 1 ? '' : 's'}, so{' '}
            <b className="text-white">{more.name.toLowerCase()}</b> has about{' '}
            <b className="text-white">
              10{sup(diff.toFixed(1).replace(/\.0$/, ''))} ≈ {formatFactor(ratio)}×
            </b>{' '}
            more hydrogen ions than <b className="text-white">{less.name.toLowerCase()}</b>.
          </>
        )}
        <p className="mt-2 text-xs text-lab-300">
          Each step of one pH unit is a tenfold change in hydrogen ion activity, which this simulator approximates with
          concentration. Two units = 100×, three units = 1,000×.
        </p>
      </div>
    </div>
  );
}
