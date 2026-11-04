import type { Controller } from '../runtime/controller';

/** Measurable outcomes for the active experiment, computed from history since it began. */
export function experimentOutcomes(ctl: Controller): { label: string; value: string }[] {
  const exp = ctl.experiment;
  if (!exp) return [];
  const sim = ctl.sim;
  const h = sim.history.data;
  const from = Math.min(exp.historyIndex, Math.max(0, h.day.length - 1));
  const slice = (k: 'deer' | 'wolves' | 'vegPct') => h[k].slice(from);
  const days = h.day.slice(from);
  const argmax = (a: number[]) => a.reduce((bi, v, i) => (v > a[bi] ? i : bi), 0);
  const argmin = (a: number[]) => a.reduce((bi, v, i) => (v < a[bi] ? i : bi), 0);
  const deer = slice('deer'), wolves = slice('wolves'), veg = slice('vegPct');
  if (!deer.length) return [];
  const c = sim.counters;
  const d = (k: string, s: 'deer' | 'wolf') => (c.deaths[s] as Record<string, number>)[k] - (exp.deaths[s][k] ?? 0);
  const elapsed = sim.day - exp.startDay;
  const iMaxD = argmax(deer), iMinD = argmin(deer), iMaxW = argmax(wolves), iMinV = argmin(veg);
  const extinct = (s: 'deer' | 'wolf') => (sim.extinct[s] >= 0 ? `day ${sim.extinct[s].toFixed(0)}` : 'no');
  const below30 = veg.findIndex((v) => v < 30);
  return [
    { label: 'Days elapsed', value: elapsed.toFixed(1) },
    { label: 'Peak deer', value: `${deer[iMaxD]} (day ${days[iMaxD].toFixed(0)})` },
    { label: 'Lowest deer', value: `${deer[iMinD]} (day ${days[iMinD].toFixed(0)})` },
    { label: 'Peak wolves', value: `${wolves[iMaxW]} (day ${days[iMaxW].toFixed(0)})` },
    { label: 'Lowest vegetation', value: `${veg[iMinV].toFixed(0)}% (day ${days[iMinV].toFixed(0)})` },
    { label: 'Vegetation first < 30%', value: below30 >= 0 ? `day ${days[below30].toFixed(0)}` : 'not yet' },
    { label: 'Deer killed by wolves', value: String(c.hunts.kills - exp.kills) },
    { label: 'Deer starved / dehydrated', value: `${d('starvation', 'deer')} / ${d('dehydration', 'deer')}` },
    { label: 'Wolves starved', value: String(d('starvation', 'wolf')) },
    { label: 'Births deer / wolves', value: `${c.births.deer - exp.births.deer} / ${c.births.wolf - exp.births.wolf}` },
    { label: 'Deer extinct?', value: extinct('deer') },
    { label: 'Wolves extinct?', value: extinct('wolf') },
  ];
}
