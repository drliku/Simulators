/**
 * Autonomous behaviour: utility-based decisions plus a finite state machine per animal,
 * and shared steering (obstacle avoidance, separation, terrain and boundaries).
 *
 * Deer weigh hunger, thirst, fatigue, herd isolation and reproductive readiness, but any
 * detected wolf (or a fleeing herd-mate) overrides everything: survival first.
 * Wolves weigh hunger, stamina and pack state; they stalk, then chase on limited stamina,
 * and a capture attempt succeeds with a probability shaped by pack support, the deer's
 * condition, cover and light. Nothing is scripted; outcomes emerge from these rules.
 */
import {
  DEER, DEER_DRINK_RATE, DEER_ENERGY_PER_BIOMASS, DEER_GRAZE_RATE, DEER_HYDRATION_LOSS,
  WOLF, WOLF_EAT_RATE, isAdult, type Animal, type Carcass, type Traits,
} from './agents';
import type { Ecosystem } from './ecosystem';
import { CELL, HALF, cellCenter, cellIndex } from './world';
import { PREDATOR_OF, SPECIES, SPECIES_IDS } from './species';

const TAU = Math.PI * 2;
const wrap = (a: number) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// ------------------------------------------------------------------ steering

export interface Steer { dx: number; dz: number; speed: number }

/**
 * Turn toward the desired direction (with a turn-rate limit), adjust speed with limited
 * acceleration, avoid obstacles and edges, keep spacing, then move and resolve collisions.
 */
