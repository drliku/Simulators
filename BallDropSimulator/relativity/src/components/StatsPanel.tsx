import type { ReactNode } from 'react';
import { useSimFrame } from '../sim/context';
import { derive } from '../sim/derive';
import {
  formatAdaptiveDuration, formatDistance, formatGamma, formatInUnit, formatPercentC, UNIT_SHORT, withThousands,
} from '../physics/format';
import { Term } from './Term';
import { TIPS } from './tips';

function Row({ label, value, tone, sub }: { label: ReactNode; value: ReactNode; tone?: 'earth' | 'ship'; sub?: ReactNode }) {
  const color = tone === 'earth' ? 'text-earth-soft' : tone === 'ship' ? 'text-ship-soft' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="m-0 text-right">
        <div className={`font-mono text-[15px] font-medium tabular-nums ${color}`}>{value}</div>
        {sub && <div className="font-mono text-[11px] tabular-nums text-ink-faint">{sub}</div>}
      </dd>
    </div>
  );
}

export function StatsPanel() {
  const e = useSimFrame();
  const d = derive(e);
  const u = UNIT_SHORT[d.unit];
  const dec = d.unit === 'years' ? 4 : 3;
  const fmt = (s: number) => `${formatInUnit(s, d.unit, dec)} ${u}`;

  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Live statistics">
      <h2 className="panel-title">Live statistics</h2>
      <dl className="m-0">
        <Row label={<>Velocity <Term tip={TIPS.beta}>(% of c)</Term></>} value={`${formatPercentC(d.beta)}`} tone="ship" sub={`β = ${d.beta < 0.001 ? d.beta.toExponential(4) : d.beta.toFixed(4)}`} />
        <Row label="Velocity (km/s)" value={withThousands(d.kmPerSecond, d.beta < 0.001 ? 6 : 1)} sub={d.beta < 0.001 ? `${withThousands(d.kmPerSecond * 3600, 2)} km/h` : undefined} />
        <Row label={<Term tip={TIPS.gamma}>Lorentz factor γ</Term>} value={formatGamma(d.beta, 6)} />
        <Row label={<><Term tip={TIPS.earthTime}>Earth elapsed Δt</Term></>} value={fmt(d.earthTime)} tone="earth" sub="Earth frame" />
        <Row label={<Term tip={TIPS.properTime}>Ship proper time Δτ</Term>} value={fmt(d.shipTime)} tone="ship" sub="Δτ = Δt / γ" />
        <Row label={<Term tip={TIPS.difference}>Time difference Δt − Δτ</Term>} value={formatAdaptiveDuration(d.difference, 5)} />
        <Row label={<>Distance, Earth frame (<Term tip={TIPS.lightYear}>ly</Term>)</>} value={formatDistance(d.distanceLy, d.distanceM)} sub={d.distanceLy >= 0.001 ? `${(d.distanceM / 1000).toExponential(3)} km` : undefined} />
      </dl>

      {e.frame === 'ship' && (
        <div className="rounded-xl border border-ship/25 bg-ship/[0.05] p-3.5">
          <h3 className="mb-1.5 font-display text-[16px] font-normal uppercase tracking-[0.1em] text-ship-soft">Ship-frame comparison</h3>
          <dl className="m-0">
            <Row label="Ship clock τ" value={fmt(d.shipTime)} tone="ship" />
            <Row label={<>Earth clock, simultaneous <i>in ship frame</i></>} value={fmt(d.earthInShipFrame)} tone="earth" sub="τ / γ" />
            <Row label={<>Earth clock, simultaneous <i>in Earth frame</i></>} value={fmt(d.earthTime)} tone="earth" sub="γ τ" />
            <Row label={<Term tip={TIPS.simultaneity}>Simultaneity gap</Term>} value={formatAdaptiveDuration(d.simultaneityGap, 4)} sub="γ β² τ" />
          </dl>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
            Both statements are true: each frame finds the other's clock slow. They compare the ship's event with two different
            Earth events, because the frames disagree about which Earth event happens "now".
          </p>
        </div>
      )}
    </section>
  );
}
