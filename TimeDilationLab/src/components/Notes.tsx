import { Term } from './Term';
import { TIPS } from './tips';

const items: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What the clocks compare',
    body: <>Both clocks start at zero at event O, when the ship passes Earth. The ship clock shows its <Term tip={TIPS.properTime}>proper time</Term> to the ship's current event E. The Earth clock shows the time Earth's frame assigns between O and E, read from Earth-frame clocks synchronized with Earth's own.</>,
  },
  {
    title: 'Neither clock is broken',
    body: <>Every clock aboard, whether mechanical, atomic, or biological, records the same proper time, and each works perfectly. Time dilation is a property of space-time geometry, not a malfunction or an effect of motion on the mechanism.</>,
  },
  {
    title: 'No frame is "really" slower',
    body: <>From Earth the ship clock runs slow; from the ship, Earth's runs slow. Both are correct because they compare different pairs of events. Switch to the ship frame to see how <Term tip={TIPS.simultaneity}>simultaneity</Term> resolves it.</>,
  },
  {
    title: 'Not the full twin paradox',
    body: <>This is a one-way trip at constant velocity. The twins only disagree unambiguously about who aged less when they meet again, which needs the ship to turn around and change inertial frames.</>,
  },
  {
    title: 'Light speed is a hard limit',
    body: <>γ grows without bound as v → c, and so would the energy needed to accelerate further. Anything with mass stays below c, which is why the slider stops at 99.9%.</>,
  },
  {
    title: 'Animation is not velocity',
    body: <>Simulation speed only changes how fast the experiment plays back. Star streaks and photon speeds are illustrations. The clocks, scale bar, statistics, and graph use exact values with c = 299,792,458 m/s and Julian years.</>,
  },
];

export function Notes() {
  return (
    <section aria-labelledby="notesTitle" className="flex flex-col gap-4">
      <h2 id="notesTitle" className="font-display text-[30px] font-normal uppercase tracking-[0.04em] text-ship">Reading the experiment carefully</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <article key={it.title} className="glass p-5">
            <h3 className="mb-2 font-display text-[19px] font-normal uppercase tracking-[0.04em] text-ink">{it.title}</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">{it.body}</p>
          </article>
        ))}
      </div>
      <div className="glass flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 font-mono text-[13px] text-ink">
        <span>γ = 1 / √(1 − v²/c²)</span>
        <span className="text-ship-soft">Δτ = Δt / γ</span>
        <span className="text-ink-muted">β = v / c</span>
        <span className="text-ink-muted">c = 299,792,458 m/s</span>
      </div>
    </section>
  );
}