export function move(sim: Ecosystem, a: Animal, T: Traits, s: Steer, separation = true) {
  let { dx, dz } = s;
  const w = sim.world;
  const flies = !!SPECIES[a.species].flies && a.alt > 1.5;
  // Standing or barely moving (resting, grazing, drinking): no need to steer around anything.
  const still = s.speed < 0.05 && a.speed < 0.05;

  // Obstacle look-ahead avoidance
  const ahead = 2.6 + a.speed * 4;
  const hx = Math.cos(a.heading), hz = Math.sin(a.heading);
  const gx = Math.floor((a.x + HALF) / w.obstacleCell), gz = Math.floor((a.z + HALF) / w.obstacleCell);
  if (!flies && !still) for (let oz = gz - 1; oz <= gz + 1; oz++) for (let ox = gx - 1; ox <= gx + 1; ox++) {
    if (ox < 0 || oz < 0 || ox >= w.obstacleN || oz >= w.obstacleN) continue;
    for (const idx of w.obstacleGrid[oz * w.obstacleN + ox]) {
      const o = w.obstacles[idx];
      const rx = o.x - a.x, rz = o.z - a.z;
      const along = rx * hx + rz * hz;
      if (along < -0.5 || along > ahead + o.r) continue;
      const side = rx * hz - rz * hx;
      const clear = o.r + T.radius + 0.4;
      if (Math.abs(side) < clear) {
        const push = (clear - Math.abs(side)) / clear * (1 - along / (ahead + o.r));
        // side > 0: obstacle on the right, so push toward the left perpendicular (−hz, hx).
        const sgn = side > 0 ? 1 : -1;
        const mag = push * 2.2 * (Math.hypot(dx, dz) || 1);
        dx += -sgn * hz * mag;
        dz += sgn * hx * mag;
      }
    }
  }

  // Soft world boundary
  const edge = 9;
  const L = Math.hypot(dx, dz) || 1;
  if (a.x > HALF - edge) dx -= L * (a.x - (HALF - edge)) / edge * 1.5;
  if (a.x < -HALF + edge) dx += L * (-HALF + edge - a.x) / edge * 1.5;
  if (a.z > HALF - edge) dz -= L * (a.z - (HALF - edge)) / edge * 1.5;
  if (a.z < -HALF + edge) dz += L * (-HALF + edge - a.z) / edge * 1.5;

  // Turn
  if (Math.hypot(dx, dz) > 1e-6 && s.speed > 0.001) {
    const want = Math.atan2(dz, dx);
    const turn = T.turn * (a.speed > T.trot ? 0.7 : 1);
    a.heading = wrap(a.heading + Math.max(-turn, Math.min(turn, wrap(want - a.heading))));
  }
  // Speed: terrain and water slow animals down; sharp turns cost speed.
  const c = cellIndex(a.x, a.z);
  let target = s.speed;
  if (!flies) {
    if (sim.veg.water[c] && a.species !== 'beaver' && a.species !== 'moose') target *= 0.65;
    if (target > T.trot) target *= 1 - 0.18 * w.forest[c];
  }
  const misalign = Math.abs(wrap(Math.atan2(dz, dx) - a.heading));
  if (misalign > 1.2) target *= 0.55;
  a.speed += Math.max(-T.accel * 1.6, Math.min(T.accel, target - a.speed));
  if (a.speed < 0.002) a.speed = 0;

  let nx = a.x + Math.cos(a.heading) * a.speed;
  let nz = a.z + Math.sin(a.heading) * a.speed;

  // Separation from same-species neighbours (avoid overlapping bodies)
  if (separation && !flies && !still) {
    const minD = T.radius * 2.1;
    sim.hashes[a.species].query(nx, nz, minD, (i) => {
      const b = sim.animals[i];
      if (b === a || !b.alive) return;
      const ddx = nx - b.x, ddz = nz - b.z;
      const d = Math.hypot(ddx, ddz);
      if (d > 1e-6 && d < minD) { nx += (ddx / d) * (minD - d) * 0.35; nz += (ddz / d) * (minD - d) * 0.35; }
    });
  }

  // Resolve obstacle collisions (push out of trunks and rocks)
  const cgx = Math.floor((nx + HALF) / w.obstacleCell), cgz = Math.floor((nz + HALF) / w.obstacleCell);
  if (!flies && (!still || a.speed > 0) && cgx >= 0 && cgz >= 0 && cgx < w.obstacleN && cgz < w.obstacleN) {
    for (const idx of w.obstacleGrid[cgz * w.obstacleN + cgx]) {
      const o = w.obstacles[idx];
      const ddx = nx - o.x, ddz = nz - o.z;
      const d = Math.hypot(ddx, ddz), minD = o.r + T.radius;
      if (d < minD) {
        if (d < 1e-6) { nx += minD; continue; }
        nx = o.x + (ddx / d) * minD; nz = o.z + (ddz / d) * minD;
      }
    }
  }
  a.x = Math.max(-HALF + 1, Math.min(HALF - 1, nx));
  a.z = Math.max(-HALF + 1, Math.min(HALF - 1, nz));
  const moved = Math.hypot(a.x - a.px, a.z - a.pz);
  a.gait += moved;

  // Energy: basal metabolism plus movement cost ∝ (v / sprint)²; stamina drains when sprinting.
  const p = sim.params;
  const resting = a.state === 'rest' || a.state === 'recover' || a.state === 'hibernate';
  const juvenile = !isAdult(a);
  const v = a.speed / T.sprint;
  // Hibernating bears run on a fraction of their normal metabolism.
  const torpor = a.state === 'hibernate' ? 0.2 : 1;
  const cost = p.energyCost * (T.basal * torpor * (resting ? 0.6 : 1) * (a.pregnantDays >= 0 ? 1.25 : 1) * (juvenile ? 0.75 : 1) + T.moveCost * v * v);
  a.energy = Math.max(0, a.energy - cost);
  const flows = sim.currentFlows;
  if (a.species === 'deer') flows.deerSpent += cost; else if (a.species === 'wolf') flows.wolfSpent += cost;
  if (a.speed > T.trot * 1.05) a.stamina = Math.max(0, a.stamina - T.sprintDrain * v);
  else a.stamina = Math.min(100, a.stamina + T.staminaRegen * (resting ? 2 : a.speed < 0.05 ? 1.4 : 1));
}

export const toward = (a: Animal, x: number, z: number) => ({ dx: x - a.x, dz: z - a.z, d: Math.hypot(x - a.x, z - a.z) });

export function setState(a: Animal, s: Animal['state']) {
  if (a.state !== s) { a.state = s; a.stateTicks = 0; }
}

/** How visible things are: daylight and canopy. */
export function visibility(sim: Ecosystem, x: number, z: number) {
  return (0.5 + 0.5 * sim.daylight) * (1 - 0.4 * sim.world.forest[cellIndex(x, z)]) * sim.weather.visibility;
}

// ------------------------------------------------------------------ deer

