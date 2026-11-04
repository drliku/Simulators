import type { ReactNode } from 'react';
import { useEngine, useSimFrame } from '../sim/context';
import { derive } from '../sim/derive';
import { betaFromKmPerHour, gammaMinusOne, JULIAN_YEAR } from '../physics/relativity';
import { formatAdaptiveDuration, sci } from '../physics/format';

const EVERYDAY_BETA = betaFromKmPerHour(100);

function Card({ tag, title, tone, children, action, live }: {
  tag: string; title: string; tone: 'earth' | 'ship' | 'mix'; children: ReactNode; action: ReactNode; live?: ReactNode;
}) {
  const ring = tone === 'earth' ? 'before:from-earth/60' : tone === 'ship' ? 'before:from-ship/70' : 'before:from-earth/60 before:via-ship/50';
  return (
    <article className={`glass relative flex flex-col gap-3 p-5 before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r ${ring} before:to-transparent`}>
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] text-ink-muted">{tag}</span>
        <h3 className="font-display text-[21px] font-normal uppercase tracking-[0.04em] text-ink">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-muted">{children}</div>
      {live && <div className="rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2 font-mono text-[12px] tabular-nums text-ink">{live}</div>}
      <div className="mt-auto pt-1">{action}</div>
    </article>
  );
}

export function Scenarios({ onLightClock }: { onLightClock: () => void }) {
  const engine = useEngine();
  const e = useSimFrame();
  const d = derive(e);
  const everyday = Math.abs(e.beta - EVERYDAY_BETA) < 1e-15;
  const nearC = Math.abs(e.beta - 0.99) < 1e-12;

  const run = (beta: number, years: number, speed: 1 | 10 | 100 | 1000) => {
    engine.setFrame('earth');
    engine.setBeta(beta);
    engine.setDurationYears(years);
    engine.setSpeed(speed);
    engine.restart();
    engine.play();
    document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section aria-labelledby="scenariosTitle" className="flex flex-col gap-4">
      <h2 id="scenariosTitle" className="font-display text-[30px] font-normal uppercase tracking-[0.04em] text-ship">Guided scenarios</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          tag="A"
          title="Everyday speeds"
          tone="earth"
          action={<button type="button" className="btn w-full" onClick={() => run(EVERYDAY_BETA, 1, 100)}>Drive at 100 km/h for a year</button>}
          live={everyday ? <>Δt − Δτ so far: <span className="text-earth-soft">{formatAdaptiveDuration(d.difference, 5)}</span></> : undefined}
        >
          <p>
            At 100 km/h, β ≈ {sci(EVERYDAY_BETA, 3)} and γ − 1 ≈ β²/2 = {sci(gammaMinusOne(EVERYDAY_BETA), 3)}. After a full year the
            moving clock is behind by only about {formatAdaptiveDuration(JULIAN_YEAR * gammaMinusOne(EVERYDAY_BETA) / (1 + gammaMinusOne(EVERYDAY_BETA)), 3)}.
          </p>
          <p>
            The effect grows with v², so at everyday speeds it is far below anything we notice. The clocks switch to nanosecond
            readouts so you can still see it. Atomic clocks flown on airliners have measured effects of this size, with gravity
            contributing too.
          </p>
        </Card>
        <Card
          tag="B"
          title="Near light speed"
          tone="ship"
          action={<button type="button" className="btn w-full" onClick={() => run(0.99, 50, 1000)}>Fly at 99% c for 50 Earth years</button>}
          live={nearC ? <>Earth {(d.earthTime / JULIAN_YEAR).toFixed(2)} yr · ship <span className="text-ship-soft">{(d.shipTime / JULIAN_YEAR).toFixed(2)} yr</span></> : undefined}
        >
          <p>
            At 99% of c, γ ≈ 7.09. Over 50 years in Earth's frame the ship covers 49.5 light-years, yet the ship clock records only
            about 7.05 years between the same two events.
          </p>
          <p>
            In the ship's frame the trip is just as consistent. The ship is at rest, and the stretch of space it passes through is
            length-contracted to about 7 light-years.
          </p>
        </Card>
        <Card
          tag="C"
          title="The light clock"
          tone="mix"
          action={<button type="button" className="btn w-full" onClick={onLightClock}>Show light clocks at 80% c, slow motion</button>}
        >
          <p>
            A photon bouncing between two mirrors is the simplest clock. Seen from Earth, the moving clock's photon must also keep up
            with the sideways motion, so it traces a longer diagonal: γL per leg instead of L.
          </p>
          <p>
            The speed of light is the same in every inertial frame. A longer path at the same speed takes longer, so the moving clock
            ticks slower by exactly γ, and every other process aboard the ship slows by the same factor.
          </p>
        </Card>
      </div>
    </section>
  );
}
