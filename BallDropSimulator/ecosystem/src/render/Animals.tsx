/**
 * Instanced, procedurally animated animals. Each body part of each species is one
 * InstancedMesh; per frame every animal's pose is built from its simulated state (interpolated
 * between ticks): gait phase from distance actually walked (so feet do not slide), leg swing with
 * speed, head lowered while grazing, eating or drinking, body lowered while resting.
 * Birds have their own renderer: flapping or gliding at their simulated altitude.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useController } from '../runtime/context';
import { isAdult, type Animal, type Species } from '../sim/agents';
import { SPECIES } from '../sim/species';
import { YEAR_DAYS, getWorld } from '../sim/world';

const world = getWorld();
const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

type HeadKind = 'deer' | 'moose' | 'canine' | 'feline' | 'lynx' | 'bear' | 'boar' | 'hare' | 'squirrel' | 'beaver';
type TailKind = 'flag' | 'bushy' | 'long' | 'stub' | 'puff' | 'curl' | 'flat' | 'thin';
type AntlerKind = 'deer' | 'elk' | 'moose' | 'tusks' | null;

interface Spec {
  head: HeadKind; tail: TailKind; antler: AntlerKind;
  /** Head size relative to a deer's. */
  headScale: number;
  bodyH: number; bodyLen: number; bodyR: number;
  legLen: number; legR: number; hipX: number; shoulderX: number; legZ: number;
  neckLen: number; neckR: number; neckUp: number; neckDown: number;
  stride: number;
  /** Tail angle from vertical (0 up, π/2 straight back, π down): normal and excited. */
  tailRest: number; tailExcited: number; tailLen: number;
  colors: { body: string; head: string; leg: string; tail: string; accent: string };
  accent: 'rump' | 'saddle' | 'hump' | 'chest' | 'ridge' | 'none';
  max: number;
}