export function updateDeer(sim: Ecosystem, d: Animal) {
  const T = DEER;
  const p = sim.params;
  const rng = sim.rng;
  d.stateTicks++;
  if (d.escapeTicks > 0) d.escapeTicks--;

  // Thirst (faster in drought); prolonged dehydration drains energy and eventually kills.
  d.hydration = Math.max(0, d.hydration - DEER_HYDRATION_LOSS * (1 + 0.8 * p.drought) * sim.weather.thirst);
  if (d.hydration <= 0) { d.dryTicks++; d.energy = Math.max(0, d.energy - 0.25); } else d.dryTicks = 0;

  // ---- Perception: wolves
  const vis = visibility(sim, d.x, d.z);
  // Desperately thirsty or hungry deer accept more risk to reach water or food.
  const desperate = d.hydration < 25 || d.energy < 20 ? 0.6 : 1;
  const R = p.detectionRadius * vis * desperate;
  let fx = 0, fz = 0, threats = 0;
  if ((sim.tick + d.id) % 2 === 0 || d.state === 'flee' || d.state === 'alert') {
    sim.wolfHash.query(d.x, d.z, R * 1.35, (i) => {
      const w = sim.animals[i];
      if (!w.alive) return;
      const dist = Math.hypot(w.x - d.x, w.z - d.z);
      // Flight distance depends on what the wolf is doing: resting or travelling wolves are
      // tolerated at a distance, a hunting wolf is not. Stalking wolves are hard to spot.
      const mode = w.state === 'chase' ? 1.35 : w.state === 'stalk' ? 0.55 : w.state === 'search' ? 0.6
        : w.state === 'rest' || w.state === 'recover' || w.state === 'eat' ? 0.3 : 0.45;
      const notice = R * mode * (isAdult(w) ? 1 : 0.5);
      if (dist < notice && dist > 1e-6) {
        const wgt = 1 / (dist * dist);
        fx += (d.x - w.x) / dist * wgt * 100;
        fz += (d.z - w.z) / dist * wgt * 100;
        threats++;
      }
    });
    // Other hunters: cougars (all deer), bears and lynx (fawns only, but adults keep clear too).
    for (const pred of DEER_HUNTERS) sim.hashes[pred].query(d.x, d.z, R * 1.2, (i) => {
      const o = sim.animals[i];
      const rel = PREDATOR_OF.deer[o.species];
      if (!rel || !o.alive) return;
      const dist = Math.hypot(o.x - d.x, o.z - d.z);
      // Cats are hard to spot while they creep in.
      const hunting = o.state === 'chase' ? 1.3 : o.state === 'stalk' ? 0.3 : 0.35;
      const notice = R * hunting * (rel === 1 && isAdult(d) ? 0.5 : 1);
      if (dist < notice && dist > 1e-6) {
        const wgt = 1 / (dist * dist);
        fx += (d.x - o.x) / dist * wgt * 100;
        fz += (d.z - o.z) / dist * wgt * 100;
        threats++;
      }
    });
  }
  if (threats > 0) {
    const L = Math.hypot(fx, fz) || 1;
    d.fleeX = fx / L; d.fleeZ = fz / L;
    d.lastThreatTick = sim.tick;
    setState(d, 'flee');
  } else if (d.state !== 'flee') {
    // Alarm spreads through the herd: a nearby deer fleeing from a recent threat.
    let alarmed: Animal | null = null;
    sim.deerHash.query(d.x, d.z, 9, (i) => {
      const o = sim.animals[i];
      if (alarmed || o === d || !o.alive || o.state !== 'flee') return;
      if (sim.tick - o.lastThreatTick < 10 && Math.hypot(o.x - d.x, o.z - d.z) < 9) alarmed = o;
    });
    if (alarmed) {
      const o = alarmed as Animal;
      d.fleeX = o.fleeX; d.fleeZ = o.fleeZ;
      d.lastThreatTick = o.lastThreatTick;
      setState(d, 'flee');
    }
  }

  const speedMul = p.deerSpeed * sim.weather.mobility;
  const c = cellIndex(d.x, d.z);

  // ---- Act on the current state
  switch (d.state) {
    case 'flee': {
      if (sim.tick - d.lastThreatTick > 22) { setState(d, 'alert'); break; }
      const sprint = T.sprint * speedMul * (d.escapeTicks > 0 ? 1.2 : 1) * (0.75 + 0.25 * Math.min(1, d.energy / 40));
      const v = d.stamina > 6 ? sprint : T.trot * speedMul;
      move(sim, d, T, { dx: d.fleeX, dz: d.fleeZ, speed: v });
      return;
    }
    case 'alert': {
      move(sim, d, T, { dx: -d.fleeX, dz: -d.fleeZ, speed: 0 });
      if (d.stateTicks > 25) d.decideIn = 0; else return;
      break;
    }
    case 'graze': {
      const eaten = sim.veg.consume(c, DEER_GRAZE_RATE);
      d.energy = Math.min(T.maxEnergy, d.energy + eaten * DEER_ENERGY_PER_BIOMASS);
      sim.currentFlows.vegEaten += eaten;
      sim.currentFlows.deerGained += eaten * DEER_ENERGY_PER_BIOMASS;
      // Drift slowly while grazing, like a feeding animal.
      move(sim, d, T, { dx: Math.cos(d.heading + Math.sin(d.stateTicks * 0.07) * 0.8), dz: Math.sin(d.heading + Math.sin(d.stateTicks * 0.07) * 0.8), speed: 0.02 });
      if (sim.veg.B[c] < 0.8 || d.energy >= 97) d.decideIn = 0;
      break;
    }
    case 'drink': {
      d.hydration = Math.min(100, d.hydration + DEER_DRINK_RATE);
      move(sim, d, T, { dx: 0, dz: 0, speed: 0 });
      if (d.hydration >= 99) d.decideIn = 0;
      break;
    }
    case 'rest': {
      move(sim, d, T, { dx: 0, dz: 0, speed: 0 });
      if (d.stateTicks > 60) d.decideIn = 0;
      break;
    }
    case 'mate': {
      const m = sim.byId.get(d.targetId);
      if (!m || !m.alive) { d.decideIn = 0; break; }
      const t = toward(d, m.x, m.z);
      if (t.d < 2.4) {
        const local = countNear(sim, d, 16, 'deer');
        // Crowding lowers the chance of conception (density dependence).
        const density = Math.max(0.08, 1 - local / 24);
        const q = Math.min(0.95, 0.7 * p.deerReproRate * density * (d.energy / 100));
        if (rng.chance(q)) d.pregnantDays = T.gestation;
        else d.cooldown = 1;
        d.decideIn = 0;
        move(sim, d, T, { dx: t.dx, dz: t.dz, speed: 0 });
      } else move(sim, d, T, { dx: t.dx, dz: t.dz, speed: T.trot * 0.7 * speedMul });
      break;
    }
    default: {
      // wander / seekFood / seekWater / herd: walk toward the target point
      const t = toward(d, d.tx, d.tz);
      const thirsty = d.state === 'seekWater' && d.hydration < 50;
      const hungry = d.state === 'seekFood' && d.energy < 30;
      const v = (thirsty || hungry ? T.trot * 0.8 : T.walk) * speedMul;
      if (t.d < 1.6) {
        if (d.state === 'seekFood') setState(d, 'graze');
        else if (d.state === 'seekWater') setState(d, 'drink');
        else d.decideIn = 0;
        move(sim, d, T, { dx: t.dx, dz: t.dz, speed: 0 });
      } else move(sim, d, T, { dx: t.dx, dz: t.dz, speed: v });
      if (d.state === 'herd' && d.stateTicks > 90) d.decideIn = 0;
      if (d.state === 'wander' && d.stateTicks > 120) d.decideIn = 0;
    }
  }

  // ---- Decide (utility AI)
  if (--d.decideIn > 0) return;
  d.decideIn = 8 + rng.int(0, 5);
  decideDeer(sim, d, c);
}

