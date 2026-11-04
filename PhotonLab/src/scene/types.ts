/**
 * Scene data model. World units are millimetres, angles are stored in degrees
 * and the world uses a y-up coordinate system (counter-clockwise = positive).
 */

export type MaterialId =
  | 'glass'
  | 'flint'
  | 'water'
  | 'acrylic'
  | 'diamond'
  | 'air'
  | 'polishedMetal'
  | 'roughMetal'
  | 'frostedGlass'
  | 'plastic'
  | 'black'
  | 'custom';

export interface Material {
  preset: MaterialId;
  name: string;
  /** Refractive index at 589.3 nm (sodium D line). */
  ior: number;
  /** Cauchy B coefficient in µm²: n(λ) = A + B/λ². */
  dispersion: number;
  /** Specular coating / metallic reflectance applied before any transmission (0..1). */
  reflectivity: number;
  /** Fraction of non-reflected light that crosses the interface (0 = opaque). */
  transmission: number;
  /** Bulk attenuation coefficient (Beer–Lambert) in 1/cm. */
  absorption: number;
  /** Microfacet roughness (0 = polished, 1 = very rough). */
  roughness: number;
  /** Display tint. */
  color: string;
}

export type Spectrum = 'mono' | 'white' | 'rgb';
export type EmitterType = 'laser' | 'beam' | 'point' | 'fan';
export type MirrorShape = 'flat' | 'concave' | 'convex' | 'parabolic' | 'arc';
export type BodyShape = 'rect' | 'circle' | 'prism' | 'lens' | 'fiber';
export type Polarization = 'unpolarized' | 's' | 'p';

interface BaseObject {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Degrees, counter-clockwise. */
  rotation: number;
}

export interface SourceObject extends BaseObject {
  kind: 'source';
  emitter: EmitterType;
  spectrum: Spectrum;
  /** nm, used when spectrum === 'mono'. */
  wavelength: number;
  /** Relative intensity carried by each ray (0..1). */
  intensity: number;
  rayCount: number;
  /** Degrees. Angular spread for point/fan sources, divergence for beams. */
  spread: number;
  /** mm, width of a parallel beam. */
  width: number;
  enabled: boolean;
}

export interface MirrorObject extends BaseObject {
  kind: 'mirror';
  shape: MirrorShape;
  /** Aperture / chord length in mm. */
  length: number;
  /** Radius of curvature (concave, convex, arc). */
  radius: number;
  /** Focal length (parabolic). */
  focalLength: number;
  /** Angular span in degrees (arc / spherical segment). */
  arcAngle: number;
  reflectivity: number;
  roughness: number;
  twoSided: boolean;
  /** Partially reflective: transmits (1 - reflectivity) straight through. */
  partial: boolean;
}

export interface BodyObject extends BaseObject {
  kind: 'body';
  shape: BodyShape;
  material: Material;
  // rect
  width: number;
  height: number;
  // circle
  radius: number;
  // prism (isosceles triangle)
  size: number;
  apexAngle: number;
  // lens (optical axis = local x)
  diameter: number;
  thickness: number;
  /** Left surface radius: + convex, − concave, 0 flat. */
  r1: number;
  /** Right surface radius: + convex, − concave, 0 flat. */
  r2: number;
  // fiber
  length: number;
  fiberWidth: number;
  bendRadius: number;
  bendAngle: number;
}

/** Ideal (paraxial) thin lens. */
export interface ThinLensObject extends BaseObject {
  kind: 'thinlens';
  focalLength: number;
  aperture: number;
}

export interface DetectorObject extends BaseObject {
  kind: 'detector';
  length: number;
}

export interface RulerObject extends BaseObject {
  kind: 'ruler';
  length: number;
}

export interface ProtractorObject extends BaseObject {
  kind: 'protractor';
  radius: number;
  /** Measured angle between the two arms, degrees. */
  angle: number;
}

export type SceneObject =
  | SourceObject
  | MirrorObject
  | BodyObject
  | ThinLensObject
  | DetectorObject
  | RulerObject
  | ProtractorObject;

export type ObjectKind = SceneObject['kind'];

export interface SimSettings {
  maxDepth: number;
  minIntensity: number;
  polarization: Polarization;
  whiteSamples: number;
  scatterRays: number;
  maxSegments: number;
  brightness: number;
}

export interface SceneData {
  objects: SceneObject[];
  settings: SimSettings;
}

export const DEFAULT_SETTINGS: SimSettings = {
  maxDepth: 60,
  minIntensity: 0.004,
  polarization: 'unpolarized',
  whiteSamples: 9,
  scatterRays: 7,
  maxSegments: 40000,
  brightness: 1,
};
