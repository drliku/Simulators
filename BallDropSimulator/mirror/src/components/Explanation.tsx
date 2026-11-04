import { useSimFrame } from '../sim/context';
import { ns } from '../draw/scene';
import { Term } from './Term';
import { TIPS } from './tips';

export function Explanation() {
  const e = useSimFrame();
  const trip = e.trip;
  const pct = `${(e.beta * 100).toFixed(1)}%`;
  const front = trip.orientation === 'front';
  return (
    <section className="glass grid gap-5 p-6 lg:grid-cols-[1.3fr_1fr]" aria-labelledby="whyTitle">
      <div className="flex flex-col gap-3">
        <h2 id="whyTitle" className="font-display text-[26px] font-normal uppercase tracking-[0.04em] text-coral">Why the answer is yes</h2>
        <p className="text-[15px] leading-relaxed text-ink">
          Even at {pct} of the speed of light, the passenger sees his reflection normally. Light always travels at the same speed
          in his reference frame, so it reaches the mirror {trip.L0.toFixed(2)} m away and returns in {ns(trip.trainRoundTrip)}, exactly as it
          would at rest. From the track observer's perspective the light follows a different path
          {front ? ', a long chase to the receding mirror and a short hop back' : ', a diagonal up and a diagonal down'}, and the time
          between the same two events is longer: {ns(trip.trackRoundTrip)}, γ = {e.gamma.toFixed(3)} times as long.
        </p>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          The passenger cannot tell how fast the train is moving from this experiment alone. By the{' '}
          <Term tip={TIPS.principle}>principle of relativity</Term>, a mirror in a smoothly moving train behaves exactly like one at rest.
          The light does not crawl toward the mirror at "c − v" inside the train: in the train frame it moves at c, and the mirror is at rest.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[13.5px] leading-relaxed text-ink-muted">
        <li className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <b className="text-ink">How does light catch a moving mirror?</b> In the track frame the photon moves at c and the mirror at only v &lt; c,
          so the photon always gains on it. With the mirror ahead the chase takes γ(1+β)L₀/c, and the return, with the passenger moving toward the
          light, takes γ(1−β)L₀/c.
        </li>
        <li className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <b className="text-ink">Same events, different times.</b> Both clocks time the same two events on the passenger's path: the light leaving
          his face and arriving back at his eyes. The train clock reads 2L₀/c; track clocks read γ·2L₀/c.
        </li>
        <li className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <b className="text-ink">Why the reflections disagree.</b> The frames slice "now" differently (
          <Term tip={TIPS.simultaneity}>relativity of simultaneity</Term>), so mid-trip the photon is at different points in each view, while
          departure and return always match.
        </li>
      </ul>
    </section>
  );
}
