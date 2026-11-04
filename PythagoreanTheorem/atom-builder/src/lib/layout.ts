/**
 * Scene layout: nucleon packing and shell radii (scene units, not to scale).
 */

export const NUCLEON_RADIUS = 0.3;

type V3 = [number, number, number];

/**
 * Points of a face-centred cubic lattice sorted by distance from the centre,
 * so the first N points form a compact, roughly spherical cluster.
 */
const LATTICE: V3[] = (() => {
  const pts: { p: V3; d: number }[] = [];
  const R = 6;
  const s = NUCLEON_RADIUS * 2 * 0.97 / Math.SQRT2;
  for (let x = -R; x <= R; x++)
    for (let y = -R; y <= R; y++)
      for (let z = -R; z <= R; z++) {
        if ((x + y + z) % 2 !== 0) continue; // FCC: even coordinate sum
        // A tiny deterministic offset breaks ties so growth looks organic.
        const p: V3 = [x * s, y * s, z * s];
        const d = Math.hypot(...p) + ((x * 7 + y * 13 + z * 29) % 11) * 1e-4;
        pts.push({ p, d });
      }
  pts.sort((a, b) => a.d - b.d);
  // Re-centre a 1-nucleon nucleus etc. on the cluster's centre of mass when used.
  return pts.map((q) => q.p);
})();

/** Slot positions for `count` nucleons, centred on the origin. */
export function nucleusSlots(count: number): V3[] {
  const pts = LATTICE.slice(0, count);
  if (count === 0) return pts;
  const c = pts.reduce<V3>((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / count) as V3;
  return pts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]] as V3);
}

export function nucleusRadius(count: number): number {
  if (count <= 0) return NUCLEON_RADIUS;
  const slots = nucleusSlots(count);
  return Math.max(...slots.map((p) => Math.hypot(...p))) + NUCLEON_RADIUS;
}

/**
 * Interleave protons and neutrons through the slots so both colours are mixed
 * evenly (like a Bresenham line), returning the kind for each slot index.
 */
export function slotKinds(protons: number, neutrons: number): ('p' | 'n')[] {
  const total = protons + neutrons;
  const out: ('p' | 'n')[] = [];
  let p = 0;
  for (let i = 0; i < total; i++) {
    const wantP = Math.round(((i + 1) * protons) / total);
    if (wantP > p) {
      out.push('p');
      p++;
    } else out.push('n');
  }
  return out;
}

export const SHELL_GAP = 1.05;

export function shellRadius(index: number, nucleusR: number): number {
  return nucleusR + 1.25 + index * SHELL_GAP;
}
