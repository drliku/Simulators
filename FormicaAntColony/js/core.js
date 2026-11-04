'use strict';
/* =========================================================================
   CORE — constants, RNG/noise, terrain grid, generation, terrain rendering,
   flow fields (BFS) and bounded path search.
   ========================================================================= */

const CS = 4;                 // pixels per cell (world px)
const W = 520, H = 280, N = W * H;
const INF = 65535;
const DT = 1 / 60;

const T_AIR = 0, T_SOIL = 1, T_ROCK = 2, T_ROOT = 3, T_TUNNEL = 4;
const Z_NONE = 0, Z_STORAGE = 1, Z_NURSERY = 2, Z_QUEEN = 3;
const WORKER = 0, SOLDIER = 1, QUEEN = 2;

const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];
const DNX = DX.map((x, k) => x / Math.hypot(x, DY[k]));
const DNY = DY.map((y, k) => y / Math.hypot(DX[k], y));

/* ---------- RNG & noise ---------- */
let _seed = (Math.random() * 4294967296) >>> 0;
function rand() {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + rand() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, s) { return hash2(x + s * 7919, y - s * 104729); }
function vnoise1(x, s) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hash3(i, 0, s), b = hash3(i + 1, 0, s);
  return a + (b - a) * u;
}
function fbm1(x, s, oct = 4) {
  let sum = 0, amp = 0.5, fr = 1, norm = 0;
  for (let o = 0; o < oct; o++) { sum += vnoise1(x * fr, s + o * 17) * amp; norm += amp; amp *= 0.5; fr *= 2; }
  return sum / norm;
}
function vnoise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, s), b = hash3(xi + 1, yi, s), c = hash3(xi, yi + 1, s), d = hash3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------- World state ---------- */
const World = {
  type: new Uint8Array(N),
  zone: new Uint8Array(N),
  zoneOwner: new Uint8Array(N),   // colony id + 1
  walk: new Uint8Array(N),
  plan: new Uint8Array(N),        // colony id + 1 for cells marked for excavation
  grassy: new Uint8Array(N),
  surf0: new Int16Array(W),       // generated surface row (sky above / tunnels below)
  surfTop: new Int16Array(W),     // current topmost non-air row per column
  lb0: new Float32Array(W), lb1: new Float32Array(W), lb2: new Float32Array(W),
  surfaceField: new Uint16Array(N),
  queue: new Int32Array(N),
  seeds: new Int32Array(N * 2),
  stamp: new Int32Array(N), prev: new Int32Array(N), stampId: 1,
  dirty: { any: false, x0: 0, y0: 0, x1: 0, y1: 0 },
  surfaceDirty: true, zoneDirty: true,
  minSurf: 0, maxSurf: 0,
  plants: [], blades: new Float32Array(0),
  canvas: null, ctx: null, img: null, d32: null,
  zcanvas: null, zctx: null, zimg: null, z32: null,
};

function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
function isOpenT(t) { return t === T_AIR || t === T_TUNNEL; }
function diggableT(t) { return t === T_SOIL || t === T_ROOT; }
function openAt(x, y) {
  if (y < 0) return true;
  if (x < 0 || x >= W || y >= H) return false;
  return isOpenT(World.type[y * W + x]);
}
function typeAt(x, y) {
  if (y < 0) return T_AIR;
  if (x < 0 || x >= W || y >= H) return T_ROCK;
  return World.type[y * W + x];
}
function openKindAt(x, y) { return y < World.surf0[clamp(x, 0, W - 1)] ? T_AIR : T_TUNNEL; }
function topSolid(x) {
  const t = World.type;
  for (let y = 0; y < H; y++) if (t[y * W + x] !== T_AIR) return y;
  return H;
}
function dropY(x, y) {
  const t = World.type;
  while (y + 1 < H && isOpenT(t[(y + 1) * W + x])) y++;
  return y;
}

function markDirty(x0, y0, x1, y1) {
  const d = World.dirty;
  if (!d.any) { d.any = true; d.x0 = x0; d.y0 = y0; d.x1 = x1; d.y1 = y1; return; }
  if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0;
  if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
}

function setCell(x, y, t) {
  const i = y * W + x, old = World.type[i];
  if (old === t) return false;
  World.type[i] = t;
  if (t !== T_SOIL) World.grassy[i] = 0;
  if (isOpenT(t)) World.plan[i] = 0;
  markDirty(x, y, x, y);
  return true;
}
function digCell(x, y) {
  if (!inB(x, y)) return false;
  const t = World.type[y * W + x];
  if (diggableT(t)) return setCell(x, y, openKindAt(x, y));
  return false;
}

