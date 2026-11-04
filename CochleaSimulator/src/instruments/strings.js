import * as THREE from 'three';
import { Instrument, NoteParts, glowMaterial, MAT, mesh } from './common.js';

// A rod (cylinder) between two points
function rod(a, b, r, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 10), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

// Upright display stand: tripod legs, a back post with a yoke for the neck, a cradle for the body.
function displayStand(body, { cradleY, yokeY, depth = 0.09 }) {
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x9aa1b4, metalness: 0.8, roughness: 0.3 });
  body.add(rod([0, 0.02, -depth], [0, yokeY, -depth], 0.011, steel));
  body.add(rod([0, 0.02, -depth], [-0.17, 0, 0.1], 0.009, steel));
  body.add(rod([0, 0.02, -depth], [0.17, 0, 0.1], 0.009, steel));
  body.add(rod([0, 0.02, -depth], [0, 0, -depth - 0.2], 0.009, steel));
  const yoke = mesh(new THREE.TorusGeometry(0.032, 0.006, 8, 20, Math.PI), steel, 0, yokeY, -depth + 0.03);
  yoke.rotation.x = -Math.PI / 2;
  yoke.rotation.z = Math.PI;
  body.add(yoke);
  body.add(rod([0, yokeY, -depth], [0, yokeY, -depth + 0.03], 0.008, steel));
  for (const sx of [-1, 1]) {
    body.add(rod([0, 0.02, -depth], [sx * 0.09, cradleY, 0.02], 0.008, steel));
    body.add(rod([sx * 0.09, cradleY, 0.02], [sx * 0.09, cradleY + 0.03, 0.05], 0.008, steel));
  }
}

// Base for fretted / fingered string instruments standing upright (neck up, facing the viewer).
// Every string × position is a playable spot ("pad") lit while played; strings vibrate and glow.
export class StringInstrument extends Instrument {
  constructor(opts) {
    super(opts);
    this.tuning = opts.tuning; // open-string MIDI notes, low to high
    this.frets = opts.frets; // highest position per string
  }

  buildStrings({ nutY, bridgeY, nutX, bridgeX, z, padZ, radius, stringColor, padColor, fretless = false, key }) {
    const S = this.tuning.length, F = this.frets;
    const L = nutY - bridgeY;
    const fretY = (f) => nutY - L * (1 - 2 ** (-f / 12));
    const xAt = (s, y) => nutX[s] + (bridgeX[s] - nutX[s]) * ((nutY - y) / L);
    this.geo = { S, F, fretY, xAt, nutY, bridgeY, z, padZ };

    // finger spots
    const notes = [];
    for (let s = 0; s < S; s++) for (let f = 0; f <= F; f++) notes.push(this.tuning[s] + f);
    this.pads = this.addParts(new NoteParts(
      new THREE.BoxGeometry(1, 1, 1),
      glowMaterial({ color: padColor, roughness: 0.4, transparent: true, opacity: 0.5 }, `${key}-pad`),
      notes,
    ));
    this.padPos = [];
    for (let s = 0; s < S; s++) {
      for (let f = 0; f <= F; f++) {
        const i = s * (F + 1) + f;
        const y = f === 0 ? nutY + 0.014 : (fretY(f - 1) + fretY(f)) / 2;
        const spacing = Math.abs(xAt(Math.min(s + 1, S - 1), y) - xAt(Math.max(s - 1, 0), y)) / (s === 0 || s === S - 1 ? 1 : 2);
        const h = f === 0 ? 0.012 : Math.min(0.022, (fretY(f - 1) - fretY(f)) * 0.5);
        const x = xAt(s, y);
        this.pads.base[i].makeScale(spacing * 0.7, h, 0.003).setPosition(x, y, padZ);
        this.padPos.push(new THREE.Vector3(x, y, padZ));
      }
    }

    // frets
    if (!fretless) {
      const fretMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.steel(), F);
      const m4 = new THREE.Matrix4();
      for (let f = 1; f <= F; f++) {
        const y = fretY(f);
        const w = Math.abs(xAt(S - 1, y) - xAt(0, y)) + 0.016;
        fretMesh.setMatrixAt(f - 1, m4.makeScale(w, 0.0025, 0.004).setPosition((xAt(0, y) + xAt(S - 1, y)) / 2, y, padZ + 0.001));
      }
      this.body.add(fretMesh);
    }

