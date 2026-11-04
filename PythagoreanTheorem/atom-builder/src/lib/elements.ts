/**
 * Elements supported by the simulator: Z = 1–36 (periods 1–4).
 *
 * - `weight`: standard atomic weight (IUPAC, abridged)
 * - `common`: mass number of the most abundant naturally occurring isotope
 * - `stable`: mass numbers of stable isotopes
 * - `longLived`: radioactive isotopes so long-lived they still occur in nature
 */

export type Category =
  | 'alkali'
  | 'alkaline'
  | 'transition'
  | 'post-transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble';

export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  weight: number;
  period: number;
  group: number;
  category: Category;
  common: number;
  stable: number[];
  longLived?: number[];
  /** Name of the simple anion, where one is commonly formed. */
  anion?: string;
  /** Charges of the monatomic ions this element commonly forms. */
  ions?: number[];
}

const E = (
  z: number,
  symbol: string,
  name: string,
  weight: number,
  period: number,
  group: number,
  category: Category,
  common: number,
  stable: number[],
  extra: Partial<Pick<ElementData, 'longLived' | 'anion' | 'ions'>> = {},
): ElementData => ({ z, symbol, name, weight, period, group, category, common, stable, ...extra });

export const ELEMENTS: ElementData[] = [
  E(1, 'H', 'Hydrogen', 1.008, 1, 1, 'nonmetal', 1, [1, 2], { anion: 'hydride', ions: [1, -1] }),
  E(2, 'He', 'Helium', 4.0026, 1, 18, 'noble', 4, [3, 4]),
  E(3, 'Li', 'Lithium', 6.94, 2, 1, 'alkali', 7, [6, 7], { ions: [1] }),
  E(4, 'Be', 'Beryllium', 9.0122, 2, 2, 'alkaline', 9, [9], { ions: [2] }),
  E(5, 'B', 'Boron', 10.81, 2, 13, 'metalloid', 11, [10, 11]),
  E(6, 'C', 'Carbon', 12.011, 2, 14, 'nonmetal', 12, [12, 13], { anion: 'carbide' }),
  E(7, 'N', 'Nitrogen', 14.007, 2, 15, 'nonmetal', 14, [14, 15], { anion: 'nitride', ions: [-3] }),
  E(8, 'O', 'Oxygen', 15.999, 2, 16, 'nonmetal', 16, [16, 17, 18], { anion: 'oxide', ions: [-2] }),
  E(9, 'F', 'Fluorine', 18.998, 2, 17, 'halogen', 19, [19], { anion: 'fluoride', ions: [-1] }),
  E(10, 'Ne', 'Neon', 20.18, 2, 18, 'noble', 20, [20, 21, 22]),
  E(11, 'Na', 'Sodium', 22.99, 3, 1, 'alkali', 23, [23], { ions: [1] }),
  E(12, 'Mg', 'Magnesium', 24.305, 3, 2, 'alkaline', 24, [24, 25, 26], { ions: [2] }),
  E(13, 'Al', 'Aluminium', 26.982, 3, 13, 'post-transition', 27, [27], { ions: [3] }),
  E(14, 'Si', 'Silicon', 28.085, 3, 14, 'metalloid', 28, [28, 29, 30]),
  E(15, 'P', 'Phosphorus', 30.974, 3, 15, 'nonmetal', 31, [31], { anion: 'phosphide', ions: [-3] }),
  E(16, 'S', 'Sulfur', 32.06, 3, 16, 'nonmetal', 32, [32, 33, 34, 36], { anion: 'sulfide', ions: [-2] }),
  E(17, 'Cl', 'Chlorine', 35.45, 3, 17, 'halogen', 35, [35, 37], { anion: 'chloride', ions: [-1] }),
  E(18, 'Ar', 'Argon', 39.948, 3, 18, 'noble', 40, [36, 38, 40]),
  E(19, 'K', 'Potassium', 39.098, 4, 1, 'alkali', 39, [39, 41], { longLived: [40], ions: [1] }),
  E(20, 'Ca', 'Calcium', 40.078, 4, 2, 'alkaline', 40, [40, 42, 43, 44, 46], { longLived: [48], ions: [2] }),
  E(21, 'Sc', 'Scandium', 44.956, 4, 3, 'transition', 45, [45], { ions: [3] }),
  E(22, 'Ti', 'Titanium', 47.867, 4, 4, 'transition', 48, [46, 47, 48, 49, 50], { ions: [2, 3, 4] }),
  E(23, 'V', 'Vanadium', 50.942, 4, 5, 'transition', 51, [51], { longLived: [50], ions: [2, 3] }),
  E(24, 'Cr', 'Chromium', 51.996, 4, 6, 'transition', 52, [50, 52, 53, 54], { ions: [2, 3] }),
  E(25, 'Mn', 'Manganese', 54.938, 4, 7, 'transition', 55, [55], { ions: [2] }),
  E(26, 'Fe', 'Iron', 55.845, 4, 8, 'transition', 56, [54, 56, 57, 58], { ions: [2, 3] }),
  E(27, 'Co', 'Cobalt', 58.933, 4, 9, 'transition', 59, [59], { ions: [2, 3] }),
  E(28, 'Ni', 'Nickel', 58.693, 4, 10, 'transition', 58, [58, 60, 61, 62, 64], { ions: [2] }),
  E(29, 'Cu', 'Copper', 63.546, 4, 11, 'transition', 63, [63, 65], { ions: [1, 2] }),
  E(30, 'Zn', 'Zinc', 65.38, 4, 12, 'transition', 64, [64, 66, 67, 68, 70], { ions: [2] }),
  E(31, 'Ga', 'Gallium', 69.723, 4, 13, 'post-transition', 69, [69, 71], { ions: [3] }),
  E(32, 'Ge', 'Germanium', 72.63, 4, 14, 'metalloid', 74, [70, 72, 73, 74], { longLived: [76] }),
  E(33, 'As', 'Arsenic', 74.922, 4, 15, 'metalloid', 75, [75], { ions: [-3] }),
  E(34, 'Se', 'Selenium', 78.971, 4, 16, 'nonmetal', 80, [74, 76, 77, 78, 80], { longLived: [82], anion: 'selenide', ions: [-2] }),
  E(35, 'Br', 'Bromine', 79.904, 4, 17, 'halogen', 79, [79, 81], { anion: 'bromide', ions: [-1] }),
  E(36, 'Kr', 'Krypton', 83.798, 4, 18, 'noble', 84, [80, 82, 83, 84, 86], { longLived: [78] }),
];

export const MAX_Z = ELEMENTS.length;

export const elementByZ = (z: number): ElementData | undefined => ELEMENTS[z - 1];

export const CATEGORY_INFO: Record<Category, { label: string; color: string }> = {
  alkali: { label: 'Alkali metal', color: '#f59e6b' },
  alkaline: { label: 'Alkaline earth metal', color: '#f5c66b' },
  transition: { label: 'Transition metal', color: '#e88fb4' },
  'post-transition': { label: 'Post-transition metal', color: '#9fd3a6' },
  metalloid: { label: 'Metalloid', color: '#6fd6c4' },
  nonmetal: { label: 'Reactive nonmetal', color: '#79b8ff' },
  halogen: { label: 'Halogen', color: '#b59cff' },
  noble: { label: 'Noble gas', color: '#c7a6ff' },
};

/** Special names for a few isotopes. */
export const ISOTOPE_NAMES: Record<string, string> = {
  '1-1': 'protium',
  '1-2': 'deuterium',
  '1-3': 'tritium',
};
