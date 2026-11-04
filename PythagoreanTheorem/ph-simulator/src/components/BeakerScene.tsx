import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAPACITY_L } from '../lib/lab';
import { indicatorRgb } from '../lib/chemistry';

// ---------------------------------------------------------------------------
// Dimensions (scene units)
// ---------------------------------------------------------------------------

const R = 1.25; // outer radius
const H = 2.9; // glass height
const WALL = 0.06;
const BASE = 0.1; // glass floor thickness
const RI = R - WALL - 0.012; // liquid radius
const FILL_H = 2.5; // liquid height at full capacity

export const levelFor = (volumeL: number) => (Math.min(volumeL, CAPACITY_L) / CAPACITY_L) * FILL_H;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DropEvent {
  id: number;
  beaker: number;
  kind: 'acid' | 'base';
  delay: number; // seconds before release
}

export interface PourEvent {
  id: number;
  beaker: number;
  duration: number; // seconds
}

export interface BeakerSpec {
  ph: number;
  volume: number;
  label?: string;
}

interface SceneProps {
  beakers: BeakerSpec[];
  drops: DropEvent[];
  pours: PourEvent[];
  paused: boolean;
  onDropLanded: (id: number) => void;
  onPourStep: (id: number, fraction: number, done: boolean) => void;
  reagentLabel: { acid: string; base: string };
}

// ---------------------------------------------------------------------------
// Shared resources
// ---------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const glassProfile = (() => {
  const p: THREE.Vector2[] = [];
  const v = (x: number, y: number) => p.push(new THREE.Vector2(x, y));
  v(0, 0);
  v(R - 0.08, 0);
  v(R - 0.02, 0.02);
  v(R, 0.08);
  v(R, H - 0.04);
  v(R + 0.05, H);
  v(R + 0.05, H + 0.03);
  v(R - WALL, H + 0.02);
  v(R - WALL, BASE + 0.04);
  v(R - WALL - 0.04, BASE);
  v(0, BASE);
  return p;
})();
const glassGeo = new THREE.LatheGeometry(glassProfile, 96);

const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#dfefff',
  metalness: 0,
  roughness: 0.04,
  transparent: true,
  opacity: 0.16,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMapIntensity: 2.2,
  side: THREE.DoubleSide,
  depthWrite: false,
  specularIntensity: 1,
});

const rimMat = new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.35, depthWrite: false });

/** Graduations printed on the front of the glass (50 mL steps, labels every 100 mL). */
const gradTexture = canvasTexture(512, 1024, (ctx) => {
  ctx.clearRect(0, 0, 512, 1024);
  ctx.strokeStyle = 'rgba(235,244,255,0.85)';
  ctx.fillStyle = 'rgba(235,244,255,0.9)';
  ctx.lineWidth = 4;
  ctx.font = '600 34px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  const yFor = (ml: number) => {
    const y = BASE + levelFor(ml / 1000);
    return 1024 - (y / H) * 1024;
  };
  for (let ml = 50; ml <= CAPACITY_L * 1000; ml += 50) {
    const y = yFor(ml);
    const major = ml % 100 === 0;
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(major ? 250 : 210, y);
    ctx.stroke();
    if (major) ctx.fillText(`${ml}`, 265, y);
  }
  ctx.font = '600 30px "JetBrains Mono", monospace';
  ctx.fillText('mL', 265, yFor(CAPACITY_L * 1000) - 60);
});
const gradMat = new THREE.MeshBasicMaterial({ map: gradTexture, transparent: true, depthWrite: false, opacity: 0.8 });
const gradGeo = new THREE.CylinderGeometry(R + 0.004, R + 0.004, H, 48, 1, true, -0.55, 1.1);

const gridTexture = (() => {
  const t = canvasTexture(1024, 1024, (ctx) => {
    const g = ctx.createRadialGradient(512, 470, 40, 512, 512, 620);
    g.addColorStop(0, '#26336a');
    g.addColorStop(1, '#0f1430');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = 'rgba(150,170,230,0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }
  });
  return t;
})();

