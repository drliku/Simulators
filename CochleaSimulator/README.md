# Cochlea Simulator

A real-time three.js version of `EarProject.blend`. Load any MP3 (or use the microphone) and watch the
basilar membrane and 300 hair cells respond, high pitches near the base, low pitches at the apex.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` writes a static site to `dist/` that can be hosted anywhere.

## How it maps to the Blender file

| Blender | Simulator |
| --- | --- |
| `coch_rebuild` bake (FFT → ERB filters → envelope → adaptation → spring), run once per song | `src/cochleaModel.js`, the same stages streaming live from a Web Audio `AnalyserNode` |
| `HC_###` empties (`freq_hz`, `place`) + `_Body` / `_Bundle` keyframes | `public/assets/cells.json` = 300 frequency channels; any number of instanced hair cells, animated in the vertex shader with the same bend/sway/lift formulas |
| `GN_Membrane_Wave` + `Cochlea_Activity` image | Vertex shader displacement driven by a 300×1 activity texture |
| `PL_##` pitch labels | `src/pitchLabels.js` pops a label when a strong new note hits a place |
| Materials, area lights, studio spot, AgX, glare + vignette | `src/cochleaScene.js`, `src/main.js` |

## Hair cells

The "Cells" picker sets 300 (the original single row) up to 15,000 (a real ear). Above 300 the cells are laid out like the
organ of Corti: one row of inner hair cells near the modiolus and three rows of outer hair cells, interpolated between the
original Blender cell transforms. Each cell reads the frequency channel at its place, so the hearing model always runs on
300 channels and the CPU cost doesn't grow with the cell count. Measured GPU time per frame on an RTX 3060 at ~1000×870 px:
1,000 cells 2.3 ms, 5,000 cells 4.5 ms, 15,000 cells 8.3 ms. The fps readout next to the picker shows what a viewer's
own device manages.

## Instruments

Play an instrument and watch where the cochlea responds: low notes near the apex, high notes near the base.

`src/instruments/` holds ten procedurally modelled 3D instruments built on `common.js`: grand piano, marimba, concert
harp, pipe organ, tubular bells and synth, plus violin, cello, acoustic guitar and electric guitar (with amp) in
`strings.js`. The chosen one stands on the floor behind the cochlea (narrow ones to one side) and swings round as the
camera orbits, so it always stays in the background (`index.js`); with an instrument on, the camera eases back a little.

Play by clicking or dragging across keys, bars, strings, pipes or bells, or with the computer keyboard (Z-row and Q-row
like piano keys, `[` `]` change octave). On string instruments every string × position is a playable spot; clicks pick the
position along the neck and the string by where across the neck you click. The played spot lights in its pitch colour
and strings vibrate. `src/instrumentSynth.js` has a voice per instrument; what you play goes to the speakers and into the
cochlea's input, so the cochlea, hair cells and pitch labels respond to it like any other sound. Places much quieter
than the loudest one at that moment respond more weakly, so a note's own place stands out from its overtones.

Colours come from one pitch ramp in `src/palette.js` (base/high = rose → coral → gold → teal → violet = apex/low).

## Re-exporting assets

`public/assets/` was exported read-only from `../EarProject.blend` by `tools/export_from_blender.py`
(the shell is exported without its Subdivision modifier to keep the download small). If you change the model in
Blender, re-run it from the `simulator` folder:

```bash
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b ..\EarProject.blend --python tools\export_from_blender.py -- public\assets
```
