/** Animal data and species traits. All rates are per simulation tick (1/120 day) unless noted. */
import { DEER, SPECIES, WOLF, type SpeciesId } from './species';

export { DEER, WOLF };
export type Species = SpeciesId;
export type Sex = 'F' | 'M';
export type DeerState = 'wander' | 'seekFood' | 'graze' | 'seekWater' | 'drink' | 'rest' | 'alert' | 'flee' | 'herd' | 'mate';
export type WolfState = 'rest' | 'patrol' | 'search' | 'stalk' | 'chase' | 'eat' | 'pack' | 'mate' | 'recover';
/** Extra states used by the other species. */
export type FaunaState = 'hibernate' | 'follow';
export type State = DeerState | WolfState | FaunaState;
export type DeathCause = 'predation' | 'starvation' | 'dehydration' | 'old age' | 'natural' | 'removed';

export interface Animal {
  id: number;
  species: Species;
  sex: Sex;
  parentId: number;
  generation: number;
  // Kinematics (metres, radians, metres per tick). p* = previous tick, for render interpolation.
  x: number; z: number; px: number; pz: number;
  heading: number; pheading: number;
  speed: number;
  gait: number;
  /** Height above the ground (m); only birds leave it. */
  alt: number;
  // Physiology
  energy: number;
  hydration: number;
  stamina: number;
  age: number;        // days
  lifespan: number;   // days
  pregnantDays: number; // days of gestation left, or −1
  cooldown: number;   // days until able to reproduce again
  dryTicks: number;   // ticks spent fully dehydrated
  // Behaviour
  state: State;
  stateTicks: number;
  decideIn: number;
  tx: number; tz: number;
  targetId: number;
  fleeX: number; fleeZ: number;
  lastThreatTick: number;
  escapeTicks: number;
  attemptCooldown: number;
  packId: number;
  // Records
  kills: number;
  offspring: number;
  alive: boolean;
  cause: DeathCause | null;
}

export interface Traits {
  maxEnergy: number;
  walk: number; trot: number; sprint: number;
  turn: number;
  accel: number;
  basal: number;          // energy per tick
  moveCost: number;       // extra energy per tick at full sprint (∝ (v / sprint)²)
  sprintDrain: number;    // stamina per tick at full sprint
  staminaRegen: number;
  maturity: number;       // days
  lifespan: number;       // mean days
  lifespanSd: number;
  gestation: number;      // days
  cooldown: number;       // days between births at rate 1
  reproEnergy: number;    // minimum energy to conceive
  birthCost: number;      // energy the mother loses per offspring
  newbornEnergy: number;
  bodyMeat: number;       // meat in an adult carcass (energy units)
  radius: number;         // body radius for spacing (m)
}

export const traitsOf = (s: Species) => SPECIES[s].traits;

/** Deer: grams of plant biomass turned into energy. */
export const DEER_GRAZE_RATE = 0.5;        // biomass per tick while grazing
export const DEER_ENERGY_PER_BIOMASS = 1.6;
export const DEER_HYDRATION_LOSS = 0.05;  // per tick (≈17 days from full to empty), raised by drought
export const DEER_DRINK_RATE = 5;
/** Wolves: meat eaten per tick from a carcass, 1 meat = 1 energy. */
export const WOLF_EAT_RATE = 1.6;
export const CARCASS_DECAY = 0.05;          // meat lost per tick to scavengers and decay (≈6 per day)

export interface Carcass { id: number; x: number; z: number; meat: number; initialMeat: number; ageTicks: number; predation: boolean; species: Species }

export interface Pack { id: number; leaderId: number; breederId: number; breeder2Id: number; targetId: number; homeX: number; homeZ: number; size: number }

export const isAdult = (a: Animal) => a.age >= traitsOf(a.species).maturity;
