import { makeMaterial } from '../engine/materials';
import type {
  BodyObject,
  DetectorObject,
  MaterialId,
  MirrorObject,
  ProtractorObject,
  RulerObject,
  SceneObject,
  SourceObject,
  ThinLensObject,
} from './types';

let counter = 0;
export function uid(prefix = 'o'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

type Pos = { x?: number; y?: number; rotation?: number; name?: string };

export function makeSource(p: Partial<SourceObject> & Pos = {}): SourceObject {
  return {
    id: uid('src'),
    kind: 'source',
    name: 'Laser',
    x: 0,
    y: 0,
    rotation: 0,
    emitter: 'laser',
    spectrum: 'mono',
    wavelength: 650,
    intensity: 1,
    rayCount: 9,
    spread: 0,
    width: 60,
    enabled: true,
    ...p,
  };
}

export function makeMirror(p: Partial<MirrorObject> & Pos = {}): MirrorObject {
  return {
    id: uid('mir'),
    kind: 'mirror',
    name: 'Flat Mirror',
    x: 0,
    y: 0,
    rotation: 0,
    shape: 'flat',
    length: 160,
    radius: 300,
    focalLength: 120,
    arcAngle: 120,
    reflectivity: 0.98,
    roughness: 0,
    twoSided: false,
    partial: false,
    ...p,
  };
}

export function makeBody(p: Partial<BodyObject> & Pos & { materialId?: MaterialId } = {}): BodyObject {
  const { materialId, ...rest } = p;
  return {
    id: uid('body'),
    kind: 'body',
    name: 'Glass Block',
    x: 0,
    y: 0,
    rotation: 0,
    shape: 'rect',
    material: makeMaterial(materialId ?? 'glass'),
    width: 160,
    height: 100,
    radius: 60,
    size: 160,
    apexAngle: 60,
    diameter: 140,
    thickness: 30,
    r1: 200,
    r2: 200,
    length: 400,
    fiberWidth: 24,
    bendRadius: 160,
    bendAngle: 90,
    ...rest,
  };
}

export function makeThinLens(p: Partial<ThinLensObject> & Pos = {}): ThinLensObject {
  return { id: uid('lens'), kind: 'thinlens', name: 'Ideal Lens', x: 0, y: 0, rotation: 0, focalLength: 150, aperture: 160, ...p };
}

export function makeDetector(p: Partial<DetectorObject> & Pos = {}): DetectorObject {
  return { id: uid('det'), kind: 'detector', name: 'Detector', x: 0, y: 0, rotation: 0, length: 120, ...p };
}

export function makeRuler(p: Partial<RulerObject> & Pos = {}): RulerObject {
  return { id: uid('rul'), kind: 'ruler', name: 'Ruler', x: 0, y: 0, rotation: 0, length: 200, ...p };
}

export function makeProtractor(p: Partial<ProtractorObject> & Pos = {}): ProtractorObject {
  return { id: uid('pro'), kind: 'protractor', name: 'Protractor', x: 0, y: 0, rotation: 0, radius: 80, angle: 45, ...p };
}

export type LibraryCategory = 'sources' | 'mirrors' | 'lenses' | 'prisms' | 'materials' | 'tools';

export interface LibraryItem {
  id: string;
  label: string;
  category: LibraryCategory;
  hint: string;
  /** Icon key for the sidebar glyph. */
  icon: string;
  /** Swatch colour for material items. */
  swatch?: string;
  create: (x: number, y: number) => SceneObject;
}

const materialItem = (id: MaterialId, label: string, hint: string): LibraryItem => ({
  id: `mat-${id}`,
  label,
  category: 'materials',
  hint,
  icon: 'material',
  swatch: makeMaterial(id).color,
  create: (x, y) => makeBody({ x, y, materialId: id, name: `${label} Block`, width: 140, height: 90 }),
});

export const LIBRARY: LibraryItem[] = [
  // Light sources
  { id: 'laser', label: 'Laser', category: 'sources', icon: 'laser', hint: 'Single monochromatic ray', create: (x, y) => makeSource({ x, y }) },
  {
    id: 'beam',
    label: 'Parallel Beam',
    category: 'sources',
    icon: 'beam',
    hint: 'Collimated beam of parallel rays',
    create: (x, y) => makeSource({ x, y, name: 'Parallel Beam', emitter: 'beam', wavelength: 532, rayCount: 9, width: 80 }),
  },
  {
    id: 'point',
    label: 'Point Source',
    category: 'sources',
    icon: 'point',
    hint: 'Emits rays in all directions',
    create: (x, y) => makeSource({ x, y, name: 'Point Source', emitter: 'point', wavelength: 589, rayCount: 36, spread: 360, intensity: 0.8 }),
  },
  {
    id: 'white',
    label: 'White Light',
    category: 'sources',
    icon: 'white',
    hint: 'Broadband visible spectrum',
    create: (x, y) => makeSource({ x, y, name: 'White Light', spectrum: 'white' }),
  },
  {
    id: 'rgb',
    label: 'RGB Laser',
    category: 'sources',
    icon: 'rgb',
    hint: 'Red, green and blue lines',
    create: (x, y) => makeSource({ x, y, name: 'RGB Laser', spectrum: 'rgb' }),
  },
  {
    id: 'fan',
    label: 'Ray Fan',
    category: 'sources',
    icon: 'fan',
    hint: 'Adjustable fan of diverging rays',
    create: (x, y) => makeSource({ x, y, name: 'Ray Fan', emitter: 'fan', wavelength: 470, rayCount: 11, spread: 30 }),
  },
  // Mirrors
  { id: 'mirror-flat', label: 'Flat Mirror', category: 'mirrors', icon: 'mirror-flat', hint: 'One-sided plane mirror', create: (x, y) => makeMirror({ x, y }) },
  {
    id: 'mirror-concave',
    label: 'Concave Mirror',
    category: 'mirrors',
    icon: 'mirror-concave',
    hint: 'Spherical, converging (f = R/2)',
    create: (x, y) => makeMirror({ x, y, name: 'Concave Mirror', shape: 'concave', length: 200, radius: 320 }),
  },
  {
    id: 'mirror-convex',
    label: 'Convex Mirror',
    category: 'mirrors',
    icon: 'mirror-convex',
    hint: 'Spherical, diverging',
    create: (x, y) => makeMirror({ x, y, name: 'Convex Mirror', shape: 'convex', length: 200, radius: 320 }),
  },
  {
    id: 'mirror-parabolic',
    label: 'Parabolic Mirror',
    category: 'mirrors',
    icon: 'mirror-parabolic',
    hint: 'Aberration-free focus for parallel rays',
    create: (x, y) => makeMirror({ x, y, name: 'Parabolic Mirror', shape: 'parabolic', length: 220, focalLength: 120 }),
  },
  {
    id: 'mirror-arc',
    label: 'Spherical Segment',
    category: 'mirrors',
    icon: 'mirror-arc',
    hint: 'Circular arc mirror of any span',
    create: (x, y) => makeMirror({ x, y, name: 'Spherical Segment', shape: 'arc', radius: 100, arcAngle: 140, twoSided: true }),
  },
  {
    id: 'mirror-two',
    label: 'Two-Sided Mirror',
    category: 'mirrors',
    icon: 'mirror-two',
    hint: 'Reflects on both faces',
    create: (x, y) => makeMirror({ x, y, name: 'Two-Sided Mirror', twoSided: true }),
  },
  {
    id: 'mirror-partial',
    label: 'Beam Splitter',
    category: 'mirrors',
    icon: 'mirror-partial',
    hint: 'Partially reflective mirror',
    create: (x, y) => makeMirror({ x, y, name: 'Beam Splitter', partial: true, twoSided: true, reflectivity: 0.5, rotation: 45 }),
  },
  // Lenses
  {
    id: 'lens-convex',
    label: 'Convex Lens',
    category: 'lenses',
    icon: 'lens-ideal-convex',
    hint: 'Ideal thin converging lens',
    create: (x, y) => makeThinLens({ x, y, name: 'Convex Lens (ideal)', focalLength: 150 }),
  },
  {
    id: 'lens-concave',
    label: 'Concave Lens',
    category: 'lenses',
    icon: 'lens-ideal-concave',
    hint: 'Ideal thin diverging lens',
    create: (x, y) => makeThinLens({ x, y, name: 'Concave Lens (ideal)', focalLength: -150 }),
  },
  {
    id: 'lens-biconvex',
    label: 'Biconvex Lens',
    category: 'lenses',
    icon: 'lens-biconvex',
    hint: 'Thick glass lens, both sides convex',
    create: (x, y) => makeBody({ x, y, name: 'Biconvex Lens', shape: 'lens', diameter: 150, thickness: 34, r1: 200, r2: 200 }),
  },
  {
    id: 'lens-biconcave',
    label: 'Biconcave Lens',
    category: 'lenses',
    icon: 'lens-biconcave',
    hint: 'Thick glass lens, both sides concave',
    create: (x, y) => makeBody({ x, y, name: 'Biconcave Lens', shape: 'lens', diameter: 150, thickness: 10, r1: -200, r2: -200 }),
  },
  {
    id: 'lens-planoconvex',
    label: 'Plano-Convex',
    category: 'lenses',
    icon: 'lens-planoconvex',
    hint: 'One flat, one convex surface',
    create: (x, y) => makeBody({ x, y, name: 'Plano-Convex Lens', shape: 'lens', diameter: 150, thickness: 26, r1: 0, r2: 160 }),
  },
  // Prisms & shapes
  {
    id: 'prism',
    label: 'Glass Prism',
    category: 'prisms',
    icon: 'prism',
    hint: 'Dispersive triangular prism',
    create: (x, y) => makeBody({ x, y, name: 'Prism', shape: 'prism', size: 170, apexAngle: 60, materialId: 'flint' }),
  },
  { id: 'block', label: 'Glass Block', category: 'prisms', icon: 'block', hint: 'Rectangular slab', create: (x, y) => makeBody({ x, y }) },
  {
    id: 'circle',
    label: 'Glass Circle',
    category: 'prisms',
    icon: 'circle',
    hint: 'Transparent circular object',
    create: (x, y) => makeBody({ x, y, name: 'Glass Circle', shape: 'circle', radius: 70 }),
  },
  {
    id: 'fiber',
    label: 'Optical Fiber',
    category: 'prisms',
    icon: 'fiber',
    hint: 'Guides light by total internal reflection',
    create: (x, y) => makeBody({ x, y, name: 'Optical Fiber', shape: 'fiber', length: 400, fiberWidth: 24, bendRadius: 160, bendAngle: 90, materialId: 'acrylic' }),
  },
  // Materials
  materialItem('glass', 'Glass', 'n = 1.517'),
  materialItem('water', 'Water', 'n = 1.333'),
  materialItem('acrylic', 'Acrylic', 'n = 1.491'),
  materialItem('diamond', 'Diamond', 'n = 2.417, high dispersion'),
  materialItem('air', 'Air', 'n = 1.0003 (air gap)'),
  materialItem('polishedMetal', 'Polished Metal', 'Specular, 95% reflective'),
  materialItem('roughMetal', 'Rough Metal', 'Diffuse scattering'),
  materialItem('frostedGlass', 'Frosted Glass', 'Scatters transmitted light'),
  materialItem('plastic', 'Plastic', 'Polycarbonate, n = 1.586'),
  materialItem('black', 'Absorber', 'Absorbs ~98% of light'),
  materialItem('custom', 'Custom', 'Fully editable material'),
  // Tools
  { id: 'ruler', label: 'Ruler', category: 'tools', icon: 'ruler', hint: 'Measure distances', create: (x, y) => makeRuler({ x: x - 100, y }) },
  { id: 'protractor', label: 'Protractor', category: 'tools', icon: 'protractor', hint: 'Measure angles', create: (x, y) => makeProtractor({ x, y }) },
  { id: 'detector', label: 'Light Detector', category: 'tools', icon: 'detector', hint: 'Measures incident power', create: (x, y) => makeDetector({ x, y }) },
];

export const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  sources: 'Light Sources',
  mirrors: 'Mirrors',
  lenses: 'Lenses',
  prisms: 'Prisms & Shapes',
  materials: 'Materials',
  tools: 'Measuring Tools',
};

export function libraryItem(id: string): LibraryItem | undefined {
  return LIBRARY.find((i) => i.id === id);
}

/** Default template object of the same kind, used to fill missing fields when loading files. */
export function defaultsFor(kind: SceneObject['kind']): SceneObject {
  switch (kind) {
    case 'source':
      return makeSource();
    case 'mirror':
      return makeMirror();
    case 'body':
      return makeBody();
    case 'thinlens':
      return makeThinLens();
    case 'detector':
      return makeDetector();
    case 'ruler':
      return makeRuler();
    case 'protractor':
      return makeProtractor();
  }
}

export function cloneObject(o: SceneObject): SceneObject {
  const c = JSON.parse(JSON.stringify(o)) as SceneObject;
  c.id = uid(o.kind.slice(0, 3));
  return c;
}
