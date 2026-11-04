/**
 * One data-driven brain for every species except deer and wolves (which have their own).
 *
 * Each tick an animal: loses water (if it drinks), checks for predators that hunt it and flees
 * (herd-mates pass the alarm on), then acts on its current state. Every few ticks it re-decides
 * by utility, weighing hunger, thirst, rest, breeding, its group and its diet:
 * - plant eaters graze the shared vegetation grid in the habitat they prefer (so they compete
 *   with the deer);
 * - scavengers head for carcasses (anyone's kills);
 * - predators stalk, then rush, prey from their list; a capture is a chance shaped by the
 *   prey's condition, its toughness, cover, light and weather;
 * - birds fly: they cruise above the trees, dive on prey and land to feed or rest;
 * - bears hibernate through winter on a fraction of their metabolism.
 */
import { isAdult, type Animal, type Carcass } from './agents';
import { STALK_MIN_TICKS, move, setState, toward, visibility, wanderTarget } from './behavior';
import type { Ecosystem } from './ecosystem';
import { PREDATOR_OF, SPECIES, type Habitat, type SpeciesDef, type SpeciesId } from './species';
import { CELL, HALF, VEG_N, cellCenter, cellIndex } from './world';

const DRINK_RATE = 5;
const HUNTERS = Object.fromEntries(Object.entries(PREDATOR_OF).map(([k, v]) => [k, Object.keys(v) as SpeciesId[]])) as Record<SpeciesId, SpeciesId[]>;
const HUNTED = Object.fromEntries(Object.entries(HUNTERS).map(([k, v]) => [k, v.length > 0])) as Record<string, boolean>;

function habitatWeight(sim: Ecosystem, c: number, h: Habitat) {
  const f = sim.world.forest[c];
  switch (h) {
    case 'open': return 1 - 0.85 * f;
    case 'forest': return 0.15 + f;
    case 'edge': return 0.35 + (f > 0.08 && f < 0.75 ? 0.9 : 0);
    case 'water': return sim.veg.waterDist[c] < 14 ? 1 : 0.06;
    default: return 1;
  }
}

