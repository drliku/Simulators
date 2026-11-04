import { DEFAULT_SETTINGS, type SceneObject, type SimSettings } from './types';
import { makeBody, makeDetector, makeMirror, makeProtractor, makeRuler, makeSource } from './factory';

export interface PresetUI {
  showNormals?: boolean;
  showAngles?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => { objects: SceneObject[]; settings?: Partial<SimSettings>; ui?: PresetUI };
}

export const PRESETS: Preset[] = [
  {
    id: 'flat-mirror',
    name: 'Reflection from a flat mirror',
    description: 'Law of reflection: the angle of incidence equals the angle of reflection.',
    build: () => ({
      objects: [
        makeMirror({ x: 0, y: -60, rotation: 90, length: 380, name: 'Plane Mirror' }),
        makeSource({ x: -260, y: 140, rotation: -37.57, wavelength: 650, name: 'Red Laser' }),
        makeSource({ x: -300, y: 40, rotation: -14.04, wavelength: 532, name: 'Green Laser' }),
      ],
      ui: { showNormals: true, showAngles: true },
    }),
  },
  {
    id: 'concave',
    name: 'Concave mirror focusing',
    description: 'Parallel rays converge near the focal point f = R/2 (with slight spherical aberration at the edges).',
    build: () => ({
      objects: [
        makeMirror({ x: 260, y: 0, rotation: 180, shape: 'concave', radius: 440, length: 300, name: 'Concave Mirror (R = 440 mm)' }),
        makeSource({ x: -280, y: 0, emitter: 'beam', width: 220, rayCount: 13, wavelength: 532, name: 'Parallel Beam' }),
      ],
    }),
  },
  {
    id: 'convex',
    name: 'Convex mirror divergence',
    description: 'A convex mirror spreads parallel light as if it came from a virtual focus behind the mirror.',
    build: () => ({
      objects: [
        makeMirror({ x: 200, y: 0, rotation: 180, shape: 'convex', radius: 300, length: 260, name: 'Convex Mirror (R = 300 mm)' }),
        makeSource({ x: -280, y: 0, emitter: 'beam', width: 200, rayCount: 11, wavelength: 650, name: 'Parallel Beam' }),
      ],
    }),
  },
  {
    id: 'glass-block',
    name: 'Light through a glass block',
    description: 'The beam refracts on entry and exit and leaves parallel to the incident ray, laterally displaced.',
    build: () => ({
      objects: [
        makeBody({ x: 0, y: 0, width: 260, height: 120, name: 'Glass Block' }),
        makeSource({ x: -260, y: 190, rotation: -35, wavelength: 650, name: 'Laser' }),
      ],
      ui: { showNormals: true, showAngles: true },
    }),
  },
  {
    id: 'air-water',
    name: 'Refraction from air into water',
    description: "Snell's law at an air–water interface: rays bend toward the normal on entering water.",
    build: () => ({
      objects: [
        makeBody({ x: 0, y: -170, width: 900, height: 340, materialId: 'water', name: 'Water Tank' }),
        makeSource({ x: -260, y: 220, rotation: -42, emitter: 'fan', spread: 50, rayCount: 7, wavelength: 532, name: 'Ray Fan' }),
      ],
      ui: { showNormals: true, showAngles: true },
    }),
  },
  {
    id: 'prism',
    name: 'Prism rainbow dispersion',
    description: 'White light separates into the visible spectrum because the refractive index depends on wavelength.',
    build: () => ({
      objects: [
        makeBody({ x: 0, y: 0, shape: 'prism', size: 200, apexAngle: 60, materialId: 'flint', name: 'Flint Glass Prism' }),
        makeSource({ x: -320, y: -100, rotation: 25.5, spectrum: 'white', name: 'White Light' }),
        makeDetector({ x: 340, y: -112, rotation: -25.5, length: 180, name: 'Screen' }),
      ],
      settings: { whiteSamples: 15 },
    }),
  },
  {
    id: 'tir',
    name: 'Total internal reflection',
    description: 'Beyond the critical angle (≈41° for glass→air) light is reflected completely inside the glass.',
    build: () => ({
      objects: [
        makeBody({ x: -220, y: 0, shape: 'prism', size: 160, apexAngle: 90, name: 'Right-Angle Prism' }),
        makeSource({ x: -361.6, y: 103.8, rotation: -45, wavelength: 650, name: 'Laser' }),
        makeBody({ x: 230, y: -20, width: 380, height: 200, name: 'Glass Slab' }),
        makeSource({ x: 90, y: -100, rotation: 50, emitter: 'fan', spread: 70, rayCount: 11, wavelength: 590, name: 'Embedded Fan Source' }),
      ],
      ui: { showAngles: false },
    }),
  },
  {
    id: 'convex-lens',
    name: 'Light through a convex lens',
    description: 'A biconvex glass lens focuses a parallel beam; compare the focus with the lensmaker prediction.',
    build: () => ({
      objects: [
        makeBody({ x: 0, y: 0, shape: 'lens', diameter: 200, thickness: 40, r1: 250, r2: 250, name: 'Biconvex Lens' }),
        makeSource({ x: -320, y: 0, emitter: 'beam', width: 150, rayCount: 11, wavelength: 532, name: 'Parallel Beam' }),
        makeRuler({ x: 0, y: -130, length: 250, name: 'Ruler' }),
      ],
    }),
  },
  {
    id: 'two-mirrors',
    name: 'Two-mirror multiple reflections',
    description: 'A laser bounces repeatedly between two parallel plane mirrors, losing a little energy each time.',
    build: () => ({
      objects: [
        makeMirror({ x: 0, y: 90, rotation: -90, length: 700, name: 'Upper Mirror', reflectivity: 0.95 }),
        makeMirror({ x: 0, y: -90, rotation: 90, length: 700, name: 'Lower Mirror', reflectivity: 0.95 }),
        makeSource({ x: -340, y: -60, rotation: 50, wavelength: 650, name: 'Red Laser' }),
        makeSource({ x: -340, y: 0, rotation: -28, wavelength: 450, name: 'Blue Laser' }),
      ],
    }),
  },
  {
    id: 'rough-polished',
    name: 'Rough versus polished surface',
    description: 'Specular reflection from polished metal versus diffuse scattering from a rough surface.',
    build: () => ({
      objects: [
        makeBody({ x: -180, y: -60, width: 220, height: 60, materialId: 'polishedMetal', name: 'Polished Metal' }),
        makeBody({ x: 180, y: -60, width: 220, height: 60, materialId: 'roughMetal', name: 'Rough Metal' }),
        makeSource({ x: -330, y: 120, rotation: -45, wavelength: 532, name: 'Laser A' }),
        makeSource({ x: 30, y: 120, rotation: -45, wavelength: 532, name: 'Laser B' }),
        makeProtractor({ x: -180, y: -30, rotation: 45, angle: 90, radius: 70, name: 'Protractor' }),
      ],
      settings: { scatterRays: 9 },
    }),
  },
  {
    id: 'fiber',
    name: 'Optical fiber light propagation',
    description: 'Light is guided along a bent acrylic fiber by repeated total internal reflection.',
    build: () => ({
      objects: [
        makeBody({ x: -220, y: -80, shape: 'fiber', length: 460, fiberWidth: 30, bendRadius: 150, bendAngle: 90, materialId: 'acrylic', name: 'Optical Fiber' }),
        makeSource({ x: -280, y: -80, rotation: 0, emitter: 'fan', spread: 22, rayCount: 7, wavelength: 532, name: 'Coupling Fan' }),
        makeSource({ x: -300, y: -76, rotation: 4, wavelength: 650, name: 'Laser' }),
      ],
    }),
  },
  {
    id: 'beam-splitter',
    name: 'Beam splitter experiment',
    description: 'A Mach–Zehnder layout: 50/50 splitters divide and recombine the beam; detectors read the power (incoherent).',
    build: () => ({
      objects: [
        makeSource({ x: -250, y: 0, wavelength: 532, name: 'Laser' }),
        makeMirror({ x: 0, y: 0, rotation: -45, partial: true, twoSided: true, reflectivity: 0.5, length: 90, name: 'Splitter 1' }),
        makeMirror({ x: 0, y: 220, rotation: -45, length: 90, reflectivity: 1, name: 'Mirror 1' }),
        makeMirror({ x: 300, y: 0, rotation: 135, length: 90, reflectivity: 1, name: 'Mirror 2' }),
        makeMirror({ x: 300, y: 220, rotation: -45, partial: true, twoSided: true, reflectivity: 0.5, length: 90, name: 'Splitter 2' }),
        makeDetector({ x: 480, y: 220, rotation: 0, length: 80, name: 'Detector A' }),
        makeDetector({ x: 300, y: 400, rotation: 90, length: 80, name: 'Detector B' }),
      ],
    }),
  },
];

export const STARTUP_PRESET = 'prism';

export function buildPreset(id: string): { objects: SceneObject[]; settings: SimSettings; ui: PresetUI } | null {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return null;
  const r = p.build();
  return {
    objects: r.objects,
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    ui: { showNormals: false, showAngles: false, ...(r.ui ?? {}) },
  };
}
