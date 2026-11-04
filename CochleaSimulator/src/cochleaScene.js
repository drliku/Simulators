import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { placeColor, rampUniform, RAMP_GLSL, onThemeChange } from './palette.js';
import { Sparks } from './sparks.js';

// Blender is Z-up, three.js is Y-up: (x, y, z) -> (x, z, -y)
export const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);
const C = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

// Values copied from the .blend
const MEMBRANE_LIFT = 0.035; // GN_Membrane_Wave "Lift"
const BUNDLE_REST_Z = 0.10185;
const LIFT_K = 0.05 * Math.sin(Math.PI * 0.38);
const MAX_BEND = THREE.MathUtils.degToRad(45);
const SWAY = THREE.MathUtils.degToRad(10);

// Layout of the Blender hair cells: one row at 43% across the membrane, 0.038 apart along it.
const BLENDER_ACROSS = 0.43;
const BLENDER_SPACING = 0.038;
const membraneWidth = (arc) => 0.204 + 0.072 * arc; // measured from the membrane mesh
// Organ of Corti: one row of inner hair cells (near the modiolus) and three rows of outer hair cells
const ROWS = [0.3, 0.55, 0.67, 0.79];

export const CELL_COUNTS = [10, 100, 300, 1000, 2500, 5000, 10000, 15000];

const f = (x) => x.toFixed(6); // JS number -> GLSL float literal
const lin = (r, g, b) => new THREE.Color(r, g, b); // Blender colours are linear, like three's working space