    // strings (not clickable themselves; they vibrate and glow with the note played on them)
    this.strs = this.addParts(new NoteParts(
      new THREE.CylinderGeometry(1, 1, 1, 6),
      glowMaterial({ color: stringColor, metalness: 0.85, roughness: 0.3 }, `${key}-str`),
      this.tuning.slice(),
    ), { pickable: false });
    for (let s = 0; s < S; s++) {
      const a = new THREE.Vector3(nutX[s], nutY, z), b = new THREE.Vector3(bridgeX[s], bridgeY, z);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
      this.strs.base[s].compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(radius[s], a.distanceTo(b), radius[s]));
    }
  }

  // Keyboard notes: the lowest position that plays the note (highest string that reaches it)
  noteFor(m) {
    m = this.fold(m);
    for (let s = this.tuning.length - 1; s >= 0; s--) {
      const f = m - this.tuning[s];
      if (f >= 0 && f <= this.frets) {
        const i = s * (this.frets + 1) + f;
        return { parts: this.pads, i, m };
      }
    }
    return null;
  }

  update(t, dt, keyColor) {
    // each string sounds the note last played on it
    const F = this.frets;
    for (let s = 0; s < this.tuning.length; s++) {
      let tg = 0, latestF = 0, latestT = -1e9;
      for (let f = 0; f <= F; f++) {
        const i = s * (F + 1) + f;
        if (this.pads.target[i] > tg) tg = this.pads.target[i];
        if (this.pads.hitAt[i] > latestT) { latestT = this.pads.hitAt[i]; latestF = f; }
      }
      this.strs.target[s] = tg;
      this.strs.hitAt[s] = latestT;
      this.strs.notes[s] = this.tuning[s] + latestF;
    }
    super.update(t, dt, keyColor);
  }

  pose(m, parts, i, lv, since, t, out) {
    out.copy(parts.base[i]);
    if (parts === this.strs && lv > 0.01) {
      out.elements[12] += 0.0016 * lv * (0.4 + 0.6 * Math.exp(-since * 2)) * Math.sin(t * 95 + i * 1.7);
    }
    return out;
  }

  beamOrigin(m, parts, i) {
    const p = this.padPos[i];
    return { x: p.x, y: p.y, z: p.z + 0.01, w: 0.012 };
  }

  // Strings sit millimetres apart, so a click picks the position along the neck by the nearest spot
  // on screen, and the string by where across the neck you clicked, with the neck treated as at
  // least ~40 px wide so each string gets a usable zone.
  pick(raycaster, screen) {
    if (!screen) return super.pick(raycaster);
    const cam = raycaster.camera;
    const mw = this.pads.mesh.matrixWorld;
    const S = this.tuning.length, F = this.frets;
    const px = this.padPos.map((p) => {
      const v = p.clone().applyMatrix4(mw).project(cam);
      return { x: ((v.x + 1) / 2) * screen.width, y: ((1 - v.y) / 2) * screen.height, behind: v.z > 1 };
    });
    const cx = ((screen.ndc.x + 1) / 2) * screen.width, cy = ((1 - screen.ndc.y) / 2) * screen.height;
    // nearest position along the neck (measured along the neck only, so clicking off to the side
    // of a narrow neck doesn't slip to the next position)
    const centres = Array.from({ length: F + 1 }, (_, f) => {
      let mx = 0, my = 0;
      for (let s = 0; s < S; s++) { mx += px[s * (F + 1) + f].x; my += px[s * (F + 1) + f].y; }
      return { x: mx / S, y: my / S };
    });
    const nx = centres[F].x - centres[0].x, ny = centres[F].y - centres[0].y;
    const nl = Math.hypot(nx, ny) || 1;
    let bestF = 0, bestD = Infinity;
    for (let f = 0; f <= F; f++) {
      const d = Math.abs(((cx - centres[f].x) * nx + (cy - centres[f].y) * ny) / nl);
      if (d < bestD) { bestD = d; bestF = f; }
    }
    // across the neck at that position, spread to a usable width
    const row = Array.from({ length: S }, (_, s) => px[s * (F + 1) + bestF]);
    const first = row[0], last = row[S - 1];
    const ax = last.x - first.x, ay = last.y - first.y;
    const len = Math.hypot(ax, ay) || 1;
    const spread = Math.max(len, 40);
    const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
    const along = ((cx - mid.x) * ax + (cy - mid.y) * ay) / len; // signed px across the strings
    const across = Math.abs(((cx - mid.x) * ay - (cy - mid.y) * ax) / len); // px along the neck
    if (Math.abs(along) > spread / 2 + 10 || across > 30) return null;
    const s = Math.min(S - 1, Math.max(0, Math.round((along / spread + 0.5) * (S - 1))));
    const i = s * (F + 1) + bestF;
    return { parts: this.pads, i, m: this.pads.notes[i] };
  }
}

