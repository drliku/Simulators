import type { ReactNode } from 'react';
import { fmtLength, fmtTenThousandths, hypotenuse, squareTenThousandths } from '../lib/format';
import { COLORS } from '../lib/theme';

interface Props {
  a: number;
  b: number;
  highlight: boolean;
}

function Term({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="font-semibold transition-colors duration-300" style={{ color }}>
      {children}
    </span>
  );
}

function Num({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-block rounded-lg px-1.5 py-0.5 tabular-nums transition-colors duration-300"
      style={{ color, backgroundColor: `${color}14` }}
    >
      {children}
    </span>
  );
}

export function FormulaPanel({ a, b, highlight }: Props) {
  const a2 = squareTenThousandths(a);
  const b2 = squareTenThousandths(b);
  const hyp = hypotenuse(a, b);

  return (
    <div
      className={`card px-4 py-5 transition-shadow duration-500 sm:px-6 ${highlight ? 'shadow-lift ring-2 ring-coral-200' : ''}`}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="font-math text-4xl font-extrabold tracking-wide text-navy sm:text-5xl">
          <Term color={COLORS.a}>a²</Term>
          <span className="mx-2 text-slate-300">+</span>
          <Term color={COLORS.b}>b²</Term>
          <span className="mx-2 text-slate-300">=</span>
          <Term color={COLORS.c}>c²</Term>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-mono text-base sm:text-lg">
          <Num color={COLORS.a}>{fmtLength(a)}²</Num>
          <span className="text-slate-400">+</span>
          <Num color={COLORS.b}>{fmtLength(b)}²</Num>
          <span className="text-slate-400">=</span>
          <Num color={COLORS.c}>c²</Num>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-mono text-base sm:text-lg">
          <Num color={COLORS.a}>{fmtTenThousandths(a2)}</Num>
          <span className="text-slate-400">+</span>
          <Num color={COLORS.b}>{fmtTenThousandths(b2)}</Num>
          <span className="text-slate-400">=</span>
          <Num color={COLORS.c}>{fmtTenThousandths(hyp.c2)}</Num>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 font-mono text-base sm:text-lg">
          <span className="text-slate-500">c =</span>
          <span className="text-slate-500">√{fmtTenThousandths(hyp.c2)}</span>
          <span className="text-slate-400">{hyp.exact ? '=' : '≈'}</span>
          <span className="rounded-lg bg-coral px-2.5 py-0.5 font-semibold text-white shadow-sm tabular-nums">{hyp.text}</span>
        </div>
      </div>
    </div>
  );
}