function computeWalk(x, y) {
  const T = World.type, t = T[y * W + x];
  if (t === T_TUNNEL) return 1;
  if (t !== T_AIR) return 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const xx = x + dx, yy = y + dy;
    if (yy >= H) return 1;
    if (xx < 0 || xx >= W || yy < 0) continue;
    const tt = T[yy * W + xx];
    if (tt !== T_AIR && tt !== T_TUNNEL) return 1;
  }
  return 0;
}

function flushDirty() {
  const d = World.dirty;
  if (!d.any) return false;
  d.any = false;
  const x0 = Math.max(0, d.x0 - 1), x1 = Math.min(W - 1, d.x1 + 1);
  const y0 = Math.max(0, d.y0 - 1), y1 = Math.min(H - 1, d.y1 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) World.walk[y * W + x] = computeWalk(x, y);
  renderTerrain(d.x0 - 2, d.y0 - 2, d.x1 + 2, d.y1 + 2);
  World.zoneDirty = true;
  if (d.y0 <= World.maxSurf + 3) World.surfaceDirty = true;
  if (typeof Sim !== 'undefined') Sim.onTerrainChanged();
  return true;
}

/* ---------- Generation ---------- */
function generateWorld() {
  const T = World.type;
  T.fill(T_AIR); World.zone.fill(0); World.zoneOwner.fill(0); World.plan.fill(0); World.grassy.fill(0);
  const s = ri(1, 50000);
  let mn = H, mx = 0;
  for (let x = 0; x < W; x++) {
    const h = 74 + (fbm1(x / 70, s) - 0.5) * 30 + (fbm1(x / 16, s + 5) - 0.5) * 6;
    const sy = Math.round(h);
    World.surf0[x] = sy;
    World.lb0[x] = 9 + fbm1(x / 25, s + 11) * 7;
    World.lb1[x] = 42 + fbm1(x / 40, s + 23) * 16;
    World.lb2[x] = 100 + fbm1(x / 55, s + 37) * 24;
    for (let y = sy; y < H; y++) T[y * W + x] = T_SOIL;
    World.grassy[sy * W + x] = 1;
    mn = Math.min(mn, sy); mx = Math.max(mx, sy);
  }
  // bedrock
  for (let x = 0; x < W; x++) {
    const d = 2 + Math.floor(fbm1(x / 12, s + 3) * 4);
    for (let y = H - d; y < H; y++) T[y * W + x] = T_ROCK;
  }
  const blob = (cx, cy, r, t, overwriteAir) => {
    const rs = s + cx * 3;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (!inB(x, y)) continue;
      const a = Math.atan2(y - cy, x - cx);
      const rad = r * (0.75 + vnoise1(a * 1.6 + 10, rs) * 0.5);
      if (Math.hypot(x - cx, y - cy) <= rad) {
        const i = y * W + x;
        if (T[i] === T_AIR && !overwriteAir) continue;
        T[i] = t; World.grassy[i] = 0;
      }
    }
  };
  // underground rocks
  for (let k = 0; k < 34; k++) { const x = ri(5, W - 6); blob(x, ri(World.surf0[x] + 14, H - 6), rr(2, 7.5), T_ROCK, false); }
  for (let k = 0; k < 70; k++) { const x = ri(3, W - 4); blob(x, ri(World.surf0[x] + 6, H - 4), rr(0.8, 1.8), T_ROCK, false); }
  // surface boulders
  for (let k = 0; k < 6; k++) { const x = ri(15, W - 16); blob(x, World.surf0[x] + 1, rr(2.5, 5.5), T_ROCK, true); }
  // plants & roots
  World.plants = [];
  const kinds = ['tuft', 'flower', 'clover', 'sapling', 'tuft', 'flower', 'mushroom', 'fern'];
  for (let k = 0; k < 26; k++) {
    const x = ri(4, W - 5);
    if (T[World.surf0[x] * W + x] !== T_SOIL) continue;
    const kind = kinds[ri(0, kinds.length - 1)];
    const hue = ['#e9d36b', '#f2f0ea', '#d87fb0', '#9fb7ff', '#f29b5a'][ri(0, 4)];
    World.plants.push({ x, kind, h: kind === 'sapling' ? rr(26, 44) : rr(8, 18), ph: rand() * 6.28, color: hue, seedT: rr(10, 40) });
    if (kind !== 'mushroom') growRoot(x + 0.5, World.surf0[x] + 1, kind === 'sapling' ? rr(35, 60) : rr(12, 28), Math.PI / 2 + rr(-0.4, 0.4), 0);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) World.walk[y * W + x] = computeWalk(x, y);
  World.minSurf = mn; World.maxSurf = mx;
  renderTerrain(0, 0, W - 1, H - 1);
  World.surfaceDirty = true; World.zoneDirty = true;
}