// ---------------------------------------------------------------------------------------------

// Two overlapping circles (lower and upper bout) make an acoustic guitar outline.
function acousticShape() {
  const sh = new THREE.Shape();
  const lc = [0, 0.3], lr = 0.19, uc = [0, 0.5], ur = 0.145;
  const N = 40;
  const a0 = Math.atan2(0.438 - lc[1], 0.131), a1 = Math.atan2(0.438 - lc[1], -0.131) - Math.PI * 2;
  for (let k = 0; k <= N; k++) {
    const a = a0 + ((a1 - a0) * k) / N;
    const p = [lc[0] + lr * Math.cos(a), lc[1] + lr * Math.sin(a)];
    k === 0 ? sh.moveTo(...p) : sh.lineTo(...p);
  }
  const b0 = Math.atan2(0.438 - uc[1], -0.131) + Math.PI * 2, b1 = Math.atan2(0.438 - uc[1], 0.131);
  for (let k = 0; k <= N; k++) {
    const a = b0 + ((b1 - b0) * k) / N;
    sh.lineTo(uc[0] + ur * Math.cos(a), uc[1] + ur * Math.sin(a));
  }
  return sh;
}

export class AcousticGuitar extends StringInstrument {
  constructor() {
    super({ id: 'guitar', name: 'Acoustic guitar', lo: 40, hi: 76, size: { w: 0.6, h: 1.16, d: 0.4 }, tuning: [40, 45, 50, 55, 59, 64], frets: 12 });
    const shape = acousticShape();
    const sides = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
    this.body.add(mesh(sides, MAT.wood(0x6a3a1e), 0, 0, -0.05));
    this.body.add(mesh(new THREE.ShapeGeometry(shape, 24), MAT.wood(0xd9b27a), 0, 0, 0.0565));
    this.body.add(mesh(new THREE.CircleGeometry(0.045, 32), new THREE.MeshStandardMaterial({ color: 0x0a0806 }), 0, 0.47, 0.058));
    this.body.add(mesh(new THREE.RingGeometry(0.049, 0.057, 40), MAT.wood(0x3b2312), 0, 0.47, 0.058));
    this.body.add(mesh(new THREE.BoxGeometry(0.15, 0.028, 0.012), MAT.wood(0x2a170c), 0, 0.25, 0.063));
    this.body.add(mesh(new THREE.BoxGeometry(0.075, 0.004, 0.006), MAT.ivory(), 0, 0.258, 0.071));
    // neck, fretboard, nut, headstock with tuners
    this.body.add(mesh(new THREE.BoxGeometry(0.052, 0.42, 0.03), MAT.wood(0x7a4a24), 0, 0.77, 0.035));
    this.body.add(mesh(new THREE.BoxGeometry(0.05, 0.4, 0.006), MAT.wood(0x2b1a10), 0, 0.77, 0.053));
    this.body.add(mesh(new THREE.BoxGeometry(0.05, 0.006, 0.012), MAT.ivory(), 0, 0.955, 0.058));
    this.body.add(mesh(new THREE.BoxGeometry(0.085, 0.17, 0.02), MAT.wood(0x2b1a10), 0, 1.05, 0.032));
    for (const sx of [-1, 1]) for (const y of [1.0, 1.05, 1.1]) {
      const peg = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), MAT.gold(), sx * 0.06, y, 0.03);
      peg.rotation.z = Math.PI / 2;
      this.body.add(peg, mesh(new THREE.SphereGeometry(0.009, 10, 8), MAT.ivory(), sx * 0.082, y, 0.03));
    }
    this.buildStrings({
      key: 'acoustic', nutY: 0.955, bridgeY: 0.258,
      nutX: [-0.02, -0.012, -0.004, 0.004, 0.012, 0.02], bridgeX: [-0.029, -0.0175, -0.006, 0.006, 0.0175, 0.029],
      z: 0.063, padZ: 0.057, radius: [0.0016, 0.0014, 0.0012, 0.001, 0.0008, 0.0007], stringColor: 0xd9c28a, padColor: 0xe8dcc8,
    });
    displayStand(this.body, { cradleY: 0.1, yokeY: 0.86 });
  }
}