/** The best plant-food cell nearby for this species (biomass weighted by habitat and distance). */
function bestFood(sim: Ecosystem, a: Animal, S: SpeciesDef, radius: number): number {
  const veg = sim.veg;
  const cr = Math.ceil(radius / CELL);
  const cx = Math.floor((a.x + HALF) / CELL), cz = Math.floor((a.z + HALF) / CELL);
  const need = minBiomass(S);
  let best = -1, bestScore = 0;
  for (let dz = -cr; dz <= cr; dz += 1) {
    const gz = cz + dz;
    if (gz < 0 || gz >= VEG_N) continue;
    for (let dx = -cr; dx <= cr; dx += 1) {
      const gx = cx + dx;
      if (gx < 0 || gx >= VEG_N) continue;
      const c = gz * VEG_N + gx;
      if (veg.B[c] < need || veg.water[c]) continue;
      const d = Math.hypot(dx, dz) * CELL;
      if (d > radius) continue;
      if (S.waterBound && veg.waterDist[c] > S.waterBound) continue;
      const score = (veg.B[c] * habitatWeight(sim, c, S.plants!.habitat)) / (1 + d * 0.1);
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  return best;
}

const minBiomass = (S: SpeciesDef) => (S.traits.radius < 0.35 ? 0.4 : 1.2);

function nearestCarcass(sim: Ecosystem, a: Animal, r: number): Carcass | null {
  let best: Carcass | null = null, bd = r;
  for (const c of sim.carcasses) {
    if (c.meat < 1 || c.species === a.species) continue;
    const d = Math.hypot(c.x - a.x, c.z - a.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** Predators of this animal that are close enough to notice. Returns the flee direction. */
function threats(sim: Ecosystem, a: Animal, S: SpeciesDef): { fx: number; fz: number } | null {
  const rel = PREDATOR_OF[a.species];
  if (!HUNTED[a.species]) return null;
  const R = S.detection * visibility(sim, a.x, a.z) * (a.energy < 20 ? 0.7 : 1);
  if (R <= 0) return null;
  let fx = 0, fz = 0, n = 0;
  const adult = isAdult(a);
  const check = (i: number) => {
    const o = sim.animals[i];
    const r = rel[o.species];
    if (!r || !o.alive) return;
    if (r === 1 && adult) return; // hunts only the young
    const dist = Math.hypot(o.x - a.x, o.z - a.z);
    const mode = o.state === 'chase' ? 1.4 : o.state === 'stalk' ? 0.35 : o.state === 'rest' || o.state === 'eat' || o.state === 'hibernate' ? 0.25 : 0.45;
    // Birds overhead are only noticed once they dive.
    const air = o.alt > 4 ? (o.state === 'chase' ? 0.8 : 0.2) : 1;
    if (dist < R * mode * air && dist > 1e-6) {
      const wgt = 1 / (dist * dist);
      fx += (a.x - o.x) / dist * wgt; fz += (a.z - o.z) / dist * wgt; n++;
    }
  };
  for (const pred of HUNTERS[a.species]) sim.hashes[pred].query(a.x, a.z, R * 1.4, check);
  if (!n) return null;
  const L = Math.hypot(fx, fz) || 1;
  return { fx: fx / L, fz: fz / L };
}

export function updateCritter(sim: Ecosystem, a: Animal) {
  const S = SPECIES[a.species];
  const T = S.traits;
  const p = sim.params;
  const rng = sim.rng;
  a.stateTicks++;
  if (a.escapeTicks > 0) a.escapeTicks--;
  if (a.attemptCooldown > 0) a.attemptCooldown--;
  const speedMul = sim.weather.mobility;

  // Water
  if (S.thirst > 0) {
    a.hydration = Math.max(0, a.hydration - S.thirst * (1 + 0.8 * p.drought) * sim.weather.thirst * (a.state === 'hibernate' ? 0.1 : 1));
    if (a.hydration <= 0) { a.dryTicks++; a.energy = Math.max(0, a.energy - 0.2); } else a.dryTicks = 0;
  } else a.hydration = 100;

  // Flight altitude eases toward what the animal is doing.
  if (S.flies) {
    // Resting birds soar by day and roost at night.
    const grounded = a.state === 'eat' || a.state === 'mate' || a.state === 'graze' || (a.state === 'rest' && sim.daylight < 0.3) || (a.state === 'follow' && !isAdult(a) && a.alt < 1);
    const target = grounded ? 0 : a.state === 'chase' ? Math.max(0.6, Math.min(S.flies.cruise, distToTarget(sim, a) * 0.5)) : S.flies.cruise;
    a.alt += Math.max(-1.2, Math.min(0.6, target - a.alt));
  }

  // Hibernation: bears sleep through winter if they have the reserves.
  if (S.hibernates) {
    if (sim.isWinter && a.energy > 25 && a.state !== 'flee') { if (a.state !== 'hibernate') setState(a, 'hibernate'); }
    else if (a.state === 'hibernate') { setState(a, 'wander'); a.decideIn = 0; }
    if (a.state === 'hibernate') { move(sim, a, T, { dx: 0, dz: 0, speed: 0 }); return; }
  }

  // Predators of this species
  if (a.state !== 'chase' && ((sim.tick + a.id) % 2 === 0 || a.state === 'flee')) {
    const t = threats(sim, a, S);
    if (t) {
      let { fx, fz } = t;
      // Beavers bolt for the water; squirrels for the nearest trees.
      if (a.species === 'beaver') {
        const c = cellIndex(a.x, a.z);
        if (Number.isFinite(sim.veg.waterDist[c])) { fx = fx * 0.3 + (sim.veg.nearestWaterX[c] - a.x); fz = fz * 0.3 + (sim.veg.nearestWaterZ[c] - a.z); }
      }
      const L = Math.hypot(fx, fz) || 1;
      a.fleeX = fx / L; a.fleeZ = fz / L;
      a.lastThreatTick = sim.tick;
      if (a.state !== 'flee') { a.targetId = -1; setState(a, 'flee'); }
    } else if (S.social === 'herd' && a.state !== 'flee') {
      // Alarm spreads through the herd.
      let alarmed: Animal | null = null;
      sim.hashes[a.species].query(a.x, a.z, 10, (i) => {
        const o = sim.animals[i];
        if (alarmed || o === a || o.state !== 'flee') return;
        if (sim.tick - o.lastThreatTick < 10) alarmed = o;
      });
      if (alarmed) {
        const o = alarmed as Animal;
        a.fleeX = o.fleeX; a.fleeZ = o.fleeZ; a.lastThreatTick = o.lastThreatTick;
        setState(a, 'flee');
      }
    }
  }

  const c = cellIndex(a.x, a.z);
  switch (a.state) {
    case 'flee': {
      if (sim.tick - a.lastThreatTick > 20) { setState(a, 'alert'); break; }
      const sprint = T.sprint * speedMul * (a.escapeTicks > 0 ? 1.2 : 1) * (0.75 + 0.25 * Math.min(1, a.energy / 40));
      move(sim, a, T, { dx: a.fleeX, dz: a.fleeZ, speed: a.stamina > 6 ? sprint : T.trot * speedMul });
      return;
    }
    case 'alert': {
      move(sim, a, T, { dx: -a.fleeX, dz: -a.fleeZ, speed: 0 });
      if (a.stateTicks > 20) a.decideIn = 0; else return;
      break;
    }
    case 'graze': {
      if (!S.plants) { a.decideIn = 0; break; }
      const eaten = sim.veg.consume(c, S.plants.rate);
      a.energy = Math.min(T.maxEnergy, a.energy + eaten * S.plants.eff);
      move(sim, a, T, { dx: Math.cos(a.heading + Math.sin(a.stateTicks * 0.07) * 0.8), dz: Math.sin(a.heading + Math.sin(a.stateTicks * 0.07) * 0.8), speed: T.walk * 0.1 });
      if (sim.veg.B[c] < minBiomass(S) * 0.6 || a.energy >= 97) a.decideIn = 0;
      break;
    }
    case 'drink': {
      a.hydration = Math.min(100, a.hydration + DRINK_RATE);
      move(sim, a, T, { dx: 0, dz: 0, speed: 0 });
      if (a.hydration >= 99) a.decideIn = 0;
      break;
    }
    case 'rest': {
      if (S.flies && a.alt > 2) {
        // Soaring: wide lazy circles.
        const ang = a.heading + 0.03;
        move(sim, a, T, { dx: Math.cos(ang), dz: Math.sin(ang), speed: T.walk * 0.8 });
        if (a.stateTicks > 70) a.decideIn = 0;
        break;
      }
      move(sim, a, T, { dx: 0, dz: 0, speed: 0 });
      if (a.stateTicks > 70) a.decideIn = 0;
      break;
    }
    case 'eat': {
      const car = sim.carcasses.find((k) => k.id === a.targetId);
      if (!car || car.meat < 0.3 || !S.meat) { a.targetId = -1; setState(a, 'rest'); a.decideIn = 25; break; }
      const t = toward(a, car.x, car.z);
      if (t.d > 1.2 + T.radius) { move(sim, a, T, { dx: t.dx, dz: t.dz, speed: (S.flies ? T.trot : T.trot * 0.9) * speedMul }); return; }
      const bite = Math.min(S.meat.rate, car.meat, (T.maxEnergy - a.energy) / S.meat.eff);
      car.meat -= bite;
      a.energy += bite * S.meat.eff;
      move(sim, a, T, { dx: t.dx, dz: t.dz, speed: 0 });
      if (a.energy >= 97) { a.targetId = -1; setState(a, 'rest'); a.decideIn = 40; }
      return;
    }
    case 'stalk': {
      const d = sim.byId.get(a.targetId);
      const H = S.hunt;
      if (!d || !d.alive || !H) { a.targetId = -1; a.decideIn = 0; break; }
      const t = toward(a, d.x, d.z);
      if (t.d > H.sensing * 1.6) { a.targetId = -1; a.decideIn = 0; break; }
      if (d.state === 'flee' && t.d < H.pounce * 1.6 || (t.d < H.pounce && a.stateTicks >= STALK_MIN_TICKS)) { setState(a, 'chase'); chase(sim, a, S, speedMul); return; }
      move(sim, a, T, { dx: t.dx, dz: t.dz, speed: (t.d < H.pounce ? H.stalkSpeed * 0.5 : H.stalkSpeed) * speedMul });
      return;
    }
    case 'chase': chase(sim, a, S, speedMul); return;
    case 'mate': {
      const m = sim.byId.get(a.targetId);
      if (!m || !m.alive) { a.decideIn = 0; break; }
      const t = toward(a, m.x, m.z);
      if (t.d < 1.5 + T.radius * 2) {
        const q = Math.min(0.9, 0.6 * breedingChance(sim, a, S) * (a.energy / 100));
        if (rng.chance(q)) a.pregnantDays = T.gestation; else a.cooldown = 1.5;
        a.decideIn = 0;
        move(sim, a, T, { dx: t.dx, dz: t.dz, speed: 0 });
      } else move(sim, a, T, { dx: t.dx, dz: t.dz, speed: T.trot * 0.7 * speedMul });
      break;
    }
    case 'follow': {
      // Young stay with their mother; ravens shadow the wolf packs.
      const m = sim.byId.get(a.targetId !== -1 ? a.targetId : a.parentId);
      if (!m || !m.alive || (isAdult(a) && a.species !== 'raven')) { a.targetId = -1; setState(a, 'wander'); a.decideIn = 0; break; }
      const gap = a.species === 'raven' ? 9 : 2 + T.radius * 3;
      const t = toward(a, m.x + Math.cos(a.id) * gap * 0.6, m.z + Math.sin(a.id) * gap * 0.6);
      const v = t.d > gap * 3 ? T.trot : t.d > gap ? Math.max(T.walk, m.speed) : m.speed * 0.8;
      move(sim, a, T, { dx: t.dx, dz: t.dz, speed: v * speedMul });
      if (a.stateTicks > 90) a.decideIn = Math.min(a.decideIn, 1);
      break;
    }
    default: {
      // wander / seekFood / seekWater / herd / search: walk toward the target point
      const t = toward(a, a.tx, a.tz);
      const urgent = (a.state === 'seekWater' && a.hydration < 45) || (a.state === 'seekFood' && a.energy < 30) || a.state === 'search';
      const v = (urgent ? T.trot * 0.8 : T.walk) * speedMul;
      if (t.d < 1.2 + T.radius) {
        if (a.state === 'seekFood') setState(a, 'graze');
        else if (a.state === 'seekWater') setState(a, 'drink');
        else a.decideIn = Math.min(a.decideIn, 1);
        move(sim, a, T, { dx: t.dx, dz: t.dz, speed: 0 });
      } else move(sim, a, T, { dx: t.dx, dz: t.dz, speed: v });
      if (a.stateTicks > 140) a.decideIn = Math.min(a.decideIn, 1);
    }
  }

  if (--a.decideIn > 0) return;
  a.decideIn = 8 + rng.int(0, 6);
  decide(sim, a, S, c);
}

function distToTarget(sim: Ecosystem, a: Animal) {
  const d = sim.byId.get(a.targetId);
  return d ? Math.hypot(d.x - a.x, d.z - a.z) : 99;
}

/** Breeding falls as same-species adults crowd the territory (and with poor condition). */
function breedingChance(sim: Ecosystem, a: Animal, S: SpeciesDef) {
  if (!S.territory) return 1;
  let n = 0;
  sim.hashes[a.species].query(a.x, a.z, S.territory, (i) => {
    const o = sim.animals[i];
    if (o !== a && o.alive && isAdult(o) && Math.hypot(o.x - a.x, o.z - a.z) < S.territory) n++;
  });
  return Math.max(0.03, 1 - n / S.territoryMax);
}

function decide(sim: Ecosystem, a: Animal, S: SpeciesDef, c: number) {
  const T = S.traits;
  const rng = sim.rng;
  const hunger = 1 - a.energy / T.maxEnergy;
  const thirst = S.thirst > 0 ? 1 - a.hydration / 100 : 0;
  const night = 1 - sim.daylight;
  const adult = isAdult(a);

  // The young follow their mother until they are grown.
  if (!adult && a.parentId !== -1 && sim.byId.get(a.parentId)?.alive && hunger < 0.6) {
    a.targetId = -1;
    setState(a, 'follow');
    return;
  }

  // Badly thirsty animals drink before anything else.
  if (thirst > 0.6 && Number.isFinite(sim.veg.waterDist[c])) {
    a.tx = sim.veg.nearestWaterX[c] + rng.range(-1, 1);
    a.tz = sim.veg.nearestWaterZ[c] + rng.range(-1, 1);
    setState(a, 'seekWater');
    return;
  }

  // Meat on the ground first, for those that eat it.
  if (S.meat && hunger > 0.15) {
    const scent = S.flies ? 140 : S.meat.scavenges ? 70 : 25;
    const car = nearestCarcass(sim, a, scent);
    if (car && (S.meat.scavenges || car.predation)) { a.targetId = car.id; setState(a, 'eat'); return; }
  }

  // Hunting
  if (S.hunt && S.prey.length && hunger > 0.3 && adult) {
    const prey = findPrey(sim, a, S);
    if (prey) { a.targetId = prey.id; setState(a, 'stalk'); return; }
  }

  const ready = a.sex === 'F' && adult && a.pregnantDays < 0 && a.cooldown <= 0 && a.energy >= T.reproEnergy;
  const activeTime = S.nocturnal ? night : 1 - night;
  const u = {
    eat: S.plants && hunger > 0.08 ? 1.3 * hunger ** 1.3 + (sim.veg.B[c] >= minBiomass(S) * 1.3 && hunger > 0.35 ? 0.4 : 0) : 0,
    hunt: S.hunt && hunger > 0.3 ? 0.9 * hunger : 0,
    drink: thirst < 0.1 ? 0 : 1.8 * thirst ** 1.3,
    rest: (1 - hunger) * (0.12 + 0.55 * (1 - activeTime)) + (a.stamina < 40 ? 0.4 : 0),
    mate: ready ? 0.65 * (a.energy / 100) : 0,
    social: 0,
    wander: 0.12,
  };
  // Herd animals keep together; ravens follow the wolves when not busy.
  let herdX = 0, herdZ = 0, herdN = 0, nearest = Infinity;
  if (S.social === 'herd' || S.social === 'family') {
    sim.hashes[a.species].query(a.x, a.z, 32, (i) => {
      const o = sim.animals[i];
      if (o === a || !o.alive) return;
      const dist = Math.hypot(o.x - a.x, o.z - a.z);
      if (dist > 32) return;
      nearest = Math.min(nearest, dist);
      herdX += o.x; herdZ += o.z; herdN++;
    });
    if (herdN && nearest > 12) u.social = 0.4;
  }
  if (a.species === 'raven' && hunger < 0.6) u.social = Math.max(u.social, 0.45);

  const keys = Object.keys(u) as (keyof typeof u)[];
  const choice = keys.reduce((x, y) => (u[y] > u[x] ? y : x));

  switch (choice) {
    case 'eat': {
      if (sim.veg.B[c] >= minBiomass(S) * 1.3 && habitatWeight(sim, c, S.plants!.habitat) > 0.3 && (!S.waterBound || sim.veg.waterDist[c] <= S.waterBound)) { setState(a, 'graze'); return; }
      let cell = bestFood(sim, a, S, 16);
      if (cell < 0) cell = bestFood(sim, a, S, 45);
      if (cell >= 0) {
        const pt = cellCenter(cell);
        a.tx = pt.x + rng.range(-CELL * 0.4, CELL * 0.4); a.tz = pt.z + rng.range(-CELL * 0.4, CELL * 0.4);
        setState(a, 'seekFood');
      } else roam(sim, a, S, 35);
      return;
    }
    case 'hunt': roam(sim, a, S, S.flies ? 80 : 45); setState(a, 'search'); return;
    case 'drink': {
      if (!Number.isFinite(sim.veg.waterDist[c])) { roam(sim, a, S, 30); return; }
      a.tx = sim.veg.nearestWaterX[c] + rng.range(-1, 1);
      a.tz = sim.veg.nearestWaterZ[c] + rng.range(-1, 1);
      setState(a, 'seekWater');
      return;
    }
    case 'rest': setState(a, 'rest'); return;
    case 'mate': {
      let best: Animal | null = null, bd = S.social === 'solitary' ? 110 : 45;
      sim.hashes[a.species].query(a.x, a.z, bd, (i) => {
        const o = sim.animals[i];
        if (!o.alive || o.sex !== 'M' || !isAdult(o) || o.energy < 40) return;
        const dist = Math.hypot(o.x - a.x, o.z - a.z);
        if (dist < bd) { bd = dist; best = o; }
      });
      if (best) { a.targetId = (best as Animal).id; setState(a, 'mate'); }
      else roam(sim, a, S, 40);
      return;
    }
    case 'social': {
      if (a.species === 'raven') {
        let wolf: Animal | null = null, wd = 140;
        sim.wolfHash.query(a.x, a.z, wd, (i) => {
          const o = sim.animals[i];
          const d = Math.hypot(o.x - a.x, o.z - a.z);
          if (o.alive && d < wd) { wd = d; wolf = o; }
        });
        if (wolf) { a.targetId = (wolf as Animal).id; setState(a, 'follow'); return; }
        roam(sim, a, S, 60);
        return;
      }
      a.tx = herdX / herdN; a.tz = herdZ / herdN;
      setState(a, 'herd');
      return;
    }
    default: roam(sim, a, S, S.flies ? 60 : 16);
  }
}

/** Wander, but stay in reach of water for beavers. */
function roam(sim: Ecosystem, a: Animal, S: SpeciesDef, r: number) {
  wanderTarget(sim, a, r);
  if (S.waterBound) {
    const c = cellIndex(a.tx, a.tz);
    if (!(sim.veg.waterDist[c] <= S.waterBound)) {
      const here = cellIndex(a.x, a.z);
      if (Number.isFinite(sim.veg.waterDist[here])) {
        a.tx = sim.veg.nearestWaterX[here] + sim.rng.range(-6, 6);
        a.tz = sim.veg.nearestWaterZ[here] + sim.rng.range(-6, 6);
      }
    }
  }
}

function findPrey(sim: Ecosystem, a: Animal, S: SpeciesDef): Animal | null {
  const H = S.hunt!;
  const range = H.sensing * (S.flies ? 1 : 0.7 + 0.3 * visibility(sim, a.x, a.z) / Math.max(0.2, sim.weather.visibility)) * (0.5 + 0.5 * sim.weather.visibility);
  let best: Animal | null = null, bestScore = 0;
  const consider = (i: number) => {
    const d = sim.animals[i];
    if (!d.alive || d === a || d.alt > 1.5) return;
    const link = S.prey.find((p) => p.id === d.species);
    if (!link) return;
    const adult = isAdult(d);
    if (link.juvenileOnly && adult) return;
    const dist = Math.hypot(d.x - a.x, d.z - a.z);
    if (dist > range) return;
    // Eagles hunt in the open; their prey hides under the canopy.
    if (S.flies && sim.world.forest[cellIndex(d.x, d.z)] > 0.55) return;
    const weak = 1 + (1 - d.energy / 100) + (adult ? 0 : 0.6);
    const score = (link.weight * weak * (adult ? SPECIES[d.species].toughness : 1)) / (dist + 5);
    if (score > bestScore) { bestScore = score; best = d; }
  };
  for (const link of S.prey) sim.hashes[link.id].query(a.x, a.z, range, consider);
  return best;
}

/** A short, stamina-limited rush and the capture attempt. */
function chase(sim: Ecosystem, a: Animal, S: SpeciesDef, speedMul: number) {
  const T = S.traits, H = S.hunt!;
  const d = sim.byId.get(a.targetId);
  if (!d || !d.alive || !H) { a.targetId = -1; setState(a, 'rest'); a.decideIn = 20; return; }
  const dist = Math.hypot(d.x - a.x, d.z - a.z);
  if (a.stamina < 3 || dist > H.giveUp || a.stateTicks > H.maxChase) {
    a.targetId = -1;
    setState(a, 'rest');
    a.decideIn = 30;
    move(sim, a, T, { dx: 0, dz: 0, speed: 0 });
    return;
  }
  const lead = Math.min(dist / (T.sprint * speedMul), 8);
  const px = d.x + Math.cos(d.heading) * d.speed * lead;
  const pz = d.z + Math.sin(d.heading) * d.speed * lead;
  const v = a.stamina > 0 ? T.sprint * speedMul * (0.8 + 0.2 * Math.min(1, a.energy / 40)) : T.trot * speedMul;
  move(sim, a, T, { dx: px - a.x, dz: pz - a.z, speed: v }, false);

  const reach = 1 + T.radius + SPECIES[d.species].traits.radius;
  if (dist < reach && a.attemptCooldown === 0 && (!S.flies || a.alt < 2.5)) {
    const condition = 0.75 + 0.6 * (1 - d.energy / 100) + (isAdult(d) ? 0 : 0.4) + (d.stamina < 20 ? 0.35 : 0);
    const cover = 1 - 0.3 * sim.world.forest[cellIndex(d.x, d.z)] * (S.id === 'lynx' || S.id === 'cougar' ? -0.5 : 1);
    const light = S.nocturnal ? (sim.daylight < 0.4 ? 1.2 : 0.9) : 1;
    const tough = isAdult(d) ? SPECIES[d.species].toughness : 1;
    const prob = Math.max(0.02, Math.min(0.95, H.success * condition * cover * light * tough * sim.weather.capture));
    if (sim.rng.chance(prob)) {
      sim.kill(d, 'predation', a);
      const car = sim.carcasses[sim.carcasses.length - 1];
      a.kills++;
      if (car && car.x === d.x && car.z === d.z) { a.targetId = car.id; setState(a, 'eat'); }
      else { a.targetId = -1; setState(a, 'rest'); }
    } else {
      d.escapeTicks = 12;
      d.stamina = Math.min(100, d.stamina + 12);
      a.attemptCooldown = 12;
      a.stamina = Math.max(0, a.stamina - 12);
    }
  }
}