const SPEC: Record<Exclude<Species, 'eagle' | 'raven'>, Spec> = {
  deer: { head: 'deer', tail: 'flag', antler: 'deer', headScale: 1, bodyH: 0.95, bodyLen: 0.62, bodyR: 0.26, legLen: 0.9, legR: 0.045, hipX: -0.34, shoulderX: 0.32, legZ: 0.12, neckLen: 0.55, neckR: 0.085, neckUp: -0.55, neckDown: -2.25, stride: 1.25,
    tailRest: 0.9, tailExcited: -0.1, tailLen: 0.18, accent: 'rump', max: 1400,
    colors: { body: '#93643a', head: '#86592f', leg: '#6d4a2a', tail: '#f3ece0', accent: '#d9cbb2' } },
  wolf: { head: 'canine', tail: 'bushy', antler: null, headScale: 1, bodyH: 0.62, bodyLen: 0.62, bodyR: 0.2, legLen: 0.6, legR: 0.045, hipX: -0.3, shoulderX: 0.3, legZ: 0.1, neckLen: 0.28, neckR: 0.125, neckUp: -1.0, neckDown: -2.3, stride: 1.05,
    tailRest: 2.6, tailExcited: 1.75, tailLen: 0.48, accent: 'saddle', max: 400,
    colors: { body: '#8b9097', head: '#7d838a', leg: '#6b7076', tail: '#5c6168', accent: '#3d4249' } },
  elk: { head: 'deer', tail: 'flag', antler: 'elk', headScale: 1.4, bodyH: 1.28, bodyLen: 0.85, bodyR: 0.36, legLen: 1.18, legR: 0.06, hipX: -0.46, shoulderX: 0.44, legZ: 0.16, neckLen: 0.72, neckR: 0.13, neckUp: -0.6, neckDown: -2.2, stride: 1.65,
    tailRest: 1.0, tailExcited: 0.2, tailLen: 0.14, accent: 'rump', max: 500,
    colors: { body: '#b0804f', head: '#5e3f26', leg: '#4a3322', tail: '#ead9b5', accent: '#e8d4a8' } },
  moose: { head: 'moose', tail: 'stub', antler: 'moose', headScale: 1.5, bodyH: 1.55, bodyLen: 1.0, bodyR: 0.45, legLen: 1.5, legR: 0.07, hipX: -0.55, shoulderX: 0.52, legZ: 0.2, neckLen: 0.55, neckR: 0.17, neckUp: -0.95, neckDown: -2.0, stride: 1.95,
    tailRest: 1.4, tailExcited: 1.2, tailLen: 0.12, accent: 'hump', max: 200,
    colors: { body: '#4a3426', head: '#3b2a1f', leg: '#7a6654', tail: '#3b2a1f', accent: '#3d2b20' } },
  boar: { head: 'boar', tail: 'thin', antler: 'tusks', headScale: 1, bodyH: 0.52, bodyLen: 0.68, bodyR: 0.26, legLen: 0.4, legR: 0.045, hipX: -0.32, shoulderX: 0.3, legZ: 0.12, neckLen: 0.1, neckR: 0.18, neckUp: -1.35, neckDown: -1.95, stride: 0.8,
    tailRest: 2.3, tailExcited: 1.3, tailLen: 0.2, accent: 'ridge', max: 400,
    colors: { body: '#54443b', head: '#463830', leg: '#2d2420', tail: '#2d2420', accent: '#7a685b' } },
  hare: { head: 'hare', tail: 'puff', antler: null, headScale: 1, bodyH: 0.24, bodyLen: 0.18, bodyR: 0.11, legLen: 0.18, legR: 0.025, hipX: -0.1, shoulderX: 0.09, legZ: 0.05, neckLen: 0.05, neckR: 0.05, neckUp: -0.7, neckDown: -1.7, stride: 0.5,
    tailRest: 0.9, tailExcited: 0.6, tailLen: 0.06, accent: 'none', max: 900,
    colors: { body: '#9a8a74', head: '#8e7f6a', leg: '#857561', tail: '#f4f0e8', accent: '#d8cdbb' } },
  squirrel: { head: 'squirrel', tail: 'curl', antler: null, headScale: 1, bodyH: 0.16, bodyLen: 0.12, bodyR: 0.065, legLen: 0.12, legR: 0.018, hipX: -0.06, shoulderX: 0.06, legZ: 0.035, neckLen: 0.03, neckR: 0.035, neckUp: -0.6, neckDown: -1.5, stride: 0.3,
    tailRest: 0.35, tailExcited: 0.9, tailLen: 0.22, accent: 'chest', max: 500,
    colors: { body: '#b5562c', head: '#b05228', leg: '#8f4422', tail: '#c4612f', accent: '#efe2cf' } },
  beaver: { head: 'beaver', tail: 'flat', antler: null, headScale: 1, bodyH: 0.2, bodyLen: 0.36, bodyR: 0.17, legLen: 0.13, legR: 0.035, hipX: -0.16, shoulderX: 0.16, legZ: 0.1, neckLen: 0.05, neckR: 0.12, neckUp: -1.2, neckDown: -1.8, stride: 0.35,
    tailRest: 1.75, tailExcited: 1.6, tailLen: 0.3, accent: 'none', max: 200,
    colors: { body: '#6b4a2e', head: '#634429', leg: '#3a2a1c', tail: '#2f2620', accent: '#6b4a2e' } },
  bear: { head: 'bear', tail: 'stub', antler: null, headScale: 1, bodyH: 0.95, bodyLen: 0.78, bodyR: 0.42, legLen: 0.72, legR: 0.09, hipX: -0.4, shoulderX: 0.38, legZ: 0.2, neckLen: 0.24, neckR: 0.22, neckUp: -1.2, neckDown: -2.0, stride: 1.2,
    tailRest: 1.4, tailExcited: 1.3, tailLen: 0.1, accent: 'hump', max: 120,
    colors: { body: '#6e4a30', head: '#5d3e28', leg: '#4a3220', tail: '#4a3220', accent: '#5e3e27' } },
  cougar: { head: 'feline', tail: 'long', antler: null, headScale: 1, bodyH: 0.6, bodyLen: 0.75, bodyR: 0.19, legLen: 0.55, legR: 0.05, hipX: -0.36, shoulderX: 0.34, legZ: 0.11, neckLen: 0.22, neckR: 0.11, neckUp: -1.0, neckDown: -2.0, stride: 1.1,
    tailRest: 2.5, tailExcited: 1.9, tailLen: 0.75, accent: 'chest', max: 120,
    colors: { body: '#c49a63', head: '#b88d58', leg: '#a8804f', tail: '#9a7246', accent: '#ecdcc0' } },
  lynx: { head: 'lynx', tail: 'stub', antler: null, headScale: 0.85, bodyH: 0.5, bodyLen: 0.44, bodyR: 0.16, legLen: 0.48, legR: 0.045, hipX: -0.23, shoulderX: 0.22, legZ: 0.1, neckLen: 0.14, neckR: 0.1, neckUp: -0.9, neckDown: -2.0, stride: 0.9,
    tailRest: 1.3, tailExcited: 0.9, tailLen: 0.13, accent: 'chest', max: 160,
    colors: { body: '#a89a84', head: '#a09280', leg: '#9a8c76', tail: '#2b2622', accent: '#e4dccd' } },
  fox: { head: 'canine', tail: 'bushy', antler: null, headScale: 0.62, bodyH: 0.36, bodyLen: 0.38, bodyR: 0.115, legLen: 0.33, legR: 0.025, hipX: -0.19, shoulderX: 0.19, legZ: 0.065, neckLen: 0.15, neckR: 0.07, neckUp: -1.0, neckDown: -2.2, stride: 0.7,
    tailRest: 2.1, tailExcited: 1.6, tailLen: 0.42, accent: 'chest', max: 200,
    colors: { body: '#d0692a', head: '#cf6828', leg: '#2a1e18', tail: '#c9662a', accent: '#f2ebe0' } },
};

function mergeGeometries(list: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let offset = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) idx.push(i + offset);
    offset += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

