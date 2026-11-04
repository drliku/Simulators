/** Fixed lab parameters for the simplified experiment. */

export const CAPACITY_L = 0.5; // 500 mL beaker
export const START_VOLUME_L = 0.1; // presets and reset fill to 100 mL
export const WATER_STEP_L = 0.05; // "Add water" pours 50 mL
export const DROPS_PER_DOSE = 5;
export const DROP_VOLUME_L = 0.0002; // 0.2 mL per drop → 1.0 mL per click

/** Strong acid (HCl) and strong base (NaOH) solutions in the droppers. */
export const MOLARITIES = [0.001, 0.01, 0.1, 1] as const;
export type Molarity = (typeof MOLARITIES)[number];

export function fmtMolarity(m: number): string {
  return m >= 0.1 ? m.toFixed(2) : m >= 0.01 ? m.toFixed(2) : m.toFixed(3);
}

export const fmtMl = (l: number) => {
  const ml = Math.round(l * 1000 * 10) / 10;
  return Number.isInteger(ml) ? ml.toFixed(0) : ml.toFixed(1);
};
