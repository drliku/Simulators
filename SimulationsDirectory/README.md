# SimulationsDirectionary
Directionary for TheBrainMaze Website, where we hope to showcase scientific 3d simulations

## The page

Open `index.html` in a browser (or host the folder as a static site). Simulations are grouped into
Biology, Physics, Astronomy, Mathematics, Chemistry and Geography (19 simulations), with filter chips, a search box and a "How to use" window per simulation.
Subjects without simulations yet show a "Coming soon" card.

## Adding a simulation

Add an entry to `js/simulations.js`:

```js
{
  title: "My New Sim",
  url: "https://claude.ai/artifact/…",
  categories: ["chemistry"],        // first one is the main subject; add more to list it in several
  description: "One or two sentences.",
  features: ["Tag one", "Tag two"]
}
```

`art` is optional: it picks an illustration from `SIM_ART` in `js/app.js`; without it the card shows the subject's icon.

`preview` is optional: a 10 second muted 16:9 clip (e.g. `previews/ph.mp4`, 640x360 H.264) that plays over the cover while the card is hovered.
