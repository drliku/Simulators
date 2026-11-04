import * as THREE from 'three';
import { Instrument, NoteParts, glowMaterial, MAT, mesh, isBlack } from './common.js';

// Marimba A2–C7: rosewood bars (naturals in front, accidentals raised behind) over golden
// resonator tubes, on a frame with legs and castors. Bars bounce when struck.
export class Marimba extends Instrument {
  constructor() {
    super({ id: 'marimba', name: 'Marimba', lo: 45, hi: 96, size: { w: 2.2, h: 1.0, d: 1.2 } });
    const naturals = [], sharps = [];
    for (let m = this.lo; m <= this.hi; m++) (isBlack(m) ? sharps : naturals).push(m);
    const pitch = 0.064;
    const x0 = -((naturals.length - 1) * pitch) / 2;
    const xOf = new Map();
    let wi = 0;
    for (let m = this.lo; m <= this.hi; m++) {
      if (isBlack(m)) xOf.set(m, x0 + (wi - 0.5) * pitch);
      else { xOf.set(m, x0 + wi * pitch); wi++; }
    }
    const lenOf = (m) => 0.5 - ((m - this.lo) / (this.hi - this.lo)) * 0.25;
    const resOf = (m) => 0.6 - ((m - this.lo) / (this.hi - this.lo)) * 0.48;
    const Y = 0.86, ZN = -0.32, ZS = -0.84;
    this.barH = 0.026;

    const barGeo = () => new THREE.BoxGeometry(1, 1, 1);
    const wood = { color: 0x8a4428, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 };
    this.nat = this.addParts(new NoteParts(barGeo(), glowMaterial(wood, 'marimba-n'), naturals));
    this.shp = this.addParts(new NoteParts(barGeo(), glowMaterial(wood, 'marimba-s'), sharps));
    naturals.forEach((m, i) => this.nat.base[i].makeScale(0.054, this.barH, lenOf(m)).setPosition(xOf.get(m), Y, ZN));
    sharps.forEach((m, i) => this.shp.base[i].makeScale(0.054, this.barH, lenOf(m)).setPosition(xOf.get(m), Y + 0.035, ZS));

    // resonators hang under every bar
    const all = [...naturals, ...sharps];
    const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 14), MAT.gold(), all.length);
    const m4 = new THREE.Matrix4();
    all.forEach((m, i) => {
      const r = resOf(m);
      const z = isBlack(m) ? ZS : ZN;
      tubes.setMatrixAt(i, m4.makeScale(1, r, 1).setPosition(xOf.get(m), Y - 0.06 - r / 2, z));
    });
    this.body.add(tubes);

    // frame: rails under each row, end frames, legs with castors
    const dark = MAT.wood(0x3a2116);
    const span = naturals.length * pitch + 0.12;
    for (const [z, y] of [[ZN - 0.18, Y - 0.03], [ZN + 0.18, Y - 0.03], [ZS - 0.12, Y + 0.005], [ZS + 0.12, Y + 0.005]]) {
      this.body.add(mesh(new THREE.BoxGeometry(span, 0.03, 0.03), dark, 0, y, z));
    }
    for (const sx of [-1, 1]) {
      const ex = sx * (span / 2 + 0.02);
      this.body.add(mesh(new THREE.BoxGeometry(0.05, 0.06, 1.0), dark, ex, Y - 0.05, (ZN + ZS) / 2));
      for (const z of [ZN + 0.12, ZS - 0.08]) {
        this.body.add(mesh(new THREE.BoxGeometry(0.045, Y - 0.08, 0.045), dark, ex, (Y - 0.08) / 2 + 0.05, z));
        this.body.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), MAT.steel(), ex, 0.035, z));
      }
      this.body.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), dark, ex, 0.18, (ZN + ZS) / 2));
    }
    this.body.add(mesh(new THREE.BoxGeometry(span, 0.035, 0.035), dark, 0, 0.18, (ZN + ZS) / 2));
    this.xOf = xOf;
    this._t = new THREE.Matrix4();
  }

  pose(m, parts, i, lv, since, t, out) {
    out.copy(parts.base[i]);
    if (since < 1) out.elements[13] -= 0.012 * Math.exp(-since * 14) * Math.cos(since * 40);
    return out;
  }

  beamOrigin(m, parts, i) {
    const e = parts.base[i].elements;
    return { x: e[12], y: e[13] + this.barH, z: e[14], w: 0.02 };
  }
}