function growRoot(x, y, len, ang, depth) {
  const T = World.type;
  for (let s = 0; s < len; s++) {
    x += Math.cos(ang) * 0.8; y += Math.sin(ang) * 0.8;
    ang += rr(-0.28, 0.28); ang = lerp(ang, Math.PI / 2, 0.04);
    const ix = x | 0, iy = y | 0;
    if (!inB(ix, iy) || iy >= H - 6) break;
    const i = iy * W + ix;
    if (T[i] === T_ROCK) break;
    if (T[i] === T_SOIL) T[i] = T_ROOT;
    if (s < len * 0.15 && depth === 0 && inB(ix + 1, iy) && T[i + 1] === T_SOIL) T[i + 1] = T_ROOT;
    if (depth < 3 && rand() < 0.07) growRoot(x, y, len * 0.5, ang + rr(-1.1, 1.1), depth + 1);
  }
}

/* ---------- Terrain rendering (per-pixel into ImageData) ---------- */
const LAYER_RGB = [[90, 60, 39], [116, 80, 50], [138, 93, 60], [104, 88, 76]];
const ZONE_RGB = [null, [240, 180, 70], [240, 128, 170], [190, 140, 255]];

function initTerrainCanvas() {
  World.canvas = document.createElement('canvas');
  World.canvas.width = W * CS; World.canvas.height = H * CS;
  World.ctx = World.canvas.getContext('2d');
  World.img = World.ctx.createImageData(W * CS, H * CS);
  World.d32 = new Uint32Array(World.img.data.buffer);
  World.zcanvas = document.createElement('canvas');
  World.zcanvas.width = W; World.zcanvas.height = H;
  World.zctx = World.zcanvas.getContext('2d');
  World.zimg = World.zctx.createImageData(W, H);
  World.z32 = new Uint32Array(World.zimg.data.buffer);
}

function pack(r, g, b, a = 255) {
  r = r > 255 ? 255 : r < 0 ? 0 : r | 0;
  g = g > 255 ? 255 : g < 0 ? 0 : g | 0;
  b = b > 255 ? 255 : b < 0 ? 0 : b | 0;
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function layerIndex(x, y, j) {
  const d = y - World.surf0[x] + j;
  if (d < World.lb0[x]) return 0;
  if (d < World.lb1[x]) return 1;
  if (d < World.lb2[x]) return 2;
  return 3;
}

function renderTerrain(x0, y0, x1, y1) {
  x0 = clamp(x0, 0, W - 1); x1 = clamp(x1, 0, W - 1); y0 = clamp(y0, 0, H - 1); y1 = clamp(y1, 0, H - 1);
  const T = World.type, d32 = World.d32, TW = W * CS, C1 = CS - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, t = T[i];
    const oU = openAt(x, y - 1), oD = openAt(x, y + 1), oL = openAt(x - 1, y), oR = openAt(x + 1, y);
    const open = isOpenT(t);
    const okind = openKindAt(x, y);
    let ao = 0;
    if (okind === T_TUNNEL && (open || oU || oD || oL || oR)) {
      let c = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!openAt(x + dx, y + dy)) c++;
      ao = c / 25;
    }
    for (let py = 0; py < CS; py++) for (let px = 0; px < CS; px++) {
      const tl = px + py <= 1, tr = C1 - px + py <= 1, bl = px + C1 - py <= 1, br = C1 - px + C1 - py <= 1;
      let et = t;
      if (!open) {
        if ((tl && oU && oL) || (tr && oU && oR) || (bl && oD && oL) || (br && oD && oR)) et = okind;
      } else {
        if ((tl && !oU && !oL) || (tr && !oU && !oR)) et = typeAt(x, y - 1);
        else if ((bl && !oD && !oL) || (br && !oD && !oR)) et = typeAt(x, y + 1);
      }
      const gx = x * CS + px, gy = y * CS + py;
      d32[gy * TW + gx] = pixelColor(et, t, x, y, gx, gy, px, py, oU, oD, oL, oR, ao, i);
    }
  }
  World.ctx.putImageData(World.img, 0, 0, x0 * CS, y0 * CS, (x1 - x0 + 1) * CS, (y1 - y0 + 1) * CS);
}

