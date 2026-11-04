import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { useController } from '../runtime/context';
import type { Controller } from '../runtime/controller';
import { ControllerContext } from '../runtime/context';
import { getWorld } from '../sim/world';
import { AnimalHerd, Birds, Carcasses } from './Animals';
import { FAUNA_IDS, SPECIES } from '../sim/species';
import { HALF } from '../sim/world';
import { Flora, Grass, HeatOverlay, Terrain, Water } from './World';
import { HuntMarkers } from './Hunts';
import { WeatherFX, weatherFx } from './Weather';

const world = getWorld();

/** Advances the simulation from the render loop (fixed timestep inside the controller). */
function Driver() {
  const ctl = useController();
  useFrame((_, dt) => ctl.frame(dt, performance.now()));
  return null;
}

const SKY = {
  night: new THREE.Color('#0a1122'), dawn: new THREE.Color('#e4a272'), day: new THREE.Color('#9fc4e3'),
  overcast: new THREE.Color('#8b959e'), overcastNight: new THREE.Color('#12161b'), storm: new THREE.Color('#3f474f'), fog: new THREE.Color('#b9c2c8'), flash: new THREE.Color('#e6ecff'),
};

/** Sun, moon, sky colour and fog from the model's time of day. */
function Lighting() {
  const ctl = useController();
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const stars = useRef<THREE.Points>(null);
  const { scene, camera, controls } = useThree();
  const bg = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog('#9fc4e3', 160, 420), []);
  scene.fog = fog;

  useFrame(() => {
    // At high speed a full day passes in about a second; show steady daylight instead of strobing.
    const visualCycle = ctl.dayNight && ctl.speed <= 2;
    const t = visualCycle ? ctl.sim.timeOfDay : 0.58;
    const elev = Math.sin(2 * Math.PI * (t - 0.25));
    const day = Math.min(1, Math.max(0, (elev + 0.12) / 0.4));
    const golden = Math.max(0, 1 - Math.abs(elev) / 0.35) * day;
    const ang = 2 * Math.PI * (t - 0.25);
    const wm = ctl.sim.weather.mix;
    const flash = weatherFx.flash;
    if (sun.current) {
      sun.current.position.set(Math.cos(ang) * 260, Math.max(14, Math.sin(ang) * 300), 100);
      sun.current.intensity = 2.4 * day * (1 - 0.78 * wm.cloud);
      sun.current.color.setRGB(1, 0.85 + 0.15 * (1 - golden), 0.7 + 0.3 * (1 - golden));
    }
    if (moon.current) moon.current.intensity = 0.35 * (1 - day) * (1 - 0.8 * wm.cloud);
    if (hemi.current) hemi.current.intensity = (0.4 + 0.5 * day) * (1 - 0.25 * wm.cloud) + 2.2 * flash;
    bg.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.dawn, golden * 0.55 * (1 - wm.cloud));
    tmp.copy(SKY.overcastNight).lerp(SKY.overcast, day);
    bg.lerp(tmp, wm.cloud * 0.85);
    bg.lerp(SKY.storm, wm.storm * 0.6 * (0.3 + 0.7 * day));
    tmp.copy(SKY.overcastNight).lerp(SKY.fog, day);
    bg.lerp(tmp, wm.fog * 0.7);
    bg.lerp(SKY.flash, flash * 0.55);
    scene.background = bg;
    fog.color.copy(bg);
    // Fog distances follow the camera so haze reads the same from close up and from above.
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const d = target ? camera.position.distanceTo(target) : 150;
    const thick = Math.min(1, wm.fog + 0.35 * wm.rain + 0.3 * wm.snow);
    fog.near = Math.max(4, d * (1.3 - 1.05 * thick));
    fog.far = d + 300 * (1 - 0.82 * thick) + 20;
    if (stars.current) stars.current.visible = day < 0.4 && wm.cloud < 0.5;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#dfefff', '#4b5a33', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={2.4}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-HALF - 10}
        shadow-camera-right={HALF + 10}
        shadow-camera-top={HALF + 10}
        shadow-camera-bottom={-HALF - 10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <directionalLight ref={moon} position={[-80, 120, -60]} color="#9fb6ff" intensity={0} />
      <Stars ref={stars as never} radius={600} depth={80} count={2500} factor={5} fade speed={0.3} />
    </>
  );
}

const DEFAULT_CAM = new THREE.Vector3(20, 115, 190);

