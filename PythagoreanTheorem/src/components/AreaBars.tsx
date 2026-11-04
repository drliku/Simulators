import { fmtTenThousandths, hypotenuse, squareTenThousandths } from '../lib/format';
import { COLORS } from '../lib/theme';

/** Two stacked bars: a² + b² on top, c² below — always exactly the same length. */
export function AreaBars({ a, b }: { a: number; b: number }) {
  const a2 = squareTenThousandths(a);
  const { c2 } = hypotenuse(a, b);
  const pa = (a2 / c2) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-7 overflow-hidden rounded-lg bg-slate-100 font-math text-xs font-bold text-white">
        <div
          className="flex items-center justify-center overflow-hidden whitespace-nowrap transition-[width] duration-300 ease-out"
          style={{ width: `${pa}%`, backgroundColor: COLORS.a }}
        >
          {pa > 14 && 'a²'}
        </div>
        <div
          className="flex flex-1 items-center justify-center overflow-hidden whitespace-nowrap transition-[width] duration-300 ease-out"
          style={{ backgroundColor: COLORS.b }}
        >
          {100 - pa > 14 && 'b²'}
        </div>
      </div>
      <div
        className="flex h-7 items-center justify-center rounded-lg font-math text-xs font-bold text-white"
        style={{ backgroundColor: COLORS.c }}
      >
        c² = {fmtTenThousandths(c2)}
      </div>
      <p className="text-xs text-slate-400">
        a² makes up <span className="font-mono text-slate-600">{pa.toFixed(1)}%</span> of c², b² the other{' '}
        <span className="font-mono text-slate-600">{(100 - pa).toFixed(1)}%</span>.
      </p>
    </div>
  );
}