function electricShape() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.1);
  sh.bezierCurveTo(0.17, 0.1, 0.21, 0.2, 0.175, 0.29);
  sh.quadraticCurveTo(0.14, 0.34, 0.15, 0.4);
  sh.bezierCurveTo(0.16, 0.46, 0.15, 0.55, 0.11, 0.57);
  sh.bezierCurveTo(0.08, 0.58, 0.07, 0.5, 0.035, 0.47);
  sh.lineTo(-0.035, 0.47);
  sh.bezierCurveTo(-0.06, 0.5, -0.07, 0.55, -0.1, 0.54);
  sh.bezierCurveTo(-0.15, 0.52, -0.15, 0.44, -0.145, 0.39);
  sh.quadraticCurveTo(-0.14, 0.34, -0.175, 0.29);
  sh.bezierCurveTo(-0.21, 0.2, -0.17, 0.1, 0, 0.1);
  return sh;
}

export class ElectricGuitar extends StringInstrument {
  constructor() {
    super({ id: 'electric', name: 'Electric guitar', lo: 40, hi: 76, size: { w: 1.0, h: 1.06, d: 0.4 }, tuning: [40, 45, 50, 55, 59, 64], frets: 12 });
    const shape = electricShape();
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xf3735f, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.body.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 24 }), paint, 0, 0, -0.0225));
    const guard = mesh(new THREE.ShapeGeometry(shape, 24), MAT.ivory(), 0.005, 0.1, 0.0295);
    guard.scale.set(0.72, 0.72, 1);
    this.body.add(guard);
    for (const y of [0.23, 0.29, 0.35]) this.body.add(mesh(new THREE.BoxGeometry(0.075, 0.018, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.4 }), 0, y, 0.034));
    this.body.add(mesh(new THREE.BoxGeometry(0.07, 0.03, 0.01), MAT.steel(), 0, 0.17, 0.034));
    for (const [x, y] of [[0.09, 0.19], [0.11, 0.15], [0.125, 0.11]]) {
      const k = mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.012, 16), MAT.steel(), x, y, 0.036);
      k.rotation.x = Math.PI / 2;
      this.body.add(k);
    }
    const maple = MAT.wood(0xe3bd84);
    this.body.add(mesh(new THREE.BoxGeometry(0.048, 0.42, 0.024), maple, 0, 0.67, 0.018));
    this.body.add(mesh(new THREE.BoxGeometry(0.046, 0.40, 0.005), maple, 0, 0.67, 0.032));
    this.body.add(mesh(new THREE.BoxGeometry(0.046, 0.005, 0.01), MAT.ivory(), 0, 0.868, 0.036));
    this.body.add(mesh(new THREE.BoxGeometry(0.07, 0.15, 0.016), maple, 0.012, 0.95, 0.02));
    for (let k = 0; k < 6; k++) this.body.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), MAT.steel(), 0.035, 0.9 + k * 0.022, 0.03));
    this.buildStrings({
      key: 'electric', nutY: 0.868, bridgeY: 0.17,
      nutX: [-0.019, -0.0114, -0.0038, 0.0038, 0.0114, 0.019], bridgeX: [-0.026, -0.0156, -0.0052, 0.0052, 0.0156, 0.026],
      z: 0.04, padZ: 0.0352, radius: [0.0015, 0.0013, 0.0011, 0.0009, 0.0008, 0.0007], stringColor: 0xd8dde6, padColor: 0x6b4a2a,
    });
    displayStand(this.body, { cradleY: 0.09, yokeY: 0.78 });

    // amp with a glowing coral jewel light, and the cable
    const amp = new THREE.Group();
    amp.position.set(0.47, 0, -0.05);
    const tolex = new THREE.MeshPhysicalMaterial({ color: 0x15161c, roughness: 0.8 });
    amp.add(mesh(new THREE.BoxGeometry(0.42, 0.38, 0.24), tolex, 0, 0.19, 0));
    amp.add(mesh(new THREE.BoxGeometry(0.37, 0.25, 0.005), new THREE.MeshStandardMaterial({ color: 0x3a3c46, roughness: 1 }), 0, 0.15, 0.121));
    amp.add(mesh(new THREE.BoxGeometry(0.4, 0.055, 0.006), MAT.steel(), 0, 0.33, 0.121));
    for (let k = 0; k < 5; k++) {
      const knob = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0x0b0b0f }), -0.13 + k * 0.05, 0.33, 0.128);
      knob.rotation.x = Math.PI / 2;
      amp.add(knob);
    }
    amp.add(mesh(new THREE.SphereGeometry(0.01, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f3735f').multiplyScalar(2.5), toneMapped: false }), 0.16, 0.33, 0.128));
    amp.add(mesh(new THREE.BoxGeometry(0.12, 0.012, 0.03), MAT.steel(), 0, 0.385, 0));
    this.body.add(amp);
    const cable = new THREE.CatmullRomCurve3([[0.13, 0.11, 0.03], [0.19, 0.02, 0.1], [0.3, 0.01, 0.13], [0.35, 0.12, 0.08]].map((p) => new THREE.Vector3(...p)));
    this.body.add(mesh(new THREE.TubeGeometry(cable, 40, 0.005, 8), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.6 })));
  }
}

