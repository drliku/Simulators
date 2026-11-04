import { describe, expect, it } from 'vitest';
import { Ecosystem } from './ecosystem';
import { DEFAULT_PARAMS, DEFAULT_SETUP, NO_FAUNA, type Params, type Setup } from './params';
import { FAUNA_IDS, SPECIES, SPECIES_IDS } from './species';
import { DEER_ENERGY_PER_BIOMASS } from './agents';
import { HALF, TICKS_PER_DAY } from './world';

const run = (sim: Ecosystem, days: number) => { for (let t = 0; t < days * TICKS_PER_DAY; t++) sim.step(); };
/** Deer, wolves and plants only (the core model), unless other species are asked for. */
const make = (setup: Partial<Setup> = {}, params: Partial<Params> = {}) =>
  new Ecosystem({ ...DEFAULT_SETUP, fauna: NO_FAUNA, ...setup }, { ...DEFAULT_PARAMS, ...params });
/** The full fourteen-species forest. */
const full = (setup: Partial<Setup> = {}, params: Partial<Params> = {}) =>
  new Ecosystem({ ...DEFAULT_SETUP, ...setup }, { ...DEFAULT_PARAMS, ...params });

describe('ecological rules', () => {
  it('deer cannot survive without food', () => {
    const sim = make({ initialDeer: 40, initialWolves: 0 }, { vegGrowth: 0 });
    sim.veg.B.fill(0);
    run(sim, 40);
    expect(sim.count('deer')).toBe(0);
    expect(sim.counters.deaths.deer.starvation).toBeGreaterThan(0);
  });

  it('wolves gain energy only by eating meat', () => {
    const sim = make({ initialDeer: 0, initialWolves: 12 });
    let gained = 0;
    for (let t = 0; t < 30 * TICKS_PER_DAY; t++) {
      const before = new Map(sim.animals.map((a) => [a.id, a.energy]));
      sim.step();
      for (const a of sim.animals) if ((before.get(a.id) ?? Infinity) < a.energy) gained++;
    }
    expect(gained).toBe(0);
    expect(sim.currentFlows.wolfGained).toBe(0);
    run(sim, 30);
    expect(sim.count('wolf')).toBe(0);
    expect(sim.counters.deaths.wolf.starvation).toBeGreaterThan(0);
  });

  it('vegetation regrows only when conditions allow', () => {
    const still = make({ initialDeer: 0, initialWolves: 0 }, { vegGrowth: 0 });
    still.veg.fill(0.2);
    const t0 = still.veg.total();
    run(still, 10);
    expect(still.veg.total()).toBeCloseTo(t0, 6);

    const dry = make({ initialDeer: 0, initialWolves: 0 }, { drought: 1, water: 0 });
    dry.veg.fill(0.2);
    const d0 = dry.veg.total();
    run(dry, 10);
    expect(dry.veg.total()).toBeCloseTo(d0, 6);

    const wet = make({ initialDeer: 0, initialWolves: 0 });
    wet.veg.fill(0);
    run(wet, 10);
    expect(wet.veg.total()).toBeGreaterThan(0);
  });

  it('reproduction costs energy and is limited by food', () => {
    const sim = make({ initialDeer: 60, initialWolves: 0 }, { vegGrowth: 0 });
    sim.veg.B.fill(0);
    run(sim, 60);
    // With no food there is no lasting growth: births cannot outpace starvation.
    expect(sim.count('deer')).toBe(0);
    const fed = make({ initialDeer: 60, initialWolves: 0 });
    run(fed, 60);
    expect(fed.counters.births.deer).toBeGreaterThan(0);
    // Energy gained by deer came from plants eaten.
    const f = fed.recentFlows(5);
    expect(f.deerGained).toBeCloseTo(f.vegEaten * DEER_ENERGY_PER_BIOMASS, 6);
  });

  it('counters match the living agents and every death is recorded once (all species)', () => {
    const sim = full({}, { immigration: 1 });
    const seen = new Set<number>();
    const kill = sim.kill.bind(sim);
    let duplicate = false;
    sim.kill = (a, cause, by) => { if (a.alive) { if (seen.has(a.id)) duplicate = true; seen.add(a.id); } kill(a, cause, by); };
    run(sim, 30);
    sim.remove('deer', 5);
    sim.remove('lynx', 'all');
    run(sim, 5);
    expect(duplicate).toBe(false);
    for (const s of SPECIES_IDS) {
      const started = s === 'deer' ? sim.setup.initialDeer : s === 'wolf' ? sim.setup.initialWolves : sim.setup.fauna[s];
      const expected = started + sim.counters.births[s] + sim.counters.added[s] - sim.totalDeaths(s) - sim.counters.removed[s];
      expect(sim.count(s)).toBe(expected);
      expect(sim.animals.filter((a) => a.species === s).length).toBe(expected);
    }
    expect(sim.animals.every((a) => a.alive)).toBe(true);
  });

  it('animals stay inside the world', () => {
    const sim = full();
    run(sim, 30);
    for (const a of sim.animals) {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(HALF - 1);
      expect(Math.abs(a.z)).toBeLessThanOrEqual(HALF - 1);
    }
  });

  it('identical seeds and inputs reproduce identical runs; different seeds differ', () => {
    const a = make({ seed: 42 }), b = make({ seed: 42 }), c = make({ seed: 43 });
    for (const s of [a, b, c]) { run(s, 20); s.addWolves(3); run(s, 10); }
    expect(a.history.data.deer).toEqual(b.history.data.deer);
    expect(a.history.data.wolves).toEqual(b.history.data.wolves);
    expect(a.animals.map((x) => x.x)).toEqual(b.animals.map((x) => x.x));
    expect(c.history.data.deer).not.toEqual(a.history.data.deer);
  });

  it('reset restores the initial conditions exactly', () => {
    const sim = make({ seed: 11 });
    const first = sim.animals.map((a) => [a.id, a.x, a.z, a.energy]);
    run(sim, 15);
    sim.reset();
    expect(sim.tick).toBe(0);
    expect(sim.animals.map((a) => [a.id, a.x, a.z, a.energy])).toEqual(first);
    expect(sim.counters.births.deer).toBe(0);
  });

  it('extinction is handled without errors', () => {
    const sim = make({ initialDeer: 10, initialWolves: 0 });
    sim.remove('deer', 'all');
    run(sim, 3);
    expect(sim.count('deer')).toBe(0);
    expect(sim.extinct.deer).toBeGreaterThanOrEqual(0);
    sim.addDeer(5);
    run(sim, 1);
    expect(sim.count('deer')).toBeGreaterThan(0);
  });
});

