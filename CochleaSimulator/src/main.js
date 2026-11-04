import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { AudioEngine, FFT_SIZE } from './audioEngine.js';
import { midiFreq } from './notes.js';
import { InstrumentSynth } from './instrumentSynth.js';
import { InstrumentStage, INSTRUMENTS, midiName } from './instruments/index.js';
import { CochleaModel } from './cochleaModel.js';
import { buildCochlea, b2t, CELL_COUNTS } from './cochleaScene.js';
import { PitchLabels, formatHz, noteName, regionName } from './pitchLabels.js';
import { Cochleagram } from './cochleagram.js';
import { THEMES, DEFAULT_THEME, setTheme, themeGradient, placeColor, onThemeChange } from './palette.js';
import { YouTubePlayer, parseYouTubeId } from './youtube.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');

// ---------- renderer (AgX "Medium High Contrast", exposure -0.3 in the .blend)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 2 ** -0.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let model, cochlea, labels, gram;
let simTime = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
camera.position.copy(b2t(0.55, -3.9, 3.6)); // Camera world position at frame 1

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0; // one turn per minute, like Cam_Orbit

// ---------- post: Glare (fog glow) + vignette, as in the compositor
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = (vUv - 0.5) / vec2(0.95, 0.75);
        float m = 1.0 - smoothstep(0.35, 1.25, length(d) * 1.4);
        c.rgb *= mix(0.42, 1.0, m);
        gl_FragColor = c;
      }`,
  }),
);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  // Landscape: 33 mm lens on a 36 mm sensor (57° across the width), as in the .blend.
  // Portrait: keep at least ~44° across the width so the whole spiral fits on a phone.
  const halfH = camera.aspect >= 1 ? Math.atan(18 / 33) : THREE.MathUtils.degToRad(22);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfH) / camera.aspect));
  camera.updateProjectionMatrix();
  cochlea?.sparks.setPixelScale(h * renderer.getPixelRatio(), camera.fov);
}
addEventListener('resize', resize);
resize();

// ---------- app state
const audio = new AudioEngine();

async function init() {
  const { cells } = await fetch(`${import.meta.env.BASE_URL}assets/cells.json`).then((r) => r.json());
  cochlea = await buildCochlea(renderer, scene, cells);
  controls.target.copy(cochlea.target);
  controls.update();
  setupCellPicker();
  setupThemePicker();
  resize();

  // 300 frequency channels drive any number of hair cells (each cell reads the channel at its place)
  model = new CochleaModel(cells);
  model.configure(audio.sampleRate, FFT_SIZE);
  labels = new PitchLabels(scene, $('labels'), cells, cochlea.channelPos);
  gram = new Cochleagram($('gram'), cells);
  setupHover();
  setupInstruments(cells);

  if (import.meta.env.DEV) window.__sim = { model, audio, camera, controls, composer, renderer, frame, cochlea, getSynth, pressHit, releaseSource, get stage() { return stage; }, get inst() { return inst; } };
  $('loading').classList.add('done');
  renderer.setAnimationLoop(frame);
}

// ---------- hair-cell count picker (remembered per browser)
const CELLS_KEY = 'cochlea.cells';
function setupCellPicker() {
  const sel = $('cellCount');
  sel.innerHTML = CELL_COUNTS.map((n) => `<option value="${n}">${n.toLocaleString('en-US')}${n === 15000 ? ' (real ear)' : ''}</option>`).join('');
  let saved = 1000;
  try { saved = Number(localStorage.getItem(CELLS_KEY)) || 1000; } catch {}
  if (!CELL_COUNTS.includes(saved)) saved = 1000;
  sel.value = String(saved);
  cochlea.setCellCount(saved);
  sel.addEventListener('change', () => {
    const n = Number(sel.value);
    cochlea.setCellCount(n);
    try { localStorage.setItem(CELLS_KEY, String(n)); } catch {}
  });
}

// keep the cochleagram panel just above the dock, however many lines the dock wraps to
new ResizeObserver(([e]) => {
  document.documentElement.style.setProperty('--dock-h', `${Math.round(e.target.offsetHeight)}px`);
}).observe(document.querySelector('.dock'));

// ---------- instruments: play a 3D instrument behind the cochlea and watch where the cochlea responds
let stage = null;
let inst = null; // current Instrument, or null for "None"
let synth = null;
let volume = 0.9;
let lastPlayed = null; // { m, at }
let octave = 0; // computer-keyboard octave shift
const INSTRUMENT_KEY = 'cochlea.instrument';
const keyCol = Array.from({ length: 128 }, () => new THREE.Color());
const keyColor = (m) => keyCol[m];
const held = new Map(); // what is being held down (pointer or a keyboard key) -> { hit, sound }

function getSynth() {
  const ctx = audio.context();
  if (!synth) {
    synth = new InstrumentSynth(ctx, [ctx.destination, audio.inputBus]);
    synth.setPreset(inst?.id || 'piano');
    synth.setVolume(volume);
  }
  return synth;
}

// The analyser's bin spacing depends on the real sample rate, known once audio has started.
let configuredRate = 0;
function configureForRate() {
  if (configuredRate === audio.sampleRate) return;
  configuredRate = audio.sampleRate;
  model.configure(audio.sampleRate, FFT_SIZE);
}

function applyVolume() {
  audio.setVolume(volume);
  synth?.setVolume(volume);
}

// Start a note on the instrument: you hear it, the spot lights up, and the cochlea responds.
function pressHit(hit, source, sound = hit?.m) {
  if (!hit || !inst) return;
  releaseSource(source);
  const s = getSynth();
  audio.ctx.resume();
  s.noteOn(sound, 0.85);
  inst.press(hit);
  inst.noteOn(hit, 1, simTime);
  audio.manualUntil = audio.ctx.currentTime + 4;
  configureForRate();
  held.set(source, { hit, sound });
  lastPlayed = { m: sound, at: performance.now() };
}

function releaseSource(source) {
  const h = held.get(source);
  if (!h) return;
  held.delete(source);
  // keep sounding if something else still holds the same note
  if (![...held.values()].some((o) => o.sound === h.sound)) synth?.noteOff(h.sound);
  if (![...held.values()].some((o) => o.hit.parts === h.hit.parts && o.hit.i === h.hit.i)) {
    inst?.release(h.hit);
    inst?.noteOff(h.hit, simTime);
  }
  if (audio.ctx) audio.manualUntil = Math.max(audio.manualUntil, audio.ctx.currentTime + 3);
}

function releaseAll() {
  for (const source of [...held.keys()]) releaseSource(source);
}

function setupInstruments(cells) {
  // note colour = pitch colour of the place on the cochlea that hears that note
  const byFreq = [...cells].sort((a, b) => a.f - b.f);
  const logF = byFreq.map((c) => Math.log(c.f));
  const placeFor = (f) => {
    const lf = Math.log(f);
    if (lf <= logF[0]) return byFreq[0].p;
    for (let i = 1; i < logF.length; i++) {
      if (lf <= logF[i]) {
        const t = (lf - logF[i - 1]) / (logF[i] - logF[i - 1]);
        return byFreq[i - 1].p + (byFreq[i].p - byFreq[i - 1].p) * t;
      }
    }
    return byFreq[byFreq.length - 1].p;
  };
  const bakeKeyColors = () => {
    for (let m = 0; m < 128; m++) placeColor(placeFor(midiFreq(m)), keyCol[m]);
  };
  bakeKeyColors();
  onThemeChange(bakeKeyColors);

  stage = new InstrumentStage(scene, cochlea.target, cochlea.bounds.min.y);

  const sel = $('instrument');
  sel.innerHTML = INSTRUMENTS.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  let saved = 'piano';
  try { saved = localStorage.getItem(INSTRUMENT_KEY) || 'piano'; } catch {}
  if (!INSTRUMENTS.some((d) => d.id === saved)) saved = 'piano';
  const choose = (id) => {
    releaseAll();
    synth?.allOff();
    const had = !!inst;
    inst = stage.set(id);
    if (!!inst !== had) reframe(!!inst);
    if (inst) synth?.setPreset(id);
    sel.value = id;
    lastPlayed = null;
  };
  choose(saved);
  sel.addEventListener('change', () => {
    choose(sel.value);
    sel.blur(); // so the computer keyboard plays notes instead of changing the menu
    try { localStorage.setItem(INSTRUMENT_KEY, sel.value); } catch {}
  });

  setupInstrumentPointer();
  setupInstrumentKeyboard();

  const panel = $('pianoPanel');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--piano-h', `${panel.offsetHeight + 8}px`);
  }).observe(panel);
}

// With an instrument on, ease the camera back a little and look a bit higher, so the instrument
// fits in the background while the cochlea stays the centrepiece.
const FRAME_LIFT = 0.5, FRAME_PULL = 1.26;
let reframeAnim = null;
function reframe(withInstrument) {
  const fromT = controls.target.clone();
  const toT = cochlea.target.clone().add(new THREE.Vector3(0, withInstrument ? FRAME_LIFT : 0, 0));
  const fromOff = camera.position.clone().sub(fromT);
  const toOff = fromOff.clone().multiplyScalar(withInstrument ? FRAME_PULL : 1 / FRAME_PULL);
  reframeAnim = { t: 0, fromT, toT, fromOff, toOff };
}
function stepReframe(dt) {
  if (!reframeAnim) return;
  const a = reframeAnim;
  a.t = Math.min(1, a.t + dt / 0.8);
  const k = a.t * a.t * (3 - 2 * a.t);
  controls.target.lerpVectors(a.fromT, a.toT, k);
  const off = a.fromOff.clone().lerp(a.toOff, k);
  camera.position.copy(controls.target).add(off);
  if (a.t >= 1) reframeAnim = null;
}

// Click (or drag across) the instrument's keys, bars, strings, pipes or bells to play them.
function setupInstrumentPointer() {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = false;
  const hitFrom = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return inst?.pick(ray, { ndc, width: innerWidth, height: innerHeight }) ?? null;
  };
  const same = (a, b) => a && b && a.parts === b.parts && a.i === b.i;
  // capture phase, so playing a note doesn't also start orbiting the camera
  canvas.addEventListener('pointerdown', (e) => {
    if (!inst) return;
    const hit = hitFrom(e);
    if (!hit) return;
    e.stopImmediatePropagation();
    canvas.setPointerCapture(e.pointerId);
    down = true;
    pressHit(hit, 'pointer');
  }, { capture: true });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    e.stopImmediatePropagation();
    const hit = hitFrom(e);
    if (hit && !same(hit, held.get('pointer')?.hit)) pressHit(hit, 'pointer');
  }, { capture: true });
  const end = () => { if (down) { down = false; releaseSource('pointer'); } };
  canvas.addEventListener('pointerup', end, { capture: true });
  canvas.addEventListener('pointercancel', end, { capture: true });
}

// Computer keyboard as a piano: Z-row = one octave, Q-row = the next; [ and ] shift octaves.
const KEY_SEMITONES = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23,
  KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
};
function setupInstrumentKeyboard() {
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
  addEventListener('keydown', (e) => {
    if (!inst || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      octave = Math.max(-2, Math.min(3, octave + (e.code === 'BracketRight' ? 1 : -1)));
      lastPlayed = null;
      return;
    }
    const semis = KEY_SEMITONES[e.code];
    if (semis === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    const m = inst.fold(48 + octave * 12 + semis);
    pressHit(inst.noteFor(m), `key:${e.code}`, m);
  });
  addEventListener('keyup', (e) => {
    if (KEY_SEMITONES[e.code] !== undefined) releaseSource(`key:${e.code}`);
  });
  addEventListener('blur', releaseAll);
}

// The bar under the instrument: what you just played and where the cochlea hears it
let notesShownAt = 0;
function updateNotes(now) {
  if (now - notesShownAt < 120) return;
  notesShownAt = now;
  const el = $('pianoNotes');
  let text, idle = true;
  if (lastPlayed && now - lastPlayed.at < 3000) {
    const f = midiFreq(lastPlayed.m);
    text = `${midiName(lastPlayed.m)}  ·  ${formatHz(f)}  ·  ${regionName(f)}`;
    idle = false;
  } else if (inst) {
    text = `Click the ${inst.name.toLowerCase()} or play with your keyboard: Z–M and Q–P rows, [ ] change octave (now C${3 + octave})`;
  } else {
    text = 'Choose an instrument to play it and watch where the cochlea responds.';
  }
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.toggle('idle', idle);
  }
}

// ---------- colour theme picker (remembered per browser)
const THEME_KEY = 'cochlea.theme';
function setupThemePicker() {
  const sel = $('theme');
  const swatch = $('themeSwatch');
  sel.innerHTML = Object.entries(THEMES).map(([key, t]) => `<option value="${key}">${t.name}</option>`).join('');
  let saved = DEFAULT_THEME;
  try { saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME; } catch {}
  if (!THEMES[saved]) saved = DEFAULT_THEME;
  const apply = (key) => {
    setTheme(key);
    sel.value = key;
    swatch.style.background = themeGradient(key);
  };
  apply(saved);
  sel.addEventListener('change', () => {
    apply(sel.value);
    try { localStorage.setItem(THEME_KEY, sel.value); } catch {}
  });
}

// smoothed frames-per-second readout so people can pick a cell count their device handles
let fpsAvg = 60, fpsShown = 0, fpsAt = 0;
function updateFps(dt, now) {
  if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  if (now - fpsAt > 500) {
    fpsAt = now;
    const v = Math.round(fpsAvg);
    if (v !== fpsShown) {
      fpsShown = v;
      const el = $('fps');
      el.textContent = `${v} fps`;
      el.dataset.level = v >= 50 ? 'good' : v >= 30 ? 'ok' : 'low';
    }
  }
}

const clock = new THREE.Clock();
function frame(now) {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 1 / 20);
  simTime += dt;
  updateFps(raw, now);

  audio.readPower(model.power);
  model.step(dt);
  cochlea.update(model, simTime, dt);
  labels.update(model, simTime, camera, innerWidth, innerHeight);
  gram.push(model.vv);
  updateNotes(now);
  updateTransport();

  stepReframe(dt);
  controls.update(dt);
  camera.updateMatrixWorld();
  stage?.update(simTime, dt, camera, keyColor);
  composer.render(dt);
}

// ---------- hover a hair cell to see what it listens for
function setupHover() {
  const v = new THREE.Vector3();
  const tip = $('tooltip');
  let pending = null;
  canvas.addEventListener('pointermove', (e) => {
    pending = e;
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; pending = null; });
  const check = () => {
    if (pending) {
      const e = pending;
      pending = null;
      // nearest hair cell on screen (within 14 px), nearest to the camera on ties
      const cells = cochlea.hair.cells;
      let best = -1, bestD = 14 * 14, bestZ = Infinity;
      for (let i = 0; i < cells.length; i++) {
        v.copy(cells[i].tip).project(camera);
        if (v.z > 1) continue;
        const dx = (v.x * 0.5 + 0.5) * innerWidth - e.clientX;
        const dy = (-v.y * 0.5 + 0.5) * innerHeight - e.clientY;
        const d = dx * dx + dy * dy;
        if (d < bestD - 4 || (d < bestD + 4 && v.z < bestZ)) { best = i; bestD = d; bestZ = v.z; }
      }
      if (best >= 0) {
        const c = cells[best], f = c.f;
        tip.innerHTML = `${c.inner ? 'Inner' : 'Outer'} hair cell <b>#${best + 1}</b> · ${formatHz(f)} (${noteName(f)})<br>${regionName(f)} · activity ${Math.round(model.vv[c.ch] * 100)}%`;
        tip.style.left = `${e.clientX}px`;
        tip.style.top = `${e.clientY}px`;
        tip.hidden = false;
      } else tip.hidden = true;
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

