import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { fmtLength } from '../lib/format';

interface Props {
  id: string;
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  onChange: (v: number) => void;
}

export function Slider({ id, label, symbol, value, min, max, step, color, onChange }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  const style = { '--fill': `${fill}%`, '--accent': color } as CSSProperties;
  const clampRound = (x: number) => Math.round(Math.min(max, Math.max(min, x)) * 100) / 100;
  const nudge = (d: number) => onChange(clampRound(value + d));

  // Typed value: updates the triangle live while valid, clamps/reverts on Enter or blur.
  const [draft, setDraft] = useState(fmtLength(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(fmtLength(value));
  }, [value, editing]);

  const parse = (text: string) => {
    const t = text.trim().replace(',', '.');
    return /^\d*\.?\d+$|^\d+\.$/.test(t) ? parseFloat(t) : NaN;
  };
  const typed = parse(draft);
  const invalid = editing && draft.trim() !== '' && (Number.isNaN(typed) || typed < min || typed > max);

  const onType = (text: string) => {
    setDraft(text);
    const x = parse(text);
    if (!Number.isNaN(x) && x >= min && x <= max) onChange(Math.round(x * 100) / 100);
  };
  const commit = () => {
    const x = parse(draft);
    const next = Number.isNaN(x) ? value : clampRound(x);
    if (next !== value) onChange(next);
    setDraft(fmtLength(next));
    setEditing(false);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-2 font-display text-[16px] font-bold uppercase tracking-wide text-navy">
          <span
            className="grid h-6 w-6 place-items-center rounded-lg font-display text-sm font-extrabold text-white"
            style={{ backgroundColor: color }}
          >
            <span className="font-math normal-case">{symbol}</span>
          </span>
          {label} <span className="font-math normal-case">{symbol}</span>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Decrease ${symbol}`}
            onClick={() => nudge(-0.1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            −
          </button>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Type a length for side ${symbol} (${min} to ${max})`}
            title={`Type a number from ${min} to ${max}`}
            value={draft}
            onFocus={(e) => {
              setEditing(true);
              e.currentTarget.select();
            }}
            onChange={(e) => onType(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(fmtLength(value));
                setEditing(false);
                e.currentTarget.blur();
              }
            }}
            className={`w-[4.5rem] rounded-lg border-2 bg-white px-2 py-0.5 text-center font-mono text-sm font-semibold tabular-nums outline-none transition-colors ${
              invalid ? 'border-coral text-coral-600' : 'border-slate-200 text-slate-800 hover:border-slate-300 focus:border-navy'
            }`}
          />
          <button
            type="button"
            aria-label={`Increase ${symbol}`}
            onClick={() => nudge(0.1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            +
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={style}
        onChange={(e) => onChange(Math.round(parseFloat(e.target.value) * 100) / 100)}
      />
      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-slate-400">
        <span>{min}</span>
        {invalid && <span className="text-coral-600">Enter a number from {min} to {max}</span>}
        <span>{max}</span>
      </div>
    </div>
  );
}