describe('runtime controller', () => {
  it('speed changes how many ticks run, not the rules; pause freezes', async () => {
    const { Controller } = await import('../runtime/controller');
    const slow = new Controller(), fast = new Controller();
    slow.setSpeed(1); fast.setSpeed(10);
    for (let i = 0; i < 100; i++) slow.frame(0.1, i * 100);
    for (let i = 0; i < 10; i++) fast.frame(0.1, i * 100);
    // Same seed and same number of ticks → same state.
    expect(fast.sim.tick).toBe(slow.sim.tick);
    expect(fast.sim.animals.map((a) => a.x)).toEqual(slow.sim.animals.map((a) => a.x));
    fast.pause();
    const t = fast.sim.tick;
    fast.frame(1, 5000);
    expect(fast.sim.tick).toBe(t);
  });

  it('weather at 0% stays clear; weather on changes and stays within bounds', () => {
    const calm = make({}, { weather: 0 });
    run(calm, 20);
    expect(calm.weather.kind).toBe('clear');
    expect(calm.weather.mix.rain).toBe(0);
    const wild = make({}, { weather: 1 });
    const kinds = new Set<string>();
    for (let d = 0; d < 60; d++) {
      run(wild, 1);
      kinds.add(wild.weather.kind);
      for (const v of Object.values(wild.weather.mix)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(wild.weather.visibility).toBeGreaterThan(0.2);
    }
    expect(kinds.size).toBeGreaterThan(2);
  });

  it('hunt tracker agrees with the kill counter and announces hunts before they end', () => {
    const sim = make();
    run(sim, 25);
    const kills = sim.hunts.results.filter((r) => r.outcome === 'kill').length;
    // Results are capped at the last 30; the counter covers the whole run.
    if (sim.counters.hunts.kills <= 30 && sim.hunts.resultSeq <= 30) expect(kills).toBe(sim.counters.hunts.kills);
    expect(sim.hunts.startSeq).toBeGreaterThanOrEqual(sim.hunts.resultSeq);
    for (const r of sim.hunts.results) expect(['kill', 'escaped', 'called off']).toContain(r.outcome);
  });

});

describe('the wider fauna', () => {
  const forest = full({ seed: 5 });
  run(forest, 30.5); // ends at midday

  it('every kill follows the food web, and kill records match predation deaths', () => {
    for (const pred of SPECIES_IDS) {
      for (const [prey, n] of Object.entries(forest.counters.predation[pred])) {
        expect(SPECIES[pred].prey.map((p) => p.id)).toContain(prey);
        expect(n).toBeGreaterThan(0);
      }
    }
    for (const s of SPECIES_IDS) {
      const recorded = SPECIES_IDS.reduce((sum, p) => sum + (forest.counters.predation[p][s] ?? 0), 0);
      expect(recorded).toBe(forest.counters.deaths[s].predation);
    }
    // Several different predators actually hunted in 30 days.
    const hunters = SPECIES_IDS.filter((p) => Object.keys(forest.counters.predation[p]).length > 0);
    expect(hunters.length).toBeGreaterThanOrEqual(4);
  });

  it('every species is still present after 30 days', () => {
    for (const id of SPECIES_IDS) expect(forest.count(id)).toBeGreaterThan(0);
  });

  it('birds fly and land; nothing else leaves the ground', () => {
    const birds = forest.animals.filter((a) => a.species === 'eagle' || a.species === 'raven');
    expect(birds.some((b) => b.alt > 5)).toBe(true);
    for (const a of forest.animals) if (!SPECIES[a.species].flies) expect(a.alt).toBe(0);
  });

  it('bears hibernate through winter and wake in spring', () => {
    const sim = make({ initialDeer: 40, initialWolves: 0, fauna: { ...NO_FAUNA, bear: 4 } }, { immigration: 0 });
    run(sim, 72); // mid-winter
    const bears = sim.animals.filter((a) => a.species === 'bear');
    expect(bears.length).toBeGreaterThan(0);
    expect(bears.filter((b) => b.state === 'hibernate').length).toBeGreaterThanOrEqual(Math.ceil(bears.length / 2));
    run(sim, 26); // spring
    expect(sim.animals.filter((a) => a.species === 'bear' && a.state === 'hibernate').length).toBe(0);
  });

  it('hares without predators stay bounded by territory and food', () => {
    const sim = make({ initialDeer: 0, initialWolves: 0, fauna: { ...NO_FAUNA, hare: 120 } }, { immigration: 0 });
    run(sim, 60);
    expect(sim.count('hare')).toBeGreaterThan(20);
    expect(sim.count('hare')).toBeLessThan(700);
  });

  it('immigration revives only the wider fauna, never deer or wolves; 0% keeps populations closed', () => {
    const open = make({ initialDeer: 30, initialWolves: 0, fauna: { ...NO_FAUNA, lynx: 2 } }, { immigration: 1 });
    open.remove('lynx', 'all');
    run(open, 80);
    expect(open.counters.added.lynx).toBeGreaterThan(0);
    expect(open.count('wolf')).toBe(0);
    const closed = make({ initialDeer: 30, initialWolves: 0, fauna: { ...NO_FAUNA, lynx: 2 } }, { immigration: 0 });
    closed.remove('lynx', 'all');
    run(closed, 40);
    expect(closed.count('lynx')).toBe(0);
    expect(closed.counters.added.lynx).toBe(0);
    for (const id of FAUNA_IDS) if (id !== 'lynx') expect(closed.count(id)).toBe(0);
  });
});