function pixelColor(et, t, x, y, gx, gy, px, py, oU, oD, oL, oR, ao, i) {
  if (et === T_AIR) return 0;
  const n1 = hash2(gx, gy);
  const n2 = vnoise2(gx / 9, gy / 9, 3);
  let r, g, b;
  if (et === T_TUNNEL) {
    const L = LAYER_RGB[layerIndex(x, y, 0)];
    let f = (0.3 + n2 * 0.07 + n1 * 0.03) * (1 - ao * 0.55);
    if (isOpenT(t)) {
      if (!oU && py <= 1) f *= 0.72;
      if (!oD && py === CS - 1) f *= 1.15;
    }
    return pack(L[0] * f + 12, L[1] * f + 7, L[2] * f + 4);
  }
  if (et === T_ROCK) {
    const v = 0.7 + vnoise2(gx / 7, gy / 7, 9) * 0.4 + (n1 - 0.5) * 0.1;
    r = 128 * v; g = 123 * v; b = 115 * v;
    if (t === T_ROCK) {
      const nr = (xx, yy) => typeAt(xx, yy) === T_ROCK;
      if (py === 0 && !nr(x, y - 1)) { const k = oU ? 1.25 : 0.8; r *= k; g *= k; b *= k; }
      else if (py === CS - 1 && !nr(x, y + 1)) { r *= 0.62; g *= 0.62; b *= 0.62; }
      else if ((px === 0 && !nr(x - 1, y)) || (px === CS - 1 && !nr(x + 1, y))) { r *= 0.78; g *= 0.78; b *= 0.78; }
    }
    return pack(r, g, b);
  }
  if (et === T_ROOT) {
    // fibrous root: a thin lighter core blended into the surrounding soil
    const L = LAYER_RGB[layerIndex(x, y, 0)];
    const nr = (xx, yy) => typeAt(xx, yy) === T_ROOT;
    const vert = nr(x, y - 1) || nr(x, y + 1), hor = nr(x - 1, y) || nr(x + 1, y);
    const dc = vert && !hor ? Math.abs(px - 1.5) : hor && !vert ? Math.abs(py - 1.5) : Math.min(Math.abs(px - 1.5), Math.abs(py - 1.5));
    const core = clamp(1.4 - dc * 0.75, 0, 1) * (0.8 + hash2((gx >> 1) + gy * 131, 7) * 0.3);
    const v = 0.88 + n2 * 0.18 + (n1 - 0.5) * 0.1;
    r = lerp(L[0] * v, 150, core * 0.7); g = lerp(L[1] * v, 112, core * 0.7); b = lerp(L[2] * v, 74, core * 0.7);
    if (isOpenT(t)) return pack(r * 0.4, g * 0.4, b * 0.4);
    return pack(r, g, b);
  }
  // soil
  const L = LAYER_RGB[layerIndex(x, y, (n1 - 0.5) * 2.5)];
  let v = 0.86 + n2 * 0.22 + (n1 - 0.5) * 0.12;
  if (n1 > 0.985) v += 0.3; else if (n1 < 0.012) v -= 0.25;
  r = L[0] * v; g = L[1] * v; b = L[2] * v;
  if (t === T_SOIL) {
    if (World.grassy[i] && oU) {
      if (py <= 1) { const gv = 0.78 + n1 * 0.45; return pack(72 * gv, 122 * gv, 44 * gv); }
      if (py === 2) { r = r * 0.6 + 26; g = g * 0.6 + 46; b = b * 0.6 + 12; }
    }
    if (oU && py === 0) { r *= 1.2; g *= 1.16; b *= 1.1; }
    if (oD && py === CS - 1) { r *= 0.6; g *= 0.58; b *= 0.56; }
    if ((oL && px === 0) || (oR && px === CS - 1)) { r *= 0.84; g *= 0.83; b *= 0.82; }
  }
  return pack(r, g, b);
}

function renderZones() {
  const z32 = World.z32, Z = World.zone, T = World.type;
  for (let i = 0; i < N; i++) {
    const z = Z[i];
    if (!z) { z32[i] = 0; continue; }
    const c = ZONE_RGB[z];
    z32[i] = pack(c[0], c[1], c[2], isOpenT(T[i]) ? 74 : 26);
  }
  World.zctx.putImageData(World.zimg, 0, 0);
  World.zoneDirty = false;
}

