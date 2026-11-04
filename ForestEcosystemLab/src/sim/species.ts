/**
 * The species catalogue: fourteen animals of a temperate northern forest.
 *
 * Deer and wolves are the core of the model and have their own, more detailed behaviour
 * (behavior.ts). Every other species runs on one data-driven brain (fauna.ts) configured by
 * the entries below: what it eats, what hunts it, how it moves, breeds and lives.
 *
 * Units: distances in metres, speeds in metres per tick (one tick is about a second of
 * movement), energy 0–100, ages in model days. Meat is in the same units as energy for a wolf
 * (`meat.eff` converts it for other species: a hare is a meal for a fox, a snack for a bear).
 */
import type { Traits } from './agents';

export const SPECIES_IDS = ['deer', 'wolf', 'elk', 'moose', 'boar', 'hare', 'squirrel', 'beaver', 'bear', 'cougar', 'lynx', 'fox', 'eagle', 'raven'] as const;
export type SpeciesId = (typeof SPECIES_IDS)[number];
/** The species that run on the generic brain. */
export const FAUNA_IDS = SPECIES_IDS.filter((s) => s !== 'deer' && s !== 'wolf') as Exclude<SpeciesId, 'deer' | 'wolf'>[];
export type FaunaId = (typeof FAUNA_IDS)[number];

export type Habitat = 'open' | 'forest' | 'edge' | 'water' | 'any';
export type Role = 'herbivore' | 'omnivore' | 'predator' | 'scavenger';

export interface PreyLink { id: SpeciesId; weight: number; juvenileOnly?: boolean }

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  plural: string;
  role: Role;
  color: string;
  blurb: string;
  traits: Traits;
  /** Plant food: biomass eaten per tick, energy per unit biomass, preferred habitat. */
  plants: { rate: number; eff: number; habitat: Habitat } | null;
  /** Eats meat from carcasses: meat per tick and energy per unit of meat. */
  meat: { rate: number; eff: number; scavenges: boolean } | null;
  /** What it hunts (higher weight = preferred). */
  prey: PreyLink[];
  /** Hunting style for predators. */
  hunt?: { sensing: number; pounce: number; giveUp: number; maxChase: number; success: number; stalkSpeed: number };
  /** Multiplier on a predator's capture chance when this species is the prey (moose fight back). */
  toughness: number;
  /** How far it notices a hunting predator (m). */
  detection: number;
  social: 'herd' | 'solitary' | 'family';
  groupSize: [number, number];
  /** Water loss per tick (0 = gets water from food). */
  thirst: number;
  litter: [number, number];
  /** Same-species adults inside this radius suppress breeding (territory / crowding). */
  territory: number;
  territoryMax: number;
  /** Stays within this distance of water (beavers). */
  waterBound?: number;
  flies?: { cruise: number };
  hibernates?: boolean;
  nocturnal?: boolean;
  /** Default number at the start of a run. */
  initial: number;
  maxInitial: number;
}

const T = (t: Partial<Traits> & Pick<Traits, 'walk' | 'trot' | 'sprint' | 'maturity' | 'lifespan' | 'gestation' | 'cooldown' | 'bodyMeat' | 'radius'>): Traits => ({
  maxEnergy: 100, turn: 0.24, accel: 0.08, basal: 0.04, moveCost: 0.05, sprintDrain: 1.4, staminaRegen: 0.5,
  lifespanSd: t.lifespan * 0.1, reproEnergy: 62, birthCost: 22, newbornEnergy: 50,
  ...t,
});

export const DEER: Traits = {
  maxEnergy: 100, walk: 0.2, trot: 0.45, sprint: 0.95, turn: 0.26, accel: 0.09,
  basal: 0.038, moveCost: 0.05, sprintDrain: 1.5, staminaRegen: 0.55,
  maturity: 15, lifespan: 95, lifespanSd: 10, gestation: 7, cooldown: 8,
  reproEnergy: 62, birthCost: 26, newbornEnergy: 48, bodyMeat: 110, radius: 0.55,
};

