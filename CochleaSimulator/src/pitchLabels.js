import * as THREE from 'three';
import { placeColor } from './palette.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Timing from the Blender label keyframes (60 fps): fade in 9f, hold to 39f, fade out to 73f
const FADE_IN = 0.15, HOLD_END = 0.65, LIFE = 1.22;
const COOLDOWN = 2.0; // minimum seconds between new labels
const MAX_LIVE = 3;

export function noteName(f) {
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
export function formatHz(f) {
  return f < 1000 ? `${Math.round(f)} Hz` : `${(f / 1000).toFixed(1)} kHz`;
}
export function regionName(f) {
  if (f < 250) return 'LOW PITCH · APEX';
  if (f < 1000) return 'MIDDLE PITCH';
  if (f < 5000) return 'UPPER PITCH';
  return 'HIGH PITCH · BASE';
}

export class PitchLabels {
  constructor(scene, container, cells, worldPos) {
    this.scene = scene;
    this.container = container;
    this.cells = cells;
    this.worldPos = worldPos;
    this.live = [];
    this.lastTime = -Infinity;
    this.lastCell = -100;
    this.enabled = true;
    this.dotGeo = new THREE.SphereGeometry(0.012, 16, 12);
    this._v = new THREE.Vector3();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) while (this.live.length) this._remove(this.live[0]);
  }

  _spawn(i, t) {
    const f = this.cells[i].f;
    const p = this.worldPos[i];
    const radial = new THREE.Vector3(p.x, 0, p.z).normalize();
    const start = p.clone().addScaledVector(radial, 0.06).add(new THREE.Vector3(0, 0.2, 0));
    const end = p.clone().addScaledVector(radial, 0.18).add(new THREE.Vector3(0, 0.42, 0));

    // each label glows in the pitch colour of the place it points at
    const pitch = placeColor(this.cells[i].p);
    const glow = pitch.clone().multiplyScalar(2.6);
    const mat = () => new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const dot = new THREE.Mesh(this.dotGeo, mat());
    dot.position.copy(p);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([p, start]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    dot.renderOrder = line.renderOrder = 5;
    this.scene.add(dot, line);

    const el = document.createElement('div');
    el.className = 'pitch-label';
    el.style.setProperty('--pc', `#${pitch.clone().lerp(new THREE.Color(1, 1, 1), 0.15).getHexString()}`);
    el.innerHTML = `<div class="pl-main">${formatHz(f)}&nbsp;&nbsp;${noteName(f)}</div><div class="pl-sub">${regionName(f)}</div>`;
    this.container.appendChild(el);

    this.live.push({ i, born: t, dot, line, el, start, end, pos: start.clone() });
    this.lastTime = t;
    this.lastCell = i;
  }

  _remove(l) {
    this.scene.remove(l.dot, l.line);
    l.dot.material.dispose();
    l.line.material.dispose();
    l.line.geometry.dispose();
    l.el.remove();
    this.live.splice(this.live.indexOf(l), 1);
  }

  update(model, t, camera, width, height) {
    // Trigger: the strongest freshly-excited place on the membrane
    if (this.enabled && t - this.lastTime > COOLDOWN && this.live.length < MAX_LIVE) {
      let best = -1, bestV = 0.62;
      for (let i = 0; i < model.N; i++) {
        if (model.drive[i] > 0.8 && model.vv[i] > bestV) { bestV = model.vv[i]; best = i; }
      }
      // avoid labelling the same spot twice in a row unless time has passed
      if (best >= 0 && (Math.abs(best - this.lastCell) > 12 || t - this.lastTime > 4)) this._spawn(best, t);
    }

    for (const l of [...this.live]) {
      const age = t - l.born;
      if (age > LIFE) { this._remove(l); continue; }
      const a = age < FADE_IN ? age / FADE_IN : age < HOLD_END ? 1 : 1 - (age - HOLD_END) / (LIFE - HOLD_END);
      const k = 1 - (1 - Math.min(age / LIFE, 1)) ** 3; // ease-out drift upward
      l.pos.lerpVectors(l.start, l.end, k);

      l.dot.material.opacity = a;
      l.line.material.opacity = 0.55 * a;
      const attr = l.line.geometry.attributes.position;
      attr.setXYZ(1, l.pos.x, l.pos.y, l.pos.z);
      attr.needsUpdate = true;

      const v = this._v.copy(l.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const scale = 0.85 + 0.15 * Math.min(age / 0.17, 1);
      l.el.style.opacity = v.z < 1 ? a : 0;
      l.el.style.transform = `translate(${x + 6}px, ${y}px) translateY(-100%) scale(${scale})`;
    }
  }
}
