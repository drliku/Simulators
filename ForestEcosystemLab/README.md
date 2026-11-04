# Forest Ecosystem Lab

A 3D ecosystem of fourteen species in a 360 m northern-forest valley, simulated animal by animal. The valley
has a river and its tributary, a lake, two ponds and a rocky conifer ridge. React, TypeScript, Tailwind,
Three.js and React Three Fiber, in The Brain Maze style.

```bash
npm install
npm run dev                      # local dev server
npm test                         # 18 ecological validation tests (vitest)
npm run build                    # type-check and build to dist/
npm run sim -- balanced 200 7 --all   # headless run: scenario, days, seed (--all lists every species)
```

- **Agent-based model** (`src/sim/`). Every animal has energy, hunger, hydration, stamina, age, sex,
  reproductive state and a lifespan.
  - **Deer** choose between eating, drinking, resting, mating, herding and wandering by utility, and flee
    when they notice a wolf. How far away they notice depends on what the wolf is doing, on daylight and on
    how desperate the deer is.
  - **Wolves** live in packs with a leader. They search, stalk and then chase, limited by stamina. Capture
    probability depends on the deer's condition, the pack's help, cover and light.
  - **Twelve more species** (`src/sim/species.ts`, `src/sim/fauna.ts`) share one data-driven brain:
    - herbivores: elk, moose, snowshoe hare, red squirrel and beaver;
    - omnivores: wild boar and brown bear (bears hibernate through winter);
    - predators: cougar, Canada lynx, red fox and golden eagle;
    - a scavenger: the common raven, which shadows the wolf packs.

    Each species' catalogue entry sets its diet, preferred habitat, prey list, hunting style, speed,
    breeding and territory. Plant eaters graze the same vegetation grid as the deer, so they compete with
    them. Predators stalk, then rush, and a capture is a chance shaped by the prey's condition and
    toughness, cover, light and weather. Wolves also hunt elk, moose calves, boar and beavers; deer flee
    cougars and bears. Birds fly at their own altitude, dive on prey and land to feed. Snowshoe hares turn
    white in winter.
  - **Carcasses** leave meat that decays and feeds wolves and scavengers alike.
  - **Immigration** (Environment tab): when one of the twelve new species is down to its last one or two
    animals, a pair may wander in from beyond the valley. Deer and wolves never immigrate, so the
    experiments stay closed. At 0%, every population is closed.
  - **Vegetation** grows logistically on a 112×112 grid. Growth is shaped by moisture, distance to water,
    forest cover, season and drought.
  - **Lotka–Volterra** is not the engine. The Model tab fits its coefficients to the run as a reference.
- **Engine**:
  - fixed timestep (120 ticks per simulated day, 10 ticks/s per 1× of speed);
  - capped catch-up, so a slow device runs slower rather than freezing;
  - interpolated rendering;
  - one spatial hash per species for neighbour queries, and a fast path for animals standing still;
  - instanced meshes for animals, trees and grass;
  - one seeded RNG. The same seed, parameters and actions reproduce a run exactly. The landscape is fixed;
    the seed sets the animals and every chance event.
- **Interface**:
  - Left panel: seven experiments (A–G, including the lynx–hare cycle), each with hypotheses and outcomes
    measured since it started; starting numbers and add/remove buttons for every species; biology and
    environment sliders; seed and saved runs.
  - Centre: the 3D view, with free, follow, top-down and cinematic cameras, heatmaps (vegetation, deer,
    wolves, resources, predation) and a day/night toggle.
  - Right panel: statistics with trend arrows and a wildlife table; the animal inspector (diet, predators,
    altitude); a "who eats whom" web of all fourteen species, sized by population with links thickening
    as kills are recorded; the energy flows from plants to deer to wolves; and the Lotka–Volterra comparison.
  - Bottom: the population graph, with hover, range, pause, clear, series toggles, any of the other species
    on demand, and saved runs drawn as dashed lines.
  - **Hunts are announced** for every predator. When one starts stalking, the target gets an amber ring, arrow and
    label, with lines from each wolf, and a banner offers ▶ Watch (slows to 1× and follows the deer). The
    marker turns red when the chase begins. A kill sends up a red column; an escape shows a green ring.
    **Hunt cam** follows every new hunt automatically. Wolves now creep in for about 2 s (at 1×) before
    the rush unless the deer bolts first, so there is time to look.
  - **Dynamic weather** (`src/sim/weather.ts`): clear, overcast, rain, thunderstorms with lightning,
    fog and snow in winter. It runs as a seasonal Markov chain on its own seeded stream. Rain speeds plant
    growth and eases deer thirst; fog, rain and snow shorten sight; snow and storms slow animals; snow
    makes deer easier to catch. The Environment tab shows the current effects and has a
    "Weather variability" slider (0% keeps the sky clear).
  - Shortcuts: Space play/pause, → step, 1–4 speed, F follow, H watch a hunt, Esc deselect.
- **Validation** (`src/sim/ecosystem.test.ts`) checks that:
  - animals with no food starve;
  - wolves without meat gain nothing;
  - vegetation cannot regrow at zero growth, or under full drought with no water;
  - deer reproduction is limited by food, and energy accounting balances;
  - population counters always match the living animals, with no death counted twice;
  - animals stay inside the world;
  - seeds reproduce runs, and reset is exact;
  - extinction is handled safely;
  - results do not depend on playback speed;
  - every kill follows the food web, and kill records match predation deaths;
  - every species is present after 30 days;
  - birds fly and land, and nothing else leaves the ground;
  - bears hibernate in winter and wake in spring;
  - hares without predators stay bounded;
  - immigration revives only the wider fauna, and 0% keeps populations closed.

**Simplifications and limitations**:
- **Time is compressed.** A tick is about 12 ecological minutes but about one second of movement. Lifespans
  are 95 days for deer and 170 days for wolves, and a "year" is 100 days, so cycles play out in minutes.
- **Outcomes depend on the seed.** In a 200-day headless run of the full forest (seed 7, default
  settings), all fourteen species were present at every 40-day sample:
  - deer ranged from about 270 to 420, wolves from 14 to 19, elk from 50 to 86, hares from 62 to 129;
  - squirrels held at about 50 to 66 and boar at about 40;
  - moose fell from 14 to 3;
  - bears, cougars, lynx and foxes stayed in single digits, and at times depended on immigrants.

  Small populations are fragile, as in real ecology. Treat a single run as one possible history, not a
  prediction.
- **The lynx–hare experiment (G)** has not produced a clean textbook cycle in testing. With seed 7, the
  hares settled at about 140 to 210 (held down by territory) and the lynx slowly declined from 8 to 2
  over 120 days.
- **Simplified biology:**
  - wolves, hares, squirrels and birds get their water from food;
  - there are no diseases, no territories between wolf packs, and no deer or wolf immigration;
  - the other species share one brain with per-species settings, rather than the detailed, hand-built
    behaviour of the deer and wolves;
  - only a pack's dominant female breeds (a second breeder is allowed in large, well-fed packs);
  - vegetation is one generic biomass layer.
- **Performance:** about 800 animals in a 360 m world cost roughly 3 ms per tick headless, so slower
  devices fall behind at 10×. The interface shows a notice when that happens.
- **This is an exploration tool**, not a calibrated model of any real population.
