import * as THREE from 'three';
import { Instrument, NoteParts, glowMaterial, MAT, mesh, isBlack } from './common.js';

// Concert harp C1–G7: one string per natural note (sharps and flats use the string below, as a
// pedal harp does). C strings are red and F strings blue, like a real harp. Strings shimmer when plucked.
export class Harp extends Instrument {
  constructor() {
    super({ id: 'harp', name: 'Concert harp', lo: 24, hi: 103, size: { w: 1.3, h: 1.9, d: 0.5 } });
    const strings = [];
    for (let m = this.lo; m <= this.hi; m++) if (!isBlack(m)) strings.push(m);
    const N = strings.length;
    const Z = -0.25;
    const xA = -0.4, xB = 0.53;
    const boardY = (x) => 0.22 + ((x + 0.44) / 1.02) * 1.1; // soundboard runs up diagonally
    const neckY = (x) => 1.7 - 0.24 * ((x + 0.45) / 1.0) + 0.065 * Math.sin((x + 0.45) * Math.PI * 1.8);

    this.str = this.addParts(new NoteParts(
      new THREE.CylinderGeometry(1, 1, 1, 6),
      glowMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.6 }, 'harp-str'),
      strings,
    ));
    this.geom = [];
    const red = new THREE.Color(0xc8322f), blue = new THREE.Color(0x2b3f9a), gut = new THREE.Color(0xf1e6cf);
    strings.forEach((m, i) => {
      const x = xA + (i / (N - 1)) * (xB - xA);
      const bottom = boardY(x) + 0.03, top = neckY(x) - 0.02;
      const r = 0.0045 - (i / N) * 0.0025;
      this.str.base[i].makeScale(r, top - bottom, r).setPosition(x, (top + bottom) / 2, Z);
      this.str.mesh.setColorAt(i, m % 12 === 0 ? red : m % 12 === 5 ? blue : gut);
      this.geom.push({ x, top, bottom });
    });

    const wood = MAT.wood(0x9a6232);
    const gold = MAT.gold();
    // column with a crown
    this.body.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.62, 20), wood, -0.53, 0.93, Z));
    this.body.add(mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.12, 20), gold, -0.53, 1.78, Z));
    this.body.add(mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 24), gold, -0.53, 1.84, Z));
    // neck: the curved top rail the strings hang from
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const x = -0.53 + (k / 16) * 1.14;
      pts.push(new THREE.Vector3(x, neckY(x) + 0.03, Z));
    }
    this.body.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.038, 10), wood));
    // soundboard: a long tapered box on the diagonal
    const sbLen = Math.hypot(1.02, 1.12);
    const sb = mesh(new THREE.BoxGeometry(sbLen, 0.09, 0.26), wood, 0.07, 0.77, Z);
    sb.rotation.z = Math.atan2(1.12, 1.02);
    this.body.add(sb);
    const stripe = mesh(new THREE.BoxGeometry(sbLen, 0.012, 0.03), gold, 0.05, 0.8, Z + 0.135);
    stripe.rotation.z = sb.rotation.z;
    this.body.add(stripe);
    // base with pedals
    this.body.add(mesh(new THREE.BoxGeometry(0.62, 0.14, 0.42), wood, -0.28, 0.07, Z));
    for (let p = 0; p < 7; p++) this.body.add(mesh(new THREE.BoxGeometry(0.025, 0.012, 0.06), gold, -0.52 + p * 0.07, 0.04, Z + 0.24));
    this._t = new THREE.Matrix4();
  }

  // sharps and flats sound on the natural string below
  noteFor(m) {
    return this.partOf.get(this.fold(isBlack(m) ? m - 1 : m)) ?? null;
  }

  pose(m, parts, i, lv, since, t, out) {
    out.copy(parts.base[i]);
    if (lv > 0.01) out.elements[12] += 0.006 * lv * Math.exp(-since * 1.5) * Math.sin(t * 90 + i);
    return out;
  }

  beamOrigin(m, parts, i) {
    const g = this.geom[i];
    return { x: g.x, y: g.top + 0.08, z: -0.25, w: 0.03 };
  }
}
