import type { ReactNode } from 'react';
import { useSimFrame } from '../sim/context';
import { contractedLength, speedKmPerSecond } from '../physics/mirror';
import { TRAIN_REST_LENGTH } from '../sim/engine';
import { ns } from '../draw/scene';
import { Term } from './Term';
import { TIPS } from './tips';

function Row({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'coral' | 'track' | 'photon' }) {
  const color = tone === 'coral' ? 'text-coral-soft' : tone === 'track' ? 'text-track-soft' : tone === 'photon' ? 'text-photon-soft' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="m-0 text-right">
        <div className={`font-mono text-[14.5px] font-medium tabular-nums ${color}`}>{value}</div>
        {sub && <div className="font-mono text-[11px] text-ink-faint">{sub}</div>}
      </dd>
    </div>
  );
}

export function Dashboard() {
  const e = useSimFrame();
  const trip = e.trip;
  const front = trip.orientation === 'front';
  const out = trip.track[1].t - trip.track[0].t;
  const back = trip.track[2].t - trip.track[1].t;
  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Live data">
      <h2 className="panel-title">Live data</h2>
      <dl className="m-0">
        <Row label="Train speed" value={`${(e.beta * 100).toFixed(1)}% of c`} tone="coral" sub={`β = ${e.beta.toFixed(3)}`} />
        <Row label="Train speed (km/s)" value={speedKmPerSecond(e.beta).toLocaleString('en-US', { maximumFractionDigits: 0 })} />
        <Row label={<Term tip={TIPS.gamma}>Lorentz factor γ</Term>} value={e.gamma.toFixed(4)} />
        <Row label={front ? 'Eye-to-mirror distance L₀' : 'Eye-to-ceiling-mirror L₀'} value={`${trip.L0.toFixed(2)} m`} sub="train frame" />
        <Row label={<Term tip={TIPS.properTime}>Round trip, train clock</Term>} value={ns(trip.trainRoundTrip)} tone="coral" sub="t′ = 2L₀/c" />
        <Row label="Round trip, track clocks" value={ns(trip.trackRoundTrip)} tone="track" sub="t = γ·2L₀/c" />
        <Row label="Track-frame legs" value={`${ns(out)} + ${ns(back)}`} sub={front ? 'γ(1+β)L₀/c out, γ(1−β)L₀/c back' : 'γL₀/c up, γL₀/c down'} />
        <Row
          label={<Term tip={TIPS.contraction}>Train length from the track</Term>}
          value={`${contractedLength(TRAIN_REST_LENGTH, e.beta).toFixed(2)} m`}
          sub={`rest length ${TRAIN_REST_LENGTH} m ÷ γ`}
        />
        <Row label={<Term tip={TIPS.c}>Light speed measured</Term>} value="c in both frames" tone="photon" sub="299,792,458 m/s" />
      </dl>
    </section>
  );
}