/** Head in the neck-tip frame (+X forward, +Y up). Returns the head and the nose tip. */
function makeHead(kind: HeadKind, k: number): { head: THREE.BufferGeometry; nose: THREE.BufferGeometry } {
  const P: THREE.BufferGeometry[] = [];
  let nose: [number, number, number] = [0.27, 0.01, 0.03];
  switch (kind) {
    case 'deer':
      P.push(new THREE.CapsuleGeometry(0.085, 0.16, 3, 8).rotateZ(Math.PI / 2).translate(0.1, 0.02, 0));
      P.push(new THREE.ConeGeometry(0.045, 0.16, 6).rotateZ(Math.PI / 4).translate(-0.02, 0.13, 0.07));
      P.push(new THREE.ConeGeometry(0.045, 0.16, 6).rotateZ(Math.PI / 4).translate(-0.02, 0.13, -0.07));
      break;
    case 'moose':
      P.push(new THREE.CapsuleGeometry(0.09, 0.26, 3, 8).rotateZ(Math.PI / 2 + 0.25).translate(0.15, -0.02, 0));
      P.push(new THREE.SphereGeometry(0.08, 8, 6).scale(1.2, 1, 1).translate(0.3, -0.07, 0));
      P.push(new THREE.ConeGeometry(0.05, 0.1, 5).translate(0.02, -0.18, 0)); // the bell (dewlap)
      P.push(new THREE.ConeGeometry(0.04, 0.12, 6).rotateZ(Math.PI / 3).translate(-0.04, 0.1, 0.08));
      P.push(new THREE.ConeGeometry(0.04, 0.12, 6).rotateZ(Math.PI / 3).translate(-0.04, 0.1, -0.08));
      nose = [0.38, -0.08, 0.035];
      break;
    case 'canine':
      P.push(new THREE.SphereGeometry(0.13, 10, 8).scale(1.1, 0.95, 0.95).translate(0.05, 0.02, 0));
      P.push(new THREE.ConeGeometry(0.075, 0.24, 7).rotateZ(-Math.PI / 2).translate(0.25, -0.02, 0));
      P.push(new THREE.ConeGeometry(0.05, 0.13, 4).translate(-0.02, 0.15, 0.065));
      P.push(new THREE.ConeGeometry(0.05, 0.13, 4).translate(-0.02, 0.15, -0.065));
      nose = [0.37, -0.02, 0.035];
      break;
    case 'feline':
    case 'lynx':
      P.push(new THREE.SphereGeometry(0.12, 10, 8).scale(1.05, 0.95, 1).translate(0.04, 0.02, 0));
      P.push(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.75, 1).translate(0.14, -0.03, 0));
      P.push(new THREE.ConeGeometry(0.04, 0.08, 5).translate(-0.01, 0.13, 0.07));
      P.push(new THREE.ConeGeometry(0.04, 0.08, 5).translate(-0.01, 0.13, -0.07));
      if (kind === 'lynx') {
        P.push(new THREE.CylinderGeometry(0.004, 0.008, 0.07, 3).translate(-0.01, 0.2, 0.07));
        P.push(new THREE.CylinderGeometry(0.004, 0.008, 0.07, 3).translate(-0.01, 0.2, -0.07));
        P.push(new THREE.ConeGeometry(0.05, 0.09, 6).rotateX(Math.PI / 2).translate(0.02, -0.07, 0.11)); // ruff
        P.push(new THREE.ConeGeometry(0.05, 0.09, 6).rotateX(-Math.PI / 2).translate(0.02, -0.07, -0.11));
      }
      nose = [0.2, -0.01, 0.03];
      break;
    case 'bear':
      P.push(new THREE.SphereGeometry(0.19, 10, 8).translate(0.04, 0.02, 0));
      P.push(new THREE.CapsuleGeometry(0.08, 0.1, 3, 8).rotateZ(Math.PI / 2).translate(0.2, -0.04, 0));
      P.push(new THREE.SphereGeometry(0.055, 6, 5).translate(-0.02, 0.17, 0.11));
      P.push(new THREE.SphereGeometry(0.055, 6, 5).translate(-0.02, 0.17, -0.11));
      nose = [0.32, -0.03, 0.04];
      break;
    case 'boar':
      P.push(new THREE.SphereGeometry(0.15, 9, 7).scale(1.2, 1, 0.9).translate(0.02, 0.0, 0));
      P.push(new THREE.ConeGeometry(0.09, 0.3, 8).rotateZ(-Math.PI / 2 - 0.15).translate(0.24, -0.06, 0));
      P.push(new THREE.ConeGeometry(0.045, 0.1, 4).translate(-0.04, 0.15, 0.07));
      P.push(new THREE.ConeGeometry(0.045, 0.1, 4).translate(-0.04, 0.15, -0.07));
      nose = [0.39, -0.1, 0.05];
      break;
    case 'hare':
      P.push(new THREE.SphereGeometry(0.06, 8, 6).scale(1.2, 1, 0.95).translate(0.03, 0.01, 0));
      P.push(new THREE.CapsuleGeometry(0.018, 0.12, 2, 5).rotateZ(0.25).translate(-0.02, 0.12, 0.025));
      P.push(new THREE.CapsuleGeometry(0.018, 0.12, 2, 5).rotateZ(0.25).translate(-0.02, 0.12, -0.025));
      nose = [0.1, 0.0, 0.012];
      break;
    case 'squirrel':
      P.push(new THREE.SphereGeometry(0.04, 8, 6).scale(1.2, 1, 1).translate(0.02, 0.01, 0));
      P.push(new THREE.ConeGeometry(0.012, 0.035, 4).translate(-0.005, 0.05, 0.018));
      P.push(new THREE.ConeGeometry(0.012, 0.035, 4).translate(-0.005, 0.05, -0.018));
      nose = [0.066, 0.0, 0.008];
      break;
    case 'beaver':
      P.push(new THREE.SphereGeometry(0.1, 8, 6).scale(1.2, 0.95, 1).translate(0.04, 0, 0));
      P.push(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.02, 0.08, 0.06));
      P.push(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.02, 0.08, -0.06));
      nose = [0.15, 0.0, 0.02];
      break;
  }
  const head = mergeGeometries(P).scale(k, k, k);
  const n = new THREE.SphereGeometry(nose[2], 6, 5).translate(nose[0], nose[1], 0).scale(k, k, k);
  return { head, nose: n };
}