// ---------- UI
const playBtn = $('playBtn'), seek = $('seek'), fileInput = $('fileInput');
let seeking = false;

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

function updateTransport() {
  const el = audio.element;
  playBtn.classList.toggle('playing', audio.playing);
  playBtn.setAttribute('aria-label', audio.playing ? 'Pause' : 'Play');
  $('micBtn')?.classList.toggle('active', audio.mode === 'mic'); // absent in the shared build
  $('tabBtn')?.classList.toggle('active', audio.mode === 'tab');
  if (audio.mode === 'file') {
    $('tCur').textContent = fmt(el.currentTime);
    $('tDur').textContent = fmt(el.duration);
    if (!seeking && el.duration) seek.value = String((el.currentTime / el.duration) * 1000);
  }
}

function started(name) {
  $('trackName').textContent = name;
  const isFile = audio.mode === 'file';
  playBtn.disabled = !isFile;
  seek.disabled = !isFile;
  if (!isFile) { $('tCur').textContent = 'live'; $('tDur').textContent = ''; seek.value = '0'; }
  configureForRate();
  applyVolume();
}

function showError(err) {
  console.error(err);
  $('trackName').textContent = `⚠ ${err.message || err}`;
}

async function loadFile(file) {
  if (!file) return;
  yt.pause();
  try {
    await audio.loadFile(file);
    started(file.name.replace(/\.[^.]+$/, ''));
  } catch (err) { showError(err); }
}