/** Orbit controls plus follow, top-down, cinematic and reset modes, with smooth transitions. */
function CameraRig() {
  const ctl = useController();
  const controls = useRef<OrbitImpl>(null);
  const { camera } = useThree();
  (window as unknown as { ecosystemCamera: THREE.Camera }).ecosystemCamera = camera;
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  const lastCmd = useRef(0);
  const lastFollow = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    (window as unknown as { ecosystemControls: OrbitImpl }).ecosystemControls = c;
    const cmd = ctl.cameraCommand;
    if (cmd.n !== lastCmd.current) {
      lastCmd.current = cmd.n;
      const tgt = c.target.clone();
      if (cmd.kind === 'reset') goal.current = { pos: DEFAULT_CAM.clone(), target: new THREE.Vector3(0, 0, 0), t: 0 };
      if (cmd.kind === 'top') goal.current = { pos: new THREE.Vector3(tgt.x, 420, tgt.z + 0.1), target: new THREE.Vector3(tgt.x, 0, tgt.z), t: 0 };
      if (cmd.kind === 'cinematic') goal.current = { pos: new THREE.Vector3(250, 110, 0), target: new THREE.Vector3(0, 0, 0), t: 0 };
      if (cmd.kind === 'follow') {
        const a = ctl.sim.byId.get(ctl.selectedId);
        if (a) {
          const p = new THREE.Vector3(a.x, world.heightAt(a.x, a.z) + 1, a.z);
          goal.current = { pos: p.clone().add(new THREE.Vector3(-14, 11, 14)), target: p, t: 0 };
          lastFollow.current.copy(p);
        }
      }
    }
    // Smooth fly-to
    if (goal.current) {
      const g = goal.current;
      g.t = Math.min(1, g.t + dt * 1.2);
      const k = 1 - Math.pow(1 - g.t, 3);
      camera.position.lerp(g.pos, k * 0.25 + 0.02);
      c.target.lerp(g.target, k * 0.25 + 0.02);
      if (g.t >= 1 && camera.position.distanceTo(g.pos) < 0.5) goal.current = null;
    }
    // Follow: move the target and camera together with the animal (interpolated).
    if (ctl.cameraMode === 'follow' && !goal.current) {
      const a = ctl.sim.byId.get(ctl.selectedId);
      if (a) {
        const x = a.px + (a.x - a.px) * ctl.alpha, z = a.pz + (a.z - a.pz) * ctl.alpha;
        const p = new THREE.Vector3(x, world.heightAt(x, z) + 1, z);
        const delta = p.clone().sub(lastFollow.current);
        if (delta.length() < 20) { camera.position.add(delta); c.target.add(delta); }
        lastFollow.current.copy(p);
        c.target.lerp(p, 0.1);
      }
    }
    c.autoRotate = ctl.cameraMode === 'cinematic';
    c.autoRotateSpeed = 0.35;
    c.update();
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI * 0.47}
      minDistance={6}
      maxDistance={620}
      screenSpacePanning={false}
    />
  );
}

/** Ring under the selected animal and, optionally, its detection radius traced over the terrain. */
function SelectionMarker() {
  const ctl = useController();
  const ring = useRef<THREE.Mesh>(null);
  const SEGS = 72;
  const lineGeo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 3), 3)), []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.8 }), []);
  const lineObj = useMemo(() => new THREE.Line(lineGeo, lineMat), [lineGeo, lineMat]);

  useFrame(({ clock }) => {
    const a = ctl.sim.byId.get(ctl.selectedId);
    if (!ring.current) return;
    ring.current.visible = !!a;
    lineObj.visible = !!a && ctl.showRadius;
    if (!a) return;
    const x = a.px + (a.x - a.px) * ctl.alpha, z = a.pz + (a.z - a.pz) * ctl.alpha;
    ring.current.position.set(x, world.heightAt(x, z) + 0.12, z);
    ring.current.scale.setScalar(1 + 0.08 * Math.sin(clock.elapsedTime * 4));
    if (ctl.showRadius) {
      const p = ctl.sim.params;
      const S = SPECIES[a.species];
      const hunter = S.prey.length > 0;
      const r = a.species === 'deer' ? p.detectionRadius * (0.5 + 0.5 * ctl.sim.daylight)
        : a.species === 'wolf' ? p.wolfSensing * (0.75 + 0.25 * ctl.sim.daylight)
        : hunter && S.hunt ? S.hunt.sensing : S.detection;
      lineMat.color.set(hunter ? '#ff7a6b' : '#7cc4ff');
      const pos = lineGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i <= SEGS; i++) {
        const ang = (i / SEGS) * Math.PI * 2;
        const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
        pos.setXYZ(i, px, world.heightAt(px, pz) + 0.3, pz);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[1.1, 1.45, 40]} />
        <meshBasicMaterial color="#ffe066" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <primitive object={lineObj} />
    </>
  );
}

export function Scene({ controller }: { controller: Controller }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: DEFAULT_CAM.toArray(), fov: 45, near: 0.5, far: 2000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => controller.selectedId !== -1 && controller.cameraMode !== 'follow' && controller.deselect()}
    >
      {/* Context does not cross the R3F reconciler boundary, so provide it again inside. */}
      <ControllerContext.Provider value={controller}>
        <Driver />
        <Lighting />
        <Terrain />
        <HeatOverlay />
        <Water />
        <Grass />
        <Flora />
        <AnimalHerd species="deer" />
        <AnimalHerd species="wolf" />
        {FAUNA_IDS.map((id) => (id === 'eagle' || id === 'raven' ? <Birds key={id} species={id} /> : <AnimalHerd key={id} species={id} />))}
        <Carcasses />
        <WeatherFX />
        <HuntMarkers />
        <SelectionMarker />
        <CameraRig />
      </ControllerContext.Provider>
    </Canvas>
  );
}
