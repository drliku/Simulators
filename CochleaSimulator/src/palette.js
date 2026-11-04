import * as THREE from 'three';

// One "pitch colour" for every place along the cochlea, shared by the membrane, hair-cell glow,
// sparks, labels and the cochleagram. Stops run from the base (high pitch) to the apex (low pitch).
const STOP_POS = [0.0, 0.22, 0.45, 0.7, 1.0];

export const THEMES = {
  spectrum: { name: 'Spectrum', colors: ['#ff4d6d', '#ff8a4c', '#ffd166', '#2ec4b6', '#7b6cff'] },
  brainmaze: { name: 'Brain Maze', colors: ['#f3735f', '#ff9f8a', '#ffe1d2', '#8a9cff', '#3b4fd8'] },
  aurora: { name: 'Aurora', colors: ['#f6ff7a', '#4dffa6', '#18d9f0', '#4f7dff', '#b65cff'] },
  ember: { name: 'Ember', colors: ['#fff4c2', '#ffd23f', '#ff8c1a', '#ff3d2e', '#b3123a'] },
  ocean: { name: 'Ocean', colors: ['#e3fdfd', '#8ff7e0', '#33d1c9', '#1f8fe0', '#2a3fd1'] },
  neon: { name: 'Neon', colors: ['#ff2fb3', '#ff7af0', '#b56cff', '#4ff0ff', '#2bff9e'] },
};
export const DEFAULT_THEME = 'spectrum';

const STOP_COLORS = STOP_POS.map(() => new THREE.Color());
const RAMP_UNIFORM = { value: STOP_POS.map(() => new THREE.Vector3()) };
const listeners = new Set();
let current = null;

export function setTheme(key) {
  if (!THEMES[key]) key = DEFAULT_THEME;
  current = key;
  THEMES[key].colors.forEach((hex, i) => {
    STOP_COLORS[i].set(hex); // linear working space
    RAMP_UNIFORM.value[i].set(STOP_COLORS[i].r, STOP_COLORS[i].g, STOP_COLORS[i].b);
  });
  listeners.forEach((fn) => fn(key));
}
export const currentTheme = () => current;

// Called whenever the theme changes, for anything that bakes ramp colours on the CPU.
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function placeColor(p, out = new THREE.Color()) {
  p = Math.min(Math.max(p, 0), 1);
  let k = 0;
  while (k < STOP_POS.length - 2 && p > STOP_POS[k + 1]) k++;
  return out.copy(STOP_COLORS[k]).lerp(STOP_COLORS[k + 1], (p - STOP_POS[k]) / (STOP_POS[k + 1] - STOP_POS[k]));
}

// CSS gradient of a theme, high pitch on the left
export function themeGradient(key) {
  const t = THEMES[key] || THEMES[DEFAULT_THEME];
  return `linear-gradient(90deg, ${t.colors.map((c, i) => `${c} ${STOP_POS[i] * 100}%`).join(', ')})`;
}

// Shared uniform: every shader using it updates instantly when the theme changes
export function rampUniform() {
  return RAMP_UNIFORM;
}

const g = (x) => x.toFixed(3);
export const RAMP_GLSL = `
uniform vec3 uRamp[5];
vec3 pitchRamp(float p) {
  p = clamp(p, 0.0, 1.0);
  if (p < ${g(STOP_POS[1])}) return mix(uRamp[0], uRamp[1], p / ${g(STOP_POS[1])});
  if (p < ${g(STOP_POS[2])}) return mix(uRamp[1], uRamp[2], (p - ${g(STOP_POS[1])}) / ${g(STOP_POS[2] - STOP_POS[1])});
  if (p < ${g(STOP_POS[3])}) return mix(uRamp[2], uRamp[3], (p - ${g(STOP_POS[2])}) / ${g(STOP_POS[3] - STOP_POS[2])});
  return mix(uRamp[3], uRamp[4], (p - ${g(STOP_POS[3])}) / ${g(STOP_POS[4] - STOP_POS[3])});
}
`;

setTheme(DEFAULT_THEME);
