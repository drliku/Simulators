# Time Dilation Lab

An interactive special-relativity laboratory built with React, TypeScript, Tailwind CSS and Canvas.
Styled for The Brain Maze: a coral ship and a periwinkle Earth on navy, with the Brain typeface for titles and the
large clocks (digits sit in fixed-width cells so running clocks don't jitter).
Observer A stays on Earth; observer B coasts past in a spaceship at constant velocity. Both clocks
read zero as the ship passes Earth, then show the time between that event and the ship's current event.

```bash
npm install
npm run dev      # local dev server
npm test         # physics + engine tests (vitest)
npm run build    # type-check and build to dist/
```

- **Physics** (`src/physics/relativity.ts`): γ = 1/√(1 − β²), Δτ = Δt/γ, using β = v/c. Formulas are
  written in cancellation-free forms (for example Δt − Δτ = Δt·β²/(1 + √(1 − β²))), so 100 km/h still
  shows its ~135 ns per year. The tests check that 10 Earth years at 0.8c give 6 ship years.
- **Single clock** (`src/sim/engine.ts`): one requestAnimationFrame loop advances Earth-frame time by
  real frame delta × playback speed (1× = one day per second). Everything else is derived from it. The run
  stops exactly at the chosen duration. Changing velocity restarts the run, so the ship stays inertial.
- **Reference frames**: the ship-frame view shows the ship clock at rest and Earth's clock running slow.
  It also shows which Earth event each frame calls simultaneous, and the γβ²τ gap between them.
- **Light clock**: a photon between mirrors, at rest and moving. The moving photon covers γL per leg.
  Mirror width contracts along the motion; the mirror gap does not.
- Live statistics, a Δτ-vs-Δt graph, three guided scenarios (100 km/h, 99% c, light clock), and tooltips.