function countNear(sim: Ecosystem, a: Animal, r: number, s: 'deer' | 'wolf') {
  let n = 0;
  (s === 'deer' ? sim.deerHash : sim.wolfHash).query(a.x, a.z, r, (i) => {
    const b = sim.animals[i];
    if (b !== a && b.alive && Math.hypot(b.x - a.x, b.z - a.z) < r) n++;
  });
  return n;
}

function decideDeer(sim: Ecosystem, d: Animal, c: number) {
  const T = DEER;
  const rng = sim.rng;
  const hunger = 1 - d.energy / T.maxEnergy;
  const thirst = 1 - d.hydration / 100;
  const night = 1 - sim.daylight;

  // Herd context
  let nearest = Infinity, cx = 0, cz = 0, herdN = 0;
  sim.deerHash.query(d.x, d.z, 30, (i) => {
    const o = sim.animals[i];
    if (o === d || !o.alive) return;
    const dist = Math.hypot(o.x - d.x, o.z - d.z);
    if (dist > 30) return;
    nearest = Math.min(nearest, dist);
    cx += o.x; cz += o.z; herdN++;
  });

  const ready = d.sex === 'F' && isAdult(d) && d.pregnantDays < 0 && d.cooldown <= 0 && d.energy >= T.reproEnergy;
  const u = {
    // Food underfoot is cheap to take: hungry deer graze before walking off to drink.
    eat: hunger < 0.08 ? 0 : 1.3 * hunger ** 1.3 + (sim.veg.B[c] >= 1.5 && hunger > 0.4 ? 0.45 : 0),
    drink: thirst < 0.1 ? 0 : 1.8 * thirst ** 1.3,
    rest: (1 - hunger) * (0.12 + 0.5 * night) + (d.stamina < 40 ? 0.4 : 0),
    mate: ready ? 0.7 * (d.energy / 100) : 0,
    herd: herdN > 0 && nearest > 14 ? 0.38 : 0,
    wander: 0.12,
  };
  const current = d.state === 'graze' || d.state === 'seekFood' ? 'eat' : d.state === 'drink' || d.state === 'seekWater' ? 'drink' : d.state;
  if (current in u) (u as Record<string, number>)[current] += 0.08;
  const choice = (Object.keys(u) as (keyof typeof u)[]).reduce((a, b) => (u[b] > u[a] ? b : a));

  switch (choice) {
    case 'eat': {
      if (sim.veg.B[c] >= 1.5) { setState(d, 'graze'); return; }
      let cell = sim.veg.bestFoodNear(d.x, d.z, 14);
      if (cell < 0) cell = sim.veg.bestFoodNear(d.x, d.z, 40);
      if (cell >= 0) {
        const p = cellCenter(cell);
        d.tx = p.x + rng.range(-CELL * 0.4, CELL * 0.4); d.tz = p.z + rng.range(-CELL * 0.4, CELL * 0.4);
        setState(d, 'seekFood');
      } else wanderTarget(sim, d, 30);
      return;
    }
    case 'drink': {
      if (!Number.isFinite(sim.veg.waterDist[c])) { wanderTarget(sim, d, 25); return; }
      d.tx = sim.veg.nearestWaterX[c] + rng.range(-1, 1);
      d.tz = sim.veg.nearestWaterZ[c] + rng.range(-1, 1);
      setState(d, 'seekWater');
      return;
    }
    case 'rest': setState(d, 'rest'); return;
    case 'mate': {
      let best: Animal | null = null, bd = 30;
      sim.deerHash.query(d.x, d.z, 30, (i) => {
        const o = sim.animals[i];
        if (!o.alive || o.sex !== 'M' || !isAdult(o) || o.energy < 45) return;
        const dist = Math.hypot(o.x - d.x, o.z - d.z);
        if (dist < bd) { bd = dist; best = o; }
      });
      if (best) { d.targetId = (best as Animal).id; setState(d, 'mate'); }
      else if (herdN) { d.tx = cx / herdN; d.tz = cz / herdN; setState(d, 'herd'); }
      else wanderTarget(sim, d, 20);
      return;
    }
    case 'herd': d.tx = cx / herdN; d.tz = cz / herdN; setState(d, 'herd'); return;
    default: wanderTarget(sim, d, 12);
  }
}