export async function buildCochlea(renderer, scene, channels) {
  const base = import.meta.env.BASE_URL;
  const [gltf, membraneBuf] = await Promise.all([
    new GLTFLoader().loadAsync(`${base}assets/cochlea.glb`),
    fetch(`${base}assets/membrane.bin`).then((r) => r.arrayBuffer()),
  ]);

  // ---------- environment & lights
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;
  scene.background = new THREE.Color('#05070f');

  const target = b2t(0.2, 0, 0.45);
  const area = (pos, w, intensity, color) => {
    const l = new THREE.RectAreaLight(color, intensity, w, w);
    l.position.copy(pos);
    l.lookAt(target);
    scene.add(l);
  };
  area(b2t(2.5, -2.5, 4.0), 3, 2.6, lin(1.0, 0.93, 0.88)); // Key, warm
  area(b2t(-2.0, -3.0, 1.0), 4, 0.5, lin(0.75, 0.8, 1.0)); // Fill
  area(b2t(-3.0, 3.0, 2.0), 3, 6.0, lin(0.45, 0.5, 1.0)); // Rim, violet-blue

  const spot = new THREE.SpotLight(lin(1.0, 0.95, 0.9), 26, 0, 0.48, 0.75, 2);
  spot.position.copy(b2t(0.3, -0.6, 5.5));
  spot.target.position.copy(target);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  scene.add(spot, spot.target);

  // ---------- static anatomy from the GLB
  const bone = new THREE.MeshPhysicalMaterial({ color: lin(0.8, 0.76, 0.7), roughness: 0.5, sheen: 0.3, sheenColor: lin(0.6, 0.65, 1.0) });
  const byName = (n) => {
    let found = null;
    gltf.scene.traverse((o) => { if (!found && o.name === n) found = o; });
    if (!found) throw new Error(`Missing ${n} in cochlea.glb`);
    return found;
  };
  const meshOf = (o) => {
    let m = null;
    o.traverse((c) => { if (!m && c.isMesh) m = c; });
    return m;
  };

  const rim = { color: { value: new THREE.Color('#7b6cff') }, strength: { value: 0.15 } };
  const shellMat = makeShellMaterial(rim);
  const shell = byName('Cochlea_Shell');
  shell.traverse((c) => {
    if (c.isMesh) { c.material = shellMat; c.renderOrder = 2; c.receiveShadow = true; }
  });
  for (const n of ['Spiral_Lamina', 'Modiolus']) {
    byName(n).traverse((c) => {
      if (c.isMesh) { c.material = bone; c.castShadow = c.receiveShadow = true; }
    });
  }
  const anatomy = new THREE.Group();
  anatomy.add(byName('Spiral_Lamina'), byName('Modiolus'), shell);
  scene.add(anatomy);
  const box = new THREE.Box3().setFromObject(shell);

  // ---------- floor + a pool of light that takes the colour of whatever pitch is playing
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 96),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a0f24'), roughness: 0.65, envMapIntensity: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = box.min.y - 0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const ambient = makeFloorGlow();
  ambient.mesh.position.set(target.x, box.min.y + 0.002, target.z);
  scene.add(ambient.mesh);

  // ---------- shared per-channel state on the GPU: R = activity 0..1, G = bundle deflection
  const state = makeStateTexture(channels.length);

  // ---------- basilar membrane
  const membrane = buildMembrane(membraneBuf, channels, state.tex);
  scene.add(membrane.mesh);

  // ---------- hair cells (rebuilt when the count changes)
  const bodyGeo = meshOf(byName('HC_Body_EXPORT')).geometry;
  const bundleGeo = meshOf(byName('HC_Bundle_EXPORT')).geometry;
  const hairUniforms = { uState: { value: state.tex }, uTime: { value: 0 }, uGlow: { value: 1 }, uRamp: rampUniform() };
  const bodyMat = makeHairMaterial(false, hairUniforms);
  const bundleMat = makeHairMaterial(true, hairUniforms);
  let hair = null;

  const channelPos = channels.map((c) => new THREE.Vector3().setFromMatrixPosition(C.clone().multiply(new THREE.Matrix4().fromArray(c.m))));

  const sparks = new Sparks(scene, 5000);
  const tmpColor = new THREE.Color();
  const dominant = new THREE.Color('#7b6cff');
  const channelColor = channels.map((c) => placeColor(c.p, new THREE.Color()));
  onThemeChange(() => channels.forEach((c, i) => placeColor(c.p, channelColor[i])));
  let level = 0;

  function setCellCount(n) {
    if (hair) {
      scene.remove(hair.bodies, hair.bundles);
      hair.dispose();
    }
    hair = buildHairCells(bodyGeo, bundleGeo, bodyMat, bundleMat, channels, n);
    hairUniforms.uGlow.value = Math.min(1, (1000 / hair.count) ** 0.3);
    scene.add(hair.bodies, hair.bundles);
    return hair;
  }

  return {
    target,
    bounds: box,
    channelPos,
    sparks,
    get hair() { return hair; },
    setCellCount,
    update(model, t, dt) {
      state.update(model.vv, model.pos);
      hairUniforms.uTime.value = t;

      // loudness + the colour of what is playing (activity-weighted pitch colour)
      let sum = 0, r = 0, g = 0, b = 0;
      for (let i = 0; i < model.N; i++) {
        const w = model.vv[i] * model.vv[i];
        sum += model.vv[i];
        r += channelColor[i].r * w; g += channelColor[i].g * w; b += channelColor[i].b * w;
      }
      const mean = sum / model.N;
      const k = 1 - Math.exp(-dt / 0.25);
      level += (mean - level) * k;
      const wsum = r + g + b;
      if (wsum > 1e-4) dominant.lerp(tmpColor.setRGB(r / wsum * 3, g / wsum * 3, b / wsum * 3), k * 0.6);
      ambient.set(dominant, 0.05 + level * 0.9);
      rim.color.value.copy(dominant);
      rim.strength.value = 0.12 + level * 1.4;

      // sparks from firing hair cells
      const budget = Math.min(900, 3000 * level * level) * dt; // sparks per frame
      let toSpawn = Math.floor(budget) + (Math.random() < budget % 1 ? 1 : 0);
      const cells = hair.cells;
      for (let tries = 0; toSpawn > 0 && tries < toSpawn * 8; tries++) {
        const c = cells[(Math.random() * cells.length) | 0];
        const a = model.vv[c.ch];
        if (Math.random() > a * a) continue;
        sparks.spawn(c.tip.x, c.tip.y, c.tip.z, c.up.x, c.up.y, c.up.z, channelColor[c.ch], a);
        toSpawn--;
      }
      sparks.update(dt);
    },
  };
}

// ---------------------------------------------------------------------------------------------

function makeStateTexture(N) {
  const data = new Uint16Array(N * 2);
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const h = THREE.DataUtils.toHalfFloat;
  return {
    tex,
    update(vv, S) {
      for (let i = 0; i < N; i++) {
        data[i * 2] = h(vv[i]);
        data[i * 2 + 1] = h(S[i]);
      }
      tex.needsUpdate = true;
    },
  };
}

