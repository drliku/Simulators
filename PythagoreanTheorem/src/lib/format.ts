/**
 * Exact formatting helpers. Side lengths live on a 0.01 grid, so working in
 * integer hundredths lets us print a², b² and c² with no floating-point error:
 * the identity a² + b² = c² always holds digit-for-digit on screen.
 */

const toHundredths = (x: number) => Math.round(x * 100);

function trimFixed(intPart: number, frac: number, digits: number): string {
  if (frac === 0) return intPart.toLocaleString('en-US');
  const f = String(frac).padStart(digits, '0').replace(/0+$/, '');
  return `${intPart.toLocaleString('en-US')}.${f}`;
}

/** A length on the 0.01 grid, trailing zeros trimmed (3, 4.5, 4.25). */
export function fmtLength(x: number): string {
  const h = toHundredths(x);
  return trimFixed(Math.floor(h / 100), h % 100, 2);
}

/** Exact square of a length on the 0.01 grid (up to 4 decimals). */
export function squareTenThousandths(x: number): number {
  const h = toHundredths(x);
  return h * h;
}

export function fmtTenThousandths(n: number): string {
  return trimFixed(Math.floor(n / 10000), n % 10000, 4);
}

export interface Hypotenuse {
  /** c² in ten-thousandths (exact). */
  c2: number;
  /** Numerical value of c. */
  c: number;
  /** True when c lands exactly on the 0.01 grid (e.g. 5, 13, 2.5). */
  exact: boolean;
  /** Display string for c. */
  text: string;
}

export function hypotenuse(a: number, b: number): Hypotenuse {
  const c2 = squareTenThousandths(a) + squareTenThousandths(b);
  const c = Math.sqrt(c2) / 100;
  const ch = Math.round(Math.sqrt(c2));
  const exact = ch * ch === c2;
  const text = exact ? trimFixed(Math.floor(ch / 100), ch % 100, 2) : c.toFixed(3);
  return { c2, c, exact, text };
}

/** Compact number for in-canvas labels. */
export function fmtShort(x: number, digits = 2): string {
  const s = x.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
