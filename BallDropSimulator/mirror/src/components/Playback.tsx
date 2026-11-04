import { useEngine, useSim, useSimFrame } from '../sim/context';
import type { View } from '../sim/engine';
import { photonInTrain, photonOnTrack, C } from '../physics/mirror';
import { ns } from '../draw/scene';

const VIEWS: { id: View; label: string }[] = [
  { id: 'both', label: 'Side by side' },
  { id: 'train', label: 'Inside the train' },
  { id: 'track', label: 'Track observer' },
];

export function Toolbar() {
  const engine = useEngine();
  const playing = useSim((e) => e.playing);
  const slow = useSim((e) => e.slow);
  const view = useSim((e) => e.view);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => engine.toggle()}
          aria-pressed={playing}
          className={`btn min-w-[104px] font-display text-[16px] font-normal uppercase tracking-[0.06em] ${playing
            ? 'border-coral/50 bg-coral/10 text-coral-soft'
            : 'border-transparent bg-coral text-space-700 shadow-[0_6px_24px_rgba(243,112,100,0.35)] hover:bg-[#f6857a]'}`}
        >
          {playing
            ? <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
            : <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn w-10 px-0" onClick={() => engine.stepFrame(-1)} title="Step back one frame (,)" aria-label="Step back one frame">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M6 5h2.5v14H6zM19 5.5v13L9.5 12z" /></svg>
        </button>
        <button type="button" className="btn w-10 px-0" onClick={() => engine.stepFrame(1)} title="Step forward one frame (.)" aria-label="Step forward one frame">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M15.5 5H18v14h-2.5zM5 5.5v13l9.5-6.5z" /></svg>
        </button>
        <button type="button" className="btn" onClick={() => engine.reset()} title="Back to the departure event (R)">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" /></svg>
          Reset
        </button>
        <button
          type="button"
          aria-pressed={slow}
          onClick={() => engine.setSlow(!slow)}
          className="btn aria-pressed:border-photon/60 aria-pressed:bg-photon/10 aria-pressed:text-photon-soft"
          title="Play the photon at 15% speed (playback only)"
        >
          Slow motion
        </button>
      </div>
      <div className="seg w-full sm:w-auto" role="group" aria-label="Camera">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => engine.setView(v.id)}>{v.label}</button>
        ))}
      </div>
    </div>
  );
}

/** Scrubber over one round trip, with the key events marked. */
export function Timeline() {
  const e = useSimFrame();
  const trip = e.trip;
  const total = trip.trackRoundTrip;
  const events = trip.orientation === 'front'
    ? [
        { t: 0, label: 'Departure' },
        { t: e.gamma * trip.train[1].t, label: 'Reflection · train frame' },
        { t: trip.track[1].t, label: 'Reflection · track frame' },
        { t: total, label: 'Return' },
      ]
    : [
        { t: 0, label: 'Departure' },
        { t: trip.track[1].t, label: 'Reflection' },
        { t: total, label: 'Return' },
      ];
  const pct = (t: number) => `${(t / total) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative px-[9px]">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(e.progress * 1000)}
          className="photon-range"
          style={{ ['--pct' as string]: `${e.progress * 100}%` }}
          onChange={(ev) => e.seek((Number(ev.target.value) / 1000) * total)}
          aria-label="Position in the round trip"
          aria-valuetext={`track time ${ns(e.t)}`}
        />
        <div className="pointer-events-none absolute inset-x-[9px] top-[18px] h-2">
          {events.map((ev) => (
            <span key={ev.label} className="absolute h-2 w-px bg-photon/70" style={{ left: pct(ev.t) }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jump to an event">
        {events.map((ev) => (
          <button key={ev.label} type="button" className="chip" onClick={() => e.seek(ev.t)}>{ev.label}</button>
        ))}
      </div>
    </div>
  );
}

/** What is happening right now, in each frame, in words and numbers. */
export function Narration() {
  const e = useSimFrame();
  const trip = e.trip;
  const L0 = trip.L0;
  const front = trip.orientation === 'front';
  const pTrain = photonInTrain(trip, e.tPrime);
  const pTrack = photonOnTrack(trip, e.t);
  const v = e.beta * C;
  const moved = v * e.t;

  const trainText = pTrain.leg === 'outbound'
    ? `The photon has covered ${pTrain.distance.toFixed(2)} m of the ${L0.toFixed(2)} m to the mirror, at c.`
    : pTrain.leg === 'returning'
      ? `Reflected. It comes straight back over the same ${L0.toFixed(2)} m, still at c.`
      : `Back at his eyes after t′ = 2L₀/c = ${ns(trip.trainRoundTrip)}. He sees his reflection.`;

  const trackText = pTrack.leg === 'outbound'
    ? front
      ? `The train has moved ${moved.toFixed(2)} m. The photon has gone ${pTrack.distance.toFixed(2)} m at c, gaining on the mirror because the mirror moves at only v.`
      : `The photon climbs ${L0.toFixed(2)} m while the train carries the mirror ${(v * trip.track[1].t).toFixed(2)} m forward, so its path is a diagonal, covered at c.`
    : pTrack.leg === 'returning'
      ? front
        ? 'Reflected. Now the passenger moves toward the photon, so this leg is much shorter than the first.'
        : 'Reflected. It comes down along another diagonal to the moved passenger, still at c.'
      : `Back at his eyes after t = γ·2L₀/c = ${ns(trip.trackRoundTrip)}. The photon travelled ${pTrack.distance.toFixed(2)} m at c.`;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-coral/25 bg-black/20 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[15px] uppercase tracking-[0.08em] text-coral-soft">Train frame</span>
          <span className="font-mono text-[12.5px] tabular-nums text-photon-soft">t′ = {ns(e.tPrime)}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{trainText}</p>
      </div>
      <div className="rounded-xl border border-track/25 bg-black/20 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[15px] uppercase tracking-[0.08em] text-track-soft">Track frame</span>
          <span className="font-mono text-[12.5px] tabular-nums text-photon-soft">t = {ns(e.t)}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{trackText}</p>
      </div>
    </div>
  );
}