function makeAntler(kind: AntlerKind, k: number): THREE.BufferGeometry | null {
  const P: THREE.BufferGeometry[] = [];
  const tine = (len: number, r: number, rz: number, x: number, y: number, z: number, rx = 0) =>
    P.push(new THREE.CylinderGeometry(r * 0.6, r, len, 4).rotateX(rx).rotateZ(rz).translate(x, y, z));
  switch (kind) {
    case 'deer':
      for (const s of [1, -1]) { tine(0.32, 0.018, -0.3, -0.02, 0.24, 0.06 * s); tine(0.16, 0.014, -1.0, 0.06, 0.3, 0.07 * s); }
      break;
    case 'elk':
      for (const s of [1, -1]) {
        tine(0.55, 0.02, 0.45, -0.1, 0.3, 0.08 * s, 0.25 * s);
        tine(0.2, 0.013, -0.9, 0.0, 0.2, 0.1 * s);
        tine(0.2, 0.013, -0.8, -0.1, 0.38, 0.13 * s);
        tine(0.18, 0.012, -0.5, -0.18, 0.5, 0.15 * s);
      }
      break;
    case 'moose':
      for (const s of [1, -1]) {
        P.push(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 4).rotateX(s * 1.2).translate(-0.02, 0.12, 0.12 * s));
        P.push(new THREE.BoxGeometry(0.26, 0.03, 0.2).rotateX(s * -0.35).translate(-0.04, 0.2, 0.28 * s)); // palm
        for (let t = 0; t < 4; t++) tine(0.08, 0.01, 0, -0.14 + t * 0.07, 0.24, 0.37 * s);
      }
      break;
    case 'tusks':
      for (const s of [1, -1]) P.push(new THREE.ConeGeometry(0.012, 0.08, 4).rotateZ(-0.6).translate(0.3, -0.08, 0.05 * s));
      break;
    default: return null;
  }
  return mergeGeometries(P).scale(k, k, k);
}

function makeTail(kind: TailKind, len: number): THREE.BufferGeometry {
  switch (kind) {
    case 'bushy': return new THREE.CapsuleGeometry(len * 0.17, len * 0.7, 3, 7).translate(0, len * 0.5, 0);
    case 'long': return new THREE.CylinderGeometry(len * 0.05, len * 0.08, len, 6).translate(0, len / 2, 0);
    case 'curl': return mergeGeometries([
      new THREE.CapsuleGeometry(len * 0.22, len * 0.55, 3, 7).translate(0, len * 0.45, 0),
      new THREE.SphereGeometry(len * 0.24, 7, 5).translate(len * 0.15, len * 0.9, 0),
    ]);
    case 'flat': return new THREE.BoxGeometry(len * 0.5, len, len * 0.12).rotateY(Math.PI / 2).scale(1, 1, 1).translate(0, len / 2, 0);
    case 'puff': return new THREE.SphereGeometry(len, 6, 5).translate(0, len * 0.6, 0);
    case 'stub': return new THREE.ConeGeometry(len * 0.4, len, 6).translate(0, len / 2, 0);
    case 'thin': return new THREE.CylinderGeometry(0.008, 0.02, len, 4).translate(0, len / 2, 0);
    default: return new THREE.ConeGeometry(len * 0.33, len, 6).translate(0, len / 2, 0);
  }
}

