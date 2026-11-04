# Atom Builder

An interactive 3D Bohr-model atom builder for chemistry students, built with **React**, **TypeScript**,
**Tailwind CSS**, **Three.js** and **React Three Fiber**.

## Features

- **3D atom** – a nucleus of red protons and grey neutrons with blue electrons orbiting on Bohr shells.
  Drag to rotate, scroll or pinch to zoom. Particles fly in and out when added or removed.
- **Controls** – protons (change the element), neutrons (change the isotope), electrons (change the charge).
- **Element information** – name, symbol, atomic number, mass number, particle counts, charge,
  neutral / cation / anion, shell configuration (e.g. 2, 8, 1), full electron configuration
  (e.g. 1s² 2s² 2p⁶ 3s¹), valence electrons, isotope name and stability.
- **Periodic table** (elements 1–36): click an element to build its neutral atom with its most common isotope.
- **Selection** – click the nucleus or a shell (or use the info panel) to highlight it with an explanation.
- **Examples** – H, He, C, O, Na, plus deuterium, carbon-14, Na⁺, Cl⁻, O²⁻. Reset returns to hydrogen.
- Particle labels, auto-rotate and electron-motion toggles.

## Branding

Styled after The Brain Maze logo: navy background scale built on `#232F5B`, coral `#F37367` accents
(protons are coral too), squared corners and a logo-style wordmark. Headings, buttons and labels use the
**Brain** typeface (inlined at build time). Brain is capitals-only, so chemical symbols (Na, Fe, p⁺, e⁻)
use Saira Semi Condensed to keep their correct letter case.

## Science notes

- Elements 1–36 are supported. Electron configurations follow the aufbau order with the Cr and Cu
  exceptions; cations lose electrons from the highest shell first (4p, then 4s, before 3d), so
  Fe²⁺ is 2, 8, 14. Anions gain electrons in aufbau order. Shell counts are derived from the configuration.
- Up to 3 extra electrons are allowed (e.g. N³⁻). The panel says whether an ion is one the element commonly forms.
- Isotope stability uses the list of stable isotopes for each element; a few very long-lived
  radioactive isotopes found in nature (K-40, Ca-48, V-50, Ge-76, Se-82, Kr-78) are labelled separately.
- The Bohr model is shown as a simplified educational representation, not a literal picture of
  electron orbits, and sizes are not to scale.

## Getting started

```bash
npm install
npm run dev
npm run build
```
