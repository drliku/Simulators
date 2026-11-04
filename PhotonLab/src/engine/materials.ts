import type { Material, MaterialId } from '../scene/types';

type Def = Omit<Material, 'preset'>;

/** Reference material library. Indices at 589 nm, dispersion as Cauchy B (µm²). */
export const MATERIALS: Record<MaterialId, Def> = {
  glass: { name: 'Crown Glass (BK7)', ior: 1.5168, dispersion: 0.0042, reflectivity: 0, transmission: 1, absorption: 0, roughness: 0, color: '#7dd3fc' },
  flint: { name: 'Dense Flint Glass', ior: 1.648, dispersion: 0.0102, reflectivity: 0, transmission: 1, absorption: 0, roughness: 0, color: '#a5b4fc' },
  water: { name: 'Water', ior: 1.333, dispersion: 0.0031, reflectivity: 0, transmission: 1, absorption: 0.01, roughness: 0, color: '#3b82f6' },
  acrylic: { name: 'Acrylic (PMMA)', ior: 1.4905, dispersion: 0.0045, reflectivity: 0, transmission: 1, absorption: 0.001, roughness: 0, color: '#99f6e4' },
  diamond: { name: 'Diamond', ior: 2.417, dispersion: 0.0133, reflectivity: 0, transmission: 1, absorption: 0, roughness: 0, color: '#e0f2fe' },
  air: { name: 'Air', ior: 1.000293, dispersion: 0, reflectivity: 0, transmission: 1, absorption: 0, roughness: 0, color: '#cbd5e1' },
  polishedMetal: { name: 'Polished Metal', ior: 1.5, dispersion: 0, reflectivity: 0.95, transmission: 0, absorption: 0, roughness: 0, color: '#cbd5e1' },
  roughMetal: { name: 'Rough Metal', ior: 1.5, dispersion: 0, reflectivity: 0.85, transmission: 0, absorption: 0, roughness: 0.55, color: '#94a3b8' },
  frostedGlass: { name: 'Frosted Glass', ior: 1.5168, dispersion: 0.0042, reflectivity: 0, transmission: 1, absorption: 0.02, roughness: 0.35, color: '#e2e8f0' },
  plastic: { name: 'Plastic (Polycarbonate)', ior: 1.586, dispersion: 0.0102, reflectivity: 0, transmission: 1, absorption: 0.05, roughness: 0, color: '#fbbf24' },
  black: { name: 'Absorbing Black', ior: 1.5, dispersion: 0, reflectivity: 0.02, transmission: 0, absorption: 0, roughness: 0.8, color: '#111827' },
  custom: { name: 'Custom', ior: 1.6, dispersion: 0.006, reflectivity: 0.1, transmission: 1, absorption: 0.05, roughness: 0, color: '#f0abfc' },
};

export const MATERIAL_ORDER: MaterialId[] = [
  'glass',
  'flint',
  'water',
  'acrylic',
  'diamond',
  'air',
  'polishedMetal',
  'roughMetal',
  'frostedGlass',
  'plastic',
  'black',
  'custom',
];

export function makeMaterial(id: MaterialId): Material {
  return { preset: id, ...MATERIALS[id] };
}

export function isOpaque(m: Material): boolean {
  return m.transmission <= 0;
}

/** True when the material differs from its library definition. */
export function isModified(m: Material): boolean {
  const ref = MATERIALS[m.preset];
  if (!ref) return true;
  return (
    ref.ior !== m.ior ||
    ref.dispersion !== m.dispersion ||
    ref.reflectivity !== m.reflectivity ||
    ref.transmission !== m.transmission ||
    ref.absorption !== m.absorption ||
    ref.roughness !== m.roughness
  );
}
