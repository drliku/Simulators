/**
 * Static and slowly changing parts of the scene: terrain coloured by live vegetation,
 * grass tufts that shrink when grazed, trees, rocks, bushes, water and heatmap overlays.
 * Everything reads the simulation directly inside useFrame; no React state per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useController } from '../runtime/context';
import { HeatMaps, type HeatKind } from '../sim/heatmaps';
import { waterGeometry } from '../sim/vegetation';
import { CELL, HALF, VEG_N, WORLD_SIZE, cellIndex, getWorld } from '../sim/world';

const SEG = 230;
const world = getWorld();
const C = (hex: string) => new THREE.Color(hex);
const LUSH = C('#5d8f37'), DRY = C('#a39060'), BARE = C('#7d6a4c'), FOREST = C('#3d5a2a'), MUD = C('#6e6248'), ROCKY = C('#7d7a6e');
const WET = C('#2f3a22'), SNOW = C('#eef3f7');

function vegFraction(veg: { B: Float32Array }, x: number, z: number, cap: number) {
  return Math.min(1, veg.B[cellIndex(x, z)] / Math.max(0.1, cap));
}

// ------------------------------------------------------------------ terrain

export function Terrain() {
  const ctl = useController();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, world.heightAt(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    return g;
  }, []);
  const last = useRef(-1);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const sim = ctl.sim;
    if (sim.tick === last.current) return;
    if (last.current >= 0 && Math.abs(sim.tick - last.current) < 15 && sim.tick > last.current) return;
    last.current = sim.tick;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const cap = sim.params.vegCapacity * Math.max(0.3, sim.params.habitat);
    const winter = 1 - Math.min(1, sim.season);
    const snow = Math.min(1, sim.weather.mix.snow * 0.9), wet = sim.weather.mix.rain * 0.18;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const c = cellIndex(x, z);
      const v = vegFraction(sim.veg, x, z, cap);
      tmp.copy(BARE).lerp(DRY, Math.min(1, v * 2.2)).lerp(LUSH, Math.max(0, v - 0.35) / 0.65);
      tmp.lerp(FOREST, world.forest[c] * 0.75);
      if (sim.veg.waterDist[c] < 5) tmp.lerp(MUD, 0.5 * (1 - sim.veg.waterDist[c] / 5));
      const slope = world.slopeAt(x, z);
      if (slope > 0.35) tmp.lerp(ROCKY, Math.min(0.6, (slope - 0.35) * 1.5));
      if (winter > 0) tmp.lerp(DRY, winter * 0.25);
      if (wet > 0.01) tmp.lerp(WET, wet);
      if (snow > 0.01) tmp.lerp(SNOW, snow * (slope > 0.6 ? 0.5 : 0.92) * (1 - 0.35 * world.forest[c]));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  });

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

// ------------------------------------------------------------------ heat overlay

const RAMPS: Record<HeatKind, [string, string, string]> = {
  vegetation: ['#6b4f2a', '#c9b458', '#3fa34d'],
  deer: ['#0b1d3a', '#2f6fdd', '#9cd4ff'],
  wolves: ['#2a0a0a', '#d43a2f', '#ffb199'],
  resources: ['#1d1a2e', '#2a9d8f', '#e9f5a1'],
  predation: ['#1a0612', '#c2185b', '#ffd166'],
};

export function HeatOverlay() {
  const ctl = useController();
  const N = HeatMaps.N;
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [N]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 160, 160);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, world.heightAt(pos.getX(i), pos.getZ(i)) + 0.25);
    // Plane UVs run v from bottom (z = +100) to top; flip so texel rows match grid rows (z ascending).
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    return g;
  }, []);
  const mesh = useRef<THREE.Mesh>(null);
  const lastVersion = useRef(-1);
  const lastKind = useRef<HeatKind | null>(null);
  const cols = useMemo(() => Object.fromEntries(Object.entries(RAMPS).map(([k, v]) => [k, v.map(C)])) as Record<HeatKind, THREE.Color[]>, []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const kind = ctl.heat;
    if (!mesh.current) return;
    mesh.current.visible = !!kind;
    if (!kind) return;
    const heat = ctl.sim.heat;
    if (heat.version === lastVersion.current && kind === lastKind.current) return;
    lastVersion.current = heat.version; lastKind.current = kind;
    const g = heat.grid(kind);
    let max = 0;
    for (let i = 0; i < g.length; i++) max = Math.max(max, g[i]);
    const scale = kind === 'vegetation' || kind === 'resources' ? 1 : Math.max(kind === 'predation' ? 1 : 2, max);
    const data = tex.image.data as Uint8Array;
    const [c0, c1, c2] = cols[kind];
    for (let i = 0; i < g.length; i++) {
      const v = Math.min(1, g[i] / scale);
      tmp.copy(c0).lerp(c1, Math.min(1, v * 2));
      if (v > 0.5) tmp.lerp(c2, (v - 0.5) * 2);
      data[i * 4] = tmp.r * 255; data[i * 4 + 1] = tmp.g * 255; data[i * 4 + 2] = tmp.b * 255;
      data[i * 4 + 3] = kind === 'vegetation' || kind === 'resources' ? 200 : Math.min(230, 40 + v * 260);
    }
    tex.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geo} visible={false} renderOrder={2}>
      <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

// ------------------------------------------------------------------ grass

const GRASS_N = 18000;

export function Grass() {
  const ctl = useController();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number; r: number; s: number }[] = [];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    while (out.length < GRASS_N) {
      const x = (rnd() - 0.5) * (WORLD_SIZE - 2), z = (rnd() - 0.5) * (WORLD_SIZE - 2);
      const c = cellIndex(x, z);
      if (world.forest[c] > 0.55 || world.streamDist[c] < 3 || world.pondDist[c] < 11) continue;
      out.push({ x, z, r: rnd() * Math.PI, s: 0.7 + rnd() * 0.6 });
    }
    return out;
  }, []);
  const geo = useMemo(() => {
    // Three crossed blades.
    const g = new THREE.BufferGeometry();
    const v: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      const dx = Math.cos(a) * 0.18, dz = Math.sin(a) * 0.18;
      v.push(-dx, 0, -dz, dx, 0, dz, 0, 1, 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const last = useRef(-100);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const sim = ctl.sim;
    if (!mesh.current || Math.abs(sim.tick - last.current) < 15) return;
    last.current = sim.tick;
    const cap = sim.params.vegCapacity * Math.max(0.3, sim.params.habitat);
    spots.forEach((s, i) => {
      const v = vegFraction(sim.veg, s.x, s.z, cap);
      const h = 0.08 + 0.75 * v * s.s;
      q.setFromAxisAngle(up, s.r);
      m.compose(new THREE.Vector3(s.x, world.heightAt(s.x, s.z) - 0.02, s.z), q, new THREE.Vector3(1, h, 1));
      mesh.current!.setMatrixAt(i, m);
      col.copy(DRY).lerp(LUSH, v).multiplyScalar(0.85 + 0.25 * s.s - 0.1);
      mesh.current!.setColorAt(i, col);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, GRASS_N]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------ trees, rocks, bushes

export function Flora() {
  const ctl = useController();
  const conifers = world.obstacles.filter((o) => o.kind === 'conifer');
  const broad = world.obstacles.filter((o) => o.kind === 'broadleaf');
  const rocks = world.obstacles.filter((o) => o.kind === 'rock');
  const crowns = useRef<THREE.InstancedMesh>(null);
  const lastSeason = useRef(-1);

  const build = useMemo(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const set = (mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = 0, color?: THREE.Color) => {
      if (!mesh) return;
      q.setFromEuler(e.set(0, rot, 0));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(i, m);
      if (color) mesh.setColorAt(i, color);
    };
    return set;
  }, []);

  const refs = {
    conTrunk: useRef<THREE.InstancedMesh>(null), con1: useRef<THREE.InstancedMesh>(null), con2: useRef<THREE.InstancedMesh>(null), con3: useRef<THREE.InstancedMesh>(null),
    brTrunk: useRef<THREE.InstancedMesh>(null), rock: useRef<THREE.InstancedMesh>(null), bush: useRef<THREE.InstancedMesh>(null),
  };
  const ready = useRef(false);

  useFrame(() => {
    if (!ready.current && refs.conTrunk.current) {
      ready.current = true;
      const col = new THREE.Color();
      conifers.forEach((o, i) => {
        const y = world.heightAt(o.x, o.z), s = o.scale;
        build(refs.conTrunk.current, i, o.x, y + 1.0 * s, o.z, s, s, s);
        col.setHSL(0.31 + o.tint * 0.06, 0.45, 0.2 + o.tint * 0.08);
        build(refs.con1.current, i, o.x, y + 2.6 * s, o.z, s, s, s, o.rot, col);
        build(refs.con2.current, i, o.x, y + 3.9 * s, o.z, s * 0.78, s * 0.85, s * 0.78, o.rot, col);
        build(refs.con3.current, i, o.x, y + 5.0 * s, o.z, s * 0.52, s * 0.7, s * 0.52, o.rot, col);
      });
      broad.forEach((o, i) => {
        const y = world.heightAt(o.x, o.z), s = o.scale;
        build(refs.brTrunk.current, i, o.x, y + 1.2 * s, o.z, s * 1.1, s * 1.2, s * 1.1);
      });
      rocks.forEach((o, i) => {
        const y = world.heightAt(o.x, o.z), s = o.scale;
        col.setHSL(0.09, 0.06, 0.38 + o.tint * 0.15);
        build(refs.rock.current, i, o.x, y + 0.25 * s, o.z, s * 1.1, s * (0.6 + o.tint * 0.4), s * 0.9, o.rot, col);
      });
      world.bushes.forEach((b, i) => {
        const y = world.heightAt(b.x, b.z);
        col.setHSL(0.27 + b.tint * 0.06, 0.42, 0.24 + b.tint * 0.08);
        build(refs.bush.current, i, b.x, y + 0.35 * b.s, b.z, b.s * 1.2, b.s * 0.8, b.s, b.tint * 6, col);
      });
      for (const r of Object.values(refs)) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; }
    }
    // Broadleaf crowns follow the seasons: green in summer, gold in autumn, thin in winter.
    const season = Math.round(((ctl.sim.day % 100) + 100) % 100);
    if (crowns.current && season !== lastSeason.current) {
      lastSeason.current = season;
      const f = season / 100;
      const col = new THREE.Color();
      const amp = ctl.sim.params.seasonality;
      broad.forEach((o, i) => {
        const y = world.heightAt(o.x, o.z), s = o.scale;
        const autumn = amp * Math.max(0, Math.sin(Math.PI * (f - 0.4) / 0.35)) * (f > 0.4 && f < 0.75 ? 1 : 0);
        const winter = amp * (f > 0.62 && f < 0.9 ? Math.sin(Math.PI * (f - 0.62) / 0.28) : 0);
        col.setHSL(0.27 - autumn * 0.19 + o.tint * 0.04, 0.5 - winter * 0.3, 0.3 + o.tint * 0.08 + autumn * 0.08);
        const leaf = 1 - winter * 0.45;
        build(crowns.current, i, o.x, y + 3.1 * s, o.z, s * 1.9 * leaf, s * 1.6 * leaf, s * 1.9 * leaf, o.rot, col);
      });
      crowns.current.instanceMatrix.needsUpdate = true;
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
    }
  });

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.26, 2, 6), []);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(1.5, 2.6, 7), []);
  const crownGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(0.8, 0), []);
  const bushGeo = useMemo(() => new THREE.IcosahedronGeometry(0.7, 0), []);

  return (
    <group>
      <instancedMesh ref={refs.conTrunk} args={[trunkGeo, undefined, conifers.length]} castShadow><meshStandardMaterial color="#5b4030" roughness={1} /></instancedMesh>
      <instancedMesh ref={refs.con1} args={[coneGeo, undefined, conifers.length]} castShadow receiveShadow><meshStandardMaterial flatShading roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.con2} args={[coneGeo, undefined, conifers.length]} castShadow><meshStandardMaterial flatShading roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.con3} args={[coneGeo, undefined, conifers.length]} castShadow><meshStandardMaterial flatShading roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.brTrunk} args={[trunkGeo, undefined, broad.length]} castShadow><meshStandardMaterial color="#5e4634" roughness={1} /></instancedMesh>
      <instancedMesh ref={crowns} args={[crownGeo, undefined, broad.length]} castShadow receiveShadow><meshStandardMaterial flatShading roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.rock} args={[rockGeo, undefined, rocks.length]} castShadow receiveShadow><meshStandardMaterial flatShading roughness={0.95} /></instancedMesh>
      <instancedMesh ref={refs.bush} args={[bushGeo, undefined, world.bushes.length]} castShadow><meshStandardMaterial flatShading roughness={1} /></instancedMesh>
    </group>
  );
}

// ------------------------------------------------------------------ water

export function Water() {
  const ctl = useController();
  const streams = useRef<(THREE.Mesh | null)[]>([]);
  const ponds = useRef<(THREE.Mesh | null)[]>([]);
  const lastLevel = useRef(-1);

  useFrame(({ clock }) => {
    const level = ctl.sim.veg.level;
    const mat = streams.current[0]?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.12 + 0.04 * Math.sin(clock.elapsedTime * 1.3);
    if (level === lastLevel.current || streams.current.some((m) => !m) || ponds.current.some((m) => !m)) return;
    lastLevel.current = level;
    const { streamHalfWidth, pondRadius } = waterGeometry(level);
    world.streams.forEach((pts, si) => {
      const mesh = streams.current[si]!;
      // The tributary is narrower (its distance field is offset by 1.2 m).
      const half = si === 0 ? streamHalfWidth : streamHalfWidth - 1.2;
      mesh.visible = half > 0.05;
      if (!mesh.visible) return;
      const verts: number[] = [], idx: number[] = [];
      const w = half + 0.6;
      pts.forEach((p, i) => {
        const n = pts[Math.min(pts.length - 1, i + 1)], b = pts[Math.max(0, i - 1)];
        const tx = n.x - b.x, tz = n.z - b.z, L = Math.hypot(tx, tz) || 1;
        const nx = -tz / L, nz = tx / L;
        const y = Math.min(world.heightAt(p.x, p.z), world.heightAt(p.x + nx * w, p.z + nz * w), world.heightAt(p.x - nx * w, p.z - nz * w)) + 0.35 + level * 0.3;
        verts.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
        if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      mesh.geometry.dispose();
      mesh.geometry = g;
    });
    world.ponds.forEach((p, pi) => {
      const mesh = ponds.current[pi]!;
      const r = pondRadius > 0 ? pondRadius + (p.r - 10) : 0;
      mesh.visible = r > 0.2;
      mesh.scale.setScalar(Math.max(0.01, r + 0.8));
      mesh.position.set(p.x, world.heightAt(p.x, p.z) + 0.35 + level * 0.4, p.z);
    });
  });

  return (
    <group>
      {world.streams.map((_, i) => (
        <mesh key={`s${i}`} ref={(el) => { streams.current[i] = el; }} receiveShadow>
          <bufferGeometry />
          <meshStandardMaterial color="#3b7fa8" emissive="#2a6f9a" emissiveIntensity={0.12} roughness={0.12} metalness={0.1} transparent opacity={0.86} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {world.ponds.map((_, i) => (
        <mesh key={`p${i}`} ref={(el) => { ponds.current[i] = el; }} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1, 48]} />
          <meshStandardMaterial color="#3b7fa8" emissive="#2a6f9a" emissiveIntensity={0.12} roughness={0.12} metalness={0.1} transparent opacity={0.88} />
        </mesh>
      ))}
    </group>
  );
}

export const WORLD_HALF = HALF;
export const VEG_CELL = CELL;
export const VEG_GRID = VEG_N;
