/**
 * The ecosystem: a spatially explicit, agent-based model of vegetation → deer → wolves.
 *
 * One call to step() advances one fixed tick (1/120 of a model day). Everything random
 * draws from a single seeded stream in a fixed order, so a seed plus the same sequence of
 * user actions reproduces a run exactly. Simulation speed only changes how many ticks run
 * per real second; the rules per tick never change.
 */
import { DEER, WOLF, CARCASS_DECAY, traitsOf, type Animal, type Carcass, type DeathCause, type Pack, type Sex, type Species } from './agents';
import { FAUNA_IDS, SPECIES, SPECIES_IDS, speciesName, type FaunaId } from './species';
import { updateCritter } from './fauna';
import { DEFAULT_PARAMS, DEFAULT_SETUP, type Params, type Setup } from './params';
import { Rng } from './rng';
import { SpatialHash } from './spatial';
import { Vegetation, seasonFactor } from './vegetation';
import { DAY_START, HALF, TICKS_PER_DAY, cellIndex, getWorld, type World } from './world';
import { updateDeer, updateWolf } from './behavior';
import { History } from './history';
import { HeatMaps } from './heatmaps';
import { HuntTracker } from './hunts';
import { WEATHER_LABEL, Weather } from './weather';

export type Cause = Exclude<DeathCause, 'removed'>;
const CAUSES: Cause[] = ['predation', 'starvation', 'dehydration', 'old age', 'natural'];

export interface Counters {
  births: Record<Species, number>;
  deaths: Record<Species, Record<Cause, number>>;
  removed: Record<Species, number>;
  added: Record<Species, number>;
  /** Wolf hunts only (the core predator–prey pair). */
  hunts: { attempts: number; kills: number };
  /** Kills by predator species and prey species, for every species. */
  predation: Record<Species, Partial<Record<Species, number>>>;
}
const perSpecies = <T>(f: () => T) => Object.fromEntries(SPECIES_IDS.map((id) => [id, f()])) as Record<Species, T>;

/** Energy and biomass flows, accumulated per model day. */
export interface DayFlows {
  vegProduced: number;   // plant biomass grown
  vegEaten: number;      // plant biomass eaten by deer
  deerGained: number;    // energy deer gained from plants
  deerSpent: number;     // energy deer burned (metabolism + movement + reproduction)
  meatProduced: number;  // meat in new deer carcasses
  wolfGained: number;    // energy wolves gained from meat
  wolfSpent: number;
  meatDecayed: number;
}
const emptyFlows = (): DayFlows => ({ vegProduced: 0, vegEaten: 0, deerGained: 0, deerSpent: 0, meatProduced: 0, wolfGained: 0, wolfSpent: 0, meatDecayed: 0 });

export interface SimEvent { tick: number; kind: 'hunt' | 'birth' | 'death' | 'info' | 'extinct'; text: string }

const zeroCauses = (): Record<Cause, number> => ({ predation: 0, starvation: 0, dehydration: 0, 'old age': 0, natural: 0 });

export class Ecosystem {
  params: Params;
  setup: Setup;
  readonly world: World;
  rng!: Rng;
  veg!: Vegetation;
  tick = 0;
  animals: Animal[] = [];
  byId = new Map<number, Animal>();
  carcasses: Carcass[] = [];
  packs = new Map<number, Pack>();
  /** One neighbour index per species, rebuilt every tick. */
  hashes = Object.fromEntries(SPECIES_IDS.map((id) => [id, new SpatialHash(8)])) as Record<Species, SpatialHash>;
  get deerHash() { return this.hashes.deer; }
  get wolfHash() { return this.hashes.wolf; }
  counters!: Counters;
  flows: DayFlows[] = [];
  history!: History;
  heat!: HeatMaps;
  weather!: Weather;
  hunts = new HuntTracker();
  events: SimEvent[] = [];
  extinct = perSpecies(() => -1);
  private nextId = 1;
  private nextCarcassId = 1;
  private nextPackId = 1;
  /** Cached daylight for the current tick. */
  daylight = 1;

  constructor(setup: Setup = DEFAULT_SETUP, params: Params = DEFAULT_PARAMS) {
    this.world = getWorld();
    this.setup = { ...setup };
    this.params = { ...params };
    this.reset();
  }

  // ------------------------------------------------------------------ setup

