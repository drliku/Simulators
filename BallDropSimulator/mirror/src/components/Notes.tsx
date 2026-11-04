const items: { title: string; body: string }[] = [
  { title: 'Light is never slowed', body: 'Light moves at c in every view, on every leg, toward and away from the mirror. The relativistic velocity addition of c and v gives c again.' },
  { title: 'Contraction only along the motion', body: 'From the track the train, the passenger and the mirror spacing shrink by 1/γ along the direction of travel. Heights, including the distance to a ceiling mirror, do not change.' },
  { title: 'Real distances, illustrative scenery', body: 'Positions of the passenger, the mirror, the walls and the photon are drawn to scale; each view has a scale bar. The track view zooms out at high speed to fit the whole trip. Scenery speed, poles and the observer icon are illustrative.' },
  { title: 'Playback is not physics', body: 'Every trip plays over the same few seconds, and slow motion and stepping only change playback. The clocks show the real times, which are a few nanoseconds for a mirror two metres away.' },
];

export function Notes() {
  return (
    <section aria-labelledby="notesTitle" className="flex flex-col gap-4">
      <h2 id="notesTitle" className="font-display text-[26px] font-normal uppercase tracking-[0.04em] text-coral">Reading the simulation</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <article key={it.title} className="glass p-5">
            <h3 className="mb-2 font-display text-[18px] font-normal uppercase tracking-[0.04em] text-ink">{it.title}</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">{it.body}</p>
          </article>
        ))}
      </div>
      <div className="glass flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 font-mono text-[13px] text-ink">
        <span>γ = 1 / √(1 − v²/c²)</span>
        <span className="text-coral-soft">t′ = 2L₀ / c</span>
        <span className="text-track-soft">t = γ · 2L₀ / c</span>
        <span className="text-ink-muted">x = γ(x′ + vt′), t = γ(t′ + vx′/c²)</span>
      </div>
    </section>
  );
}
