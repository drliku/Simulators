# Pythagorean Lab

An interactive Pythagorean theorem simulator built with **React**, **TypeScript**, **Tailwind CSS** and **SVG**.

## Features

- **Draggable right triangle** – drag vertex **A** to change side *b*, vertex **B** to change side *a*, or the
  right-angle vertex **C** to swing it around the hypotenuse along its Thales circle. The angle at C is
  always exactly 90°. Vertices are also keyboard-accessible (arrow keys, Shift for bigger steps).
- **Sliders** for sides *a* and *b* (1–15, 0.01 precision), ± nudge buttons, and editable number boxes
  (type a value and press Enter; out-of-range values are capped, invalid text is rejected).
- **Live formula** – `a² + b² = c²` with the substituted numbers, the squared values and `c = √…`.
- **Squares on every side** (toggleable), with an optional unit grid so students can count cells (9 + 16 = 25).
- **Animated proof** – Euclid's shear → rotate → shear argument (Elements I.47) morphs the two leg squares
  into the two rectangles that exactly fill the hypotenuse square, with step-by-step captions.
- **Reset** to the classic 3-4-5 triangle and one-click Pythagorean triple presets.
- Measurements table (lengths, square areas, angles) and an "area balance" bar chart.
- Fully responsive; the camera smoothly re-frames the figure as it changes.

### Accuracy

Side lengths live on a 0.01 grid, and squares are computed in integer ten-thousandths, so
`a²`, `b²` and `c²` are printed exactly and the on-screen sum always matches digit for digit.
`c` is shown exactly when it lands on the grid (e.g. 5, 13) and as `≈` a 3-decimal value otherwise.

## Branding & fonts

Styled after The Brain Maze logo: coral `#F37367` and navy `#232F5B`, squared corners.
Headings, buttons and labels use the **Brain** typeface (`src/assets/fonts/Brain.woff2`, © Vladimir Nikolic),
which is inlined into the CSS at build time. Brain is capitals-only and has no math symbols, so math
(`a² + b² = c²`, side names) is set in **Saira Semi Condensed**, and any character Brain lacks falls
back to Saira automatically.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

## Project structure

```
src/
  App.tsx                    layout, state, presets, demo captions
  components/
    TriangleCanvas.tsx       SVG triangle, squares, drag handles, proof animation
    FormulaPanel.tsx         live a² + b² = c² display
    Slider.tsx, Toggle.tsx   rounded controls
    AreaBars.tsx             a² + b² vs c² comparison bars
  hooks/
    useDemo.ts               timeline for the animated proof
    useSmoothView.ts         eased camera framing
    useElementSize.ts        ResizeObserver helper
  lib/
    geometry.ts              vectors, triangle construction, Euclid keyframes, Thales drag
    format.ts                exact number formatting
```
