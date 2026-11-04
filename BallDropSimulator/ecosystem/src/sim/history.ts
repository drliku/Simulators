import type { Ecosystem } from './ecosystem';
import { SPECIES_IDS, type SpeciesId } from './species';

export const SERIES = ['day', 'deer', 'wolves', 'veg', 'vegPct', 'deerEnergy', 'wolfEnergy', 'deerBirths', 'wolfBirths', 'deerDeaths', 'wolfDeaths', 'kills'] as const;
export type SeriesKey = (typeof SERIES)[number];

/** Population time series sampled every half day. Long runs are thinned to stay bounded. */
export class History {
  data: Record<SeriesKey, number[]> = Object.fromEntries(SERIES.map((k) => [k, []])) as unknown as Record<SeriesKey, number[]>;
  /** Samples between recorded points (doubles each time the buffer is thinned). */
  stride = 1;
  /** Population of every species, sampled with the main series. */
  species: Record<SpeciesId, number[]> = Object.fromEntries(SPECIES_IDS.map((k) => [k, []])) as unknown as Record<SpeciesId, number[]>;
  private skip = 0;
  static MAX = 4000;

  get length() { return this.data.day.length; }

  record(sim: Ecosystem) {
    if (this.skip > 0) { this.skip--; return; }
    this.skip = this.stride - 1;
    const c = sim.counters;
    const row: Record<SeriesKey, number> = {
      day: sim.day,
      deer: sim.count('deer'),
      wolves: sim.count('wolf'),
      veg: sim.veg.total(),
      vegPct: (100 * sim.veg.total()) / Math.max(1e-9, sim.veg.totalCapacity()),
      deerEnergy: sim.averageEnergy('deer'),
      wolfEnergy: sim.averageEnergy('wolf'),
      deerBirths: c.births.deer,
      wolfBirths: c.births.wolf,
      deerDeaths: sim.totalDeaths('deer'),
      wolfDeaths: sim.totalDeaths('wolf'),
      kills: c.hunts.kills,
    };
    for (const k of SERIES) this.data[k].push(row[k]);
    const counts = Object.fromEntries(SPECIES_IDS.map((k) => [k, 0])) as Record<SpeciesId, number>;
    for (const a of sim.animals) if (a.alive) counts[a.species]++;
    for (const k of SPECIES_IDS) this.species[k].push(counts[k]);
    if (this.length > History.MAX) {
      for (const k of SERIES) this.data[k] = this.data[k].filter((_, i) => i % 2 === 0);
      for (const k of SPECIES_IDS) this.species[k] = this.species[k].filter((_, i) => i % 2 === 0);
      this.stride *= 2;
    }
  }

  last(k: SeriesKey) { const a = this.data[k]; return a[a.length - 1] ?? 0; }

  /** Value `days` ago (nearest sample), for trend arrows and rate estimates. */
  /** Population of a species `days` ago (nearest sample). */
  speciesAgo(k: SpeciesId, days: number) {
    const d = this.data.day;
    const target = d[d.length - 1] - days;
    let i = d.length - 1;
    while (i > 0 && d[i] > target) i--;
    return this.species[k][i] ?? 0;
  }

  ago(k: SeriesKey, days: number) {
    const d = this.data.day;
    const target = d[d.length - 1] - days;
    let i = d.length - 1;
    while (i > 0 && d[i] > target) i--;
    return this.data[k][i] ?? 0;
  }
}
