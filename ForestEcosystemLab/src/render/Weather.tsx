import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useController } from '../runtime/context';
import { HALF, getWorld } from '../sim/world';

const world = getWorld();

/** Render-only weather state shared with the lighting (lightning flashes). */
export const weatherFx = { flash: 0 };

const RAIN_N = 4500, SNOW_N = 3600;
const BOX = 170, HEIGHT = 70;

function rand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** Where the precipitation volume is centred: the point the camera orbits around. */
function useFocus() {
  const { controls, camera } = useThree();
  return () => {
    const t = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    return t ?? new THREE.Vector3(camera.position.x, 0, camera.position.z);
  };
}

function Rain() {
  const ctl = useController();
  const focus = useFocus();
  const { geo, offs } = useMemo(() => {
    const r = rand(7);
    const offs = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) { offs[i * 3] = (r() - 0.5) * BOX; offs[i * 3 + 1] = r() * HEIGHT; offs[i * 3 + 2] = (r() - 0.5) * BOX; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
    return { geo, offs };
  }, []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: 0.5, depthWrite: false }), []);
  const obj = useMemo(() => { const l = new THREE.LineSegments(geo, mat); l.frustumCulled = false; return l; }, [geo, mat]);

  useFrame((_, dtRaw) => {
    const w = ctl.sim.weather;
    const amount = w.mix.rain;
    obj.visible = amount > 0.03;
    if (!obj.visible) return;
    const dt = Math.min(dtRaw, 0.05);
    const f = focus();
    const wind = 3 + 12 * w.mix.wind;
    const wx = Math.cos(w.windDir) * wind, wz = Math.sin(w.windDir) * wind;
    const n = Math.floor(RAIN_N * Math.min(1, amount * 1.1));
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const fall = 30 + 10 * w.mix.storm;
    for (let i = 0; i < n; i++) {
      let ox = offs[i * 3] + wx * dt, oy = offs[i * 3 + 1] - fall * dt, oz = offs[i * 3 + 2] + wz * dt;
      if (oy < 0) oy += HEIGHT;
      if (ox > BOX / 2) ox -= BOX; else if (ox < -BOX / 2) ox += BOX;
      if (oz > BOX / 2) oz -= BOX; else if (oz < -BOX / 2) oz += BOX;
      offs[i * 3] = ox; offs[i * 3 + 1] = oy; offs[i * 3 + 2] = oz;
      const x = f.x + ox, z = f.z + oz, y = f.y + oy - 8;
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x - wx * 0.045, y - 1.3, z - wz * 0.045);
    }
    geo.setDrawRange(0, n * 2);
    pos.needsUpdate = true;
    mat.opacity = 0.25 + 0.4 * amount;
  });
  return <primitive object={obj} />;
}

function Snow() {
  const ctl = useController();
  const focus = useFocus();
  const { geo, offs } = useMemo(() => {
    const r = rand(11);
    const offs = new Float32Array(SNOW_N * 4);
    for (let i = 0; i < SNOW_N; i++) { offs[i * 4] = (r() - 0.5) * BOX; offs[i * 4 + 1] = r() * HEIGHT; offs[i * 4 + 2] = (r() - 0.5) * BOX; offs[i * 4 + 3] = r() * 6.28; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
    return { geo, offs };
  }, []);
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.55, map: tex, transparent: true, depthWrite: false, color: '#ffffff' }), [tex]);
  const obj = useMemo(() => { const p = new THREE.Points(geo, mat); p.frustumCulled = false; return p; }, [geo, mat]);

  useFrame(({ clock }, dtRaw) => {
    const w = ctl.sim.weather;
    const amount = w.mix.snow;
    obj.visible = amount > 0.03;
    if (!obj.visible) return;
    const dt = Math.min(dtRaw, 0.05);
    const f = focus();
    const wind = 1 + 4 * w.mix.wind;
    const wx = Math.cos(w.windDir) * wind, wz = Math.sin(w.windDir) * wind;
    const n = Math.floor(SNOW_N * Math.min(1, amount * 1.1));
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < n; i++) {
      const ph = offs[i * 4 + 3];
      let ox = offs[i * 4] + wx * dt, oy = offs[i * 4 + 1] - 2.6 * dt, oz = offs[i * 4 + 2] + wz * dt;
      if (oy < 0) oy += HEIGHT;
      if (ox > BOX / 2) ox -= BOX; else if (ox < -BOX / 2) ox += BOX;
      if (oz > BOX / 2) oz -= BOX; else if (oz < -BOX / 2) oz += BOX;
      offs[i * 4] = ox; offs[i * 4 + 1] = oy; offs[i * 4 + 2] = oz;
      pos.setXYZ(i, f.x + ox + Math.sin(t * 1.3 + ph) * 0.6, f.y + oy - 8, f.z + oz + Math.cos(t * 1.1 + ph) * 0.6);
    }
    geo.setDrawRange(0, n);
    pos.needsUpdate = true;
    mat.opacity = 0.5 + 0.5 * amount;
  });
  return <primitive object={obj} />;
}

/** Lightning: random flashes during storms, with a jagged bolt near the view. */
function Lightning() {
  const ctl = useController();
  const focus = useFocus();
  const SEG = 14;
  const geo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3)), []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0 }), []);
  const bolt = useMemo(() => { const l = new THREE.Line(geo, mat); l.frustumCulled = false; return l; }, [geo, mat]);
  const next = useRef(0);

  useFrame(({ clock }, dt) => {
    const storm = ctl.sim.weather.mix.storm;
    const t = clock.elapsedTime;
    weatherFx.flash *= Math.exp(-dt * 7);
    if (storm > 0.35 && ctl.playing && t > next.current) {
      next.current = t + 1.5 + Math.random() * (7 / storm);
      weatherFx.flash = 1;
      const f = focus();
      const ang = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60;
      let x = THREE.MathUtils.clamp(f.x + Math.cos(ang) * r, -HALF + 5, HALF - 5), z = THREE.MathUtils.clamp(f.z + Math.sin(ang) * r, -HALF + 5, HALF - 5);
      const ground = world.heightAt(x, z);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i <= SEG; i++) {
        const y = ground + 90 * (1 - i / SEG);
        pos.setXYZ(i, x, y, z);
        x += (Math.random() - 0.5) * 7; z += (Math.random() - 0.5) * 7;
      }
      pos.needsUpdate = true;
    }
    // A second, weaker flicker right after the first, like real lightning.
    const flicker = weatherFx.flash > 0.5 && weatherFx.flash < 0.62 ? 0.4 : 0;
    mat.opacity = Math.min(1, weatherFx.flash * 1.4 + flicker);
    bolt.visible = weatherFx.flash > 0.2;
  });
  return <primitive object={bolt} />;
}

export function WeatherFX() {
  return (
    <>
      <Rain />
      <Snow />
      <Lightning />
    </>
  );
}
