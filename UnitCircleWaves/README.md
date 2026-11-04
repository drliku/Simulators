# Unit Circle Waves

An interactive sine and cosine simulator in The Brain Maze style: coral sine, periwinkle cosine on navy,
with the Brain typeface for headings and labels (math symbols stay in STIX Two so θ, ω and φ keep their case). A point rotates around the unit circle, and dotted
projection lines carry its height (sin θ) and horizontal position (cos θ) onto a live wave graph.
The graph uses the same vertical scale as the circle, so the projections line up exactly.

**Run it:** open `index.html` in a browser.

- Drag the point around the circle, or scrub along the graph. Both snap to multiples of 15°.
- Play/Pause, rotation speed, slow motion (×0.2), an angle slider, and presets for 0°, 30°, 45°, 60°, 90°, 180°, 270° and 360°.
- Amplitude, frequency and phase change the transformed waves `y = A sin(ωt + φ)` and `y = A cos(ωt + φ)`.
  The unit circle always shows the base functions, and the graph keeps them as dashed curves for comparison.
- Toggle sine and cosine separately. *Trace* draws the wave as the point turns. *Compare* slides a cosine
  copy a quarter period onto the sine wave and marks the 90° phase gap.
- The live data panel shows the angle in degrees and radians (with π form), sin, cos and tan
  (shown as "undefined" near 90° and 270°), exact values at special angles, A, ω, the period 2π/ω,
  φ, and the horizontal shift −φ/ω.
- The formula has numbers you can drag sideways to change them.
- Challenge mode gives you an angle, you predict its sine or cosine, then reveal the answer with an explanation.
