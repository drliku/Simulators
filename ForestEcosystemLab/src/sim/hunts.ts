/**
 * Watches every predator and groups them into hunts, so the interface can announce a hunt before
 * it happens and show how it ends. It only observes: it never changes the simulation or draws
 * random numbers.
 *
 * A hunt exists while at least one predator is stalking or chasing a living animal. It starts in
 * the stalk phase (closing in unseen), switches to chase when a hunter breaks into a run, and
 * ends in a kill, an escape (a chase that failed) or is called off (never chased).
 */
import type { Species } from './agents';
import { SPECIES } from './species';
import type { Ecosystem } from './ecosystem';

export type HuntPhase = 'stalk' | 'chase';
export type HuntOutcome = 'kill' | 'escaped' | 'called off';

export interface Hunt {
  id: number;
  /** The hunted animal (named deerId for history; it can be any prey species). */
  deerId: number;
  prey: Species;
  predator: Species;
  packId: number;
  wolfIds: number[];
  phase: HuntPhase;
  startTick: number;
  chaseTick: number;
  /** Distance from the nearest hunting wolf to the deer (m). */
  gap: number;
  x: number; z: number;
}

export interface HuntResult { id: number; seq: number; deerId: number; prey: Species; predator: Species; packId: number; outcome: HuntOutcome; x: number; z: number; tick: number; wolves: number; byWolf: number }

export class HuntTracker {
  active = new Map<number, Hunt>();
  results: HuntResult[] = [];
  /** Increments with every finished hunt, and with every hunt that starts. */
  resultSeq = 0;
  startSeq = 0;
  chaseSeq = 0;
  private nextId = 1;

  update(sim: Ecosystem) {
    const seen = new Set<number>();
    for (const w of sim.animals) {
      if (!w.alive || (w.state !== 'stalk' && w.state !== 'chase')) continue;
      const d = sim.byId.get(w.targetId);
      if (!d || !d.alive || d.species === w.species) continue;
      let h = this.active.get(d.id);
      if (!h) {
        h = { id: this.nextId++, deerId: d.id, prey: d.species, predator: w.species, packId: w.packId, wolfIds: [], phase: 'stalk', startTick: sim.tick, chaseTick: -1, gap: Infinity, x: d.x, z: d.z };
        this.active.set(d.id, h);
        this.startSeq++;
      }
      if (!seen.has(d.id)) { seen.add(d.id); h.wolfIds = []; h.gap = Infinity; }
      h.wolfIds.push(w.id);
      h.gap = Math.min(h.gap, Math.hypot(w.x - d.x, w.z - d.z));
      h.x = d.x; h.z = d.z;
      if (w.state === 'chase' && h.phase === 'stalk') { h.phase = 'chase'; h.chaseTick = sim.tick; this.chaseSeq++; }
    }
    for (const [deerId, h] of this.active) {
      if (seen.has(deerId)) continue;
      this.active.delete(deerId);
      const d = sim.byId.get(deerId);
      const killed = !!d && !d.alive && d.cause === 'predation';
      const outcome: HuntOutcome = killed ? 'kill' : h.phase === 'chase' ? 'escaped' : 'called off';
      let byWolf = -1;
      if (killed) for (const id of h.wolfIds) { const w = sim.byId.get(id); if (w && w.state === 'eat') { byWolf = id; break; } }
      this.results.push({ id: h.id, seq: ++this.resultSeq, deerId, prey: h.prey, predator: h.predator, packId: h.packId, outcome, x: d?.x ?? h.x, z: d?.z ?? h.z, tick: sim.tick, wolves: h.wolfIds.length, byWolf });
      if (this.results.length > 30) this.results.shift();
    }
  }

  /** The hunt most worth watching: chases before stalks, big game before small, then the closest. */
  focus(): Hunt | undefined {
    let best: Hunt | undefined, bestScore = -Infinity;
    for (const h of this.active.values()) {
      const score = (h.phase === 'chase' ? 100 : 0) + 8 * Math.log1p(SPECIES[h.prey].traits.bodyMeat) + (h.predator === 'wolf' ? 6 : 0) - h.gap * 0.2;
      if (score > bestScore) { bestScore = score; best = h; }
    }
    return best;
  }
}
