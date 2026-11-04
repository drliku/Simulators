import type { Spectrum } from '../scene/types';

/** Approximate visible-spectrum colour (Bruton) for a wavelength in nm. Returns 0..1 RGB. */
export function wavelengthToRGB(wl: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (wl >= 380 && wl < 440) {
    r = -(wl - 440) / 60;
    b = 1;
  } else if (wl >= 440 && wl < 490) {
    g = (wl - 440) / 50;
    b = 1;
  } else if (wl >= 490 && wl < 510) {
    g = 1;
    b = -(wl - 510) / 20;
  } else if (wl >= 510 && wl < 580) {
    r = (wl - 510) / 70;
    g = 1;
  } else if (wl >= 580 && wl < 645) {
    r = 1;
    g = -(wl - 645) / 65;
  } else if (wl >= 645 && wl <= 780) {
    r = 1;
  }
  let f = 0;
  if (wl >= 380 && wl < 420) f = 0.3 + (0.7 * (wl - 380)) / 40;
  else if (wl >= 420 && wl <= 700) f = 1;
  else if (wl > 700 && wl <= 780) f = 0.3 + (0.7 * (780 - wl)) / 80;
  const gamma = 0.8;
  const c = (v: number) => (v <= 0 ? 0 : Math.pow(v * f, gamma));
  return [c(r), c(g), c(b)];
}

export function wavelengthToCss(wl: number): string {
  const [r, g, b] = wavelengthToRGB(wl);
  const m = Math.max(r, g, b, 1e-6);
  return `rgb(${Math.round((r / m) * 255)}, ${Math.round((g / m) * 255)}, ${Math.round((b / m) * 255)})`;
}

export interface SpectralComponent {
  wavelength: number;
  /** Fraction of the source intensity carried by this component. */
  weight: number;
  /** Display colour (per unit intensity), may exceed 1 per channel. */
  r: number;
  g: number;
  b: number;
}

export const RGB_WAVELENGTHS = [630, 532, 465];

export function spectrumWavelengths(spectrum: Spectrum, wavelength: number, samples: number): number[] {
  if (spectrum === 'mono') return [wavelength];
  if (spectrum === 'rgb') return RGB_WAVELENGTHS;
  const n = Math.max(2, Math.round(samples));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(405 + ((690 - 405) * i) / (n - 1));
  return out;
}

/**
 * Splits a source into spectral components. Multi-wavelength sources are colour
 * normalised per channel so an undispersed beam adds up to neutral white.
 */
export function spectralComponents(spectrum: Spectrum, wavelength: number, samples: number): SpectralComponent[] {
  const wls = spectrumWavelengths(spectrum, wavelength, samples);
  const rgbs = wls.map(wavelengthToRGB);
  if (wls.length === 1) {
    const [r, g, b] = rgbs[0];
    const m = Math.max(r, g, b, 1e-6);
    return [{ wavelength: wls[0], weight: 1, r: r / m, g: g / m, b: b / m }];
  }
  const n = wls.length;
  const sum = [0, 0, 0];
  for (const c of rgbs) for (let k = 0; k < 3; k++) sum[k] += c[k];
  return wls.map((wl, i) => ({
    wavelength: wl,
    weight: 1 / n,
    r: sum[0] > 0 ? (rgbs[i][0] * n) / sum[0] : 0,
    g: sum[1] > 0 ? (rgbs[i][1] * n) / sum[1] : 0,
    b: sum[2] > 0 ? (rgbs[i][2] * n) / sum[2] : 0,
  }));
}