export const WOLF: Traits = {
  maxEnergy: 100, walk: 0.24, trot: 0.52, sprint: 0.9, turn: 0.22, accel: 0.08,
  basal: 0.04, moveCost: 0.06, sprintDrain: 0.95, staminaRegen: 0.42,
  maturity: 26, lifespan: 170, lifespanSd: 18, gestation: 12, cooldown: 22,
  reproEnergy: 66, birthCost: 16, newbornEnergy: 52, bodyMeat: 35, radius: 0.5,
};

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  deer: {
    id: 'deer', name: 'White-tailed deer', plural: 'deer', role: 'herbivore', color: '#4c8eda',
    blurb: 'Grazes the meadows in loose herds; the main prey of wolves and cougars.',
    traits: DEER, plants: { rate: 0.5, eff: 1.6, habitat: 'open' }, meat: null, prey: [], toughness: 1, detection: 24,
    social: 'herd', groupSize: [4, 12], thirst: 0.05, litter: [1, 2], territory: 16, territoryMax: 24, initial: 300, maxInitial: 500,
  },
  wolf: {
    id: 'wolf', name: 'Grey wolf', plural: 'wolves', role: 'predator', color: '#e5534b',
    blurb: 'Hunts in packs; the dominant female breeds. Brings down deer, elk and the odd moose calf.',
    traits: WOLF, plants: null, meat: { rate: 1.6, eff: 1, scavenges: true },
    prey: [{ id: 'deer', weight: 1 }, { id: 'elk', weight: 0.9 }, { id: 'moose', weight: 0.5 }, { id: 'boar', weight: 0.55 }, { id: 'beaver', weight: 0.35 }],
    toughness: 1, detection: 30, social: 'family', groupSize: [3, 6], thirst: 0, litter: [1, 4], territory: 0, territoryMax: 0, initial: 24, maxInitial: 100,
  },
  elk: {
    id: 'elk', name: 'Elk', plural: 'elk', role: 'herbivore', color: '#c08a4e',
    blurb: 'Large grazing deer that gathers in herds on open meadows. Prime wolf prey.',
    traits: T({ walk: 0.2, trot: 0.45, sprint: 0.9, turn: 0.2, accel: 0.07, basal: 0.036, sprintDrain: 1.2, maturity: 22, lifespan: 130, gestation: 10, cooldown: 10, reproEnergy: 62, birthCost: 26, bodyMeat: 240, radius: 0.75 }),
    plants: { rate: 0.6, eff: 1.35, habitat: 'open' }, meat: null, prey: [], toughness: 0.7, detection: 28,
    social: 'herd', groupSize: [5, 12], thirst: 0.04, litter: [1, 1], territory: 18, territoryMax: 22, initial: 60, maxInitial: 300,
  },
  moose: {
    id: 'moose', name: 'Moose', plural: 'moose', role: 'herbivore', color: '#6b4a32',
    blurb: 'Solitary giant that browses willows near water. Adults are dangerous prey; calves are not.',
    traits: T({ walk: 0.17, trot: 0.4, sprint: 0.78, turn: 0.17, accel: 0.06, basal: 0.034, sprintDrain: 1.4, maturity: 28, lifespan: 150, gestation: 12, cooldown: 22, reproEnergy: 66, birthCost: 28, bodyMeat: 380, radius: 0.95 }),
    plants: { rate: 0.6, eff: 1.3, habitat: 'water' }, meat: null, prey: [], toughness: 0.3, detection: 20,
    social: 'solitary', groupSize: [1, 2], thirst: 0.05, litter: [1, 2], territory: 30, territoryMax: 3, initial: 10, maxInitial: 60,
  },
  boar: {
    id: 'boar', name: 'Wild boar', plural: 'wild boar', role: 'omnivore', color: '#5b4a42',
    blurb: 'Roots through the forest floor in family groups (sounders) and will eat carrion.',
    traits: T({ walk: 0.16, trot: 0.4, sprint: 0.75, turn: 0.26, accel: 0.09, basal: 0.04, maturity: 18, lifespan: 100, gestation: 9, cooldown: 16, reproEnergy: 62, birthCost: 14, newbornEnergy: 48, bodyMeat: 70, radius: 0.5 }),
    plants: { rate: 0.35, eff: 2.4, habitat: 'edge' }, meat: { rate: 0.35, eff: 1.2, scavenges: false }, prey: [], toughness: 0.7, detection: 16,
    social: 'herd', groupSize: [3, 7], thirst: 0.035, litter: [2, 4], territory: 30, territoryMax: 10, initial: 34, maxInitial: 200,
  },
  hare: {
    id: 'hare', name: 'Snowshoe hare', plural: 'hares', role: 'herbivore', color: '#c9b79c',
    blurb: 'Breeds fast and feeds almost every forest predator. Its boom-and-bust with the lynx is a classic cycle.',
    traits: T({ walk: 0.14, trot: 0.42, sprint: 0.8, turn: 0.45, accel: 0.16, basal: 0.05, moveCost: 0.04, sprintDrain: 3, staminaRegen: 0.9, maturity: 7, lifespan: 38, gestation: 3.5, cooldown: 6, reproEnergy: 55, birthCost: 10, newbornEnergy: 45, bodyMeat: 6, radius: 0.2 }),
    plants: { rate: 0.12, eff: 4, habitat: 'edge' }, meat: null, prey: [], toughness: 1, detection: 14,
    social: 'solitary', groupSize: [1, 3], thirst: 0, litter: [1, 3], territory: 25, territoryMax: 8, initial: 100, maxInitial: 400,
  },
  squirrel: {
    id: 'squirrel', name: 'Red squirrel', plural: 'squirrels', role: 'herbivore', color: '#b5562c',
    blurb: 'Lives in the conifers on seeds and cones; quick, but a favourite of foxes, lynx and eagles.',
    traits: T({ walk: 0.12, trot: 0.35, sprint: 0.62, turn: 0.5, accel: 0.18, basal: 0.05, moveCost: 0.04, sprintDrain: 2, staminaRegen: 0.9, maturity: 9, lifespan: 50, gestation: 4, cooldown: 12, reproEnergy: 55, birthCost: 9, newbornEnergy: 45, bodyMeat: 2.5, radius: 0.15 }),
    plants: { rate: 0.05, eff: 6, habitat: 'forest' }, meat: null, prey: [], toughness: 0.8, detection: 11,
    social: 'solitary', groupSize: [1, 2], thirst: 0, litter: [1, 3], territory: 20, territoryMax: 5, initial: 50, maxInitial: 200,
  },
  beaver: {
    id: 'beaver', name: 'Beaver', plural: 'beavers', role: 'herbivore', color: '#7a5636',
    blurb: 'Never strays far from the water, where it feeds on bankside plants. Slow on land.',
    traits: T({ walk: 0.1, trot: 0.2, sprint: 0.38, turn: 0.3, accel: 0.08, basal: 0.036, maturity: 20, lifespan: 120, gestation: 9, cooldown: 25, reproEnergy: 60, birthCost: 12, bodyMeat: 18, radius: 0.32 }),
    plants: { rate: 0.2, eff: 2.6, habitat: 'water' }, meat: null, prey: [], toughness: 1.1, detection: 12,
    social: 'family', groupSize: [2, 4], thirst: 0.05, litter: [1, 3], territory: 16, territoryMax: 6, waterBound: 14, initial: 14, maxInitial: 80,
  },
  bear: {
    id: 'bear', name: 'Brown bear', plural: 'bears', role: 'omnivore', color: '#8a5a3a',
    blurb: 'Eats berries and grass, steals carcasses and takes the odd calf or fawn. Hibernates through winter.',
    traits: T({ walk: 0.16, trot: 0.4, sprint: 0.85, turn: 0.2, accel: 0.07, basal: 0.04, sprintDrain: 1.9, maturity: 40, lifespan: 220, gestation: 18, cooldown: 50, reproEnergy: 70, birthCost: 18, bodyMeat: 180, radius: 0.85 }),
    plants: { rate: 0.4, eff: 1.5, habitat: 'edge' }, meat: { rate: 0.8, eff: 0.75, scavenges: true },
    prey: [{ id: 'deer', weight: 0.6, juvenileOnly: true }, { id: 'elk', weight: 0.6, juvenileOnly: true }, { id: 'moose', weight: 0.4, juvenileOnly: true }, { id: 'boar', weight: 0.4, juvenileOnly: true }],
    hunt: { sensing: 30, pounce: 10, giveUp: 22, maxChase: 50, success: 0.3, stalkSpeed: 0.12 },
    toughness: 0.2, detection: 30, social: 'solitary', groupSize: [1, 1], thirst: 0.05, litter: [1, 3], territory: 80, territoryMax: 2, hibernates: true, initial: 5, maxInitial: 30,
  },
  cougar: {
    id: 'cougar', name: 'Cougar', plural: 'cougars', role: 'predator', color: '#d0a46a',
    blurb: 'A solitary ambush hunter: creeps close through cover, then a short explosive sprint.',
    traits: T({ walk: 0.2, trot: 0.45, sprint: 1.2, turn: 0.28, accel: 0.14, basal: 0.036, sprintDrain: 2.8, staminaRegen: 0.45, maturity: 30, lifespan: 150, gestation: 11, cooldown: 35, reproEnergy: 66, birthCost: 16, bodyMeat: 40, radius: 0.5 }),
    plants: null, meat: { rate: 1.2, eff: 1.1, scavenges: false },
    prey: [{ id: 'deer', weight: 1 }, { id: 'elk', weight: 0.55, juvenileOnly: true }, { id: 'boar', weight: 0.5 }, { id: 'hare', weight: 0.15 }],
    hunt: { sensing: 45, pounce: 10, giveUp: 26, maxChase: 45, success: 0.65, stalkSpeed: 0.08 },
    toughness: 0.4, detection: 34, social: 'solitary', groupSize: [1, 1], thirst: 0.04, litter: [1, 3], territory: 75, territoryMax: 2, nocturnal: true, initial: 4, maxInitial: 30,
  },
  lynx: {
    id: 'lynx', name: 'Canada lynx', plural: 'lynx', role: 'predator', color: '#a89a82',
    blurb: 'A hare specialist. When hares crash, lynx follow a season later.',
    traits: T({ walk: 0.17, trot: 0.4, sprint: 1.05, turn: 0.34, accel: 0.14, basal: 0.038, sprintDrain: 2.4, maturity: 20, lifespan: 110, gestation: 8, cooldown: 24, reproEnergy: 62, birthCost: 12, bodyMeat: 14, radius: 0.36 }),
    plants: null, meat: { rate: 0.5, eff: 6, scavenges: false },
    prey: [{ id: 'hare', weight: 1 }, { id: 'squirrel', weight: 0.55 }, { id: 'deer', weight: 0.2, juvenileOnly: true }],
    hunt: { sensing: 32, pounce: 6, giveUp: 22, maxChase: 50, success: 0.5, stalkSpeed: 0.07 },
    toughness: 0.6, detection: 26, social: 'solitary', groupSize: [1, 1], thirst: 0.04, litter: [1, 3], territory: 45, territoryMax: 2, nocturnal: true, initial: 8, maxInitial: 60,
  },
  fox: {
    id: 'fox', name: 'Red fox', plural: 'foxes', role: 'predator', color: '#e07a2e',
    blurb: 'Pounces on hares and squirrels and scavenges whatever the wolves leave.',
    traits: T({ walk: 0.19, trot: 0.45, sprint: 0.95, turn: 0.36, accel: 0.12, basal: 0.044, sprintDrain: 1.6, maturity: 14, lifespan: 80, gestation: 6, cooldown: 20, reproEnergy: 60, birthCost: 10, bodyMeat: 10, radius: 0.3 }),
    plants: { rate: 0.03, eff: 4, habitat: 'edge' }, meat: { rate: 0.4, eff: 5, scavenges: true },
    prey: [{ id: 'hare', weight: 1 }, { id: 'squirrel', weight: 0.8 }],
    hunt: { sensing: 26, pounce: 5, giveUp: 20, maxChase: 70, success: 0.38, stalkSpeed: 0.08 },
    toughness: 0.8, detection: 22, social: 'solitary', groupSize: [1, 2], thirst: 0.04, litter: [2, 4], territory: 30, territoryMax: 2, nocturnal: true, initial: 12, maxInitial: 80,
  },
  eagle: {
    id: 'eagle', name: 'Golden eagle', plural: 'eagles', role: 'predator', color: '#a8742a',
    blurb: 'Soars high and dives on hares and squirrels in the open; also feeds on carrion in winter.',
    traits: T({ walk: 0.5, trot: 0.75, sprint: 1.5, turn: 0.12, accel: 0.07, basal: 0.04, moveCost: 0.02, sprintDrain: 1, staminaRegen: 0.6, maturity: 30, lifespan: 200, gestation: 6, cooldown: 60, reproEnergy: 62, birthCost: 12, bodyMeat: 0, radius: 0.4 }),
    plants: null, meat: { rate: 0.2, eff: 5, scavenges: true },
    prey: [{ id: 'hare', weight: 1 }, { id: 'squirrel', weight: 0.6 }, { id: 'fox', weight: 0.15, juvenileOnly: true }],
    hunt: { sensing: 70, pounce: 40, giveUp: 60, maxChase: 70, success: 0.35, stalkSpeed: 0.45 },
    toughness: 1, detection: 40, social: 'solitary', groupSize: [1, 1], thirst: 0, litter: [1, 2], territory: 100, territoryMax: 2, flies: { cruise: 26 }, initial: 6, maxInitial: 30,
  },
  raven: {
    id: 'raven', name: 'Common raven', plural: 'ravens', role: 'scavenger', color: '#3a3f4a',
    blurb: 'Follows the wolf packs and is first to every kill; picks at seeds and berries in between.',
    traits: T({ walk: 0.42, trot: 0.65, sprint: 0.9, turn: 0.2, accel: 0.08, basal: 0.04, moveCost: 0.02, sprintDrain: 0.8, staminaRegen: 0.6, maturity: 18, lifespan: 140, gestation: 5, cooldown: 60, reproEnergy: 60, birthCost: 8, bodyMeat: 0, radius: 0.25 }),
    plants: { rate: 0.03, eff: 5, habitat: 'any' }, meat: { rate: 0.1, eff: 5, scavenges: true }, prey: [],
    toughness: 1, detection: 30, social: 'family', groupSize: [2, 4], thirst: 0, litter: [1, 3], territory: 40, territoryMax: 3, flies: { cruise: 15 }, initial: 14, maxInitial: 80,
  },
};

/** Predators that hunt `prey` (and whether only its young). */
export function predatorsOf(prey: SpeciesId): { id: SpeciesId; juvenileOnly: boolean }[] {
  const out: { id: SpeciesId; juvenileOnly: boolean }[] = [];
  for (const id of SPECIES_IDS) {
    const link = SPECIES[id].prey.find((p) => p.id === prey);
    if (link) out.push({ id, juvenileOnly: !!link.juvenileOnly });
  }
  return out;
}

/** Fast lookup: PREDATOR_OF[prey][predator] = 0 (not a predator), 1 (hunts young only), 2 (hunts all). */
export const PREDATOR_OF: Record<SpeciesId, Partial<Record<SpeciesId, number>>> = Object.fromEntries(
  SPECIES_IDS.map((prey) => [prey, Object.fromEntries(predatorsOf(prey).map((p) => [p.id, p.juvenileOnly ? 1 : 2]))]),
) as Record<SpeciesId, Partial<Record<SpeciesId, number>>>;

export const speciesName = (id: SpeciesId, n = 1) => (n === 1 ? SPECIES[id].name.split(' ').slice(-1)[0].toLowerCase() : SPECIES[id].plural);
