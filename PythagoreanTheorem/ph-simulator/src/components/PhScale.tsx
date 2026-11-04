import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BANDS, INDICATOR_GRADIENT, indicatorCss } from '../lib/chemistry';

interface Marker {
  ph: number;
  label?: string;
}

interface Props {
  markers: Marker[];
  /** When provided, clicking or dragging along the scale sets the pH. */
  onPick?: (ph: number) => void;
}

const BAND_STYLE: Record<string, string> = {
  'Strong acid': 'text-[#ff7a59]',
  'Weak acid': 'text-[#fbb817]',
  Neutral: 'text-[#6bd36a]',
  'Weak base': 'text-[#3cc1d4]',
  'Strong base': 'text-[#a98cf0]',
};

export function PhScale({ markers, onPick }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const phAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(t * 14 * 100) / 100;
  };
  const down = (e: ReactPointerEvent) => {
    if (!onPick) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onPick(phAt(e.clientX));
  };
  const move = (e: ReactPointerEvent) => {
    if (dragging.current && onPick) onPick(phAt(e.clientX));
  };
  const up = () => (dragging.current = false);

  return (
    <div className="select-none">
      <div className="h-8" />
      <div
        ref={bar}
        className={`relative h-12 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] sm:h-14 ${onPick ? 'cursor-pointer' : ''}`}
        style={{ background: INDICATOR_GRADIENT, touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role={onPick ? 'slider' : undefined}
        aria-label={onPick ? 'pH scale' : undefined}
        aria-valuemin={0}
        aria-valuemax={14}
        aria-valuenow={markers[0] ? Math.round(markers[0].ph * 100) / 100 : undefined}
      >
        {/* band separators */}
        {[3, 6.5, 7.5, 11].map((v) => (
          <span key={v} className="absolute inset-y-1 w-px bg-white/35" style={{ left: `${(v / 14) * 100}%` }} />
        ))}
        {/* glossy highlight */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/25 to-transparent" />

        {markers.map((m, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out"
            style={{ left: `${(Math.min(14, Math.max(0, m.ph)) / 14) * 100}%` }}
          >
            <div className="h-16 w-1.5 rounded-sm bg-white shadow-[0_0_0_2px_rgba(10,18,40,0.6),0_6px_18px_rgba(0,0,0,0.5)] sm:h-[72px]" />
            <div
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-white px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-lg"
              style={{ background: indicatorCss(m.ph) }}
            >
              {m.label ? `${m.label} · ` : ''}
              {m.ph.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Ticks */}
      <div className="relative mt-2 h-6">
        {Array.from({ length: 15 }, (_, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-center font-mono text-[11px] font-semibold text-lab-200 sm:text-xs"
            style={{ left: `${(i / 14) * 100}%` }}
          >
            <span className="mx-auto mb-0.5 block h-1.5 w-px bg-lab-300/60" />
            {i}
          </span>
        ))}
      </div>
      {/* Band labels */}
      <div className="relative mt-2 flex h-9 overflow-hidden rounded-xl border border-white/[0.06]">
        {BANDS.map((b) => (
          <div
            key={b.band}
            className="flex items-center justify-center border-r border-white/[0.06] bg-white/[0.03] px-0.5 text-center last:border-r-0"
            style={{ width: `${((b.to - b.from) / 14) * 100}%` }}
          >
            <span className={`font-display text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-sm ${BAND_STYLE[b.band]}`}>{b.band}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-lab-300">
        <span>← More acidic</span>
        <span>More basic (alkaline) →</span>
      </div>
    </div>
  );
}
