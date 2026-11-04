# Photon Lab — Light & Optics Simulator

Interactive 2D optical laboratory built with React, TypeScript, Vite, Tailwind CSS and a custom physically based ray tracer rendered on HTML5 Canvas.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # physics + serialization unit tests
npm run build    # type-check and production build
```

## Physics model

- **Reflection** `R = I − 2(I·N)N` on segments, circular arcs and parabolas.
- **Refraction** via the vector form of Snell's law; **total internal reflection** when `sin θₜ > 1`.
- **Fresnel equations** split energy at every dielectric boundary (unpolarized, s or p).
- **Dispersion** with Cauchy's equation `n(λ) = A + B/λ²` (B in µm², nD at 589.3 nm).
- **Absorption** with Beer–Lambert attenuation inside media (coefficient in 1/cm).
- **Rough surfaces**: stratified microfacet normal perturbation (deterministic, no flicker).
- Media are resolved by point containment: where bodies overlap, the topmost body defines the medium.
- Energy is tracked exactly: emitted = escaped + absorbed + detected + truncated (shown in the Scene panel).
- Rays are traced breadth-first with limits on depth, minimum intensity and total segments.

Units: millimetres, degrees, y axis up. Thin "Convex/Concave Lens" items are ideal paraxial lenses; biconvex, biconcave and plano-convex lenses are real glass bodies.

## Layout

| Path | Purpose |
| --- | --- |
| `src/engine/geometry.ts` | Ray–segment/arc/parabola intersection, containment, bounds |
| `src/engine/optics.ts` | Reflection, Snell, Fresnel, Cauchy, lensmaker |
| `src/engine/compile.ts` | Scene objects → world-space optical surfaces (cached) |
| `src/engine/tracer.ts` | Ray-tracing engine |
| `src/engine/materials.ts`, `color.ts`, `sources.ts` | Materials, spectra, light sources |
| `src/scene/` | Data model, object factory/library, presets, JSON serialization |
| `src/render/` | Camera and canvas renderer |
| `src/interaction/handles.ts` | Hit testing, rotate/resize handles |
| `src/state/store.ts` | Zustand store with undo/redo |
| `src/components/` | React UI (library, canvas, properties, toolbars) |

## Shortcuts

Drag empty space or middle/right-drag to pan · wheel to zoom · Space+drag to pan · Del to delete · Ctrl+D to duplicate · Ctrl+Z / Ctrl+Y to undo/redo · R / Shift+R to rotate 15° · arrow keys to nudge (Shift ×10) · P to pause · F to fit view · Shift while rotating snaps to 15° · Alt bypasses snap-to-grid.
