import * as THREE from 'three';
import { GrandPiano } from './grandPiano.js';
import { Marimba } from './marimba.js';
import { Harp } from './harp.js';
import { PipeOrgan } from './organ.js';
import { TubularBells } from './bells.js';
import { StageSynth } from './synth.js';
import { Violin, Cello, AcousticGuitar, ElectricGuitar } from './strings.js';

export { midiName } from './common.js';

export const INSTRUMENTS = [
  { id: 'none', name: 'None' },
  { id: 'piano', name: 'Grand piano', make: () => new GrandPiano() },
  { id: 'marimba', name: 'Marimba', make: () => new Marimba() },
  { id: 'harp', name: 'Concert harp', make: () => new Harp(), side: true },
  { id: 'organ', name: 'Pipe organ', make: () => new PipeOrgan() },
  { id: 'bells', name: 'Tubular bells', make: () => new TubularBells() },
  { id: 'synth', name: 'Synth', make: () => new StageSynth() },
  { id: 'violin', name: 'Violin', make: () => new Violin(), side: true },
  { id: 'cello', name: 'Cello', make: () => new Cello(), side: true },
  { id: 'guitar', name: 'Acoustic guitar', make: () => new AcousticGuitar(), side: true },
  { id: 'electric', name: 'Electric guitar', make: () => new ElectricGuitar(), side: true },
];
// narrow instruments stand to one side behind the cochlea, so it doesn't hide them
const SIDE_OFFSET = 1.3;

const BEHIND = 1.85; // distance from the cochlea's centre to the instrument's front edge
const FIT_W = 3.0, FIT_H = 1.32; // largest size an instrument is scaled to (world units)

// Holds the chosen instrument on the floor behind the cochlea, as seen from the camera,
// and swings it around as the camera orbits so it always stays in the background.
export class InstrumentStage {
  constructor(scene, target, floorY) {
    this.target = target;
    this.floorY = floorY;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.cache = new Map();
    this.current = null;
    this.angle = null;

    // its own soft light, since the studio spot only covers the cochlea
    const key = new THREE.SpotLight(0xfff1e6, 9, 0, 0.75, 0.9, 1.6);
    key.position.set(0.6, 3.2, 1.6);
    key.target.position.set(0, 0.7, -0.8);
    const fill = new THREE.PointLight(0x8a9cff, 2.5, 6, 1.5);
    fill.position.set(-1.6, 1.4, -0.4);
    this.root.add(key, key.target, fill);
  }

  set(id) {
    if (this.current) this.root.remove(this.current.group);
    this.current = null;
    const def = INSTRUMENTS.find((d) => d.id === id);
    if (!def?.make) return null;
    if (!this.cache.has(id)) {
      const inst = def.make();
      inst.fit(FIT_W, FIT_H);
      inst.group.position.x = def.side ? SIDE_OFFSET : 0;
      this.cache.set(id, inst);
    }
    this.current = this.cache.get(id);
    this.root.add(this.current.group);
    return this.current;
  }

  follow(camera, dt) {
    const T = this.target;
    const goal = Math.atan2(camera.position.x - T.x, camera.position.z - T.z);
    if (this.angle === null) this.angle = goal;
    let d = goal - this.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.angle += d * (1 - Math.exp(-dt / 0.35));
    const a = this.angle;
    this.root.position.set(T.x - Math.sin(a) * BEHIND, this.floorY, T.z - Math.cos(a) * BEHIND);
    this.root.rotation.y = a;
  }

  update(t, dt, camera, keyColor) {
    if (!this.current) return;
    this.follow(camera, dt);
    this.current.update(t, dt, keyColor);
    this.root.updateMatrixWorld(true);
  }
}
