import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useController } from '../runtime/context';
import { getWorld } from '../sim/world';
import { speciesName } from '../sim/species';

const world = getWorld();
const SLOTS = 6;
const MAX_LINES = 60;
const STALK = new THREE.Color('#ffb02e'), CHASE = new THREE.Color('#ff3b30');

/**
 * Makes hunts impossible to miss:
 * - the hunted deer gets a pulsing ring, a bobbing arrow and a label (amber while the wolves
 *   stalk, red once the chase is on);
 * - lines tie each hunting wolf to its target;
 * - a kill sends up a red column and shock ring; an escape a green ring.
 */
export function HuntMarkers() {
  const ctl = useController();
  const groups = useRef<(THREE.Group | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const arrows = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const ringMats = useMemo(() => Array.from({ length: SLOTS }, () => new THREE.MeshBasicMaterial({ color: STALK, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })), []);
  const arrowMats = useMemo(() => Array.from({ length: SLOTS }, () => new THREE.MeshBasicMaterial({ color: STALK })), []);

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINES * 6), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_LINES * 6), 3));
    return g;
  }, []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false }), []);
  const lines = useMemo(() => { const l = new THREE.LineSegments(lineGeo, lineMat); l.frustumCulled = false; l.renderOrder = 5; return l; }, [lineGeo, lineMat]);

  // Outcome bursts
  const bursts = useRef<(THREE.Group | null)[]>([]);
  const burstRingMats = useMemo(() => Array.from({ length: SLOTS }, () => new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, depthWrite: false, side: THREE.DoubleSide })), []);
  const beamMats = useMemo(() => Array.from({ length: SLOTS }, () => new THREE.MeshBasicMaterial({ color: '#ff4b3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), []);
  const burstLabels = useRef<(HTMLDivElement | null)[]>([]);

  useFrame(({ clock }) => {
    const sim = ctl.sim;
    const show = ctl.huntAlerts;
    const t = clock.elapsedTime;
    const lerpPos = (id: number) => {
      const a = sim.byId.get(id);
      if (!a) return null;
      const x = a.px + (a.x - a.px) * ctl.alpha, z = a.pz + (a.z - a.pz) * ctl.alpha;
      return { x, z, y: world.heightAt(x, z) + a.alt };
    };

    // Active hunts, most advanced first.
    const hunts = show ? [...sim.hunts.active.values()].sort((a, b) => (a.phase === b.phase ? a.gap - b.gap : a.phase === 'chase' ? -1 : 1)) : [];
    const pos = lineGeo.attributes.position as THREE.BufferAttribute;
    const col = lineGeo.attributes.color as THREE.BufferAttribute;
    let nl = 0;
    for (let s = 0; s < SLOTS; s++) {
      const g = groups.current[s];
      const label = labels.current[s];
      const h = hunts[s];
      const p = h ? lerpPos(h.deerId) : null;
      if (!g) continue;
      g.visible = !!p;
      if (label) label.style.display = p ? '' : 'none';
      if (!h || !p) continue;
      const chase = h.phase === 'chase';
      const c = chase ? CHASE : STALK;
      g.position.set(p.x, p.y, p.z);
      ringMats[s].color.copy(c);
      arrowMats[s].color.copy(c);
      const pulse = chase ? 1 + 0.25 * Math.sin(t * 14) : 1 + 0.15 * Math.sin(t * 5);
      rings.current[s]?.scale.setScalar(pulse * (chase ? 1.4 : 1.15));
      ringMats[s].opacity = chase ? 0.95 : 0.75;
      const arrow = arrows.current[s];
      if (arrow) { arrow.position.y = 5 + Math.sin(t * (chase ? 9 : 4)) * 0.6; arrow.rotation.y = t * 2; }
      if (label) {
        const txt = chase ? `CHASE! · ${h.gap.toFixed(0)} m` : `STALKED · ${h.wolfIds.length} ${speciesName(h.predator, h.wolfIds.length)}`;
        if (label.textContent !== txt) label.textContent = txt;
        label.dataset.phase = h.phase;
      }
      for (const wid of h.wolfIds) {
        if (nl >= MAX_LINES) break;
        const wp = lerpPos(wid);
        if (!wp) continue;
        pos.setXYZ(nl * 2, wp.x, wp.y + 0.9, wp.z);
        pos.setXYZ(nl * 2 + 1, p.x, p.y + 0.9, p.z);
        col.setXYZ(nl * 2, c.r, c.g, c.b);
        col.setXYZ(nl * 2 + 1, c.r, c.g, c.b);
        nl++;
      }
    }
    lineGeo.setDrawRange(0, nl * 2);
    pos.needsUpdate = true; col.needsUpdate = true;
    lines.visible = nl > 0;
    lineMat.opacity = 0.55 + 0.35 * Math.abs(Math.sin(t * 6));

    // Outcome bursts (real-time animation, so they read at any speed).
    const now = performance.now();
    const flashes = show ? ctl.huntFlashes.slice(-SLOTS) : [];
    for (let s = 0; s < SLOTS; s++) {
      const b = bursts.current[s];
      const lb = burstLabels.current[s];
      const f = flashes[s];
      if (!b) continue;
      const age = f ? (now - f.at) / 1000 : 99;
      b.visible = age < 6;
      if (lb) lb.style.display = age < 6 ? '' : 'none';
      if (!f || age >= 6) continue;
      const kill = f.outcome === 'kill';
      b.position.set(f.x, world.heightAt(f.x, f.z), f.z);
      const ring = b.children[0] as THREE.Mesh, beam = b.children[1] as THREE.Mesh;
      const k = Math.min(1, age / 1.6);
      ring.scale.setScalar(1 + (kill ? 7 : 5) * (1 - Math.pow(1 - k, 3)));
      burstRingMats[s].color.set(kill ? '#ff3b30' : '#5eea8a');
      burstRingMats[s].opacity = Math.max(0, 1 - age / 2.2);
      beam.visible = kill;
      beamMats[s].opacity = kill ? Math.max(0, 0.5 * (1 - age / 5)) : 0;
      beam.scale.set(1 + 0.3 * Math.sin(t * 20), 1, 1 + 0.3 * Math.sin(t * 20));
      if (lb) {
        const txt = kill ? 'KILL' : 'ESCAPED';
        if (lb.textContent !== txt) lb.textContent = txt;
        lb.dataset.outcome = f.outcome;
        lb.style.opacity = String(Math.max(0, Math.min(1, (6 - age) / 1.5)));
      }
    }
  });

  return (
    <>
      <primitive object={lines} />
      {Array.from({ length: SLOTS }, (_, s) => (
        <group key={`h${s}`} ref={(el) => { groups.current[s] = el; }} visible={false}>
          <mesh ref={(el) => { rings.current[s] = el; }} rotation-x={-Math.PI / 2} position-y={0.15} material={ringMats[s]} renderOrder={4}>
            <ringGeometry args={[1.6, 2.2, 40]} />
          </mesh>
          <mesh ref={(el) => { arrows.current[s] = el; }} rotation-x={Math.PI} position-y={5} material={arrowMats[s]}>
            <coneGeometry args={[0.7, 1.6, 4]} />
          </mesh>
          <Html position={[0, 7.2, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(el) => { labels.current[s] = el; }} className="hunt-label" />
          </Html>
        </group>
      ))}
      {Array.from({ length: SLOTS }, (_, s) => (
        <group key={`b${s}`} ref={(el) => { bursts.current[s] = el; }} visible={false}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.2} material={burstRingMats[s]}>
            <ringGeometry args={[0.8, 1.2, 48]} />
          </mesh>
          <mesh position-y={15} material={beamMats[s]}>
            <cylinderGeometry args={[0.3, 0.55, 30, 12, 1, true]} />
          </mesh>
          <Html position={[0, 4, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(el) => { burstLabels.current[s] = el; }} className="hunt-burst" />
          </Html>
        </group>
      ))}
    </>
  );
}