function rebuildSurface() {
  const bl = [];
  let mn = H, mx = 0;
  for (let x = 0; x < W; x++) {
    const y = topSolid(x);
    World.surfTop[x] = y;
    if (y < H) { mn = Math.min(mn, y); mx = Math.max(mx, y); }
    if (y >= H) continue;
    const i = y * W + x;
    if (World.type[i] === T_SOIL && World.grassy[i]) {
      for (let k = 0; k < 2; k++) {
        bl.push(x * CS + hash2(x, k) * CS, y * CS + 1.2, 3 + hash2(x + k * 31, 5) * 7, (hash2(x, k + 9) * 3) | 0);
      }
    }
  }
  World.blades = Float32Array.from(bl);
  World.minSurf = mn; World.maxSurf = Math.max(mx, World.maxSurf);
  World.surfaceDirty = false;
}

/* ---------- Soil dumping (ant hills) ---------- */
function dumpSoil(x) {
  let cx = clamp(x, 2, W - 3);
  for (let it = 0; it < 8; it++) {
    const top = topSolid(cx), lt = topSolid(cx - 1), rt = topSolid(cx + 1);
    if (lt > top + 1 && (rt <= top + 1 || rand() < 0.5) && cx > 2) cx--;
    else if (rt > top + 1 && cx < W - 3) cx++;
    else break;
  }
  const ty = topSolid(cx) - 1;
  if (ty < 3) return false;
  for (let yy = ty - 3; yy <= ty + 6; yy++) for (let xx = cx - 4; xx <= cx + 4; xx++) {
    if (inB(xx, yy) && World.type[yy * W + xx] === T_TUNNEL) return false;
  }
  if (World.type[ty * W + cx] !== T_AIR) return false;
  setCell(cx, ty, T_SOIL);
  return true;
}

/* ---------- Flow fields ---------- */
function bfsFill(field, seeds, n) {
  field.fill(INF);
  const q = World.queue, walk = World.walk;
  let h = 0, t = 0;
  for (let k = 0; k < n; k++) {
    const s = seeds[k];
    if (walk[s] && field[s] !== 0) { field[s] = 0; q[t++] = s; }
  }
  while (h < t) {
    const i = q[h++], d = field[i] + 1;
    const x = i % W, y = (i - x) / W;
    const l = x > 0, r = x < W - 1, u = y > 0, dn = y < H - 1;
    let wl = 0, wr = 0, wu = 0, wd = 0, j;
    if (l) { j = i - 1; wl = walk[j]; if (wl && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (r) { j = i + 1; wr = walk[j]; if (wr && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (u) { j = i - W; wu = walk[j]; if (wu && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (dn) { j = i + W; wd = walk[j]; if (wd && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (l && u && (wl || wu)) { j = i - W - 1; if (walk[j] && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (r && u && (wr || wu)) { j = i - W + 1; if (walk[j] && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (l && dn && (wl || wd)) { j = i + W - 1; if (walk[j] && field[j] > d) { field[j] = d; q[t++] = j; } }
    if (r && dn && (wr || wd)) { j = i + W + 1; if (walk[j] && field[j] > d) { field[j] = d; q[t++] = j; } }
  }
  return t;
}

function computeSurfaceField() {
  const seeds = World.seeds, T = World.type, walk = World.walk;
  let n = 0;
  for (let i = 0; i < N; i++) if (T[i] === T_AIR && walk[i]) seeds[n++] = i;
  bfsFill(World.surfaceField, seeds, n);
}

/* Bounded BFS path from (sx,sy) to (tx,ty). Returns array of cell indices (excluding start). */
function findPath(sx, sy, tx, ty, maxIter = 30000) {
  const walk = World.walk, st = World.stamp, prev = World.prev, q = World.queue;
  if (!inB(tx, ty) || !inB(sx, sy)) return null;
  const target = ty * W + tx, start = sy * W + sx;
  if (!walk[target]) return null;
  const id = ++World.stampId;
  let h = 0, t = 0;
  q[t++] = target; st[target] = id; prev[target] = -1;
  while (h < t && h < maxIter) {
    const i = q[h++];
    if (i === start) {
      const path = [];
      let c = prev[i];
      while (c !== -1) { path.push(c); c = prev[c]; }
      return path;
    }
    const x = i % W, y = (i - x) / W;
    for (let k = 0; k < 8; k++) {
      const x2 = x + DX[k], y2 = y + DY[k];
      if (x2 < 0 || x2 >= W || y2 < 0 || y2 >= H) continue;
      const j = y2 * W + x2;
      if (st[j] === id || !walk[j]) continue;
      if (DX[k] && DY[k] && !walk[y * W + x2] && !walk[y2 * W + x]) continue;
      st[j] = id; prev[j] = i; q[t++] = j;
    }
  }
  return null;
}
