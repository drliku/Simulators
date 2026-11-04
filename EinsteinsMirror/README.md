# Einstein's Mirror

"If you're travelling almost as fast as light, can you still see yourself in a mirror?" A passenger in a
train looks into a mirror while the train speeds up to 99.9% of c. In The Brain Maze style.

```bash
npm install
npm run dev      # local dev server
npm test         # 45 physics + engine tests (vitest)
npm run build    # type-check and build to dist/
```

- **Physics** (`src/physics/mirror.ts`): departure, reflection and return events are defined in the train
  frame and Lorentz-transformed to the track frame, t = γ(t′ + vx′/c²) and x = γ(x′ + vt′). The tests check:
  - light moves at c on every leg in both frames;
  - the round trip is t′ = 2L₀/c on the train and t = γ·2L₀/c from the track, with the track-frame legs
    taking γ(1+β)L₀/c and γ(1−β)L₀/c;
  - the photon meets the contracted, moving mirror and returns to the moving passenger;
  - relativistic addition of c and v gives c.
- **One clock** (`src/sim/engine.ts`): track-frame time drives everything. The train view shows the train
  frame at the passenger's proper time t/γ, so both views share the departure and return events. The
  reflection happens at different moments in each view because of the relativity of simultaneity.
  Playback is normalised to a few seconds per trip. Slow motion, stepping and seeking only change playback.
- **Views**: inside the train (scenery scrolls, train at rest), the track observer (the train moves and is
  length-contracted along x; the view zooms out to fit the trip), or both side by side. There is a scale bar
  in metres; scenery is illustrative.
- **Mirror in front or on the ceiling**, the latter being a light clock with diagonal paths seen from the
  track. There are three guided experiments, a live dashboard, a dynamic explanation, and a blinking passenger
  whose reflection and speech bubble react to the speed.
