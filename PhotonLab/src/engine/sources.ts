import type { SourceObject } from '../scene/types';
import { spectralComponents } from './color';
import { deg2rad } from './vec';

export interface EmittedRay {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  wavelength: number;
  intensity: number;
  r: number;
  g: number;
  b: number;
}

/** Geometric ray directions/origins for a source, before spectral splitting. */
export function sourceGeometry(s: SourceObject): { ox: number; oy: number; a: number }[] {
  const base = deg2rad(s.rotation);
  const n = s.emitter === 'laser' ? 1 : Math.max(1, Math.round(s.rayCount));
  const out: { ox: number; oy: number; a: number }[] = [];
  if (s.emitter === 'laser') {
    out.push({ ox: s.x, oy: s.y, a: base });
  } else if (s.emitter === 'beam') {
    const px = -Math.sin(base);
    const py = Math.cos(base);
    const div = deg2rad(s.spread);
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1) - 0.5;
      const off = f * s.width;
      out.push({ ox: s.x + px * off, oy: s.y + py * off, a: base + f * div });
    }
  } else {
    const spread = deg2rad(Math.min(360, Math.max(0, s.spread)));
    const full = spread >= Math.PI * 2 - 1e-9;
    for (let i = 0; i < n; i++) {
      let a: number;
      if (full) a = base + (Math.PI * 2 * i) / n;
      else if (n === 1) a = base;
      else a = base - spread / 2 + (spread * i) / (n - 1);
      out.push({ ox: s.x, oy: s.y, a });
    }
  }
  return out;
}

export function emitRays(s: SourceObject, whiteSamples: number): EmittedRay[] {
  if (!s.enabled || s.intensity <= 0) return [];
  const comps = spectralComponents(s.spectrum, s.wavelength, whiteSamples);
  const rays: EmittedRay[] = [];
  for (const g of sourceGeometry(s)) {
    const dx = Math.cos(g.a);
    const dy = Math.sin(g.a);
    for (const c of comps) {
      rays.push({
        ox: g.ox,
        oy: g.oy,
        dx,
        dy,
        wavelength: c.wavelength,
        intensity: s.intensity * c.weight,
        r: c.r,
        g: c.g,
        b: c.b,
      });
    }
  }
  return rays;
}