export function wanderTarget(sim: Ecosystem, a: Animal, r: number) {
  const ang = a.heading + sim.rng.range(-1.3, 1.3);
  const dist = sim.rng.range(r * 0.4, r);
  a.tx = Math.max(-HALF + 6, Math.min(HALF - 6, a.x + Math.cos(ang) * dist));
  a.tz = Math.max(-HALF + 6, Math.min(HALF - 6, a.z + Math.sin(ang) * dist));
  setState(a, 'wander');
}

// ------------------------------------------------------------------ wolves

function nearestCarcass(sim: Ecosystem, w: Animal, r: number): Carcass | null {
  let best: Carcass | null = null, bd = r;
  for (const c of sim.carcasses) {
    if (c.meat < 2 || c.species === 'wolf') continue;
    const d = Math.hypot(c.x - w.x, c.z - w.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updateWolf(sim: Ecosystem, w: Animal) {
  const T = WOLF;
  const p = sim.params;
  const rng = sim.rng;
  w.stateTicks++;
  if (w.attemptCooldown > 0) w.attemptCooldown--;
  const pack = sim.packs.get(w.packId);
  const leader = pack ? sim.byId.get(pack.leaderId) : undefined;
  const speedMul = p.wolfSpeed * sim.weather.mobility;

  switch (w.state) {
    case 'chase': chase(sim, w, speedMul); return;
    case 'stalk': {
      const d = sim.byId.get(w.targetId);
      if (!d || !d.alive) { w.decideIn = 0; break; }
      const t = toward(w, d.x, d.z);
      if (t.d > p.wolfSensing * 1.5) { w.targetId = -1; w.decideIn = 0; break; }
      // Wolves creep in for a moment before the rush (about 2 s at 1×) unless the deer bolts first.
      if (d.state === 'flee' || (t.d < 15 && w.stateTicks >= STALK_MIN_TICKS)) { setState(w, 'chase'); chase(sim, w, speedMul); return; }
      if (t.d < 15) { move(sim, w, T, { dx: t.dx, dz: t.dz, speed: 0.12 * speedMul }); return; }
      move(sim, w, T, { dx: t.dx, dz: t.dz, speed: 0.28 * speedMul });
      return;
    }
    case 'eat': {
      const car = sim.carcasses.find((c) => c.id === w.targetId);
      if (!car || car.meat < 0.5) { w.targetId = -1; setState(w, 'rest'); w.decideIn = 30; break; }
      const t = toward(w, car.x, car.z);
      if (t.d > 1.7) { move(sim, w, T, { dx: t.dx, dz: t.dz, speed: T.trot * speedMul }); return; }
      const bite = Math.min(WOLF_EAT_RATE, car.meat, T.maxEnergy - w.energy);
      car.meat -= bite;
      w.energy += bite;
      sim.currentFlows.wolfGained += bite;
      move(sim, w, T, { dx: t.dx, dz: t.dz, speed: 0 });
      if (w.energy >= 97) { w.targetId = -1; setState(w, 'rest'); w.decideIn = 40; }
      return;
    }
    case 'rest':
    case 'recover': {
      move(sim, w, T, { dx: 0, dz: 0, speed: 0 });
      break;
    }
    case 'mate': {
      const m = sim.byId.get(w.targetId);
      if (!m || !m.alive) { w.decideIn = 0; break; }
      const t = toward(w, m.x, m.z);
      if (t.d < 2.4) {
        const crowd = (pack?.size ?? 1) > 9 ? 0.2 : 1;
        const q = Math.min(0.9, 0.45 * p.wolfReproRate * crowd * (w.energy / 100));
        if (rng.chance(q)) { w.pregnantDays = T.gestation; sim.log('info', `Wolf #${w.id} (pack ${w.packId}) is expecting.`); }
        else w.cooldown = 2;
        w.decideIn = 0;
        move(sim, w, T, { dx: t.dx, dz: t.dz, speed: 0 });
      } else move(sim, w, T, { dx: t.dx, dz: t.dz, speed: T.walk * 1.3 * speedMul });
      break;
    }
    case 'pack': {
      // Follow the leader, holding a loose formation slot.
      if (!leader || leader === w || !leader.alive) { w.decideIn = 0; move(sim, w, T, { dx: 0, dz: 0, speed: 0 }); break; }
      const slot = (w.id % 5) - 2;
      const bx = leader.x - Math.cos(leader.heading) * 3 + Math.cos(leader.heading + Math.PI / 2) * slot * 1.8;
      const bz = leader.z - Math.sin(leader.heading) * 3 + Math.sin(leader.heading + Math.PI / 2) * slot * 1.8;
      const t = toward(w, bx, bz);
      const v = t.d > 10 ? T.trot : t.d > 2 ? Math.max(leader.speed, T.walk) : leader.speed * 0.8;
      move(sim, w, T, { dx: t.dx, dz: t.dz, speed: v * speedMul });
      break;
    }
    default: {
      // patrol / search: travel toward a target point, avoiding other packs
      const t = toward(w, w.tx, w.tz);
      let dx = t.dx / (t.d || 1), dz = t.dz / (t.d || 1);
      sim.wolfHash.query(w.x, w.z, 22, (i) => {
        const o = sim.animals[i];
        if (!o.alive || o.packId === w.packId) return;
        const dist = Math.hypot(o.x - w.x, o.z - w.z);
        if (dist < 22 && dist > 1e-6) { dx += (w.x - o.x) / dist * 0.8; dz += (w.z - o.z) / dist * 0.8; }
      });
      const v = (w.state === 'search' ? T.trot * 0.85 : T.walk) * speedMul;
      move(sim, w, T, { dx, dz, speed: t.d < 2 ? 0 : v });
      if (t.d < 2) w.decideIn = Math.min(w.decideIn, 1);
    }
  }

  if (--w.decideIn > 0) return;
  w.decideIn = 6 + rng.int(0, 4);
  decideWolf(sim, w, leader);
}

function decideWolf(sim: Ecosystem, w: Animal, leader: Animal | undefined) {
  const T = WOLF;
  const p = sim.params;
  const rng = sim.rng;
  const pack = sim.packs.get(w.packId);
  const hunger = 1 - w.energy / T.maxEnergy;
  const isLeader = !leader || leader === w;
  const adult = isAdult(w);

  // Food that is already on the ground comes first.
  if (hunger > 0.12) {
    const car = nearestCarcass(sim, w, 45);
    if (car) { w.targetId = car.id; setState(w, 'eat'); return; }
  }

  // Pups follow the pack and never hunt.
  if (!adult) {
    if (leader && leader !== w && Math.hypot(leader.x - w.x, leader.z - w.z) > 4) setState(w, 'pack');
    else setState(w, 'rest');
    return;
  }

  if (hunger > 0.3) {
    // Join the pack's current hunt if there is one.
    const shared = pack && pack.targetId !== -1 ? sim.byId.get(pack.targetId) : undefined;
    if (shared && shared.alive && Math.hypot(shared.x - w.x, shared.z - w.z) < 70) {
      w.targetId = shared.id;
      setState(w, shared.state === 'flee' ? 'chase' : 'stalk');
      return;
    }
    // Look for prey directly.
    const range = p.wolfSensing * (0.75 + 0.25 * sim.daylight) * (1 - 0.3 * sim.world.forest[cellIndex(w.x, w.z)]) * (0.5 + 0.5 * sim.weather.visibility);
    let best: Animal | null = null, bestScore = 0;
    sim.deerHash.query(w.x, w.z, range, (i) => {
      const d = sim.animals[i];
      if (!d.alive) return;
      const dist = Math.hypot(d.x - w.x, d.z - w.z);
      if (dist > range) return;
      const weak = 1 + (1 - d.energy / 100) * 1.2 + (isAdult(d) ? 0 : 0.6) + (d.age > d.lifespan * 0.8 ? 0.5 : 0);
      const score = weak / (dist + 5);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    // Other prey: elk, moose (mostly calves and the weak), boar and beavers.
    for (const preyId of WOLF_PREY_IDS) sim.hashes[preyId].query(w.x, w.z, range, (i) => {
      const d = sim.animals[i];
      const link = WOLF_PREY[d.species];
      if (!link || !d.alive || d.alt > 1.5) return;
      const dist = Math.hypot(d.x - w.x, d.z - w.z);
      if (dist > range) return;
      const S = SPECIES[d.species];
      const weak = 1 + (1 - d.energy / 100) * 1.2 + (isAdult(d) ? 0 : 0.8) + (d.age > d.lifespan * 0.8 ? 0.5 : 0);
      // Big, dangerous prey is taken mainly when it is young or weak.
      const risk = isAdult(d) ? S.toughness : 1;
      const score = (weak * link * risk) / (dist + 5);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    if (best) {
      const d = best as Animal;
      w.targetId = d.id;
      if (pack) pack.targetId = d.id;
      setState(w, 'stalk');
      return;
    }
    // Follow scent: head for areas where deer have recently been common.
    if (isLeader) {
      const tgt = sim.heat.bestDeerCell(w.x, w.z, 60);
      if (tgt) { w.tx = tgt.x; w.tz = tgt.z; setState(w, 'search'); return; }
      patrolTarget(sim, w, 45);
      setState(w, 'search');
    } else setState(w, 'pack');
    return;
  }

  // Not hungry: breed, rest or patrol. Only the pack's dominant female breeds.
  if (w.sex === 'F' && pack && (pack.breederId === w.id || pack.breeder2Id === w.id) && w.pregnantDays < 0 && w.cooldown <= 0 && w.energy >= T.reproEnergy && (pack?.size ?? 1) <= 9) {
    let mate: Animal | null = null, md = 60;
    sim.wolfHash.query(w.x, w.z, 60, (i) => {
      const o = sim.animals[i];
      if (!o.alive || o.sex !== 'M' || o.packId !== w.packId || !isAdult(o)) return;
      const d = Math.hypot(o.x - w.x, o.z - w.z);
      if (d < md) { md = d; mate = o; }
    });
    if (mate) { w.targetId = (mate as Animal).id; setState(w, 'mate'); return; }
  }
  const midday = sim.daylight > 0.85;
  if (w.stamina < 55 || (midday && rng.chance(0.55)) || (w.state === 'rest' && w.stateTicks < 50)) { setState(w, 'rest'); return; }
  if (isLeader) { patrolTarget(sim, w, 38); setState(w, 'patrol'); }
  else setState(w, 'pack');
}

function patrolTarget(sim: Ecosystem, w: Animal, r: number) {
  const pack = sim.packs.get(w.packId);
  const hx = pack ? pack.homeX : w.x, hz = pack ? pack.homeZ : w.z;
  const pt = sim.randomOpenPoint(hx, hz, r);
  w.tx = pt.x; w.tz = pt.z;
}

export const STALK_MIN_TICKS = 20;
const WOLF_PREY: Partial<Record<Animal['species'], number>> = Object.fromEntries(SPECIES.wolf.prey.filter((p) => p.id !== 'deer').map((p) => [p.id, p.weight]));
const WOLF_PREY_IDS = SPECIES.wolf.prey.filter((p) => p.id !== 'deer').map((p) => p.id);
const DEER_HUNTERS = SPECIES_IDS.filter((id) => id !== 'wolf' && PREDATOR_OF.deer[id]);

/** Pursuit with lead, stamina limits, give-up rules and the capture attempt. */
function chase(sim: Ecosystem, w: Animal, speedMul: number) {
  const T = WOLF;
  const d = sim.byId.get(w.targetId);
  const pack = sim.packs.get(w.packId);
  if (!d || !d.alive) { w.targetId = -1; setState(w, 'recover'); w.decideIn = 20; return; }
  const dist = Math.hypot(d.x - w.x, d.z - w.z);

  // Give up when exhausted, outdistanced or after a long chase.
  if (w.stamina < 3 || dist > 42 || w.stateTicks > 150) {
    sim.counters.hunts.attempts++;
    if (pack && pack.leaderId === w.id) pack.targetId = -1;
    w.targetId = -1;
    setState(w, 'recover');
    w.decideIn = 35;
    move(sim, w, T, { dx: 0, dz: 0, speed: 0 });
    return;
  }

  // Lead pursuit: aim where the deer will be.
  const lead = Math.min(dist / (T.sprint * speedMul), 10);
  const px = d.x + Math.cos(d.heading) * d.speed * lead;
  const pz = d.z + Math.sin(d.heading) * d.speed * lead;
  const v = w.stamina > 0 ? T.sprint * speedMul * (0.8 + 0.2 * Math.min(1, w.energy / 40)) : T.trot * speedMul;
  move(sim, w, T, { dx: px - w.x, dz: pz - w.z, speed: v }, false);

  // Capture attempt on contact.
  if (dist < 1.5 && w.attemptCooldown === 0) {
    const p = sim.params;
    let support = 0;
    sim.wolfHash.query(d.x, d.z, 6, (i) => {
      const o = sim.animals[i];
      if (o !== w && o.alive && o.packId === w.packId && o.state === 'chase' && Math.hypot(o.x - d.x, o.z - d.z) < 6) support++;
    });
    const condition = 0.7 + 0.8 * (1 - d.energy / 100) + (isAdult(d) ? 0 : 0.45) + (d.age > d.lifespan * 0.8 ? 0.35 : 0) + (d.stamina < 20 ? 0.4 : 0);
    const packBonus = 1 + 0.35 * Math.min(3, support);
    const cover = 1 - 0.35 * sim.world.forest[cellIndex(d.x, d.z)];
    const light = sim.daylight < 0.15 ? 1 : sim.daylight < 0.85 ? 1.12 : 0.9; // dusk and dawn favour wolves
    const prob = Math.max(0.02, Math.min(0.95, p.huntSuccess * condition * packBonus * cover * light * sim.weather.capture * (isAdult(d) ? SPECIES[d.species].toughness : 1)));
    if (sim.rng.chance(prob)) {
      // A chase counts once when it ends, in a kill or a give-up.
      sim.counters.hunts.attempts++;
      sim.counters.hunts.kills++;
      w.kills++;
      sim.kill(d, 'predation', w);
      const car = sim.carcasses[sim.carcasses.length - 1];
      w.targetId = car.id;
      if (pack) pack.targetId = -1;
      setState(w, 'eat');
    } else {
      // The deer twists free: a burst of speed and adrenaline; the wolf stumbles.
      d.escapeTicks = 14;
      d.stamina = Math.min(100, d.stamina + 15);
      w.attemptCooldown = 14;
      w.stamina = Math.max(0, w.stamina - 10);
    }
  }
}