function makeGeometries(s: Spec) {
  const body = new THREE.CapsuleGeometry(s.bodyR, s.bodyLen, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.85);
  let accent: THREE.BufferGeometry;
  switch (s.accent) {
    case 'rump': accent = new THREE.SphereGeometry(s.bodyR * 0.62, 8, 6).translate(-s.bodyLen * 0.78, s.bodyR * 0.2, 0); break;
    case 'saddle': accent = new THREE.CapsuleGeometry(s.bodyR * 0.75, s.bodyLen * 0.8, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.55, 0.8).translate(-0.02, s.bodyR * 0.55, 0); break;
    case 'hump': accent = new THREE.SphereGeometry(s.bodyR * 0.75, 8, 6).scale(1.2, 0.8, 0.9).translate(s.bodyLen * 0.32, s.bodyR * 0.62, 0); break;
    case 'chest': accent = new THREE.SphereGeometry(s.bodyR * 0.72, 8, 6).scale(1, 0.9, 0.8).translate(s.bodyLen * 0.45, -s.bodyR * 0.25, 0); break;
    case 'ridge': accent = new THREE.BoxGeometry(s.bodyLen * 1.2, s.bodyR * 0.35, s.bodyR * 0.25).translate(0.04, s.bodyR * 0.95, 0); break;
    default: accent = new THREE.SphereGeometry(0.001, 3, 2);
  }
  const neck = new THREE.CylinderGeometry(s.neckR * 0.8, s.neckR, s.neckLen, 7).translate(0, s.neckLen / 2, 0);
  const { head, nose } = makeHead(s.head, s.headScale);
  const leg = new THREE.CylinderGeometry(s.legR, s.legR * 0.72, s.legLen, 5).translate(0, -s.legLen / 2, 0);
  const foot = new THREE.CylinderGeometry(s.legR * 0.9, s.legR, Math.max(0.02, s.legLen * 0.08), 5).translate(0, -s.legLen + s.legLen * 0.03, 0);
  const tail = makeTail(s.tail, s.tailLen);
  const antler = makeAntler(s.antler, s.headScale);
  return { body, accent, neck, head, nose, leg, foot, tail, antler };
}

const hash = (n: number) => { const s = Math.sin(n * 91.3 + 17.1) * 43758.5453; return s - Math.floor(s); };
const HIGHLIGHT = new THREE.Color('#ffe066');
const WINTER_WHITE = new THREE.Color('#f1f3f5');