// Violin-family outline (right half, mirrored): lower bout, C-bout waist, upper bout.
function violinShape(sc) {
  const half = [[0, 0], [0.06, 0.008], [0.095, 0.04], [0.105, 0.085], [0.098, 0.125], [0.076, 0.146], [0.06, 0.17], [0.06, 0.195], [0.076, 0.216], [0.088, 0.25], [0.085, 0.29], [0.062, 0.33], [0.028, 0.354], [0, 0.36]];
  const pts = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => new THREE.Vector2(x * sc, y * sc));
  const sh = new THREE.Shape();
  sh.moveTo(pts[0].x, pts[0].y);
  sh.splineThru(pts.slice(1).concat([pts[0]]));
  return sh;
}

class BowedString extends StringInstrument {
  constructor(opts, { sc, bodyBottom, stand }) {
    super(opts);
    const varnish = new THREE.MeshPhysicalMaterial({ color: 0x9a4418, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new THREE.Color(0xffb070) });
    const ebony = new THREE.MeshPhysicalMaterial({ color: 0x0c0a0a, roughness: 0.3, clearcoat: 0.6 });
    const yb = bodyBottom, top = 0.36 * sc;
    const shape = violinShape(sc);
    this.body.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04 * sc, bevelEnabled: true, bevelThickness: 0.009 * sc, bevelSize: 0.006 * sc, bevelSegments: 4, curveSegments: 40 }), varnish, 0, yb, -0.02 * sc));
    const surf = 0.02 * sc + 0.009 * sc; // top of the arched front
    // f-holes, bridge, tailpiece, chinrest
    for (const sx of [-1, 1]) {
      const f = mesh(new THREE.BoxGeometry(0.005 * sc, 0.065 * sc, 0.002), ebony, sx * 0.04 * sc, yb + 0.17 * sc, surf + 0.001);
      f.rotation.z = sx * 0.12;
      this.body.add(f);
    }
    const bridgeY = yb + 0.155 * sc, nutY = yb + top + 0.13 * sc;
    const fbZ = surf + 0.012 * sc; // fingerboard surface
    this.body.add(mesh(new THREE.BoxGeometry(0.045 * sc, 0.006 * sc, 0.022 * sc), MAT.wood(0xe0c08a), 0, bridgeY, surf + 0.011 * sc));
    this.body.add(mesh(new THREE.BoxGeometry(0.04 * sc, 0.1 * sc, 0.008 * sc), ebony, 0, yb + 0.06 * sc, surf + 0.004 * sc));
    if (!opts.endpin) this.body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), ebony, -0.055, yb + 0.03, surf + 0.008));
    // neck, fingerboard, pegbox, scroll
    this.body.add(mesh(new THREE.BoxGeometry(0.025 * sc, 0.13 * sc, 0.03 * sc), varnish, 0, yb + top + 0.06 * sc, 0));
    const fbLen = nutY - (yb + 0.25 * sc);
    this.body.add(mesh(new THREE.BoxGeometry(0.027 * sc, fbLen, 0.006 * sc), ebony, 0, nutY - fbLen / 2, fbZ - 0.003 * sc));
    this.body.add(mesh(new THREE.BoxGeometry(0.024 * sc, 0.003 * sc, 0.006 * sc), ebony, 0, nutY, fbZ));
    this.body.add(mesh(new THREE.BoxGeometry(0.022 * sc, 0.075 * sc, 0.025 * sc), varnish, 0, nutY + 0.04 * sc, 0.002 * sc));
    for (let k = 0; k < 2; k++) {
      const scroll = mesh(new THREE.TorusGeometry((0.013 - k * 0.005) * sc, 0.004 * sc, 8, 20), varnish, 0, nutY + 0.085 * sc, 0.004 * sc);
      scroll.rotation.y = Math.PI / 2;
      this.body.add(scroll);
    }
    for (const [sx, dy] of [[-1, 0.015], [1, 0.03], [-1, 0.045], [1, 0.06]]) {
      const peg = mesh(new THREE.CylinderGeometry(0.003 * sc, 0.004 * sc, 0.035 * sc, 8), ebony, sx * 0.022 * sc, nutY + dy * sc, 0.002 * sc);
      peg.rotation.z = Math.PI / 2;
      this.body.add(peg);
    }
    const nutHalf = 0.008 * sc, bridgeHalf = 0.017 * sc;
    const xs = (h) => [-h, -h / 3, h / 3, h];
    this.buildStrings({
      key: opts.id, nutY, bridgeY, nutX: xs(nutHalf), bridgeX: xs(bridgeHalf),
      z: fbZ + 0.004 * sc, padZ: fbZ + 0.001, radius: [0.0011, 0.001, 0.0009, 0.0007].map((r) => r * sc), stringColor: 0xd8d2c4, padColor: 0x8a8070, fretless: true,
    });

    // bow leaning beside it
    const stick = new THREE.MeshPhysicalMaterial({ color: 0x5a2a14, roughness: 0.4 });
    const bx = 0.2 * sc;
    this.body.add(rod([bx, 0.02, 0.05], [bx - 0.12 * sc, 0.02 + 0.72 * sc, -0.04], 0.004 * sc, stick));
    this.body.add(rod([bx + 0.012 * sc, 0.05, 0.05], [bx - 0.108 * sc, 0.02 + 0.7 * sc, -0.04], 0.0022 * sc, MAT.ivory()));
    this.body.add(mesh(new THREE.BoxGeometry(0.02 * sc, 0.04 * sc, 0.015 * sc), ebony, bx + 0.004 * sc, 0.05 + 0.02 * sc, 0.05));

    if (stand) displayStand(this.body, { cradleY: yb - 0.01, yokeY: yb + top + 0.05 * sc, depth: 0.07 });
    if (opts.endpin) this.body.add(rod([0, 0, 0], [0, yb + 0.01, 0], 0.006, MAT.steel()));
  }
}

export class Violin extends BowedString {
  constructor() {
    super({ id: 'violin', name: 'Violin', lo: 55, hi: 83, size: { w: 0.5, h: 0.78, d: 0.3 }, tuning: [55, 62, 69, 76], frets: 7 }, { sc: 1, bodyBottom: 0.14, stand: true });
  }
}

export class Cello extends BowedString {
  constructor() {
    super({ id: 'cello', name: 'Cello', lo: 36, hi: 64, size: { w: 0.8, h: 1.42, d: 0.4 }, tuning: [36, 43, 50, 57], frets: 7, endpin: true }, { sc: 2.1, bodyBottom: 0.16, stand: false });
  }
}