  /** Restore the initial conditions from `setup` (and optionally new params). */
  reset(setup?: Setup, params?: Params) {
    if (setup) this.setup = { ...setup };
    if (params) this.params = { ...params };
    this.rng = new Rng(this.setup.seed);
    this.tick = 0;
    this.animals = [];
    this.byId.clear();
    this.carcasses = [];
    this.packs.clear();
    this.nextId = 1; this.nextCarcassId = 1; this.nextPackId = 1;
    this.events = [];
    this.extinct = perSpecies(() => -1);
    this.counters = {
      births: perSpecies(() => 0),
      deaths: perSpecies(zeroCauses),
      removed: perSpecies(() => 0),
      added: perSpecies(() => 0),
      hunts: { attempts: 0, kills: 0 },
      predation: perSpecies(() => ({})),
    };
    this.flows = [emptyFlows()];
    this.weather = new Weather(this.setup.seed);
    this.hunts = new HuntTracker();
    this.veg = new Vegetation(this.world);
    this.veg.refresh(this.params, true);
    this.veg.fill(0.7);
    this.daylight = this.computeDaylight();
    this.spawnDeer(this.setup.initialDeer, true);
    this.spawnWolves(this.setup.initialWolves, true);
    for (const id of FAUNA_IDS) this.spawnFauna(id, this.setup.fauna?.[id] ?? 0, true);
    this.history = new History();
    this.heat = new HeatMaps();
    this.heat.update(this, true);
    this.history.record(this);
    this.log('info', `Simulation started with ${this.setup.initialDeer} deer and ${this.setup.initialWolves} wolves (seed ${this.setup.seed}).`);
  }

  setParams(p: Partial<Params>) {
    Object.assign(this.params, p);
    this.veg.refresh(this.params);
  }

  // ------------------------------------------------------------------ time

  get day() { return this.tick / TICKS_PER_DAY; }
  /** Time of day as a fraction (0 = midnight). */
  get timeOfDay() { return (DAY_START + this.day) % 1; }

  computeDaylight() {
    const elev = Math.sin(2 * Math.PI * (this.timeOfDay - 0.25));
    const t = Math.min(1, Math.max(0, (elev + 0.12) / 0.4));
    return t * t * (3 - 2 * t);
  }

  get season() { return seasonFactor(this.day, this.params.seasonality); }

  // ------------------------------------------------------------------ the tick

  step() {
    this.tick++;
    this.daylight = this.computeDaylight();
    const flows = this.flows[this.flows.length - 1];
    const newWeather = this.weather.step(this.day, this.params);
    if (newWeather) this.log('info', `Weather: ${WEATHER_LABEL[newWeather].toLowerCase()}.`);

    // Plants grow every 4 ticks.
    if (this.tick % 4 === 0) {
      this.veg.refresh(this.params);
      flows.vegProduced += this.veg.grow(4 / TICKS_PER_DAY, this.day, this.params, this.weather.growth);
    }

    // Spatial indices
    for (const id of SPECIES_IDS) this.hashes[id].clear();
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      a.px = a.x; a.pz = a.z; a.pheading = a.heading;
      this.hashes[a.species].insert(i, a.x, a.z);
    }
    if (this.tick % TICKS_PER_DAY === 0) { this.maintainPacks(); this.immigrate(); }

    // Animals act in array order (deterministic).
    const n = this.animals.length;
    for (let i = 0; i < n; i++) {
      const a = this.animals[i];
      if (!a.alive) continue;
      this.lifecycle(a);
      if (!a.alive) continue;
      if (a.species === 'deer') updateDeer(this, a); else if (a.species === 'wolf') updateWolf(this, a); else updateCritter(this, a);
    }

    this.hunts.update(this);

    // Carcasses decay (scavengers, insects, weather).
    for (const c of this.carcasses) {
      const d = Math.min(c.meat, CARCASS_DECAY);
      c.meat -= d;
      c.ageTicks++;
      flows.meatDecayed += d;
    }
    this.carcasses = this.carcasses.filter((c) => c.meat > 0.5 && c.ageTicks < TICKS_PER_DAY * 4);

    // Remove the dead (their deaths were recorded once, in kill()).
    if (this.animals.some((a) => !a.alive)) {
      this.animals = this.animals.filter((a) => a.alive);
      for (const [id, a] of this.byId) if (!a.alive) this.byId.delete(id);
    }
    this.checkExtinction();

