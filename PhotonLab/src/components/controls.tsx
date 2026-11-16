import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const clampNum = (v: number, lo?: number, hi?: number) => {
  if (lo !== undefined && v < lo) return lo;
  if (hi !== undefined && v > hi) return hi;
  return v;
};

const fmt = (v: number, precision: number) => {
  if (!Number.isFinite(v)) return '';
  return String(+v.toFixed(precision));
};

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  unit?: string;
  disabled?: boolean;
  integer?: boolean;
  className?: string;
  title?: string;
}

/** Numeric text field with validation, clamping, arrow-key stepping and units. */
export function NumberInput({ value, onChange, min, max, step = 1, precision = 2, unit, disabled, integer, className, title }: NumberInputProps) {
  const [text, setText] = useState(fmt(value, precision));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value, precision));
  }, [value, precision]);

  const commit = (raw: string) => {
    const v = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(v)) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 600);
      setText(fmt(value, precision));
      return;
    }
    let n = clampNum(v, min, max);
    if (integer) n = Math.round(n);
    setText(fmt(n, precision));
    if (n !== value) onChange(n);
  };

  return (
    <div
      className={`flex h-7 items-center rounded-[10px] border-2 bg-white transition-colors focus-within:border-bm-coral ${
        invalid ? 'border-red-500/80' : 'border-bm-mist hover:border-bm-coral'
      } ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      title={title}
    >
      <input
        className="w-full min-w-0 bg-transparent px-2 text-right font-mono text-[11.5px] text-bm-navy outline-none"
        value={text}
        disabled={disabled}
        inputMode="decimal"
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') {
            setText(fmt(value, precision));
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            let n = clampNum(value + dir * step * (e.shiftKey ? 10 : 1), min, max);
            n = integer ? Math.round(n) : +n.toFixed(precision + 2);
            setText(fmt(n, precision));
            onChange(n);
          }
        }}
      />
      {unit && <span className="pr-2 text-[10.5px] text-bm-faint">{unit}</span>}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Hard limits for typed values (default: slider range). */
  hardMin?: number;
  hardMax?: number;
  unit?: string;
  precision?: number;
  integer?: boolean;
  hint?: string;
  disabled?: boolean;
  accent?: string;
}

export function SliderRow({ label, value, onChange, min, max, step = 0.01, hardMin, hardMax, unit, precision = 2, integer, hint, disabled, accent }: SliderRowProps) {
  return (
    <div className={`space-y-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="truncate text-[11px] text-bm-muted" title={hint}>
          {label}
        </label>
        <NumberInput
          className="w-[92px] shrink-0"
          value={value}
          onChange={onChange}
          min={hardMin ?? min}
          max={hardMax ?? max}
          step={step}
          unit={unit}
          precision={precision}
          integer={integer}
        />
      </div>
      <input
        type="range"
        className="slider w-full"
        style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}
        min={min}
        max={max}
        step={step}
        value={clampNum(value, min, max)}
        onChange={(e) => onChange(integer ? Math.round(Number(e.target.value)) : Number(e.target.value))}
      />
    </div>
  );
}

export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="truncate text-[11px] text-bm-muted" title={hint}>
        {label}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SelectInput<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <select
        className="h-7 w-full cursor-pointer appearance-none rounded-[10px] border-2 border-bm-mist bg-white pl-2 pr-7 text-[11.5px] text-bm-navy outline-none hover:border-bm-coral focus:border-bm-coral"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bm-faint" />
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" className="group flex w-full items-center justify-between gap-2 py-0.5 text-left [@media(pointer:coarse)]:min-h-[36px]" onClick={() => onChange(!checked)} title={hint}>
      <span className="text-[11px] text-bm-muted group-hover:text-bm-coral-text">{label}</span>
      <span className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${checked ? 'bg-bm-coral' : 'bg-bm-line'}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
    </button>
  );
}

export function Section({ title, children, right, defaultOpen = true }: { title: string; children: ReactNode; right?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-bm-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="flex items-center gap-1.5 brand-label text-[12.5px] text-bm-muted hover:text-bm-coral-text [@media(pointer:coarse)]:min-h-[36px]" onClick={() => setOpen(!open)}>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="space-y-2.5">{children}</div>}
    </section>
  );
}

export function InfoRow({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-bm-faint">{label}</span>
      <span className={`font-mono ${tone ?? 'text-bm-slate'}`}>{value}</span>
    </div>
  );
}

export function IconButton({
  onClick,
  title,
  children,
  active,
  disabled,
  className,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`tap flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'bg-bm-navy text-white' : 'text-bm-slate hover:bg-bm-mist hover:text-bm-coral-text'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
