import * as THREE from 'three';
import { Instrument, NoteParts, glowMaterial, MAT, mesh } from './common.js';

// Pipe organ C2–C7: a façade of 61 metal pipes on a wooden case, longest pipes in the middle
// fanning out to the shortest at the sides. Each pipe glows while its note sounds.
export class PipeOrgan extends Instrument {
  constructor() {
    super({ id: 'organ', name: 'Pipe organ', lo: 36, hi: 96, size: { w: 2.7, h: 2.65, d: 0.6 } });
    const notes = [];
    for (let m = this.lo; m <= this.hi; m++) notes.push(m);
    const lenOf = (m) => 1.5 * 2 ** (-(m - this.lo) / 26);
    const radOf = (m) => 0.034 * 2 ** (-(m - this.lo) / 52);
    const caseH = 0.95, footH = 0.14, Z = -0.22;

    // slots from the centre outward, alternating sides; longest pipes take the middle
    const byLength = [...notes].sort((a, b) => lenOf(b) - lenOf(a));
    const spacing = 0.042;
    const slotX = byLength.map((_, k) => (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * spacing));
    const xOf = new Map(byLength.map((m, k) => [m, slotX[k]]));

    this.pipes = this.addParts(new NoteParts(
      new THREE.CylinderGeometry(1, 1, 1, 18),
      glowMaterial({ color: 0xd3d8e2, metalness: 0.95, roughness: 0.22 }, 'organ-pipe'),
      notes,
    ));
    const feet = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 0.25, 1, 18), MAT.steel(), notes.length);
    const mouths = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 1 }), notes.length);
    const m4 = new THREE.Matrix4();
    this.top = new Map();
    notes.forEach((m, i) => {
      const L = lenOf(m), r = radOf(m), x = xOf.get(m);
      const y0 = caseH + footH;
      this.pipes.base[i].makeScale(r, L, r).setPosition(x, y0 + L / 2, Z);
      feet.setMatrixAt(i, m4.makeScale(r, footH, r).setPosition(x, caseH + footH / 2, Z));
      mouths.setMatrixAt(i, m4.makeScale(r * 1.1, r * 0.9, 0.004).setPosition(x, y0 + r * 0.6, Z + r * 0.98));
      this.top.set(m, { x, y: y0 + L, w: r * 1.6 });
    });
    this.body.add(feet, mouths);

    // case with panels, cornice and side towers
    const wood = MAT.wood(0x5a321e);
    const width = (notes.length + 1) * spacing + 0.16;
    this.body.add(mesh(new THREE.BoxGeometry(width, caseH, 0.5), wood, 0, caseH / 2, Z));
    this.body.add(mesh(new THREE.BoxGeometry(width + 0.08, 0.06, 0.56), MAT.gold(), 0, caseH + 0.01, Z));
    for (let p = 0; p < 5; p++) {
      const panel = mesh(new THREE.BoxGeometry(width / 5 - 0.08, caseH - 0.25, 0.02), MAT.wood(0x704026), -width / 2 + (p + 0.5) * (width / 5), caseH / 2, Z + 0.255);
      this.body.add(panel);
    }
    for (const sx of [-1, 1]) {
      this.body.add(mesh(new THREE.BoxGeometry(0.1, caseH + 0.9, 0.52), wood, sx * (width / 2 + 0.05), (caseH + 0.9) / 2, Z));
      this.body.add(mesh(new THREE.ConeGeometry(0.08, 0.22, 4), MAT.gold(), sx * (width / 2 + 0.05), caseH + 1.01, Z));
    }
  }

  beamOrigin(m) {
    const t = this.top.get(m);
    return { x: t.x, y: t.y, z: -0.22, w: t.w };
  }
}