async function action(kind) {
  if (kind === 'youtube') return openYouTubePanel(true);
  if (kind !== 'open') yt.pause();
  try {
    if (kind === 'open') fileInput.click();
    else if (kind === 'demo') {
      await audio.loadUrl(`${import.meta.env.BASE_URL}audio/demo.mp3`, 'Misty Highland Night (demo)');
      started('Misty Highland Night (demo)');
    } else if (kind === 'mic') {
      if (audio.mode === 'mic') { audio.stopLive(); $('trackName').textContent = 'Microphone stopped'; return; }
      await audio.startMic();
      started('Microphone (live)');
    } else if (kind === 'tab') {
      if (audio.mode === 'tab') { audio.stopLive(); $('trackName').textContent = 'Stopped listening to the tab'; return; }
      await audio.startTab();
      started('Browser tab (live)');
    }
  } catch (err) {
    if (err.name === 'NotAllowedError' && kind === 'tab') showError(new Error('Tab sharing was cancelled.'));
    else showError(err);
  }
}
audio.onLiveEnded = () => {
  $('trackName').textContent = 'Sharing stopped';
  setYtStatus(false, 'Sound sharing stopped');
};

// ---------- YouTube: the official embedded player plays the video; the cochlea hears it by
// sharing this tab's sound (browsers never let a page read a YouTube video's audio directly).
const yt = new YouTubePlayer($('ytMount'), {
  onError: (err) => setYtStatus(false, err.message),
});
const hearingYouTube = () => audio.mode === 'tab' && audio.fileName === 'YouTube';