function makeShellMaterial(rim) {
  // Bone_Shell: see-through face-on, solid at the rim; the rim also glows with the current pitch colour
  const m = new THREE.MeshPhysicalMaterial({
    color: lin(0.82, 0.8, 0.78),
    roughness: 0.35,
    transparent: true,
    depthWrite: false,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uRimColor = rim.color;
    s.uniforms.uRimStrength = rim.strength;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uRimColor; uniform float uRimStrength;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        totalEmissiveRadiance += uRimColor * pow(rimF, 2.5) * uRimStrength;`)
      .replace('#include <opaque_fragment>', `
        diffuseColor.a = mix(0.1, 0.62, pow(rimF, 0.8));
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'shell';
  return m;
}

function makeFloorGlow() {
  const uniforms = { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.2) * uIntensity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return {
    mesh,
    set(color, intensity) {
      uniforms.uColor.value.copy(color);
      uniforms.uIntensity.value = intensity;
    },
  };
}

function buildMembrane(buf, channels, stateTex) {
  const n = 7200;
  let off = 0;
  const take = (count) => {
    const a = new Float32Array(buf, off, count);
    off += count * 4;
    return a;
  };
  const pos = take(n * 3);
  const arc = take(n);
  const across = take(n);
  const place = take(n);
  const index = new Uint32Array(buf, off);

  // Each vertex reads the channel (Blender hair cell) sitting at its place along the duct.
  const N = channels.length;
  const cellU = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const p = place[v];
    let i = 0;
    while (i < N - 2 && channels[i + 1].p < p) i++;
    const fr = THREE.MathUtils.clamp((p - channels[i].p) / (channels[i + 1].p - channels[i].p), 0, 1);
    cellU[v] = (i + fr + 0.5) / N;
  }

  // pastel base colour from the pitch ramp, re-baked when the theme changes
  const colors = new Float32Array(n * 3);
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  const col = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  const bakeColors = () => {
    for (let v = 0; v < n; v++) placeColor(place[v], col).lerp(white, 0.35).multiplyScalar(0.85).toArray(colors, v * 3);
    colorAttr.needsUpdate = true;
  };
  bakeColors();
  onThemeChange(bakeColors);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', colorAttr);
  g.setAttribute('aCell', new THREE.BufferAttribute(cellU, 1));
  g.setAttribute('aArc', new THREE.BufferAttribute(arc, 1));
  g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
  g.setAttribute('aPlace', new THREE.BufferAttribute(place, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
    iridescence: 0.35,
    iridescenceIOR: 1.4,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uAct = { value: stateTex };
    s.uniforms.uLift = { value: MEMBRANE_LIFT };
    s.uniforms.uRamp = rampUniform();
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
         ${RAMP_GLSL}
         attribute float aCell; attribute float aArc; attribute float aAcross; attribute float aPlace;
         uniform sampler2D uAct; uniform float uLift;
         varying vec3 vEmit; varying float vArc; varying float vAcross;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
         float act = texture2D(uAct, vec2(aCell, 0.5)).r * sin(aAcross * PI);
         vEmit = pitchRamp(aPlace) * (0.04 + act * act * 1.5 + act * 2.2);
         vArc = aArc; vAcross = aAcross;
         transformed += objectNormal * act * uLift;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
         varying vec3 vEmit; varying float vArc; varying float vAcross;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
         float bands = 0.5 + 0.5 * sin(vArc * 1400.0 + 3.0 * sin(vAcross * 9.0 + vArc * 40.0));
         diffuseColor.rgb *= mix(0.85, 1.05, bands);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
         totalEmissiveRadiance += vEmit;`);
  };
  mat.customProgramCacheKey = () => 'membrane';

  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false; // vertices move in the shader
  return { mesh };
}

// Hair cells are animated entirely in the vertex shader (bend, sway, lift, glow), so the CPU cost
// does not grow with the number of cells. Instance matrices are static.
function makeHairMaterial(isBundle, uniforms) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: isBundle ? 0.25 : 0.3,
    clearcoat: isBundle ? 0.5 : 0.45,
    clearcoatRoughness: 0.12,
    sheen: isBundle ? 0 : 0.5,
    sheenColor: lin(0.9, 0.6, 0.7),
    side: THREE.DoubleSide, // the Blender empties are mirrored (scale -1)
  });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        ${RAMP_GLSL}
        attribute float aU; attribute float aPhase; attribute float aFv; attribute float aPlace;
        uniform sampler2D uState; uniform float uTime; uniform float uGlow;
        varying vec3 vGlow;`)
      .replace('#include <beginnormal_vertex>', `
        vec2 st = texture2D(uState, vec2(aU, 0.5)).rg;
        float act = st.r;
        float defl = st.g;
        float osc = sin(6.2831853 * aFv * uTime + aPhase);
        float dz = ${f(LIFT_K)} * act * (0.85 + 0.15 * osc);
        ${isBundle ? `
        float rx = ${f(-MAX_BEND)} * defl * (0.6 + 0.4 * osc);
        float ry = ${f(SWAY)} * clamp(defl, 0.0, 1.2) * sin(6.2831853 * aFv * 0.7 * uTime + aPhase + 1.3);
        float cx = cos(rx), sx = sin(rx), cy = cos(ry), sy = sin(ry);
        mat3 R = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
        float bend = min(abs(rx) / ${f(Math.PI / 4)}, 1.0);
        vGlow = pitchRamp(aPlace) * (bend * 3.2 + bend * bend * 2.5) * uGlow;` : `
        mat3 R = mat3(1.0);
        vGlow = pitchRamp(aPlace) * act * act * 0.9 * uGlow;`}
        vec3 objectNormal = R * vec3(normal.x, -normal.z, normal.y);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = R * vec3(position.x, -position.z, position.y) + vec3(0.0, 0.0, ${f(isBundle ? BUNDLE_REST_Z : 0)} + dz);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vGlow;`);
  };
  m.customProgramCacheKey = () => (isBundle ? 'hair-bundle' : 'hair-body');
  return m;
}

function buildHairCells(bodyGeoSrc, bundleGeoSrc, bodyMat, bundleMat, channels, requested) {
  const NC = channels.length;
  const rows = requested <= NC ? [BLENDER_ACROSS] : ROWS;
  const perRow = Math.max(1, Math.round(requested / rows.length));
  const count = perRow * rows.length;

  // Blender transforms of the original cells, decomposed for interpolation
  const P = [], Q = [], S = [];
  for (const c of channels) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    new THREE.Matrix4().fromArray(c.m).decompose(p, q, s);
    P.push(p); Q.push(q); S.push(s);
  }

  const bodyGeo = bodyGeoSrc.clone();
  const bundleGeo = bundleGeoSrc.clone();
  const aU = new Float32Array(count), aPhase = new Float32Array(count), aFv = new Float32Array(count), aPlace = new Float32Array(count);
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const bundles = new THREE.InstancedMesh(bundleGeo, bundleMat, count);

  const along = (BLENDER_SPACING * NC) / perRow;
  const sx = Math.min(1, along / 0.042);
  const multi = rows.length > 1;
  const sz = multi ? THREE.MathUtils.clamp(sx * 2.5, 0.22, 1) : 1;

  const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
  const M = new THREE.Matrix4(), local = new THREE.Matrix4(), out = new THREE.Matrix4();
  const rnd = mulberry32(7);
  const c = new THREE.Color();
  const bodyA = lin(0.62, 0.26, 0.34), bodyB = lin(0.95, 0.66, 0.66);
  const cilA = lin(0.82, 0.74, 0.66), cilB = lin(0.98, 0.94, 0.86);
  const cells = new Array(count);

  let j = 0;
  for (let r = 0; r < rows.length; r++) {
    const inner = multi && r === 0;
    for (let k = 0; k < perRow; k++, j++) {
      const u = THREE.MathUtils.clamp(((k + 0.5) / perRow) * NC - 0.5, 0, NC - 1);
      const i0 = Math.floor(u), i1 = Math.min(i0 + 1, NC - 1), fr = u - i0;
      pos.lerpVectors(P[i0], P[i1], fr);
      quat.slerpQuaternions(Q[i0], Q[i1], fr);
      M.compose(pos, quat, S[i0]);

      const d = (rows[r] - BLENDER_ACROSS) * membraneWidth(u / (NC - 1));
      const wx = inner ? sx * 1.15 : sx;
      const wy = multi ? (inner ? 0.75 : 0.6) : 1;
      local.makeScale(wx, wy, inner ? sz * 1.1 : sz).setPosition(0, d, 0);
      out.multiplyMatrices(C, M).multiply(local);
      bodies.setMatrixAt(j, out);
      bundles.setMatrixAt(j, out);

      const place = channels[i0].p + (channels[i1].p - channels[i0].p) * fr;
      const freq = Math.exp(Math.log(channels[i0].f) + (Math.log(channels[i1].f) - Math.log(channels[i0].f)) * fr);
      aU[j] = (u + 0.5) / NC;
      aPhase[j] = (j * 2.399) % (2 * Math.PI);
      aFv[j] = 4 + 8 * (1 - place);
      aPlace[j] = place;

      const e = out.elements;
      const base = new THREE.Vector3(e[12], e[13], e[14]);
      const upCol = new THREE.Vector3(e[8], e[9], e[10]);
      cells[j] = {
        f: freq,
        p: place,
        ch: Math.round(u),
        inner,
        pos: base,
        tip: base.clone().addScaledVector(upCol, 0.13),
        up: upCol.clone().normalize(),
      };

      bodies.setColorAt(j, c.copy(bodyA).lerp(bodyB, (inner ? 0.45 : 0.2) + 0.35 * rnd()));
      bundles.setColorAt(j, c.copy(cilA).lerp(cilB, 0.35 + 0.5 * rnd()));
    }
  }

  for (const g of [bodyGeo, bundleGeo]) {
    g.setAttribute('aU', new THREE.InstancedBufferAttribute(aU, 1));
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    g.setAttribute('aFv', new THREE.InstancedBufferAttribute(aFv, 1));
    g.setAttribute('aPlace', new THREE.InstancedBufferAttribute(aPlace, 1));
  }
  for (const m of [bodies, bundles]) {
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }

  return {
    count,
    rows: rows.length,
    bodies,
    bundles,
    cells,
    dispose() {
      bodyGeo.dispose();
      bundleGeo.dispose();
      bodies.dispose();
      bundles.dispose();
    },
  };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
