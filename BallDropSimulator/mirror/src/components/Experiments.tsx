import type { ReactNode } from 'react';
import { useEngine, useSim } from '../sim/context';
import { PRESETS } from '../sim/engine';

function Card({ n, title, children, action, extra }: { n: number; title: string; children: ReactNode; action: ReactNode; extra?: ReactNode }) {
  return (
    <article className="glass relative flex flex-col gap-3 p-5 before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-coral/70 before:to-transparent">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-coral font-display text-[18px] text-space-700">{n}</span>
        <h3 className="font-display text-[21px] font-normal uppercase tracking-[0.04em] text-ink">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-muted">{children}</div>
      {extra}
      <div className="mt-auto pt-1">{action}</div>
    </article>
  );
}

export function Experiments({ onRun }: { onRun: () => void }) {
  const engine = useEngine();
  const accelerating = useSim((e) => (e.accelerating === null ? -1 : e.accelerating));
  const accelDone = useSim((e) => e.accelerationDone);

  const run1 = () => { engine.setView('both'); engine.setSlow(false); engine.startAcceleration(); onRun(); };
  const run2 = () => {
    engine.setView('both'); engine.setOrientation('front'); engine.setBeta(0.8); engine.setSlow(false); engine.seek(0); onRun();
  };
  const run3 = () => {
    engine.setView('both'); engine.setOrientation('above'); engine.setBeta(0.8); engine.setSlow(true); engine.play(); onRun();
  };

  return (
    <section aria-labelledby="expTitle" className="flex flex-col gap-4">
      <h2 id="expTitle" className="font-display text-[30px] font-normal uppercase tracking-[0.04em] text-coral">Experiments</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          n={1}
          title="Can he see himself?"
          action={<button type="button" className="btn w-full" onClick={run1}>Start at rest and speed up</button>}
          extra={
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, i) => {
                const done = accelDone || accelerating > i;
                const now = accelerating === i;
                return (
                  <span
                    key={p.pct}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11.5px] ${now ? 'border-coral/70 bg-coral/15 text-coral-soft' : done ? 'border-emerald-400/40 text-emerald-300' : 'border-white/10 text-ink-faint'}`}
                  >
                    {done ? '✓ ' : ''}{p.pct}%
                  </span>
                );
              })}
            </div>
          }
        >
          <p>The train starts at rest. After every complete round trip of the photon it moves up to the next speed, all the way to 99.9% of c.</p>
          <p>Watch the train view: the photon reaches the mirror and returns exactly as it did at rest, and the reflection never disappears. Each trip runs at one constant speed; the speed-ups between trips are not shown.</p>
        </Card>
        <Card n={2} title="Follow the photon" action={<button type="button" className="btn w-full" onClick={run2}>Freeze at departure, 80% c</button>}>
          <p>The scene freezes at the moment the light leaves his face. Use the step buttons, the timeline, or the event chips to move through the journey.</p>
          <p>Notice that departure and return line up in both views, but the reflection does not: the two frames disagree about which moment is "now" at the mirror.</p>
        </Card>
        <Card n={3} title="The light clock" action={<button type="button" className="btn w-full" onClick={run3}>Mirror on the ceiling, slow motion</button>}>
          <p>Inside the train the light goes straight up and straight down. From the track the train moves sideways during the trip, so the same light traces a longer diagonal.</p>
          <p>Light covers that longer path at the same speed c, so it takes longer: γ·2L₀/c instead of 2L₀/c. That is time dilation.</p>
        </Card>
      </div>
    </section>
  );
}
