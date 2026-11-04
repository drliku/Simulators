import { FAUNA_IDS, SPECIES, type FaunaId } from './species';
/**
 * Every user-adjustable parameter of the model. The UI is generated from PARAM_META, and
 * the simulation reads `sim.params` live, so a slider changes the model itself.
 */
export interface Params {
  // Biology
  deerReproRate: number;
  wolfReproRate: number;
  deerSpeed: number;
  wolfSpeed: number;
  huntSuccess: number;
  energyCost: number;
  mortality: number;
  detectionRadius: number;
  wolfSensing: number;
  // Environment
  vegGrowth: number;
  vegCapacity: number;
  drought: number;
  water: number;
  habitat: number;
  seasonality: number;
  weather: number;
  immigration: number;
}

export interface Setup {
  seed: number;
  initialDeer: number;
  initialWolves: number;
  /** Starting numbers of the other species. */
  fauna: Record<FaunaId, number>;
}

export const DEFAULT_PARAMS: Params = {
  deerReproRate: 1,
  wolfReproRate: 1,
  deerSpeed: 1,
  wolfSpeed: 1,
  huntSuccess: 0.3,
  energyCost: 1,
  mortality: 1,
  detectionRadius: 24,
  wolfSensing: 50,
  vegGrowth: 0.2,
  vegCapacity: 10,
  drought: 0,
  water: 1,
  habitat: 1,
  seasonality: 0.35,
  weather: 0.6,
  immigration: 0.5,
};

export const DEFAULT_FAUNA = Object.fromEntries(FAUNA_IDS.map((id) => [id, SPECIES[id].initial])) as Record<FaunaId, number>;
export const NO_FAUNA = Object.fromEntries(FAUNA_IDS.map((id) => [id, 0])) as Record<FaunaId, number>;

export const DEFAULT_SETUP: Setup = { seed: 7, initialDeer: SPECIES.deer.initial, initialWolves: SPECIES.wolf.initial, fauna: DEFAULT_FAUNA };

export type ParamGroup = 'biology' | 'environment';

export interface ParamMeta {
  label: string;
  group: ParamGroup;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  help: string;
}

const x = (v: number) => `${v.toFixed(2)}×`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const PARAM_META: Record<keyof Params, ParamMeta> = {
  deerReproRate: { label: 'Deer reproduction rate', group: 'biology', min: 0, max: 3, step: 0.05, format: x, help: 'Scales the chance that a well-fed adult doe conceives when a buck is nearby, and shortens the recovery time between fawns. Pregnancy still costs energy.' },
  wolfReproRate: { label: 'Wolf reproduction rate', group: 'biology', min: 0, max: 3, step: 0.05, format: x, help: 'Scales conception chance and shortens the interval between litters for well-fed adult wolves in a pack with a mate.' },
  deerSpeed: { label: 'Deer movement speed', group: 'biology', min: 0.5, max: 1.5, step: 0.05, format: x, help: 'Multiplies walking and sprinting speed of deer. Faster deer escape more chases.' },
  wolfSpeed: { label: 'Wolf movement speed', group: 'biology', min: 0.5, max: 1.5, step: 0.05, format: x, help: 'Multiplies walking and sprinting speed of wolves.' },
  huntSuccess: { label: 'Capture success (base)', group: 'biology', min: 0.02, max: 0.9, step: 0.01, format: pct, help: 'Base probability that a wolf in contact with a deer brings it down. Modified by pack support, the deer’s condition, forest cover and light.' },
  energyCost: { label: 'Energy consumption', group: 'biology', min: 0.5, max: 2, step: 0.05, format: x, help: 'Scales metabolic and movement energy costs for both species.' },
  mortality: { label: 'Natural mortality', group: 'biology', min: 0, max: 3, step: 0.05, format: x, help: 'Scales age-dependent background mortality (disease, accidents). Animals still die at the end of their lifespan.' },
  detectionRadius: { label: 'Predator detection radius', group: 'biology', min: 6, max: 60, step: 1, format: (v) => `${v} m`, help: 'How far a deer can notice a wolf in daylight on open ground. Reduced at night and in forest; stalking wolves are harder to spot.' },
  wolfSensing: { label: 'Wolf prey-sensing radius', group: 'biology', min: 10, max: 90, step: 1, format: (v) => `${v} m`, help: 'How far a wolf can sense deer directly. Beyond that, packs follow scent toward areas where deer were recently common.' },
  vegGrowth: { label: 'Vegetation growth rate', group: 'environment', min: 0, max: 0.6, step: 0.01, format: (v) => `${v.toFixed(2)} /day`, help: 'Intrinsic logistic growth rate r of plant biomass in ideal moisture. At 0, grazed plants never regrow.' },
  vegCapacity: { label: 'Maximum vegetation capacity', group: 'environment', min: 2, max: 20, step: 0.5, format: (v) => `${v} /cell`, help: 'Carrying capacity K of plant biomass per 3 m cell in open meadow (forest floor holds less).' },
  drought: { label: 'Drought intensity', group: 'environment', min: 0, max: 1, step: 0.01, format: pct, help: 'Reduces rainfall, so plants grow more slowly away from water, streams shrink and deer get thirsty faster.' },
  water: { label: 'Water availability', group: 'environment', min: 0, max: 1, step: 0.01, format: pct, help: 'How full the streams and pond are. Low water shrinks drinking spots and the moist ground around them.' },
  habitat: { label: 'Habitat quality', group: 'environment', min: 0.3, max: 1.6, step: 0.05, format: x, help: 'Scales plant carrying capacity across the landscape (soil fertility).' },
  seasonality: { label: 'Seasonal variation', group: 'environment', min: 0, max: 1, step: 0.01, format: pct, help: 'Amplitude of the yearly cycle in plant growth (100-day year). At 100% growth stops completely in mid-winter.' },
  immigration: { label: 'Wildlife immigration', group: 'environment', min: 0, max: 1, step: 0.01, format: pct, help: 'How readily animals of the other twelve species wander in from outside the valley when their numbers here are very low. Deer and wolves never immigrate, so the experiments stay closed. 0% makes every species a closed population.' },
  weather: { label: 'Weather variability', group: 'environment', min: 0, max: 1, step: 0.01, format: pct, help: 'How often and how strongly rain, storms, fog and snow roll in. Rain speeds plant growth; fog and rain shorten sight; snow slows animals and helps wolves. 0% keeps the sky clear.' },
};
