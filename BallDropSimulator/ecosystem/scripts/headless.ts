/**
 * Headless scenario runner: `npm run sim -- <scenario> <days> [seed]`.
 * Prints a population table so ecological behaviour can be checked without graphics.
 */
import { Ecosystem } from '../src/sim/ecosystem';
import { DEFAULT_PARAMS, DEFAULT_SETUP } from '../src/sim/params';
import { EXPERIMENTS } from '../src/sim/experiments';
import { TICKS_PER_DAY } from '../src/sim/world';
import { FAUNA_IDS } from '../src/sim/species';

const others = process.argv.includes('--all');

const [name = 'balanced', daysArg = '300', seedArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const exp = EXPERIMENTS.find((e) => e.id === name);
const setup = { ...DEFAULT_SETUP, ...(exp?.setup ?? {}), ...(seedArg ? { seed: Number(seedArg) } : {}) };
const params = { ...DEFAULT_PARAMS, ...(exp?.params ?? {}) };
const sim = new Ecosystem(setup, params);
exp?.onStart?.(sim);
const days = Number(daysArg);
const t0 = Date.now();
console.log(`scenario=${name} seed=${setup.seed} deer=${setup.initialDeer} wolves=${setup.initialWolves}`);
console.log('day   deer wolves veg%  dE   wE   births(d/w) deaths(d/w) kills/chases  deerDeathCauses');
for (let d = 0; d <= days; d++) {
  if (d % 10 === 0) {
    const c = sim.counters;
    const dc = c.deaths.deer;
    console.log(
      `${String(d).padStart(4)} ${String(sim.count('deer')).padStart(6)} ${String(sim.count('wolf')).padStart(6)} ` +
      `${sim.history.last('vegPct').toFixed(0).padStart(4)} ${sim.averageEnergy('deer').toFixed(0).padStart(4)} ${sim.averageEnergy('wolf').toFixed(0).padStart(4)} ` +
      `${String(c.births.deer).padStart(6)}/${String(c.births.wolf).padEnd(4)} ${String(sim.totalDeaths('deer')).padStart(5)}/${String(sim.totalDeaths('wolf')).padEnd(5)} ` +
      `${String(c.hunts.kills).padStart(5)}/${String(c.hunts.attempts).padEnd(6)} pred ${dc.predation} starv ${dc.starvation} thirst ${dc.dehydration} old ${dc['old age']} nat ${dc.natural}`,
    );
    if (others) console.log('      ' + FAUNA_IDS.map((id) => `${id} ${sim.count(id)}`).join(' · '));
  }
  if (d === days) break;
  for (let t = 0; t < TICKS_PER_DAY; t++) sim.step();
}
console.log(`ran ${days} days in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
