import { CATEGORY_INFO, ELEMENTS } from '../lib/elements';
import type { Category } from '../lib/elements';

interface Props {
  activeZ: number;
  onPick: (z: number) => void;
}

export function PeriodicTable({ activeZ, onPick }: Props) {
  const categories = Object.keys(CATEGORY_INFO) as Category[];
  return (
    <div className="panel p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="panel-title">Periodic table · elements 1–36</h2>
        <span className="text-xs text-lab-300">Click an element to build its neutral atom</span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="mx-auto grid min-w-[620px] max-w-[1040px] gap-1.5" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
          {ELEMENTS.map((el) => {
            const c = CATEGORY_INFO[el.category].color;
            const active = el.z === activeZ;
            return (
              <button
                key={el.z}
                type="button"
                onClick={() => onPick(el.z)}
                title={`${el.name} (Z = ${el.z})`}
                aria-label={`${el.name}, atomic number ${el.z}`}
                aria-pressed={active}
                className={`group relative flex aspect-square flex-col items-center justify-center rounded border transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  active ? 'z-10 scale-110 shadow-lg' : 'hover:-translate-y-0.5 hover:brightness-125'
                }`}
                style={{
                  gridColumn: el.group,
                  gridRow: el.period,
                  borderColor: active ? c : `${c}40`,
                  background: active ? `${c}40` : `${c}14`,
                  boxShadow: active ? `0 0 24px -4px ${c}` : undefined,
                }}
              >
                <span className="absolute left-1 top-0.5 font-mono text-[8px] text-lab-300 sm:text-[9px]">{el.z}</span>
                <span className="font-math text-[13px] font-bold text-white sm:text-sm">{el.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-[1040px] flex-wrap gap-x-4 gap-y-1.5">
        {categories.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-lab-300">
            <span className="h-2.5 w-2.5" style={{ background: CATEGORY_INFO[k].color }} />
            {CATEGORY_INFO[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
