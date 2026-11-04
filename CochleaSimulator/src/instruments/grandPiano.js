import * as THREE from 'three';
import { Instrument, MAT, mesh, buildKeyboard, keyPose } from './common.js';

// Grand piano (instrument units ≈ metres): curved case on three legs, lid propped open,
// pedal lyre and music stand. Keyboard faces the viewer (front edge at z = 0).
export class GrandPiano extends Instrument {
  constructor() {
    super({ id: 'piano', name: 'Grand piano', lo: 21, hi: 108, size: { w: 1.6, h: 1.4, d: 2.0 } });
    const gloss = MAT.gloss();
    const gold = MAT.gold();
    const caseBottom = 0.5, caseH = 0.26, top = 0.74;

    // case outline (x across, s = distance back from the keyboard); bass side straight, treble side curved
    const outline = new THREE.Shape();
    outline.moveTo(-0.76, 0.14);
    outline.lineTo(0.76, 0.14);
    outline.lineTo(0.76, 0.5);
    outline.bezierCurveTo(0.76, 0.95, 0.2, 1.05, 0.1, 1.5);
    outline.bezierCurveTo(0.02, 1.85, -0.3, 1.95, -0.55, 1.95);
    outline.quadraticCurveTo(-0.76, 1.95, -0.76, 1.75);
    outline.lineTo(-0.76, 0.14);
    const shapeGeo = (depth) => {
      const g = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 32 });
      g.rotateX(-Math.PI / 2); // shape (x, s) -> world (x, z = -s), extruded upward
      return g;
    };
    this.body.add(mesh(shapeGeo(caseH), gloss, 0, caseBottom, 0));

    // soundboard + golden frame visible under the open lid
    const inner = new THREE.ShapeGeometry(outline, 32);
    inner.rotateX(-Math.PI / 2);
    const board = mesh(inner, MAT.wood(0xb98a52), 0, caseBottom + caseH - 0.04, 0);
    board.scale.set(0.96, 1, 0.97);
    const frame = mesh(inner.clone(), gold, 0, caseBottom + caseH - 0.03, -0.03);
    frame.scale.set(0.82, 1, 0.84);
    this.body.add(board, frame);
    // strings, fanning back from the keyboard
    const strings = new THREE.Group();
    const sGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 4);
    sGeo.rotateX(Math.PI / 2);
    for (let k = 0; k < 44; k++) {
      const u = k / 43;
      const len = 1.75 - u * 1.25;
      const s = mesh(sGeo, MAT.steel(), -0.66 + u * 1.3, caseBottom + caseH - 0.01, -0.12 - len / 2);
      s.scale.z = len;
      strings.add(s);
    }
    this.body.add(strings);

    // lid hinged on the straight bass side, propped open
    const lidPivot = new THREE.Group();
    lidPivot.position.set(-0.76, caseBottom + caseH + 0.01, 0);
    const lid = mesh(shapeGeo(0.015), gloss, 0.76, 0, 0);
    lidPivot.add(lid);
    lidPivot.rotation.z = 0.42;
    this.body.add(lidPivot);
    const stick = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 8), gold, 0.5, caseBottom + caseH + 0.22, -0.95);
    stick.rotation.z = -0.22;
    this.body.add(stick);

    // keyboard and key bed with cheek blocks
    const kb = buildKeyboard(this, 21, 108, { white: 0.0272, top, key: 'grand' });
    this.kb = kb;
    this.body.add(mesh(new THREE.BoxGeometry(kb.width + 0.02, 0.05, kb.depth + 0.04), gloss, 0, top - 0.05, -kb.depth / 2));
    for (const sx of [-1, 1]) this.body.add(mesh(new THREE.BoxGeometry(0.06, 0.08, kb.depth + 0.04), gloss, sx * (kb.width / 2 + 0.035), top - 0.01, -kb.depth / 2));
    this.body.add(mesh(new THREE.BoxGeometry(kb.width + 0.08, 0.02, 0.012), gloss, 0, top + 0.03, -0.13)); // fallboard rail

    // music stand
    const stand = mesh(new THREE.BoxGeometry(0.62, 0.26, 0.012), gloss, 0, caseBottom + caseH + 0.13, -0.24);
    stand.rotation.x = -0.25;
    this.body.add(stand);

    // three legs with brass castors
    const legGeo = new THREE.CylinderGeometry(0.045, 0.03, caseBottom, 16);
    const castor = new THREE.SphereGeometry(0.035, 16, 12);
    for (const [lx, lz] of [[-0.66, -0.16], [0.66, -0.2], [-0.42, -1.75]]) {
      this.body.add(mesh(legGeo, gloss, lx, caseBottom / 2, lz));
      this.body.add(mesh(castor, gold, lx, 0.035, lz));
    }

    // pedal lyre
    const lyre = new THREE.Group();
    lyre.add(mesh(new THREE.BoxGeometry(0.04, caseBottom - 0.08, 0.04), gloss, -0.07, caseBottom / 2 + 0.03, 0));
    lyre.add(mesh(new THREE.BoxGeometry(0.04, caseBottom - 0.08, 0.04), gloss, 0.07, caseBottom / 2 + 0.03, 0));
    lyre.add(mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), gloss, 0, 0.06, 0));
    for (const px of [-0.06, 0, 0.06]) lyre.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.09), gold, px, 0.05, 0.07));
    lyre.position.set(0, 0, -0.5);
    this.body.add(lyre);
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
