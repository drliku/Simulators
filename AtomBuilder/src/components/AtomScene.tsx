import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { NUCLEON_RADIUS, nucleusRadius, nucleusSlots, shellRadius, slotKinds } from '../lib/layout';
import { SHELL_LETTERS, shellCapacity } from '../lib/atom';
import { usePresence } from '../hooks/usePresence';

export type Selection = { kind: 'nucleus' } | { kind: 'shell'; index: number } | null;

interface SceneProps {
  protons: number;
  neutrons: number;
  shells: number[];
  showLabels: boolean;
  animate: boolean;
  autoRotate: boolean;
  selected: Selection;
  onSelect: (s: Selection) => void;
  resetSignal: number;
}

const COLORS = {
  proton: '#F37367',
  neutron: '#a9b4c8',
  electron: '#4cb5ff',
  ring: '#5aa9ff',
  ringHot: '#9fd2ff',
  nucleusGlow: '#F68B81',
};

// ---------------------------------------------------------------------------
// Shared resources
// ---------------------------------------------------------------------------

const sphereGeo = new THREE.SphereGeometry(NUCLEON_RADIUS, 28, 20);
const electronGeo = new THREE.SphereGeometry(0.17, 24, 16);
const labelGeo = new THREE.PlaneGeometry(NUCLEON_RADIUS * 1.25, NUCLEON_RADIUS * 1.25);

