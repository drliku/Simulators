import * as THREE from 'three';
import { Instrument, MAT, mesh, buildKeyboard, keyPose } from './common.js';

// Stage synth C2–C7: slim 61-key keyboard with a glowing coral LED strip, a little screen and
// knobs, on a crossed X-stand.
export class StageSynth extends Instrument {
  constructor() {
    super({ id: 'synth', name: 'Synth', lo: 36, hi: 96, size: { w: 1.15, h: 1.0, d: 0.5 } });
    const top = 0.92;
    const kb = buildKeyboard(this, 36, 96, { white: 0.026, top, key: 'synth' });
    this.kb = kb;
    const body = MAT.navy();
    const w = kb.width + 0.14;
    this.body.add(mesh(new THREE.BoxGeometry(w, 0.07, kb.depth + 0.16), body, 0, top - 0.045, -(kb.depth + 0.16) / 2 + 0.01));
    this.body.add(mesh(new THREE.BoxGeometry(w, 0.05, 0.14), body, 0, top + 0.0, -kb.depth - 0.08));
    const led = mesh(new THREE.BoxGeometry(w - 0.04, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f3735f').multiplyScalar(2.2), toneMapped: false }), 0, top + 0.027, -kb.depth - 0.012);
    this.body.add(led);
    this.body.add(mesh(new THREE.BoxGeometry(0.16, 0.004, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ec4b6').multiplyScalar(1.4), toneMapped: false }), 0, top + 0.027, -kb.depth - 0.08));
    for (let k = 0; k < 6; k++) {
      this.body.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14), MAT.steel(), -w / 2 + 0.1 + k * 0.05, top + 0.035, -kb.depth - 0.08));
    }
    // X-stand
    const steel = MAT.steel();
    for (const sx of [-1, 1]) {
      for (const dir of [-1, 1]) {
        const leg = mesh(new THREE.BoxGeometry(0.03, 1.16, 0.03), steel, sx * (w / 2 - 0.12), top / 2 - 0.02, -0.2);
        leg.rotation.x = dir * 0.62;
        this.body.add(leg);
      }
      this.body.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10), MAT.gold(), sx * (w / 2 - 0.12), top / 2 - 0.02, -0.2));
    }
    const bar = new THREE.CylinderGeometry(0.014, 0.014, w - 0.24, 10);
    bar.rotateZ(Math.PI / 2);
    this.body.add(mesh(bar, steel, 0, top / 2 - 0.02, -0.2));
    this._t = new THREE.Matrix4();
  }

  pose(m, parts, i, lv, since, t, out) {
    return keyPose(parts, i, lv, parts === this.kb.whiteParts ? this.kb.W.d : this.kb.B.d, out, this._t);
  }

  beamOrigin(m, parts, i) {
    const e = parts.base[i].elements;
    const d = parts === this.kb.whiteParts ? this.kb.W.d : this.kb.B.d;
    return { x: e[12], y: e[13] + 0.02, z: e[14] - d / 2 + 0.01, w: parts === this.kb.whiteParts ? 0.012 : 0.008 };
  }
}
