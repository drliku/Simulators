# pH Lab

An interactive 3D pH scale simulator for chemistry students, built with **React**, **TypeScript**,
**Tailwind CSS**, **Three.js** and **React Three Fiber**.

## Features

- **3D glass beaker** with graduations (50–500 mL), rippling liquid, bubbles and soft lab lighting.
  The liquid shows universal-indicator colours that blend smoothly as the pH changes.
- **pH slider** (0–14) with live [H⁺] and [OH⁻].
- **Add Acid / Add Base** – each click releases 5 animated drops (1.0 mL in total) of HCl or NaOH at a chosen
  concentration (0.001–1.00 M). The pH updates as each drop lands.
- **Add Water** – pours 50 mL of pure water (dilution); **Pour out half** removes half the solution
  (pH unchanged) so serial dilutions are possible.
- **Substances** – lemon juice (2), vinegar (3), coffee (5), pure water (7), baking soda solution (8.3),
  soapy water (10), household bleach (12.5).
- **Large interactive pH scale** – click or drag to set the pH; bands for strong/weak acid, neutral,
  weak/strong base.
- **Chemistry readout** – pH, pOH, [H⁺], [OH⁻], volume, comparison with pure water, an explanation and a lab notebook.
- **Compare two** – two beakers side by side with their pH values, concentrations and the tenfold-per-unit ratio.
- **Pause animation** and **Reset**.

## Branding

Styled after The Brain Maze logo: navy background scale built on `#232F5B`, coral `#F37367` accents, squared
corners and a logo-style "pH SCALE — LAB" wordmark. Headings, buttons and labels use the **Brain** typeface
(inlined at build time). Brain is capitals-only, so chemistry notation ("pH", [H⁺], mL, mol/L) stays in
Saira Semi Condensed. Universal-indicator colours are unchanged.

## The model

Ideal dilute aqueous solutions at 25 °C (Kw = 1.0 × 10⁻¹⁴). A solution is stored as its volume and its
net amount of strong acid (negative for excess strong base). From charge balance and the water equilibrium

    [H⁺] − [OH⁻] = C = net / V,   [H⁺][OH⁻] = Kw   ⇒   [H⁺] = (C + √(C² + 4Kw)) / 2

so pure water is pH 7, neutralization follows the actual moles and volumes, and dilution moves the pH
toward 7. Presets are treated as strong-acid/strong-base equivalents with their typical pH; real substances
contain weak acids, bases and buffers and behave differently. Colours represent an added universal indicator.

## Getting started

```bash
npm install
npm run dev
npm run build
```