const protonMat = new THREE.MeshPhysicalMaterial({
  color: COLORS.proton,
  roughness: 0.32,
  metalness: 0.05,
  clearcoat: 0.6,
  clearcoatRoughness: 0.25,
  emissive: '#5c1a14',
  emissiveIntensity: 0.35,
});
const neutronMat = new THREE.MeshPhysicalMaterial({
  color: COLORS.neutron,
  roughness: 0.38,
  metalness: 0.08,
  clearcoat: 0.5,
  clearcoatRoughness: 0.3,
  emissive: '#1d2433',
  emissiveIntensity: 0.3,
});
const electronMat = new THREE.MeshStandardMaterial({
  color: COLORS.electron,
  emissive: COLORS.electron,
  emissiveIntensity: 1.1,
  roughness: 0.2,
});

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function labelTexture(text: string, color: string) {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = color;
    ctx.font = `700 ${s * 0.72}px 'Saira Semi Condensed', Saira, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s / 2, s / 2 + s * 0.04);
  });
}

const glowTexture = canvasTexture((ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

let labelMats: Record<'p' | 'n' | 'e', THREE.MeshBasicMaterial> | null = null;
function getLabelMats() {
  labelMats ??= {
    p: new THREE.MeshBasicMaterial({ map: labelTexture('+', '#ffffff'), transparent: true, depthWrite: false }),
    n: new THREE.MeshBasicMaterial({ map: labelTexture('n', '#1b2440'), transparent: true, depthWrite: false }),
    e: new THREE.MeshBasicMaterial({ map: labelTexture('−', '#0a1228'), transparent: true, depthWrite: false }),
  };
  return labelMats;
}

const randomDir = () => new THREE.Vector3().randomDirection();

// ---------------------------------------------------------------------------
// Nucleus
// ---------------------------------------------------------------------------

interface NucleonItem {
  id: string;
  kind: 'p' | 'n';
  pos: THREE.Vector3;
}

function Nucleon({ kind, target, alive, showLabel }: { kind: 'p' | 'n'; target: THREE.Vector3; alive: boolean; showLabel: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const s = useRef({ scale: 0, init: false, out: randomDir() });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const st = s.current;
    if (!st.init) {
      st.init = true;
      g.position.copy(randomDir().multiplyScalar(9));
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 6);
    if (alive) {
      g.position.lerp(target, k);
      st.scale += (1 - st.scale) * k;
    } else {
      g.position.addScaledVector(st.out, Math.min(dt, 0.05) * 14);
      st.scale += (0 - st.scale) * k * 1.4;
    }
    g.scale.setScalar(Math.max(st.scale, 0.0001));
  });

  return (
    <group ref={ref} scale={0.0001}>
      <mesh geometry={sphereGeo} material={kind === 'p' ? protonMat : neutronMat} />
      {showLabel && (
        <Billboard>
          <mesh geometry={labelGeo} material={getLabelMats()[kind]} position={[0, 0, NUCLEON_RADIUS * 1.02]} />
        </Billboard>
      )}
    </group>
  );
}

function Nucleus({
  protons,
  neutrons,
  showLabels,
  selected,
  onSelect,
}: {
  protons: number;
  neutrons: number;
  showLabels: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const items = useMemo<NucleonItem[]>(() => {
    const kinds = slotKinds(protons, neutrons);
    const slots = nucleusSlots(protons + neutrons);
    let pi = 0;
    let ni = 0;
    return kinds.map((k, i) => ({
      id: k === 'p' ? `p${pi++}` : `n${ni++}`,
      kind: k,
      pos: new THREE.Vector3(...slots[i]),
    }));
  }, [protons, neutrons]);

  const present = usePresence(items, (t) => t.id, 700);
  const r = nucleusRadius(protons + neutrons);
  const glow = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);

  useFrame(({ clock }) => {
    const m = glow.current;
    if (!m) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    const on = selected ? 0.16 + 0.06 * Math.sin(clock.elapsedTime * 3) : hover ? 0.08 : 0;
    mat.opacity += (on - mat.opacity) * 0.15;
    m.visible = mat.opacity > 0.004;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <group>
      {present.map(({ key, item, alive }) => (
        <Nucleon key={key} kind={item.kind} target={item.pos} alive={alive} showLabel={showLabels} />
      ))}
      {/* Click target + highlight halo */}
      <mesh
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[r + 0.15, 24, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={glow} scale={1.25}>
        <sphereGeometry args={[r + 0.1, 32, 24]} />
        <meshBasicMaterial color={COLORS.nucleusGlow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {selected && (
        <Html position={[0, -(r + 0.55), 0]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-lg border border-proton/40 bg-lab-950/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            Nucleus · <span className="text-proton">{protons} p⁺</span> + <span className="text-neutron">{neutrons} n⁰</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Electrons & shells
// ---------------------------------------------------------------------------

interface ElectronItem {
  id: string;
  shell: number;
  slot: number;
  count: number;
}

const shellSpeed = (i: number) => 0.55 / (1 + i * 0.6);

function Electron({
  item,
  alive,
  radius,
  showLabel,
  clockRef,
}: {
  item: ElectronItem;
  alive: boolean;
  radius: number;
  showLabel: boolean;
  clockRef: MutableRefObject<number[]>;
}) {
  const ref = useRef<THREE.Group>(null);
  const st = useRef({ angle: Math.random() * Math.PI * 2, r: radius + 4, scale: 0 });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = st.current;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5);
    const phase = clockRef.current[item.shell] ?? 0;
    const target = (2 * Math.PI * item.slot) / item.count;
    let diff = (target - s.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    s.angle += diff * k;
    if (alive) {
      s.r += (radius - s.r) * k;
      s.scale += (1 - s.scale) * k;
    } else {
      s.r += Math.min(dt, 0.05) * 9;
      s.scale += (0 - s.scale) * k * 1.3;
    }
    const a = s.angle + phase;
    g.position.set(Math.cos(a) * s.r, Math.sin(a) * s.r, 0);
    g.scale.setScalar(Math.max(s.scale, 0.0001));
  });

  return (
    <group ref={ref} scale={0.0001}>
      <mesh geometry={electronGeo} material={electronMat} />
      <sprite scale={0.95}>
        <spriteMaterial map={glowTexture} color={COLORS.electron} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {showLabel && (
        <Billboard>
          <mesh geometry={labelGeo} material={getLabelMats().e} position={[0, 0, 0.18]} scale={0.6} />
        </Billboard>
      )}
    </group>
  );
}

function ShellRing({
  index,
  radius,
  count,
  selected,
  showLabel,
  onSelect,
}: {
  index: number;
  radius: number;
  count: number;
  selected: boolean;
  showLabel: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const ring = useRef<THREE.Mesh>(null);
  const hot = selected || hover;

  useFrame(() => {
    const m = ring.current;
    if (!m) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    const target = selected ? 1 : hover ? 0.75 : 0.32;
    mat.opacity += (target - mat.opacity) * 0.15;
  });

  const letter = SHELL_LETTERS[index];
  const cap = shellCapacity(index + 1);
  const lp = Math.PI / 4;

  return (
    <group>
      <mesh ref={ring}>
        <torusGeometry args={[radius, hot ? 0.03 : 0.016, 10, 220]} />
        <meshBasicMaterial color={hot ? COLORS.ringHot : COLORS.ring} transparent opacity={0.32} depthWrite={false} />
      </mesh>
      {/* Wide, invisible hit area so the thin ring is easy to click or tap */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <torusGeometry args={[radius, 0.26, 6, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(showLabel || selected) && (
        <Html position={[Math.cos(lp) * radius, Math.sin(lp) * radius, 0]} center zIndexRange={[20, 0]}>
          <div
            className={`pointer-events-none -translate-y-4 translate-x-4 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur transition-colors ${
              selected ? 'border-electron/60 bg-lab-950/90 text-white' : 'border-white/10 bg-lab-950/70 text-lab-200'
            }`}
          >
            {selected ? `Shell ${index + 1} (${letter}) · ${count} e⁻ · max ${cap}` : `${letter} · ${count}`}
          </div>
        </Html>
      )}
    </group>
  );
}

function Electrons({
  shells,
  nucleusR,
  showLabels,
  animate,
  selected,
  onSelect,
}: {
  shells: number[];
  nucleusR: number;
  showLabels: boolean;
  animate: boolean;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const items = useMemo<ElectronItem[]>(() => {
    const out: ElectronItem[] = [];
    let id = 0;
    shells.forEach((count, shell) => {
      for (let slot = 0; slot < count; slot++) out.push({ id: `e${id++}`, shell, slot, count });
    });
    return out;
  }, [shells]);
  const present = usePresence(items, (t) => t.id, 800);

  // One running phase per shell; outer shells turn more slowly.
  const phases = useRef<number[]>([]);
  useFrame((_, dt) => {
    for (let i = 0; i < 7; i++) {
      phases.current[i] = (phases.current[i] ?? i * 0.7) + (animate ? Math.min(dt, 0.05) * shellSpeed(i) : 0);
    }
  });

  return (
    <group>
      {shells.map((count, i) => (
        <ShellRing
          key={`ring-${i}`}
          index={i}
          radius={shellRadius(i, nucleusR)}
          count={count}
          selected={selected?.kind === 'shell' && selected.index === i}
          showLabel={showLabels && selected?.kind !== 'shell'}
          onSelect={() => onSelect({ kind: 'shell', index: i })}
        />
      ))}
      {present.map(({ key, item, alive }) => (
        <Electron
          key={key}
          item={item}
          alive={alive}
          radius={shellRadius(item.shell, nucleusR)}
          showLabel={showLabels}
          clockRef={phases}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function AtomRoot(props: SceneProps) {
  const { protons, neutrons, shells, showLabels, animate, selected, onSelect } = props;
  const group = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  const nucleusR = nucleusRadius(protons + neutrons);
  const outer = shells.length ? shellRadius(shells.length - 1, nucleusR) + 0.3 : nucleusR + 0.6;

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Keep the atom filling the view as it grows or shrinks, on any screen shape.
    const halfView = 15 * Math.tan((21 * Math.PI) / 180) * Math.min(1, size.width / Math.max(size.height, 1));
    const target = Math.min(2.4, (halfView * 0.9) / outer);
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    g.scale.setScalar(g.scale.x + (target - g.scale.x) * k);
  });

  return (
    <group ref={group} rotation={[-0.5, 0.22, 0]} scale={0.5}>
      <Nucleus
        protons={protons}
        neutrons={neutrons}
        showLabels={showLabels}
        selected={selected?.kind === 'nucleus'}
        onSelect={() => onSelect({ kind: 'nucleus' })}
      />
      <Electrons shells={shells} nucleusR={nucleusR} showLabels={showLabels} animate={animate} selected={selected} onSelect={onSelect} />
    </group>
  );
}

function Controls({ autoRotate, resetSignal }: { autoRotate: boolean; resetSignal: number }) {
  const ref = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    if (resetSignal) ref.current?.reset();
  }, [resetSignal]);
  return (
    <OrbitControls
      ref={ref}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      maxDistance={32}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
    />
  );
}

export function AtomScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 15], fov: 42, near: 0.1, far: 200 }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#9cc8ff', '#0a1228', 0.6]} />
      <directionalLight position={[6, 8, 10]} intensity={1.8} />
      <directionalLight position={[-8, -4, -6]} intensity={0.5} color="#7aa7ff" />
      <pointLight position={[0, 0, 0]} intensity={4} distance={6} color="#ffb4a8" />
      <AtomRoot {...props} />
      <Controls autoRotate={props.autoRotate} resetSignal={props.resetSignal} />
    </Canvas>
  );
}
