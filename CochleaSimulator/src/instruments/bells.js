import * as THREE from 'three';
import { Instrument, NoteParts, glowMaterial, MAT, mesh, isBlack } from './common.js';

// Tubular bells C4–C7: brass chimes hanging from a two-rail frame (accidentals on the back rail).
// A struck bell swings on its cord and rings with a glow.
export class TubularBells extends Instrument {
  constructor() {
    super({ id: 'bells', name: 'Tubular bells', lo: 60, hi: 96, size: { w: 1.75, h: 2.0, d: 0.6 } });
    const naturals = [], sharps = [];
    for (let m = this.lo; m <= this.hi; m++) (isBlack(m) ? sharps : naturals).push(m);
    const pitch = 0.072;
    const x0 = -((naturals.length - 1) * pitch) / 2;
    let wi = 0;
    this.hang = new Map();
    const lenOf = (m) => 1.32 - ((m - this.lo) / (this.hi - this.lo)) * 0.66;
    for (let m = this.lo; m <= this.hi; m++) {
      const black = isBlack(m);
      const x = black ? x0 + (wi - 0.5) * pitch : x0 + wi++ * pitch;
      this.hang.set(m, { x, top: black ? 1.8 : 1.74, z: black ? -0.42 : -0.2, L: lenOf(m) });
    }
    const tubeMat = () => glowMaterial({ color: 0xe2bb62, metalness: 1, roughness: 0.18 }, 'bells');
    this.nat = this.addParts(new NoteParts(new THREE.CylinderGeometry(0.021, 0.021, 1, 18), tubeMat(), naturals));
    this.shp = this.addParts(new NoteParts(new THREE.CylinderGeometry(0.021, 0.021, 1, 18), tubeMat(), sharps));
    for (const parts of [this.nat, this.shp]) {
      parts.notes.forEach((m, i) => {
        const h = this.hang.get(m);
        parts.base[i].makeScale(1, h.L, 1).setPosition(h.x, h.top - h.L / 2, h.z);
      });
    }

    // caps and cords
    const all = [...naturals, ...sharps];
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 16), MAT.brass(), all.length);
    const cords = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.002, 0.002, 1, 4), new THREE.MeshStandardMaterial({ color: 0x222 }), all.length);
    const m4 = new THREE.Matrix4();
    all.forEach((m, i) => {
      const h = this.hang.get(m);
      caps.setMatrixAt(i, m4.makeTranslation(h.x, h.top, h.z));
      cords.setMatrixAt(i, m4.makeScale(1, 0.12, 1).setPosition(h.x, h.top + 0.06, h.z));
    });
    this.body.add(caps, cords);

    // frame
    const steel = MAT.steel();
    const width = naturals.length * pitch + 0.16;
    const rail = new THREE.CylinderGeometry(0.014, 0.014, width, 10);
    rail.rotateZ(Math.PI / 2);
    this.body.add(mesh(rail, steel, 0, 1.86, -0.2), mesh(rail.clone(), steel, 0, 1.92, -0.42));
    for (const sx of [-1, 1]) {
      const px = sx * (width / 2);
      this.body.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.92, 12), steel, px, 0.96, -0.31));
      this.body.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.62), steel, px, 0.04, -0.31));
      for (const z of [-0.04, -0.58]) this.body.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), MAT.navy(), px, 0.03, z));
    }
    this.body.add(mesh(new THREE.BoxGeometry(width, 0.03, 0.03), steel, 0, 0.3, -0.31));
    this._r = new THREE.Matrix4();
  }

  pose(m, parts, i, lv, since, t, out) {
    const h = this.hang.get(m);
    const swing = since < 6 ? 0.16 * Math.exp(-since * 0.9) * Math.sin(since * 6.5) : 0;
    out.makeTranslation(h.x, h.top, h.z);
    out.multiply(this._r.makeRotationX(swing));
    out.multiply(this._r.makeScale(1, h.L, 1).setPosition(0, -h.L / 2, 0));
    return out;
  }

  beamOrigin(m) {
    const h = this.hang.get(m);
    return { x: h.x, y: h.top + 0.14, z: h.z, w: 0.02 };
  }
}
