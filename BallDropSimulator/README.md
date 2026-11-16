# Galton Board Probability Simulator

An interactive, browser-based Galton board. Balls fall from a dispenser, bounce through
rows of pegs, and pile up in bins. Over many drops the pile becomes a binomial distribution,
and in the symmetric case it looks more and more like a normal distribution.

Styled like **The Brain Maze** site (thebrainmaze.com): Poppins, a navy gradient header with the Brain Maze logo
(linking back to the site), white rounded cards, pill buttons and coral `#F78677` accents. The board and histogram
stay on navy panels.

**Run it:** open `index.html` in any modern browser. There is no build step and nothing to install.

## Features

- **Canvas animation** at 60 FPS: glowing coral balls hop from peg to peg in parabolic
  arcs. Pegs, walls, and the grid are pre-rendered once, and balls are drawn from cached sprites,
  so thousands of balls stay smooth.
- **Controls:** Drop/Pause, ball count (100 / 500 / 1,000 / 5,000), peg rows (5–20),
  drop speed (1–400 balls/s), probability of bouncing right (0–100%), Reset, and Drop Single Ball.
  The single ball is traced: its path, the pegs it hits, and its L/R sequence are highlighted.
- **Live statistics:** balls dropped, landed, and in flight; observed vs. expected mean, standard
  deviation, and most-populated bin; a Pearson χ² goodness-of-fit test with p-value; total
  variation distance; and a table comparing every bin with theory.
- **Histogram:** observed counts (or probabilities) with the theoretical binomial curve, scaled
  to the number of balls that have landed. You can also overlay the normal approximation.
- **Hover** any bin, on the board or the histogram, to see its count, relative frequency,
  theoretical probability, and expected count.
- **Explanation section** covering why independent left/right choices give `C(n,k)·pᵏ(1−p)ⁿ⁻ᵏ`
  and why the shape approaches a normal curve as the number of rows grows (de Moivre–Laplace).
- Responsive layout for desktop, tablet, and mobile. Keyboard shortcuts: `Space` drop/pause,
  `S` single ball, `R` reset.

## Why the statistics are exact

A physics engine is not used to decide where a ball goes. When a ball is released, its whole route
is drawn up front: one independent Bernoulli(p) trial per row. Its bin is the number of rightward
bounces, so bin counts follow Binomial(rows, p) exactly. The animation only renders that route.
Each hop is a parabola that starts from the top of one peg and ends on the top of the next. The
peg and ball radii are scaled so that a ball never passes inside a peg, and because the walk is
confined to the peg triangle, no ball can escape the board.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, controls, statistics panel, explanation |
| `styles.css` | Brain Maze site skin and responsive layout |
| `assets/brainmaze-logo.png` | The Brain Maze logo (header link) |
| `assets/brain-mark.png` | Brain mark cropped from the logo (favicon) |
| `app.js` | Random walk, animation, rendering, statistics, interaction |