function setYtStatus(on, msg) {
  const el = $('ytStatus');
  el.dataset.on = String(on);
  el.textContent = msg || (on ? 'The cochlea is listening' : "The cochlea can't hear the video yet");
  $('ytConnect').hidden = on;
}

function openYouTubePanel(focus) {
  $('ytPanel').hidden = false;
  if (focus) $('ytUrlPanel').focus();
}

// Must run straight from a click/submit so the browser allows the share prompt.
async function connectYouTubeSound() {
  setYtStatus(false, 'Choose "this tab" and keep "Also share tab audio" on');
  try {
    await audio.startTab({ currentTab: true });
    started('YouTube (live)');
    setYtStatus(true);
  } catch (err) {
    setYtStatus(false, err.name === 'NotAllowedError' ? "Sound sharing was cancelled, so the cochlea can't hear the video" : err.message);
  }
}

document.querySelectorAll('[data-yt-form]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = form.querySelector('input').value;
    const id = parseYouTubeId(text);
    openYouTubePanel(false);
    if (!id) {
      setYtStatus(false, "That doesn't look like a YouTube link");
      return;
    }
    $('ytUrlPanel').value = text.trim();
    audio.pause();
    if (!hearingYouTube()) connectYouTubeSound();
    yt.play(id).catch((err) => setYtStatus(false, err.message));
  });
});
$('ytConnect').addEventListener('click', () => connectYouTubeSound());
$('ytClose').addEventListener('click', () => {
  yt.close();
  if (hearingYouTube()) audio.stopLive();
  $('ytPanel').hidden = true;
  setYtStatus(false, 'Paste a link to start');
  $('ytConnect').hidden = true;
});