/** 0 in summer, 1 in deep winter: snowshoe hares moult to white. */
function winterCoat(day: number) {
  const f = (((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) / YEAR_DAYS;
  return Math.min(1, Math.max(0, Math.cos(2 * Math.PI * (f - 0.75)) * 1.6 - 0.35));
}

export function AnimalHerd({ species }: { species: Exclude<Species, 'eagle' | 'raven'> }) {
  const ctl = useController();
  const spec = SPEC[species];
  const geos = useMemo(() => makeGeometries(spec), [spec]);
  const T = SPECIES[species].traits;
  const max = spec.max;
  const small = T.radius < 0.35;
  const refs = {
    body: useRef<THREE.InstancedMesh>(null), accent: useRef<THREE.InstancedMesh>(null), neck: useRef<THREE.InstancedMesh>(null),
    head: useRef<THREE.InstancedMesh>(null), nose: useRef<THREE.InstancedMesh>(null), legs: useRef<THREE.InstancedMesh>(null),
    feet: useRef<THREE.InstancedMesh>(null), tail: useRef<THREE.InstancedMesh>(null), antler: useRef<THREE.InstancedMesh>(null),
  };
  const ids = useRef<number[]>([]);
  const m = useMemo(() => ({
    root: new THREE.Matrix4(), frame: new THREE.Matrix4(), tmp: new THREE.Matrix4(), zero: new THREE.Matrix4().makeScale(0, 0, 0),
    col: new THREE.Color(), base: new THREE.Color(spec.colors.body), headCol: new THREE.Color(spec.colors.head),
  }), [spec]);

  const local = (out: THREE.Matrix4, x: number, y: number, z: number, rotZ: number) => {
    out.makeRotationZ(rotZ);
    out.setPosition(x, y, z);
    return out;
  };

  useFrame(({ clock }) => {
    const sim = ctl.sim;
    const a0 = ctl.alpha;
    const list: Animal[] = [];
    for (const a of sim.animals) if (a.species === species) list.push(a);
    const n = Math.min(list.length, max);
    ids.current.length = n;
    const r = refs;
    const coat = species === 'hare' ? winterCoat(sim.day) * Math.min(1, sim.params.seasonality / 0.2) : 0;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      ids.current[i] = a.id;
      const x = a.px + (a.x - a.px) * a0, z = a.pz + (a.z - a.pz) * a0;
      const heading = lerpAngle(a.pheading, a.heading, a0);
      const y = world.heightAt(x, z);
      const grow = 0.5 + 0.5 * Math.min(1, a.age / T.maturity);
      const resting = a.state === 'rest' || a.state === 'recover' || a.state === 'hibernate';
      const headDown = a.state === 'graze' || a.state === 'drink' || a.state === 'eat' ? 1 : 0;
      const lie = resting ? (a.state === 'hibernate' ? 0.55 : 0.42) * spec.bodyH : a.state === 'stalk' ? 0.22 * spec.bodyH : 0;
      const ahead = world.heightAt(x + Math.cos(heading) * 0.6, z + Math.sin(heading) * 0.6) - world.heightAt(x - Math.cos(heading) * 0.6, z - Math.sin(heading) * 0.6);
      m.root.makeRotationY(-heading);
      m.tmp.makeRotationZ(Math.atan2(ahead, 1.2) * 0.8);
      m.root.multiply(m.tmp);
      m.tmp.makeScale(grow, grow, grow);
      m.root.multiply(m.tmp);
      m.root.setPosition(x, y, z);

      const speed = Math.hypot(a.x - a.px, a.z - a.pz);
      const amp = resting ? 0 : Math.min(0.75, (speed / T.sprint) * 1.15 + (speed > 0.005 ? 0.12 : 0));
      const phase = (a.gait / (spec.stride * grow)) * Math.PI * 2;
      const gallop = speed > T.trot * 1.05;
      const bob = Math.abs(Math.sin(phase)) * 0.05 * amp * (spec.bodyH / 0.9);
      const bodyY = spec.bodyH - lie + bob;

      r.body.current!.setMatrixAt(i, m.frame.multiplyMatrices(m.root, local(m.tmp, 0, bodyY, 0, 0)));
      r.accent.current!.setMatrixAt(i, m.frame);
      const shade = 0.84 + hash(a.id) * 0.28;
      m.col.copy(m.base).multiplyScalar(shade);
      if (coat > 0) m.col.lerp(WINTER_WHITE, coat);
      if (ctl.selectedId === a.id) m.col.lerp(HIGHLIGHT, 0.45);
      r.body.current!.setColorAt(i, m.col);
      m.col.copy(m.headCol);
      if (coat > 0) m.col.lerp(WINTER_WHITE, coat);
      r.head.current!.setColorAt(i, m.col);

      const neckRot = spec.neckUp + (spec.neckDown - spec.neckUp) * headDown;
      local(m.tmp, spec.shoulderX + spec.bodyR * 0.25, bodyY + spec.bodyR * 0.45, 0, neckRot);
      m.frame.multiplyMatrices(m.root, m.tmp);
      r.neck.current!.setMatrixAt(i, m.frame);
      m.tmp.makeTranslation(0, spec.neckLen, 0);
      m.frame.multiply(m.tmp);
      m.tmp.makeRotationZ(-neckRot + (headDown ? -1.1 : -0.15) + Math.sin(clock.elapsedTime * 2 + a.id) * 0.04);
      m.frame.multiply(m.tmp);
      r.head.current!.setMatrixAt(i, m.frame);
      r.nose.current!.setMatrixAt(i, m.frame);
      if (r.antler.current) r.antler.current.setMatrixAt(i, a.sex === 'M' && isAdult(a) ? m.frame : m.zero);

      const legs: [number, number, number][] = [
        [spec.shoulderX, spec.legZ, 0], [spec.shoulderX, -spec.legZ, Math.PI],
        [spec.hipX, spec.legZ, gallop ? 0.6 : Math.PI], [spec.hipX, -spec.legZ, gallop ? 0.6 + Math.PI * 0.2 : 0],
      ];
      for (let k = 0; k < 4; k++) {
        const [lx, lz, off] = legs[k];
        const swing = resting ? (k < 2 ? -1.35 : 1.35) : amp * Math.sin(phase + off);
        local(m.tmp, lx, bodyY - spec.bodyR * 0.3, lz, swing);
        m.frame.multiplyMatrices(m.root, m.tmp);
        r.legs.current!.setMatrixAt(i * 4 + k, m.frame);
        r.feet.current!.setMatrixAt(i * 4 + k, m.frame);
      }
      const excited = a.state === 'flee' || a.state === 'chase' || a.state === 'alert';
      const wag = Math.sin(clock.elapsedTime * 6 + a.id) * 0.12;
      const tailRot = (excited ? spec.tailExcited : spec.tailRest) + wag * (spec.tail === 'bushy' || spec.tail === 'long' ? 1 : 0.4);
      local(m.tmp, -spec.bodyLen / 2 - spec.bodyR * 0.8, bodyY + spec.bodyR * 0.4, 0, tailRot);
      m.frame.multiplyMatrices(m.root, m.tmp);
      r.tail.current!.setMatrixAt(i, m.frame);
    }
    for (const [key, ref] of Object.entries(r)) {
      const mesh = ref.current;
      if (!mesh) continue;
      mesh.count = key === 'legs' || key === 'feet' ? n * 4 : n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Animals move every tick: drop the cached bounds so click raycasts use current positions.
      mesh.boundingSphere = null;
    }
  });

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const id = ids.current[e.instanceId];
    if (id !== undefined) ctl.select(id);
  };

  const c = spec.colors;
  return (
    <group>
      <instancedMesh ref={refs.body} args={[geos.body, undefined, max]} castShadow onClick={onPick} frustumCulled={false}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={refs.accent} args={[geos.accent, undefined, max]} castShadow={!small} frustumCulled={false}><meshStandardMaterial color={c.accent} roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.neck} args={[geos.neck, undefined, max]} castShadow={!small} frustumCulled={false}><meshStandardMaterial color={c.head} roughness={0.85} /></instancedMesh>
      <instancedMesh ref={refs.head} args={[geos.head, undefined, max]} castShadow={!small} onClick={onPick} frustumCulled={false}><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={refs.nose} args={[geos.nose, undefined, max]} frustumCulled={false}><meshStandardMaterial color="#1b1b1b" roughness={0.4} /></instancedMesh>
      <instancedMesh ref={refs.legs} args={[geos.leg, undefined, max * 4]} castShadow={!small} frustumCulled={false}><meshStandardMaterial color={c.leg} roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.feet} args={[geos.foot, undefined, max * 4]} frustumCulled={false}><meshStandardMaterial color="#2a2420" roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.tail} args={[geos.tail, undefined, max]} castShadow={!small} frustumCulled={false}><meshStandardMaterial color={c.tail} roughness={0.9} /></instancedMesh>
      {geos.antler && (
        <instancedMesh ref={refs.antler} args={[geos.antler, undefined, max]} castShadow frustumCulled={false}>
          <meshStandardMaterial color={spec.antler === 'tusks' ? '#efe8d8' : '#d8c6a2'} roughness={0.7} />
        </instancedMesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ birds

/** A tapered wing: broad at the shoulder, narrowing and swept back toward the tip. Upper side faces +Y. */
function wing(span: number, L: number, side: 1 | -1) {
  const half = span / 2, root = Math.max(L * 0.75, span * 0.24), tip = root * 0.45;
  // Outline in the X (forward) / S (spanwise) plane, counter-clockwise when seen from above.
  const pts: [number, number][] = [[root * 0.45, 0], [tip * 0.4 - half * 0.12, half * 0.98], [-tip * 0.9 - half * 0.18, half], [-root * 0.55, 0]];
  const shape = new THREE.Shape();
  // After rotateX(-π/2) the shape's +Y becomes world −Z, so the right wing (+Z) uses negative Y.
  const ordered = side === 1 ? pts : [...pts].reverse();
  ordered.forEach(([x, sp], i) => (i ? shape.lineTo(x, -side * sp) : shape.moveTo(x, -side * sp)));
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

const BIRD = {
  eagle: { span: 1.9, body: 0.42, color: '#5a3d22', head: '#c49a5a', beak: '#e0b73a', max: 80, flap: 2.2 },
  raven: { span: 1.1, body: 0.3, color: '#16181d', head: '#16181d', beak: '#16181d', max: 300, flap: 4.5 },
};

/** Eagles and ravens: a body, head, beak, two wings and a tail; flapping, gliding, landing. */
export function Birds({ species }: { species: 'eagle' | 'raven' }) {
  const ctl = useController();
  const B = BIRD[species];
  const geos = useMemo(() => {
    const L = B.body;
    return {
      body: new THREE.CapsuleGeometry(L * 0.22, L * 0.7, 3, 8).rotateZ(Math.PI / 2),
      head: new THREE.SphereGeometry(L * 0.2, 8, 6).translate(L * 0.55, L * 0.08, 0),
      beak: new THREE.ConeGeometry(L * 0.07, L * 0.22, 5).rotateZ(-Math.PI / 2 - 0.3).translate(L * 0.75, L * 0.03, 0),
      // Wings extend along +Z from the shoulder; mirrored for the other side.
      wingR: wing(B.span, L, 1),
      wingL: wing(B.span, L, -1),
      tail: new THREE.BoxGeometry(L * 0.4, 0.02, L * 0.32).translate(-L * 0.6, 0, 0),
    };
  }, [B]);
  const refs = { body: useRef<THREE.InstancedMesh>(null), head: useRef<THREE.InstancedMesh>(null), beak: useRef<THREE.InstancedMesh>(null), wingR: useRef<THREE.InstancedMesh>(null), wingL: useRef<THREE.InstancedMesh>(null), tail: useRef<THREE.InstancedMesh>(null) };
  const ids = useRef<number[]>([]);
  const m = useMemo(() => ({ root: new THREE.Matrix4(), tmp: new THREE.Matrix4(), frame: new THREE.Matrix4(), col: new THREE.Color(), base: new THREE.Color(B.color) }), [B]);

  useFrame(({ clock }) => {
    const sim = ctl.sim, a0 = ctl.alpha, t = clock.elapsedTime;
    const list: Animal[] = [];
    for (const a of sim.animals) if (a.species === species) list.push(a);
    const n = Math.min(list.length, B.max);
    ids.current.length = n;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      ids.current[i] = a.id;
      const x = a.px + (a.x - a.px) * a0, z = a.pz + (a.z - a.pz) * a0;
      const heading = lerpAngle(a.pheading, a.heading, a0);
      const ground = world.heightAt(x, z);
      const flying = a.alt > 0.4;
      const turn = lerpAngle(0, a.heading - a.pheading, 1);
      const grow = 0.6 + 0.4 * Math.min(1, a.age / SPECIES[species].traits.maturity);
      m.root.makeRotationY(-heading);
      if (flying) { m.tmp.makeRotationX(-turn * 6); m.root.multiply(m.tmp); }
      if (a.state === 'chase' && a.alt > 1) { m.tmp.makeRotationZ(-0.5); m.root.multiply(m.tmp); }
      m.tmp.makeScale(grow, grow, grow);
      m.root.multiply(m.tmp);
      m.root.setPosition(x, ground + a.alt + B.body * 0.35, z);
      refs.body.current!.setMatrixAt(i, m.root);
      refs.head.current!.setMatrixAt(i, m.root);
      refs.beak.current!.setMatrixAt(i, m.root);
      refs.tail.current!.setMatrixAt(i, m.root);
      m.col.copy(m.base).multiplyScalar(0.85 + hash(a.id) * 0.3);
      if (ctl.selectedId === a.id) m.col.lerp(HIGHLIGHT, 0.5);
      refs.body.current!.setColorAt(i, m.col);
      // Wings: folded on the ground; flapping when climbing or slow; gliding when cruising.
      const climbing = a.alt < (SPECIES[species].flies?.cruise ?? 10) * 0.85;
      const flap = !flying ? 0 : species === 'eagle' && !climbing && a.state !== 'chase' ? 0.12 * Math.sin(t * 1.2 + a.id) : 0.75 * Math.sin(t * B.flap * Math.PI + a.id);
      const fold = flying ? 0 : 1;
      for (const [ref, side] of [[refs.wingR, 1], [refs.wingL, -1]] as const) {
        if (fold) {
          // Folded along the flanks: swept back, tucked down, shortened.
          m.tmp.makeRotationY(side * 1.35);
          m.frame.makeRotationX(-side * 0.35);
          m.tmp.premultiply(m.frame);
          m.frame.makeScale(0.5, 1, 0.5);
          m.tmp.multiply(m.frame);
        } else m.tmp.makeRotationX(-side * flap);
        m.frame.multiplyMatrices(m.root, m.tmp);
        ref.current!.setMatrixAt(i, m.frame);
      }
    }
    for (const ref of Object.values(refs)) {
      const mesh = ref.current;
      if (!mesh) continue;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = null;
    }
  });

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const id = ids.current[e.instanceId];
    if (id !== undefined) ctl.select(id);
  };

  return (
    <group>
      <instancedMesh ref={refs.body} args={[geos.body, undefined, B.max]} castShadow onClick={onPick} frustumCulled={false}><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={refs.head} args={[geos.head, undefined, B.max]} onClick={onPick} frustumCulled={false}><meshStandardMaterial color={B.head} roughness={0.8} /></instancedMesh>
      <instancedMesh ref={refs.beak} args={[geos.beak, undefined, B.max]} frustumCulled={false}><meshStandardMaterial color={B.beak} roughness={0.5} /></instancedMesh>
      <instancedMesh ref={refs.wingR} args={[geos.wingR, undefined, B.max]} castShadow onClick={onPick} frustumCulled={false}><meshStandardMaterial color={B.color} roughness={0.85} side={THREE.DoubleSide} /></instancedMesh>
      <instancedMesh ref={refs.wingL} args={[geos.wingL, undefined, B.max]} castShadow onClick={onPick} frustumCulled={false}><meshStandardMaterial color={B.color} roughness={0.85} side={THREE.DoubleSide} /></instancedMesh>
      <instancedMesh ref={refs.tail} args={[geos.tail, undefined, B.max]} frustumCulled={false}><meshStandardMaterial color={B.color} roughness={0.85} side={THREE.DoubleSide} /></instancedMesh>
    </group>
  );
}

/** Carcasses: dark mounds sized to the animal, shrinking as the meat is eaten or decays. */
export function Carcasses() {
  const ctl = useController();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.45, 8, 6).scale(1.5, 0.45, 0.9), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(() => {
    const cs = ctl.sim.carcasses;
    const n = Math.min(cs.length, 400);
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      const size = Math.min(1.7, Math.max(0.22, Math.cbrt(c.initialMeat / 110)));
      const s = size * (0.4 + 0.6 * Math.sqrt(c.meat / c.initialMeat));
      m.makeScale(s, s, s);
      m.setPosition(c.x, world.heightAt(c.x, c.z) + 0.1 * size, c.z);
      mesh.current!.setMatrixAt(i, m);
    }
    if (mesh.current) { mesh.current.count = n; mesh.current.instanceMatrix.needsUpdate = true; }
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, 400]} frustumCulled={false} castShadow>
      <meshStandardMaterial color="#5a2a24" roughness={0.8} />
    </instancedMesh>
  );
}
