import type { ReactNode } from 'react';

export type ParticleKind = 'protons' | 'neutrons' | 'electrons';

interface Row {
  kind: ParticleKind;
  name: string;
  symbol: string;
  effect: string;
  color: string;
  gradient: string;
}

const ROWS: Row[] = [
  {
    kind: 'protons',
    name: 'Protons',
    symbol: 'p⁺',
    effect: 'Changes the element',
    color: 'text-proton',
    gradient: 'radial-gradient(circle at 35% 30%, #ffc4bd, #F37367 55%, #b8443a)',
  },
  {
    kind: 'neutrons',
    name: 'Neutrons',
    symbol: 'n⁰',
    effect: 'Changes the isotope',
    color: 'text-neutron',
    gradient: 'radial-gradient(circle at 35% 30%, #f1f4fa, #a9b4c8 55%, #5e6a82)',
  },
  {
    kind: 'electrons',
    name: 'Electrons',
    symbol: 'e⁻',
    effect: 'Changes the charge',
    color: 'text-electron',
    gradient: 'radial-gradient(circle at 35% 30%, #c9ecff, #4cb5ff 55%, #1667b8)',
  },
];

interface Props {
  counts: Record<ParticleKind, number>;
  limits: Record<ParticleKind, { min: number; max: number; maxReason: string; minReason: string }>;
  onChange: (kind: ParticleKind, delta: number) => void;
  footer?: ReactNode;
}

export function ParticleControls({ counts, limits, onChange, footer }: Props) {
  return (
    <div className="panel p-5">
      <h2 className="panel-title mb-4">Build your atom</h2>
      <div className="space-y-3">
        {ROWS.map((r) => {
          const value = counts[r.kind];
          const lim = limits[r.kind];
          const atMin = value <= lim.min;
          const atMax = value >= lim.max;
          return (
            <div key={r.kind} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 shrink-0 rounded-full shadow-lg" style={{ background: r.gradient }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold uppercase leading-none tracking-wide text-white">{r.name}</div>
                  <div className={`mt-0.5 font-math text-sm font-semibold ${r.color}`}>{r.symbol}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove one ${r.name.toLowerCase().slice(0, -1)}`}
                    title={atMin ? lim.minReason : `Remove a ${r.name.toLowerCase().slice(0, -1)}`}
                    disabled={atMin}
                    onClick={() => onChange(r.kind, -1)}
                  >
                    −
                  </button>
                  <span
                    key={value}
                    className="animate-pop w-9 text-center font-display text-3xl font-bold tabular-nums text-white"
                    aria-live="polite"
                    aria-label={`${value} ${r.name.toLowerCase()}`}
                  >
                    {value}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Add one ${r.name.toLowerCase().slice(0, -1)}`}
                    title={atMax ? lim.maxReason : `Add a ${r.name.toLowerCase().slice(0, -1)}`}
                    disabled={atMax}
                    onClick={() => onChange(r.kind, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="mt-2 border-t border-white/[0.05] pt-2 text-xs text-lab-300">→ {r.effect}</p>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