// Shared build (Claude artifact): no microphone, tab capture or YouTube, and no bundled demo song
if (import.meta.env.VITE_SHARED) {
  document.querySelectorAll('[data-action="demo"], [data-action="mic"], [data-action="tab"], .tab-hint, .yt-only').forEach((b) => b.remove());
}

document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => action(b.dataset.action)));
fileInput.addEventListener('change', () => { loadFile(fileInput.files[0]); fileInput.value = ''; });

playBtn.addEventListener('click', () => (audio.playing ? audio.pause() : audio.play().catch(showError)));
seek.addEventListener('input', () => {
  seeking = true;
  const el = audio.element;
  if (el.duration) $('tCur').textContent = fmt((seek.value / 1000) * el.duration);
});
seek.addEventListener('change', () => {
  const el = audio.element;
  if (el.duration) el.currentTime = (seek.value / 1000) * el.duration;
  seeking = false;
});
$('volume').addEventListener('input', (e) => {
  volume = Number(e.target.value);
  applyVolume();
});
$('tLabels').addEventListener('change', (e) => labels.setEnabled(e.target.checked));
$('tOrbit').addEventListener('change', (e) => (controls.autoRotate = e.target.checked));
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body && audio.mode === 'file') {
    e.preventDefault();
    audio.playing ? audio.pause() : audio.play();
  }
});

// drag & drop anywhere
let dragDepth = 0;
addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').hidden = false; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').hidden = true;
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name));
  if (file) loadFile(file);
  else showError(new Error('That is not an audio file.'));
});

init().catch((err) => {
  console.error(err);
  const l = $('loading');
  l.classList.add('error');
  l.querySelector('span').textContent = `Could not build the scene: ${err.message}`;
});
