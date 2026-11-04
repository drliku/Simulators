import * as THREE from 'three';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
export const midiName = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

// Physical material that can glow per instance (attributes aGlow + aGlowCol).
export function glowMaterial(params, cacheKey) {
  const mat = new THREE.MeshPhysicalMaterial(params);
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlow; attribute vec3 aGlowCol; varying vec3 vPartGlow;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPartGlow = aGlowCol * aGlow;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPartGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float partLit = min(length(vPartGlow) * 0.5, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, normalize(vPartGlow + 1e-5) * 0.6, partLit * 0.85);
        totalEmissiveRadiance += vPartGlow;`);
  };
  mat.customProgramCacheKey = () => `glow-${cacheKey}`;
  return mat;
}

export class NoteParts {
  constructor(geometry, material, notes) {
    const n = notes.length;
    this.notes = notes; // midi per instance (the same pitch may appear more than once, e.g. on a guitar neck)
    this.glow = new Float32Array(n);
    this.glowCol = new Float32Array(n * 3);
    this.glowAttr = new THREE.InstancedBufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.InstancedBufferAttribute(this.glowCol, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aGlow', this.glowAttr);
    geometry.setAttribute('aGlowCol', this.colAttr);
    this.mesh = new THREE.InstancedMesh(geometry, material, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.base = notes.map(() => new THREE.Matrix4());
    // per-instance play state
    this.level = new Float32Array(n);
    this.target = new Float32Array(n);
    this.vel = new Float32Array(n).fill(0.8);
    this.hitAt = new Float32Array(n).fill(-100);
    this.held = new Uint8Array(n);
  }
}

const BEAM_MAX = 0.75; // world units the light beams rise before fading out
const MAX_BEAMS = 240;

// Base class: a playable 3D instrument whose note parts light up while you play them.
// A "hit" is one playable spot: { parts, i, m } (which NoteParts, which instance, which MIDI note).
// Subclasses build geometry in this.body (instrument units), add NoteParts via this.addParts(),
// and may override pose() for strike animations, beamOrigin() for where beams start, and
// noteFor()/pick() for how keyboard notes and clicks map to spots.
export class Instrument {
  constructor({ id, name, lo, hi, size }) {
    this.id = id;
    this.name = name;
    this.lo = lo;
    this.hi = hi;
    this.size = size; // {w, h, d} in instrument units, front edge at z = 0, floor at y = 0
    this.group = new THREE.Group(); // placed in the world
    this.body = new THREE.Group(); // scaled to fit
    this.group.add(this.body);
    this.parts = [];
    this.partOf = new Map(); // midi -> default hit for that note
    this.beams = [];
    this.open = new Map();
    this.scale = 1;
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();

    this.beamMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      MAX_BEAMS,
    );
    this.beamMesh.count = 0;
    this.beamMesh.frustumCulled = false;
    this.beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beamMesh.setColorAt(0, new THREE.Color());
    this.beamMesh.renderOrder = 3;
    this.body.add(this.beamMesh);
  }

  addParts(parts, { pickable = true } = {}) {
    parts.pickable = pickable;
    parts.id = this.parts.length;
    this.parts.push(parts);
    parts.notes.forEach((m, i) => { if (!this.partOf.has(m)) this.partOf.set(m, { parts, i, m }); });
    parts.mesh.frustumCulled = false;
    this.body.add(parts.mesh);
    return parts;
  }

  fold(m) {
    while (m < this.lo) m += 12;
    while (m > this.hi) m -= 12;
    return m;
  }

  // The spot that plays MIDI note m (octave-folded into range), for keyboard playing.
  noteFor(m) {
    return this.partOf.get(this.fold(m)) ?? null;
  }

  fit(maxW, maxH) {
    this.scale = Math.min(maxW / this.size.w, maxH / this.size.h);
    this.body.scale.setScalar(this.scale);
  }

  noteOn(hit, velocity, t) {
    const { parts, i } = hit;
    parts.target[i] = 1;
    parts.vel[i] = velocity;
    parts.hitAt[i] = t;
    const key = `${parts.id}:${i}`;
    if (!this.open.has(key)) {
      const beam = { hit, start: t, end: null };
      this.beams.push(beam);
      this.open.set(key, beam);
    }
  }

  noteOff(hit, t) {
    const { parts, i } = hit;
    if (!parts.held[i]) parts.target[i] = 0;
    const key = `${parts.id}:${i}`;
    const beam = this.open.get(key);
    if (beam) { beam.end = t; this.open.delete(key); }
  }

  press(hit) { hit.parts.held[hit.i] = 1; }

  release(hit) {
    hit.parts.held[hit.i] = 0;
    hit.parts.target[hit.i] = 0;
  }

  // Default pose: the part's rest matrix. `lv` 0..1 glow level, `since` seconds since struck.
  pose(m, parts, i, lv, since, t, out) {
    return out.copy(parts.base[i]);
  }

  // Where a beam starts and how wide it is, in instrument units
  beamOrigin(m, parts, i) {
    const e = parts.base[i].elements;
    return { x: e[12], y: e[13], z: e[14], w: 0.03 };
  }

  update(t, dt, keyColor) {
    const up = 1 - Math.exp(-dt / 0.02);
    const down = 1 - Math.exp(-dt / 0.15);
    for (const parts of this.parts) {
      for (let i = 0; i < parts.notes.length; i++) {
        const m = parts.notes[i];
        const tg = parts.target[i];
        parts.level[i] += (tg - parts.level[i]) * (tg > parts.level[i] ? up : down);
        const lv = parts.level[i];
        parts.mesh.setMatrixAt(i, this.pose(m, parts, i, lv, t - parts.hitAt[i], t, this._m));
        const c = keyColor(m);
        parts.glow[i] = lv * (2.6 + 1.6 * parts.vel[i]);
        parts.glowCol[i * 3] = c.r; parts.glowCol[i * 3 + 1] = c.g; parts.glowCol[i * 3 + 2] = c.b;
      }
      parts.mesh.instanceMatrix.needsUpdate = true;
      parts.glowAttr.needsUpdate = true;
      parts.colAttr.needsUpdate = true;
    }

    // light beams rise from played parts and fade before leaving the frame
    const speed = 0.7 / this.scale, max = BEAM_MAX / this.scale;
    let n = 0;
    const keep = [];
    for (const b of this.beams) {
      const top = Math.min((t - b.start) * speed, max);
      const bottom = b.end === null ? 0 : (t - b.end) * speed;
      if (bottom >= max) continue;
      keep.push(b);
      if (n >= MAX_BEAMS || top - bottom < 0.002) continue;
      const { parts, i, m } = b.hit;
      const o = this.beamOrigin(m, parts, i);
      const mid = (top + bottom) / 2;
      this._m.makeScale(o.w, top - bottom, o.w).setPosition(o.x, o.y + mid, o.z);
      this.beamMesh.setMatrixAt(n, this._m);
      const fade = Math.max(0, 1 - Math.max(0, (mid - max * 0.5) / (max * 0.5)));
      this.beamMesh.setColorAt(n, this._c.copy(keyColor(m)).multiplyScalar(2.4 * fade));
      n++;
    }
    this.beams = keep;
    this.beamMesh.count = n;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
  }

  // Which spot a click hits: { parts, i, m } or null. `screen` = { ndc, width, height } for
  // instruments that pick by nearest spot on screen.
  pick(raycaster) {
    let best = null, bestD = Infinity;
    for (const parts of this.parts) {
      if (!parts.pickable) continue;
      parts.mesh.boundingSphere ?? parts.mesh.computeBoundingSphere();
      const hit = raycaster.intersectObject(parts.mesh, false)[0];
      if (hit && hit.instanceId != null && hit.distance < bestD) {
        best = { parts, i: hit.instanceId, m: parts.notes[hit.instanceId] };
        bestD = hit.distance;
      }
    }
    return best;
  }
}

// Shared case materials
export const MAT = {
  gloss: () => new THREE.MeshPhysicalMaterial({ color: 0x0b0b12, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
  gold: () => new THREE.MeshPhysicalMaterial({ color: 0xd9a84e, metalness: 0.9, roughness: 0.28 }),
  brass: () => new THREE.MeshPhysicalMaterial({ color: 0xe0b860, metalness: 1, roughness: 0.18 }),
  steel: () => new THREE.MeshPhysicalMaterial({ color: 0xc9ced8, metalness: 1, roughness: 0.25 }),
  wood: (c = 0x6b3b24) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
  navy: () => new THREE.MeshPhysicalMaterial({ color: 0x1b2450, roughness: 0.35, clearcoat: 0.6 }),
  ivory: () => new THREE.MeshPhysicalMaterial({ color: 0xf2ede2, roughness: 0.3, clearcoat: 0.5 }),
};

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

// Piano-style keyboard: white + black keys as NoteParts, front edge at z = 0, key tops at y = top.
export function buildKeyboard(inst, lo, hi, { white = 0.0235, top = 0.72, key = 'kb' } = {}) {
  const W = { w: white * 0.94, h: 0.022, d: white * 6.4 };
  const B = { w: white * 0.55, h: 0.024, d: white * 4.1 };
  const whites = [], blacks = [];
  const x = new Map();
  let wi = 0;
  const nWhite = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter((m) => !isBlack(m)).length;
  const x0 = -((nWhite - 1) * white) / 2;
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) { x.set(m, x0 + (wi - 0.5) * white); blacks.push(m); }
    else { x.set(m, x0 + wi * white); whites.push(m); wi++; }
  }
  const wp = inst.addParts(new NoteParts(new THREE.BoxGeometry(W.w, W.h, W.d), glowMaterial({ color: 0xf6f2f4, roughness: 0.25, clearcoat: 0.8 }, `${key}-w`), whites));
  const bp = inst.addParts(new NoteParts(new THREE.BoxGeometry(B.w, B.h, B.d), glowMaterial({ color: 0x111320, roughness: 0.2, clearcoat: 0.9 }, `${key}-b`), blacks));
  whites.forEach((m, i) => wp.base[i].makeTranslation(x.get(m), top - W.h / 2, -W.d / 2));
  blacks.forEach((m, i) => bp.base[i].makeTranslation(x.get(m), top + B.h / 2, -B.d / 2 - (W.d - B.d)));
  return { width: nWhite * white, depth: W.d, W, B, whiteParts: wp, blackParts: bp };
}

// Key dip around the back edge
export function keyPose(parts, i, lv, depth, out, tmp) {
  out.copy(parts.base[i]);
  tmp.makeTranslation(0, 0, -depth / 2);
  out.multiply(tmp);
  tmp.makeRotationX(0.07 * lv);
  out.multiply(tmp);
  tmp.makeTranslation(0, 0, depth / 2);
  return out.multiply(tmp);
}