    if (this.tick % 20 === 0) this.heat.update(this);
    if (this.tick % (TICKS_PER_DAY / 2) === 0) this.history.record(this);
    if (this.tick % TICKS_PER_DAY === 0) {
      this.flows.push(emptyFlows());
      if (this.flows.length > 12) this.flows.shift();
    }
  }

  /** Ageing, pregnancy, cooldowns, thirst, background mortality, lifespan. */
  private lifecycle(a: Animal) {
    const T = traitsOf(a.species);
    const dDay = 1 / TICKS_PER_DAY;
    a.age += dDay;
    if (a.cooldown > 0) a.cooldown -= dDay;
    if (a.pregnantDays >= 0) {
      a.pregnantDays -= dDay;
      if (a.pregnantDays <= 0) { a.pregnantDays = -1; this.giveBirth(a); }
    }
    if (a.age >= a.lifespan) { this.kill(a, 'old age'); return; }
    const drinks = SPECIES[a.species].thirst > 0;
    if (a.energy <= 0) { this.kill(a, drinks && a.hydration <= 0 ? 'dehydration' : 'starvation'); return; }
    if (drinks && a.dryTicks > TICKS_PER_DAY * 3) { this.kill(a, 'dehydration'); return; }
    // Background mortality once a day per animal, rising steeply with age.
    if ((this.tick + a.id) % TICKS_PER_DAY === 0) {
      const ageFrac = a.age / a.lifespan;
      const juvenile = a.age < T.maturity ? 0.004 : 0;
      const hazard = this.params.mortality * (0.0015 + juvenile + 0.03 * ageFrac ** 6);
      if (this.rng.chance(hazard)) this.kill(a, 'natural');
    }
  }

  // ------------------------------------------------------------------ births and deaths

  private makeAnimal(species: Species, x: number, z: number, opts: Partial<Animal> = {}): Animal {
    const T = traitsOf(species);
    const sex: Sex = this.rng.chance(0.5) ? 'F' : 'M';
    const lifespan = Math.max(T.maturity * 1.6, T.lifespan + this.rng.gauss() * T.lifespanSd);
    const heading = this.rng.range(-Math.PI, Math.PI);
    const a: Animal = {
      id: this.nextId++, species, sex, parentId: -1, generation: 0,
      x, z, px: x, pz: z, heading, pheading: heading, speed: 0, gait: this.rng.next() * 6, alt: 0,
      energy: 70, hydration: 85, stamina: 100, age: 0, lifespan, pregnantDays: -1, cooldown: 0, dryTicks: 0,
      state: species === 'wolf' ? 'patrol' : 'wander', stateTicks: 0, decideIn: this.rng.int(0, 10),
      tx: x, tz: z, targetId: -1, fleeX: 0, fleeZ: 0, lastThreatTick: -1000, escapeTicks: 0, attemptCooldown: 0,
      packId: -1, kills: 0, offspring: 0, alive: true, cause: null,
      ...opts,
    };
    this.animals.push(a);
    this.byId.set(a.id, a);
    return a;
  }

  /** A random walkable point (not inside an obstacle or open water). */
  randomOpenPoint(cx = 0, cz = 0, spread = HALF - 6): { x: number; z: number } {
    for (let tries = 0; tries < 40; tries++) {
      const x = Math.max(-HALF + 4, Math.min(HALF - 4, cx + this.rng.range(-spread, spread)));
      const z = Math.max(-HALF + 4, Math.min(HALF - 4, cz + this.rng.range(-spread, spread)));
      if (this.veg.water[cellIndex(x, z)]) continue;
      if (this.obstacleAt(x, z, 0.8)) continue;
      return { x, z };
    }
    return { x: cx, z: cz };
  }

  obstacleAt(x: number, z: number, pad: number): boolean {
    const w = this.world;
    const gx = Math.floor((x + HALF) / w.obstacleCell), gz = Math.floor((z + HALF) / w.obstacleCell);
    if (gx < 0 || gz < 0 || gx >= w.obstacleN || gz >= w.obstacleN) return false;
    for (const idx of w.obstacleGrid[gz * w.obstacleN + gx]) {
      const o = w.obstacles[idx];
      if (Math.hypot(o.x - x, o.z - z) < o.r + pad) return true;
    }
    return false;
  }

  spawnDeer(n: number, initial = false) {
    // Deer arrive in small herds scattered over open ground.
    let left = n;
    while (left > 0) {
      const herd = Math.min(left, this.rng.int(4, 12));
      const centre = this.randomOpenPoint();
      for (let k = 0; k < herd; k++) {
        const p = this.randomOpenPoint(centre.x, centre.z, 9);
        const T = DEER;
        this.makeAnimal('deer', p.x, p.z, {
          age: this.rng.range(T.maturity * 0.4, T.lifespan * 0.7),
          energy: this.rng.range(60, 90),
          hydration: this.rng.range(80, 100),
        });
      }
      left -= herd;
    }
    if (!initial) { this.counters.added.deer += n; this.log('info', `${n} deer added.`); }
  }

  spawnWolves(n: number, initial = false) {
    let left = n;
    while (left > 0) {
      const size = Math.min(left, this.rng.int(3, 6));
      const home = this.randomOpenPoint();
      const pack: Pack = { id: this.nextPackId++, leaderId: -1, breederId: -1, breeder2Id: -1, targetId: -1, homeX: home.x, homeZ: home.z, size };
      this.packs.set(pack.id, pack);
      for (let k = 0; k < size; k++) {
        const p = this.randomOpenPoint(home.x, home.z, 6);
        const w = this.makeAnimal('wolf', p.x, p.z, {
          age: this.rng.range(WOLF.maturity * 1.05, WOLF.lifespan * 0.6),
          energy: this.rng.range(65, 90),
          packId: pack.id,
        });
        // Make sure each new pack has both sexes so it can breed.
        if (k === 0) w.sex = 'F';
        if (k === 1) w.sex = 'M';
      }
      left -= size;
    }
    this.maintainPacks();
    if (!initial) { this.counters.added.wolf += n; this.log('info', `${n} wolves added in new packs.`); }
  }

  /** Other species arrive in their natural group sizes, in places that suit them. */
  spawnFauna(id: FaunaId, n: number, initial = false) {
    const S = SPECIES[id], T = S.traits;
    let left = n;
    while (left > 0) {
      const size = Math.min(left, this.rng.int(S.groupSize[0], S.groupSize[1]));
      const centre = this.habitatPoint(id);
      for (let k = 0; k < size; k++) {
        const p = this.randomOpenPoint(centre.x, centre.z, S.social === 'solitary' ? 3 : 8);
        const a = this.makeAnimal(id, p.x, p.z, {
          age: this.rng.range(T.maturity * 0.5, T.lifespan * 0.65),
          energy: this.rng.range(60, 90),
          hydration: this.rng.range(80, 100),
          state: S.hibernates && this.isWinter ? 'hibernate' : 'wander',
        });
        if (S.flies) a.alt = S.flies.cruise * this.rng.range(0.6, 1);
        if (size > 1 && k < 2) a.sex = k === 0 ? 'F' : 'M';
      }
      left -= size;
    }
    if (!initial && n > 0) { this.counters.added[id] += n; this.log('info', `${n} ${speciesName(id, n)} added.`); }
  }

  /**
   * Open populations: once a day, a species of the wider fauna that is down to its last one or
   * two animals may receive a newcomer (a pair, so it can breed) from beyond the valley edge.
   */
  private immigrate() {
    const rate = this.params.immigration;
    if (rate <= 0) return;
    for (const id of FAUNA_IDS) {
      if (!this.everHad(id) || this.count(id) > 1) continue;
      if (!this.rng.chance(0.12 * rate)) continue;
      const S = SPECIES[id], T = S.traits;
      const side = this.rng.int(0, 3), t = this.rng.range(-HALF + 20, HALF - 20), e = HALF - 8;
      const edge = side === 0 ? { x: -e, z: t } : side === 1 ? { x: e, z: t } : side === 2 ? { x: t, z: -e } : { x: t, z: e };
      for (let k = 0; k < 2; k++) {
        const p = this.randomOpenPoint(edge.x, edge.z, 6);
        const a = this.makeAnimal(id, p.x, p.z, { age: T.maturity * this.rng.range(1.05, 1.6), energy: 80, hydration: 90 });
        a.sex = k === 0 ? 'F' : 'M';
        if (S.flies) a.alt = S.flies.cruise;
      }
      this.counters.added[id] += 2;
      this.log('info', `Two ${S.plural} wandered in from outside the valley.`);
    }
  }

  /** A random open point in the habitat a species prefers. */
  habitatPoint(id: Species): { x: number; z: number } {
    const S = SPECIES[id];
    const hab = S.waterBound ? 'water' : S.plants?.habitat ?? (S.id === 'lynx' || S.id === 'squirrel' ? 'forest' : 'any');
    let best = this.randomOpenPoint(), bestScore = -1;
    for (let k = 0; k < 8; k++) {
      const p = this.randomOpenPoint();
      const c = cellIndex(p.x, p.z);
      const f = this.world.forest[c];
      const wd = this.veg.waterDist[c];
      const score = hab === 'open' ? 1 - f : hab === 'forest' ? f : hab === 'edge' ? 1 - Math.abs(f - 0.4) * 2 : hab === 'water' ? Math.exp(-wd / 8) : this.rng.next();
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (hab === 'water' && Number.isFinite(this.veg.waterDist[cellIndex(best.x, best.z)])) {
      const c = cellIndex(best.x, best.z);
      const wx = this.veg.nearestWaterX[c], wz = this.veg.nearestWaterZ[c];
      return this.randomOpenPoint(wx, wz, 6);
    }
    return best;
  }

  get isWinter() { return this.params.seasonality > 0.05 && (((this.day % 100) + 100) % 100) / 100 >= 0.625 && (((this.day % 100) + 100) % 100) / 100 < 0.875; }

  private giveBirth(mother: Animal) {
    if (mother.species !== 'deer' && mother.species !== 'wolf') { this.giveBirthFauna(mother); return; }
    const T = traitsOf(mother.species);
    // Deer: twins are common in well-fed does. Wolves: litter size grows with condition.
    let litter = mother.species === 'deer'
      ? (mother.energy > 70 && this.rng.chance(0.4) ? 2 : 1)
      : 1 + Math.floor(this.rng.next() * (1 + 3 * mother.energy / 100));
    // Never let a birth leave the mother with less than ~30 energy.
    litter = Math.min(litter, 4, Math.max(1, Math.floor((mother.energy - 30) / T.birthCost)));
    if (mother.energy < T.birthCost + 4) {
      // Not enough reserves: the pregnancy fails.
      mother.cooldown = T.cooldown * 0.5;
      return;
    }
    const flows = this.flows[this.flows.length - 1];
    for (let k = 0; k < litter; k++) {
      mother.energy -= T.birthCost;
      if (mother.species === 'deer') flows.deerSpent += T.birthCost; else flows.wolfSpent += T.birthCost;
      const young = this.makeAnimal(mother.species, mother.x + this.rng.range(-0.8, 0.8), mother.z + this.rng.range(-0.8, 0.8), {
        energy: T.newbornEnergy, hydration: 80, parentId: mother.id, generation: mother.generation + 1, packId: mother.packId,
        state: mother.species === 'deer' ? 'herd' : 'pack',
      });
      young.heading = mother.heading;
      mother.offspring++;
      this.counters.births[mother.species]++;
    }
    mother.cooldown = T.cooldown / Math.max(0.15, mother.species === 'deer' ? this.params.deerReproRate : this.params.wolfReproRate);
    if (mother.species === 'wolf') this.log('birth', `Wolf #${mother.id} gave birth to ${litter} pup${litter > 1 ? 's' : ''} in pack ${mother.packId}.`);
  }

  private giveBirthFauna(mother: Animal) {
    const S = SPECIES[mother.species], T = S.traits;
    if (mother.energy < T.birthCost + 4) { mother.cooldown = T.cooldown * 0.5; return; }
    let litter = this.rng.int(S.litter[0], S.litter[1]);
    litter = Math.min(litter, Math.max(1, Math.floor((mother.energy - 30) / T.birthCost)));
    for (let k = 0; k < litter; k++) {
      mother.energy -= T.birthCost;
      const young = this.makeAnimal(mother.species, mother.x + this.rng.range(-0.6, 0.6), mother.z + this.rng.range(-0.6, 0.6), {
        energy: T.newbornEnergy, hydration: 85, parentId: mother.id, generation: mother.generation + 1, state: 'follow',
        alt: mother.alt,
      });
      young.heading = mother.heading;
      mother.offspring++;
      this.counters.births[mother.species]++;
    }
    mother.cooldown = T.cooldown;
    if (S.role === 'predator' || mother.species === 'bear' || mother.species === 'moose') {
      this.log('birth', `A ${speciesName(mother.species)} gave birth to ${litter} young.`);
    }
  }

  /** The single place an animal dies. Records the death exactly once. */
  kill(a: Animal, cause: DeathCause, by?: Animal) {
    if (!a.alive) return;
    a.alive = false;
    a.cause = cause;
    if (cause === 'removed') this.counters.removed[a.species]++;
    else this.counters.deaths[a.species][cause]++;
    const T = traitsOf(a.species);
    if (T.bodyMeat > 0 && cause !== 'removed') {
      const size = a.age < T.maturity ? 0.5 : 1;
      const meat = T.bodyMeat * size * (cause === 'predation' ? 1 : 0.6);
      this.carcasses.push({ id: this.nextCarcassId++, x: a.x, z: a.z, meat, initialMeat: meat, ageTicks: 0, predation: cause === 'predation', species: a.species });
      if (a.species === 'deer') this.flows[this.flows.length - 1].meatProduced += meat;
    }
    if (cause === 'predation' && by) {
      const row = this.counters.predation[by.species];
      row[a.species] = (row[a.species] ?? 0) + 1;
      const who = by.species === 'wolf' ? `Wolf #${by.id} (pack ${by.packId})` : `A ${speciesName(by.species)} (#${by.id})`;
      const young = a.age < T.maturity && a.species !== 'hare' && a.species !== 'squirrel' ? ' young' : '';
      // Small prey are logged only now and then, so the field notes stay readable.
      if (T.bodyMeat >= 20 || this.rng.chance(0.2)) this.log('hunt', `${who} brought down a${young} ${speciesName(a.species)} (#${a.id}).`);
      this.heat.addKill(a.x, a.z);
    } else if ((a.species === 'wolf' || SPECIES[a.species].role === 'predator' || a.species === 'bear') && cause !== 'removed') {
      this.log('death', `${speciesName(a.species)[0].toUpperCase()}${speciesName(a.species).slice(1)} #${a.id} died (${cause}).`);
    }
  }

  // ------------------------------------------------------------------ packs

  maintainPacks() {
    for (const p of this.packs.values()) p.size = 0;
    const wolves = this.animals.filter((a) => a.alive && a.species === 'wolf');
    for (const w of wolves) {
      let p = this.packs.get(w.packId);
      if (!p) {
        p = { id: this.nextPackId++, leaderId: -1, breederId: -1, breeder2Id: -1, targetId: -1, homeX: w.x, homeZ: w.z, size: 0 };
        this.packs.set(p.id, p);
        w.packId = p.id;
      }
      p.size++;
    }
    // Dispersal: oversized packs lose their youngest adult, who founds a new pack.
    for (const p of [...this.packs.values()]) {
      if (p.size > 7) {
        // A young adult pair (one of each sex where possible) disperses to found a new pack.
        const adults = wolves.filter((w) => w.packId === p.id && w.age >= WOLF.maturity && w.id !== p.breederId && w.id !== p.leaderId)
          .sort((a, b) => a.age - b.age || a.id - b.id);
        const f = adults.find((w) => w.sex === 'F'), m = adults.find((w) => w.sex === 'M');
        const leavers = f && m ? [f, m] : adults.slice(0, 2);
        if (leavers.length) {
          const np: Pack = { id: this.nextPackId++, leaderId: -1, breederId: -1, breeder2Id: -1, targetId: -1, homeX: leavers[0].x, homeZ: leavers[0].z, size: leavers.length };
          const dest = this.randomOpenPoint(p.homeX, p.homeZ, 70);
          np.homeX = dest.x; np.homeZ = dest.z;
          this.packs.set(np.id, np);
          for (const l of leavers) l.packId = np.id;
          p.size -= leavers.length;
          this.log('info', `A young pair left pack ${p.id} to found pack ${np.id}.`);
        }
      }
    }
    // A pack that can no longer breed (no adult of one sex) merges into the nearest pack,
    // as lone wolves and remnant groups do.
    for (const p of [...this.packs.values()]) {
      const members = wolves.filter((w) => w.packId === p.id);
      if (!members.length) continue;
      const adults = members.filter((w) => w.age >= WOLF.maturity);
      const canBreed = adults.some((w) => w.sex === 'F') && adults.some((w) => w.sex === 'M');
      if (canBreed || members.length > 4) continue;
      let best: Pack | null = null, bd = 120;
      for (const o of this.packs.values()) {
        if (o.id === p.id || o.size <= 0) continue;
        const d = Math.hypot(o.homeX - p.homeX, o.homeZ - p.homeZ);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        for (const w of members) w.packId = best.id;
        best.size += members.length;
        p.size = 0;
        this.log('info', `The remnant of pack ${p.id} joined pack ${best.id}.`);
      }
    }
    // Leader = oldest adult; remove empty packs.
    for (const p of [...this.packs.values()]) {
      const members = wolves.filter((w) => w.packId === p.id);
      if (!members.length) { this.packs.delete(p.id); continue; }
      const adults = members.filter((w) => w.age >= WOLF.maturity);
      const leader = (adults.length ? adults : members).reduce((a, b) => (b.age > a.age ? b : a));
      p.leaderId = leader.id;
      // The dominant (oldest) female breeds. A large, well-fed pack may raise a second litter,
      // as wolves do when prey is plentiful.
      const females = adults.filter((w) => w.sex === 'F').sort((a, b) => b.age - a.age || a.id - b.id);
      p.breederId = females.length ? females[0].id : -1;
      const fed = members.reduce((s, w) => s + w.energy, 0) / members.length;
      p.breeder2Id = females.length > 1 && members.length >= 7 && fed > 85 ? females[1].id : -1;
      if (p.targetId !== -1 && !this.byId.get(p.targetId)?.alive) p.targetId = -1;
    }
  }

  // ------------------------------------------------------------------ user actions

  addDeer(n: number) { this.spawnDeer(n); }
  addWolves(n: number) { this.spawnWolves(n); }
  addFauna(id: FaunaId, n: number) { this.spawnFauna(id, n); }

  remove(species: Species, n: number | 'all') {
    const list = this.animals.filter((a) => a.alive && a.species === species);
    const count = n === 'all' ? list.length : Math.min(n, list.length);
    for (let k = 0; k < count; k++) {
      const pickIdx = this.rng.int(0, list.length - 1);
      this.kill(list[pickIdx], 'removed');
      list.splice(pickIdx, 1);
    }
    this.animals = this.animals.filter((a) => a.alive);
    for (const [id, a] of this.byId) if (!a.alive) this.byId.delete(id);
    if (species === 'wolf') this.maintainPacks();
    if (count) this.log('info', `${count} ${speciesName(species, count)} removed by the experimenter.`);
  }

  // ------------------------------------------------------------------ bookkeeping

  log(kind: SimEvent['kind'], text: string) {
    this.events.push({ tick: this.tick, kind, text });
    if (this.events.length > 60) this.events.shift();
  }

  private checkExtinction() {
    const counts = perSpecies(() => 0);
    for (const a of this.animals) if (a.alive) counts[a.species]++;
    for (const s of SPECIES_IDS) {
      const alive = counts[s] > 0;
      if (!alive && this.extinct[s] < 0 && this.everHad(s)) {
        this.extinct[s] = this.day;
        const name = SPECIES[s].plural;
        this.log('extinct', `${name[0].toUpperCase()}${name.slice(1)} went extinct on day ${this.day.toFixed(1)}.`);
      } else if (alive && this.extinct[s] >= 0) {
        this.extinct[s] = -1;
      }
    }
  }

  private everHad(s: Species) {
    const initial = s === 'deer' ? this.setup.initialDeer : s === 'wolf' ? this.setup.initialWolves : this.setup.fauna?.[s as FaunaId] ?? 0;
    return initial + this.counters.added[s] + this.counters.births[s] > 0;
  }

  count(s: Species) {
    let n = 0;
    for (const a of this.animals) if (a.alive && a.species === s) n++;
    return n;
  }

  totalDeaths(s: Species) {
    return CAUSES.reduce((sum, c) => sum + this.counters.deaths[s][c], 0);
  }

  averageEnergy(s: Species) {
    let sum = 0, n = 0;
    for (const a of this.animals) if (a.species === s) { sum += a.energy; n++; }
    return n ? sum / n : 0;
  }

  /** Average flows per day over the last few complete days. */
  recentFlows(days = 5): DayFlows {
    const done = this.flows.slice(0, -1).slice(-days);
    const out = emptyFlows();
    if (!done.length) return out;
    for (const f of done) for (const k of Object.keys(out) as (keyof DayFlows)[]) out[k] += f[k] / done.length;
    return out;
  }

  get currentFlows() { return this.flows[this.flows.length - 1]; }
}