const benchTexture = canvasTexture(512, 512, (ctx) => {
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, '#26306a');
  g.addColorStop(0.35, '#1a2250');
  g.addColorStop(1, '#0f1430');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
});

const shadowTexture = canvasTexture(256, 256, (ctx) => {
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
});

const glowTexture = canvasTexture(256, 256, (ctx) => {
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
});

const streamTexture = (() => {
  const t = canvasTexture(64, 256, (ctx) => {
    for (let y = 0; y < 256; y++) {
      const a = 0.45 + 0.35 * Math.sin(y * 0.25) * Math.sin(y * 0.07);
      ctx.fillStyle = `rgba(200,235,255,${a})`;
      ctx.fillRect(0, y, 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

const SURFACE_SEGMENTS = 18;
const makeSurfaceGeo = () => {
  const g = new THREE.RingGeometry(0.0001, RI, 72, SURFACE_SEGMENTS);
  g.rotateX(-Math.PI / 2);
  return g;
};

// ---------------------------------------------------------------------------
// Beaker with liquid, ripples, bubbles
// ---------------------------------------------------------------------------

interface Ripple {
  x: number;
  z: number;
  t: number;
  amp: number;
}

interface BeakerHandle {
  ripple: (x: number, z: number, amp: number) => void;
  bubbles: (x: number, z: number, n: number) => void;
  surfaceY: () => number;
}

const MAX_BUBBLES = 70;

function Beaker({
  spec,
  paused,
  handleRef,
  showLabel,
}: {
  spec: BeakerSpec;
  paused: boolean;
  handleRef: MutableRefObject<BeakerHandle | null>;
  showLabel: boolean;
}) {
  const body = useRef<THREE.Mesh>(null);
  const top = useRef<THREE.Mesh>(null);
  const bubbleMesh = useRef<THREE.InstancedMesh>(null);
  const surfaceGeo = useMemo(makeSurfaceGeo, []);
  const basePositions = useMemo(() => Float32Array.from(surfaceGeo.attributes.position.array as Float32Array), [surfaceGeo]);

  const liquidMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#4cb848',
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.88,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.2,
        emissive: '#4cb848',
        emissiveIntensity: 0.22,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const topMat = useMemo(() => {
    const m = liquidMat.clone();
    m.opacity = 0.93;
    m.emissiveIntensity = 0.3;
    return m;
  }, [liquidMat]);

  const state = useRef({
    level: levelFor(spec.volume),
    color: new THREE.Color().setRGB(...indicatorRgb(spec.ph), THREE.SRGBColorSpace),
    ripples: [] as Ripple[],
    time: 0,
    calmFrames: 0,
    bubbles: Array.from({ length: MAX_BUBBLES }, () => ({ alive: false, x: 0, y: 0, z: 0, v: 0, s: 0, wob: 0 })),
  });

  handleRef.current = {
    ripple: (x, z, amp) => {
      const r = state.current.ripples;
      r.push({ x, z, t: 0, amp });
      if (r.length > 10) r.shift();
    },
    bubbles: (x, z, n) => {
      const st = state.current;
      let made = 0;
      for (const b of st.bubbles) {
        if (made >= n) break;
        if (b.alive) continue;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 0.35;
        b.alive = true;
        b.x = THREE.MathUtils.clamp(x + Math.cos(a) * d, -RI * 0.85, RI * 0.85);
        b.z = THREE.MathUtils.clamp(z + Math.sin(a) * d, -RI * 0.85, RI * 0.85);
        b.y = BASE + Math.random() * Math.max(0.05, st.level * 0.7);
        b.v = 0.35 + Math.random() * 0.5;
        b.s = 0.018 + Math.random() * 0.03;
        b.wob = Math.random() * 10;
        made++;
      }
    },
    surfaceY: () => BASE + state.current.level,
  };

  const tmp = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const dt = paused ? 0 : Math.min(delta, 0.1);
    const st = state.current;
    st.time += dt;

    // Level and colour ease toward their targets (mixing).
    const lvTarget = levelFor(spec.volume);
    st.level += (lvTarget - st.level) * (1 - Math.exp(-dt * 4));
    target.setRGB(...indicatorRgb(spec.ph), THREE.SRGBColorSpace);
    st.color.lerp(target, 1 - Math.exp(-dt * 2.6));
    liquidMat.color.copy(st.color);
    liquidMat.emissive.copy(st.color);
    topMat.color.copy(st.color).offsetHSL(0, 0, 0.05);
    topMat.emissive.copy(st.color);

    const lv = Math.max(st.level, 0.002);
    if (body.current) {
      body.current.scale.set(1, lv, 1);
      body.current.position.y = BASE + lv / 2;
    }

    // Surface ripples
    if (top.current) {
      top.current.position.y = BASE + lv;
      st.ripples.forEach((r) => (r.t += dt));
      st.ripples = st.ripples.filter((r) => r.t < 3.5);
      const pos = surfaceGeo.attributes.position as THREE.BufferAttribute;
      const calm = st.ripples.length === 0 && st.calmFrames > 2;
      const arr = pos.array as Float32Array;
      const idle = 0;
      for (let i = 0; i < arr.length && !calm; i += 3) {
        const x = basePositions[i];
        const z = basePositions[i + 2];
        let y = idle * (x / RI);
        for (const r of st.ripples) {
          const d = Math.hypot(x - r.x, z - r.z);
          const front = r.t * 1.6;
          const env = Math.exp(-r.t * 1.4) * Math.exp(-Math.pow((d - front) * 2.2, 2));
          y += r.amp * env * Math.sin(d * 14 - r.t * 20);
        }
        // Keep the rim pinned to the glass.
        const rr = Math.hypot(x, z) / RI;
        arr[i + 1] = y * (1 - rr * rr * 0.6);
      }
      st.calmFrames = st.ripples.length === 0 ? st.calmFrames + 1 : 0;
      if (!calm) {
        pos.needsUpdate = true;
        surfaceGeo.computeVertexNormals();
      }
    }

    // Bubbles
    const im = bubbleMesh.current;
    if (im) {
      st.bubbles.forEach((b, i) => {
        if (b.alive) {
          b.y += b.v * dt;
          b.wob += dt * 6;
          if (b.y > BASE + lv - 0.02) b.alive = false;
        }
        tmp.position.set(b.x + Math.sin(b.wob) * 0.02, b.y, b.z);
        tmp.scale.setScalar(b.alive ? b.s : 0);
        tmp.updateMatrix();
        im.setMatrixAt(i, tmp.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Liquid */}
      <mesh ref={body} renderOrder={1} material={liquidMat}>
        <cylinderGeometry args={[RI, RI, 1, 72, 1, true]} />
      </mesh>
      <mesh ref={top} geometry={surfaceGeo} material={topMat} renderOrder={2} />
      <instancedMesh ref={bubbleMesh} args={[undefined, undefined, MAX_BUBBLES]} renderOrder={3}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.55} roughness={0.05} clearcoat={1} depthWrite={false} />
      </instancedMesh>

      {/* Glass */}
      <mesh geometry={glassGeo} material={glassMat} renderOrder={5} />
      <mesh position={[0, H + 0.015, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={6} material={rimMat}>
        <torusGeometry args={[R + 0.02, 0.018, 8, 96]} />
      </mesh>
      <mesh geometry={gradGeo} material={gradMat} position={[0, H / 2, 0]} renderOrder={6} />
      {/* Vertical highlight strips sell the glass */}
      <mesh position={[-R * 0.62, H * 0.52, R * 0.79]} rotation={[0, -0.66, 0]} renderOrder={7}>
        <planeGeometry args={[0.07, H * 0.82]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[R * 0.82, H * 0.5, R * 0.56]} rotation={[0, 0.98, 0]} renderOrder={7}>
        <planeGeometry args={[0.035, H * 0.7]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* Soft contact shadow and coloured glow on the bench */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[R * 3.4, R * 3.4]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
      <BenchGlow ph={spec.ph} paused={paused} />

      {showLabel && spec.label && (
        <Html position={[0, H + 0.55, 0]} center zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-coral/50 bg-lab-950/85 px-3 py-1 text-center font-display text-sm font-bold uppercase tracking-wide text-white backdrop-blur">
            {spec.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function BenchGlow({ ph, paused }: { ph: number; paused: boolean }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const target = useMemo(() => new THREE.Color(), []);
  useFrame((_, d) => {
    target.setRGB(...indicatorRgb(ph), THREE.SRGBColorSpace);
    mat.color.lerp(target, paused ? 0 : 1 - Math.exp(-Math.min(d, 0.1) * 2.6));
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={mat}>
      <planeGeometry args={[R * 4.2, R * 4.2]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Dropper and droplets
// ---------------------------------------------------------------------------

const DROPPER_X = 0.78;
const DROPPER_Z = 0.25;
const TIP_Y = H + 0.55;
const DROPPER_TILT = -0.5; // leans out to the right so it stays clear of the pH readout

function Dropper({ kind, visible, label, paused }: { kind: 'acid' | 'base'; visible: boolean; label: string; paused: boolean }) {
  const g = useRef<THREE.Group>(null);
  const s = useRef({ show: 0 });
  useFrame((_, d) => {
    const dt = paused ? 0 : Math.min(d, 0.1);
    s.current.show += ((visible ? 1 : 0) - s.current.show) * (1 - Math.exp(-dt * 6));
    if (g.current) {
      const off = (1 - s.current.show) * 2.5;
      g.current.position.set(DROPPER_X - Math.sin(DROPPER_TILT) * off, TIP_Y + Math.cos(DROPPER_TILT) * off, DROPPER_Z);
      g.current.visible = s.current.show > 0.02;
    }
  });
  const color = kind === 'acid' ? '#f26522' : '#6c4bd6';
  return (
    <group ref={g} position={[DROPPER_X, TIP_Y + 2.5, DROPPER_Z]} rotation={[0, 0, DROPPER_TILT]}>
      {/* glass tube */}
      <mesh position={[0, 0.75, 0]} renderOrder={8}>
        <cylinderGeometry args={[0.07, 0.035, 1.5, 24, 1, true]} />
        <meshPhysicalMaterial color="#e6f3ff" transparent opacity={0.3} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.045, 0.026, 1.0, 16]} />
        <meshPhysicalMaterial color="#eaf6ff" transparent opacity={0.45} roughness={0.1} />
      </mesh>
      {/* rubber bulb */}
      <mesh position={[0, 1.75, 0]}>
        <capsuleGeometry args={[0.16, 0.38, 8, 24]} />
        <meshPhysicalMaterial color={color} roughness={0.45} clearcoat={0.4} />
      </mesh>
      <Html position={[0.32, 1.7, 0]} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-white/20 bg-lab-950/85 px-2.5 py-1 font-mono text-[11px] font-semibold text-white backdrop-blur">
          {label}
        </div>
      </Html>
    </group>
  );
}

function Droplet({
  drop,
  paused,
  beaker,
  onLand,
}: {
  drop: DropEvent;
  paused: boolean;
  beaker: MutableRefObject<BeakerHandle | null>;
  onLand: (id: number) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const s = useRef({ wait: drop.delay, y: TIP_Y - 0.02, v: 0, grow: 0, landed: false });
  useFrame((_, d) => {
    const dt = paused ? 0 : Math.min(d, 0.1);
    const st = s.current;
    const m = ref.current;
    if (!m || st.landed) return;
    if (st.wait > 0) {
      st.wait -= dt;
      // Droplet swells at the tip before it falls.
      st.grow = Math.min(1, 1 - Math.max(st.wait, 0) / Math.max(drop.delay, 0.001));
      m.visible = st.wait < 0.25;
      m.scale.set(0.7 + 0.3 * st.grow, 0.7 + 0.45 * st.grow, 0.7 + 0.3 * st.grow);
      m.position.set(DROPPER_X, st.y, DROPPER_Z);
      return;
    }
    m.visible = true;
    st.v += 9.8 * dt * 0.55;
    st.y -= st.v * dt;
    m.position.set(DROPPER_X, st.y, DROPPER_Z);
    m.scale.set(0.9, 1.25 + Math.min(st.v * 0.08, 0.4), 0.9);
    const surface = beaker.current?.surfaceY() ?? BASE;
    if (st.y <= surface) {
      st.landed = true;
      m.visible = false;
      beaker.current?.ripple(DROPPER_X, DROPPER_Z, 0.035);
      beaker.current?.bubbles(DROPPER_X, DROPPER_Z, 6);
      onLand(drop.id);
    }
  });
  const color = drop.kind === 'acid' ? '#ffd2bf' : '#d9ccff';
  return (
    <mesh ref={ref} visible={false} renderOrder={9}>
      <sphereGeometry args={[0.065, 16, 12]} />
      <meshPhysicalMaterial color={color} transparent opacity={0.85} roughness={0.02} clearcoat={1} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Water pour
// ---------------------------------------------------------------------------

const POUR_X = -0.75;
const POUR_Z = 0.25;
const POUR_TOP = H + 1.6;

function PourStream({
  pour,
  paused,
  beaker,
  onStep,
}: {
  pour: PourEvent;
  paused: boolean;
  beaker: MutableRefObject<BeakerHandle | null>;
  onStep: (id: number, fraction: number, done: boolean) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const flask = useRef<THREE.Group>(null);
  const s = useRef({ t: 0, sent: 0, done: false, rippleClock: 0 });
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: streamTexture,
        color: '#bfe6ff',
        transparent: true,
        opacity: 0.75,
        roughness: 0.05,
        clearcoat: 1,
        emissive: '#5cc8ff',
        emissiveIntensity: 0.25,
        depthWrite: false,
      }),
    [],
  );
  useFrame((_, d) => {
    const dt = paused ? 0 : Math.min(d, 0.1);
    const st = s.current;
    if (st.done) return;
    st.t += dt;
    const lead = 0.35; // time for the stream to reach the surface
    const tail = 0.3;
    const total = pour.duration + lead + tail;
    const surface = beaker.current?.surfaceY() ?? BASE;
    const topY = POUR_TOP - 0.15;
    const reach = Math.min(1, st.t / lead);
    const endT = st.t - lead - pour.duration;
    const detach = THREE.MathUtils.clamp(endT / tail, 0, 1);
    const bottom = topY - (topY - surface) * reach;
    const upper = topY - (topY - surface) * detach;
    const len = Math.max(0.001, upper - bottom);
    if (ref.current) {
      ref.current.scale.set(1, len, 1);
      ref.current.position.set(POUR_X, bottom + len / 2, POUR_Z);
      ref.current.visible = detach < 1;
    }
    streamTexture.offset.y -= dt * 3;
    if (flask.current) {
      const tilt = THREE.MathUtils.clamp(Math.min(st.t / 0.3, (total - st.t) / 0.3), 0, 1);
      flask.current.rotation.z = -0.9 * tilt;
      flask.current.position.y = POUR_TOP + 0.05 + (1 - tilt) * 0.5;
      (flask.current.children as THREE.Mesh[]).forEach((c) => ((c.material as THREE.Material).opacity = 0.35 * tilt + 0.05));
    }
    // Water arrives at the surface after the lead time.
    if (st.t > lead) {
      const frac = Math.min(1, (st.t - lead) / pour.duration);
      if (frac > st.sent) {
        onStep(pour.id, frac - st.sent, frac >= 1);
        st.sent = frac;
      }
      st.rippleClock -= dt;
      if (frac < 1 && st.rippleClock <= 0) {
        st.rippleClock = 0.12;
        beaker.current?.ripple(POUR_X, POUR_Z, 0.02);
        beaker.current?.bubbles(POUR_X, POUR_Z, 3);
      }
    }
    if (st.t >= total) st.done = true;
  });
  return (
    <group>
      <mesh ref={ref} material={mat} renderOrder={9} visible={false}>
        <cylinderGeometry args={[0.05, 0.07, 1, 16, 1, true]} />
      </mesh>
      {/* simple wash bottle spout above the beaker */}
      <group ref={flask} position={[POUR_X - 0.1, POUR_TOP + 0.55, POUR_Z]} scale={[-1, 1, 1]}>
        <mesh position={[0.35, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.08, 0.6, 16, 1, true]} />
          <meshPhysicalMaterial color="#d8eeff" transparent opacity={0.05} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0.9, 0.1, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.9, 32]} />
          <meshPhysicalMaterial color="#d8eeff" transparent opacity={0.05} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function Lab(props: SceneProps) {
  const { beakers, drops, pours, paused, onDropLanded, onPourStep, reagentLabel } = props;
  const handles = useRef<MutableRefObject<BeakerHandle | null>[]>([]);
  while (handles.current.length < 2) handles.current.push({ current: null });

  const compare = beakers.length > 1;
  const spacing = 3.0;
  const activeDrop = drops.find((d) => d.beaker === 0);

  return (
    <>
      {beakers.map((b, i) => (
        <group
          key={i}
          position={[compare ? (i === 0 ? -spacing / 2 : spacing / 2) : 0, 0, 0]}
          scale={compare ? 0.82 : 1}
        >
          <Beaker spec={b} paused={paused} handleRef={handles.current[i]} showLabel={compare} />
          {i === 0 && !compare && (
            <>
              <Dropper
                kind={activeDrop?.kind ?? 'acid'}
                visible={!!activeDrop}
                label={reagentLabel[activeDrop?.kind ?? 'acid']}
                paused={paused}
              />
              {drops
                .filter((d) => d.beaker === 0)
                .map((d) => (
                  <Droplet key={d.id} drop={d} paused={paused} beaker={handles.current[0]} onLand={onDropLanded} />
                ))}
              {pours
                .filter((p) => p.beaker === 0)
                .map((p) => (
                  <PourStream key={p.id} pour={p} paused={paused} beaker={handles.current[0]} onStep={onPourStep} />
                ))}
            </>
          )}
        </group>
      ))}

      {/* Bench (fades into the backdrop) and backdrop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[14, 64]} />
        <meshBasicMaterial map={benchTexture} />
      </mesh>
      <mesh position={[0, 4, -6]}>
        <planeGeometry args={[30, 18]} />
        <meshBasicMaterial map={gridTexture} />
      </mesh>
    </>
  );
}

/** Places the camera so the beaker(s) fit any screen shape, keeping the current viewing angle. */
function CameraFit({ compare }: { compare: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const fitW = compare ? 6.6 : 4.4;
    const fitH = compare ? 5.2 : 6.4;
    const dist = Math.max(fitH / (2 * half), fitW / (2 * half * aspect));
    const target = new THREE.Vector3(0, compare ? 1.7 : 2.1, 0);
    const dir = camera.position.clone().sub(controls?.target ?? target).normalize();
    if (!Number.isFinite(dir.x) || dir.lengthSq() === 0) dir.set(0, 0.16, 1).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    controls?.target.copy(target);
    controls?.update();
  }, [camera, compare, controls, size.width, size.height]);
  return null;
}

function CameraRig({ compare }: { compare: boolean }) {
  return (
    <OrbitControls
      makeDefault
      target={[0, compare ? 1.7 : 2.1, 0]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={compare ? 26 : 22}
      minPolarAngle={0.55}
      maxPolarAngle={1.52}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
    />
  );
}

export function BeakerScene(props: SceneProps) {
  const compare = props.beakers.length > 1;
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: compare ? [0, 3.1, 10.5] : [0, 3.0, 8.6], fov: 38, near: 0.1, far: 100 }}
      style={{ touchAction: 'none' }}
      key={compare ? 'compare' : 'single'}
    >
      <color attach="background" args={['#0f1430']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 6]} intensity={1.4} />
      <directionalLight position={[-6, 3, -4]} intensity={0.5} color="#8fb4ff" />
      <spotLight position={[0, 9, 2]} angle={0.45} penumbra={0.8} intensity={30} color="#ffffff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -6]} scale={[10, 4, 1]} color="#cfe3ff" />
        <Lightformer form="rect" intensity={2} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#9ec5ff" />
        <Lightformer form="rect" intensity={1.5} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={4} color="#ffffff" />
      </Environment>
      <Lab {...props} />
      <CameraRig compare={compare} />
      <CameraFit compare={compare} />
    </Canvas>
  );
}
