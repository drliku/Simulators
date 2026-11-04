'use strict';
/* =========================================================================
   RENDER — Canvas 2D renderer (batched ants, cached terrain, overlays)
   ========================================================================= */

const TAU = Math.PI * 2;
const SPR_SCALE = 5, SPR_FRAMES = 6, SPR_OX = 56, SPR_OY = 32;  // ant sprite resolution & origin (sprite px)

function mixRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgbStr(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }

const Render = {
  canvas: null, ctx: null, dpr: 1, vw: 0, vh: 0,
  cam: { x: 0, y: 0, z: 1.6 },
  time: 0, frameN: 0,
  showPher: false, showZones: true,
  cursor: { x: 0, y: 0, on: false },
  clouds: [], stars: [], hills: [], rain: [], splashes: [], fireflies: [],
  pherCanvas: null, pherCtx: null, pherImg: null, pher32: null,
  cloudSprite: null, follow: null, zoneT: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pherCanvas = document.createElement('canvas');
    this.pherCanvas.width = W; this.pherCanvas.height = H;
    this.pherCtx = this.pherCanvas.getContext('2d');
    this.pherImg = this.pherCtx.createImageData(W, H);
    this.pher32 = new Uint32Array(this.pherImg.data.buffer);
    this.makeCloudSprite();
    for (let i = 0; i < 9; i++) this.clouds.push({ x: rand() * W * CS, y: rr(14, 150), s: rr(0.6, 1.4), v: rr(3, 9) });
    for (let i = 0; i < 140; i++) this.stars.push({ x: rand(), y: rand() * 0.7, r: rr(0.4, 1.3), p: rand() * TAU });
    for (let l = 0; l < 2; l++) {
      const pts = [], seed = ri(1, 9999), len = W * CS * 1.6;
      for (let x = 0; x <= len; x += 12) pts.push(fbm1(x / (l ? 260 : 420), seed, 4));
      this.hills.push(pts);
    }
    for (let i = 0; i < 26; i++) this.fireflies.push({ x: rand() * W * CS, y: 0, o: rr(8, 60), p: rand() * TAU, s: rr(0.4, 1) });
    this.resize();
  },

  makeCloudSprite() {
    const c = document.createElement('canvas');
    c.width = 220; c.height = 90;
    const g = c.getContext('2d');
    const puffs = [[60, 55, 34], [100, 42, 40], [145, 52, 34], [180, 60, 24], [35, 64, 20], [120, 62, 30]];
    for (const [x, y, r] of puffs) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    this.cloudSprite = c;
  },

  resize() {
    const ccx = this.cam.x + (this.vw / this.cam.z) / 2, ccy = this.cam.y + (this.vh / this.cam.z) / 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hadSize = this.vw > 0;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    if (hadSize) { this.cam.x = ccx - this.vw / this.cam.z / 2; this.cam.y = ccy - this.vh / this.cam.z / 2; }
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px'; this.canvas.style.height = this.vh + 'px';
    this.clampCam();
  },

  minZoom() { return Math.max(this.vw / (W * CS), this.vh / (H * CS)); },
  clampCam() {
    const c = this.cam;
    c.z = clamp(c.z, this.minZoom(), 7);
    c.x = clamp(c.x, 0, Math.max(0, W * CS - this.vw / c.z));
    c.y = clamp(c.y, 0, Math.max(0, H * CS - this.vh / c.z));
  },
  focusCell(cx, cy, z) {
    if (z) this.cam.z = z;
    this.cam.x = cx * CS - this.vw / this.cam.z / 2;
    this.cam.y = cy * CS - this.vh / this.cam.z / 2;
    this.clampCam();
  },
  screenToCell(sx, sy) { return { x: (this.cam.x + sx / this.cam.z) / CS, y: (this.cam.y + sy / this.cam.z) / CS }; },
  zoomAt(sx, sy, factor) {
    const before = this.screenToCell(sx, sy);
    this.cam.z = clamp(this.cam.z * factor, this.minZoom(), 7);
    this.cam.x = before.x * CS - sx / this.cam.z;
    this.cam.y = before.y * CS - sy / this.cam.z;
    this.clampCam();
  },

  /* ------------------------------------------------------------------ */
  frame(dt, paused) {
    this.time += dt; this.frameN++;
    const ctx = this.ctx, z = this.cam.z, dpr = this.dpr;
    if (this.follow) {
      const f = this.follow;
      if (f.dead) this.follow = null;
      else {
        const tx = f.fx * CS - this.vw / z / 2, ty = f.fy * CS - this.vh / z / 2;
        this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
      }
    }
    this.clampCam();
    const cam = this.cam;
    const vx0 = cam.x / CS, vy0 = cam.y / CS, vx1 = (cam.x + this.vw / z) / CS, vy1 = (cam.y + this.vh / z) / CS;
    Sim.view = { x0: vx0 - 3, y0: vy0 - 3, x1: vx1 + 3, y1: vy1 + 3 };
    if (World.surfaceDirty) rebuildSurface();
    this.zoneT -= dt;
    if (World.zoneDirty && this.zoneT <= 0) { renderZones(); this.zoneT = 0.2; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawSky(ctx);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * z * dpr, -cam.y * z * dpr);
    this.drawHills(ctx);
    this.drawClouds(ctx, paused ? 0 : dt);

    // terrain
    const sx = Math.max(0, Math.floor(cam.x)), sy = Math.max(0, Math.floor(cam.y));
    const sw = Math.min(W * CS - sx, Math.ceil(this.vw / z) + 2), sh = Math.min(H * CS - sy, Math.ceil(this.vh / z) + 2);
    ctx.imageSmoothingEnabled = z < 1.2;
    ctx.drawImage(World.canvas, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.imageSmoothingEnabled = true;

    const env = Sim.env;
    // moisture tint underground
    if (env.wet > 0.02) {
      const top = World.minSurf * CS;
      ctx.fillStyle = `rgba(16,24,40,${env.wet * 0.2})`;
      ctx.fillRect(sx, Math.max(sy, top), sw, sh);
    }
    if (this.showZones) {
      ctx.drawImage(World.zcanvas, 0, 0, W, H, 0, 0, W * CS, H * CS);
      this.drawPlans(ctx);
    }
    this.drawLights(ctx);
    this.drawStorage(ctx);
    if (this.showPher) this.drawPheromones(ctx);
    this.drawPlants(ctx);
    this.drawFoods(ctx);
    this.drawBrood(ctx);
    this.drawAnts(ctx);
    this.drawPredators(ctx);
    this.drawParticles(ctx);
    this.drawGrass(ctx);
    this.drawFireflies(ctx);
    this.drawRain(ctx, paused ? 0 : dt);
    this.drawShade(ctx, sx, sy, sw, sh);
    this.drawSelection(ctx);
    this.drawCursor(ctx);
  },

  /* ---------- sky ---------- */
  skyColors() {
    const e = Sim.env, d = e.daylight;
    let top = mixRGB([8, 12, 30], [70, 132, 205], d);
    let bot = mixRGB([24, 32, 62], [196, 226, 242], d);
    const dawn = clamp(1 - Math.abs(e.elev) * 3.2, 0, 1);
    bot = mixRGB(bot, [244, 160, 96], dawn * 0.7);
    top = mixRGB(top, [110, 92, 140], dawn * 0.35);
    if (e.rain > 0) {
      top = mixRGB(top, [90, 98, 108], e.rain * 0.65);
      bot = mixRGB(bot, [140, 148, 156], e.rain * 0.6);
      const k = 1 - e.rain * 0.25; top = top.map(v => v * k); bot = bot.map(v => v * k);
    }
    return [top, bot];
  },
  drawSky(ctx) {
    const [top, bot] = this.skyColors();
    const horizon = (World.minSurf * CS + 30 - this.cam.y) * this.cam.z;
    const g = ctx.createLinearGradient(0, Math.min(0, horizon - 400), 0, Math.max(10, horizon));
    g.addColorStop(0, rgbStr(top)); g.addColorStop(1, rgbStr(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
    const e = Sim.env;
    const skyH = Math.max(60, horizon);
    // stars
    const night = 1 - e.daylight;
    if (night > 0.2 && horizon > 0) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        const a = (night - 0.2) * (0.5 + 0.5 * Math.sin(this.time * 1.5 + s.p)) * (1 - e.rain);
        if (a <= 0.02) continue;
        const y = s.y * skyH;
        if (y > horizon) continue;
        ctx.globalAlpha = a; ctx.fillRect(s.x * this.vw, y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }
    // sun / moon
    const sunT = (e.day - 0.25) / 0.5;
    const moonT = ((e.day + 0.5) % 1 - 0.25) / 0.5;
    const drawBody = (t, isSun) => {
      if (t < -0.1 || t > 1.1) return;
      const x = this.vw * (0.08 + 0.84 * t);
      const y = horizon - Math.sin(clamp(t, 0, 1) * Math.PI) * Math.min(skyH * 0.75, 340) + 30;
      if (y > horizon + 20) return;
      const r = isSun ? 22 : 16;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, isSun ? 'rgba(255,236,170,0.55)' : 'rgba(210,225,255,0.3)');
      glow.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.globalAlpha = 1 - e.rain * 0.8;
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = isSun ? '#fff3c4' : '#e8eefc';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (!isSun) { ctx.fillStyle = rgbStr(this.skyColors()[0], 0.85); ctx.beginPath(); ctx.arc(x + 7, y - 4, r * 0.85, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    };
    drawBody(sunT, true);
    drawBody(moonT, false);
  },

  drawHills(ctx) {
    const e = Sim.env, base = World.minSurf * CS + 14;
    const cols = [mixRGB([30, 40, 60], [128, 160, 150], e.daylight), mixRGB([20, 30, 36], [86, 124, 84], e.daylight)];
    for (let l = 0; l < 2; l++) {
      const p = l ? 0.7 : 0.45, amp = l ? 70 : 110, pts = this.hills[l];
      const off = this.cam.x * (1 - p);
      const c = mixRGB(cols[l], this.skyColors()[1], l ? 0.25 : 0.5);
      ctx.fillStyle = rgbStr(c);
      ctx.beginPath(); ctx.moveTo(off - 50, base + 40);
      const x0 = Math.max(0, Math.floor((this.cam.x - off) / 12) - 1);
      const x1 = Math.min(pts.length - 1, Math.ceil((this.cam.x + this.vw / this.cam.z - off) / 12) + 1);
      ctx.lineTo(off + x0 * 12, base + 40);
      for (let i = x0; i <= x1; i++) ctx.lineTo(off + i * 12, base - pts[i] * amp - (l ? 6 : 26));
      ctx.lineTo(off + x1 * 12, base + 40);
      ctx.closePath(); ctx.fill();
    }
  },

  drawClouds(ctx, dt) {
    const e = Sim.env, spr = this.cloudSprite;
    const dark = e.rain;
    ctx.globalAlpha = 0.55 + dark * 0.35 - (1 - e.daylight) * 0.35;
    for (const c of this.clouds) {
      c.x += c.v * dt * (0.5 + e.wind) * Sim.speed;
      if (c.x > W * CS + 100) c.x = -260;
      const w = 220 * c.s, h = 90 * c.s;
      ctx.drawImage(spr, c.x, c.y, w, h);
    }
    ctx.globalAlpha = 1;
  },

  /* ---------- overlays ---------- */
  drawPlans(ctx) {
    const v = Sim.view;
    ctx.fillStyle = 'rgba(255,236,200,0.35)';
    ctx.beginPath();
    for (const c of Sim.colonies) {
      if (!c.alive) continue;
      for (const i of c.plan) {
        const x = i % W, y = (i - x) / W;
        if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
        ctx.rect(x * CS + 1.5, y * CS + 1.5, 1, 1);
      }
    }
    ctx.fill();
  },

  drawLights(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const a of Sim.ants) {
      if (a.dead || a.role !== QUEEN) continue;
      const x = a.fx * CS, y = a.fy * CS;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 46);
      g.addColorStop(0, 'rgba(255,180,90,0.16)'); g.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 46, y - 46, 92, 92);
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawStorage(ctx) {
    const v = Sim.view;
    for (const c of Sim.colonies) {
      if (!c.alive || !c.storageFloor.length) continue;
      const fl = c.storageFloor, n = Math.min(fl.length * 3, Math.ceil(c.food / 4));
      const cols = ['#d8b26a', '#efe9dc', '#b98b4e', '#8fb15a'];
      for (let ci = 0; ci < 4; ci++) {
        ctx.fillStyle = cols[ci]; ctx.beginPath();
        for (let k = ci; k < n; k += 4) {
          const i = fl[k % fl.length], x = i % W, y = (i - x) / W;
          if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
          const layer = Math.floor(k / fl.length);
          const px = x * CS + hash2(k, 3) * CS, py = (y + 1) * CS - 0.9 - layer * 1.4;
          ctx.moveTo(px + 1, py); ctx.ellipse(px, py, 1, 0.75, 0, 0, TAU);
        }
        ctx.fill();
      }
    }
  },

  drawPheromones(ctx) {
    if (this.frameN % 6 === 0) {
      const p32 = this.pher32;
      const cols = Sim.colonies;
      for (let i = 0; i < N; i++) {
        let f = 0, h = 0;
        for (let c = 0; c < cols.length; c++) { f += cols[c].pherFood[i]; h += cols[c].pherHome[i]; }
        if (f < 0.05 && h < 0.05) { p32[i] = 0; continue; }
        const fa = Math.min(1, f / 8), ha = Math.min(1, h / 6) * 0.7;
        const a = Math.max(fa, ha);
        const t = fa / (fa + ha + 1e-6);
        p32[i] = pack(lerp(90, 120, t), lerp(150, 255, t), lerp(255, 140, t), Math.min(230, a * 255));
      }
      this.pherCtx.putImageData(this.pherImg, 0, 0);
    }
    ctx.drawImage(this.pherCanvas, 0, 0, W, H, 0, 0, W * CS, H * CS);
  },

  /* ---------- plants & grass ---------- */
  drawPlants(ctx) {
    const v = Sim.view, t = this.time, wind = Sim.env.wind;
    for (const p of World.plants) {
      if (p.x < v.x0 - 10 || p.x > v.x1 + 10) continue;
      const ty = World.surfTop[p.x];
      if (ty >= H || World.type[ty * W + p.x] === T_ROCK) continue;
      if (ty * CS > (World.surf0[p.x] + 3) * CS) continue;
      const bx = p.x * CS + 2, by = ty * CS + 0.5;
      const sway = Math.sin(t * 1.3 + p.ph) * wind * 2.2;
      ctx.lineCap = 'round';
      switch (p.kind) {
        case 'tuft':
          ctx.strokeStyle = '#4f8a35'; ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (let k = -3; k <= 3; k++) {
            const hh = p.h * (0.6 + 0.4 * hash2(p.x, k + 5));
            ctx.moveTo(bx + k * 0.6, by);
            ctx.quadraticCurveTo(bx + k * 1.2 + sway * 0.4, by - hh * 0.6, bx + k * 2 + sway, by - hh);
          }
          ctx.stroke();
          break;
        case 'flower': {
          ctx.strokeStyle = '#4a7f30'; ctx.lineWidth = 0.8;
          const hx = bx + sway, hy = by - p.h;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.3, by - p.h * 0.5, hx, hy); ctx.stroke();
          ctx.fillStyle = '#5c9a3a'; ctx.beginPath(); ctx.ellipse(bx + 2 + sway * 0.3, by - p.h * 0.35, 2.2, 0.9, -0.5, 0, TAU); ctx.fill();
          ctx.fillStyle = p.color;
          for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + t * 0.1; ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * 1.8, hy + Math.sin(a) * 1.8, 1.5, 0.95, a, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#f2c14a'; ctx.beginPath(); ctx.arc(hx, hy, 1.1, 0, TAU); ctx.fill();
          break;
        }
        case 'clover':
          ctx.strokeStyle = '#4c8a34'; ctx.lineWidth = 0.6; ctx.fillStyle = '#5fa040';
          for (let k = 0; k < 3; k++) {
            const sx2 = bx + (k - 1) * 3, hh = p.h * 0.5 * (0.7 + 0.3 * k / 2), hx = sx2 + sway * 0.7, hy = by - hh;
            ctx.beginPath(); ctx.moveTo(sx2, by); ctx.lineTo(hx, hy); ctx.stroke();
            for (let l = 0; l < 3; l++) { const a = l / 3 * TAU - Math.PI / 2; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 1.3, hy + Math.sin(a) * 1.3, 1.2, 0, TAU); ctx.fill(); }
          }
          break;
        case 'fern':
          ctx.strokeStyle = '#3f7a33'; ctx.lineWidth = 0.7;
          for (let s = -1; s <= 1; s += 2) {
            ctx.beginPath(); ctx.moveTo(bx, by);
            const ex = bx + s * p.h * 0.7 + sway, ey = by - p.h * 0.8;
            ctx.quadraticCurveTo(bx + s * 2, by - p.h, ex, ey); ctx.stroke();
            for (let k = 1; k < 6; k++) {
              const tt = k / 6, qx = lerp(bx, ex, tt) + s * Math.sin(tt * 3) * 1.5, qy = lerp(by, ey, tt) - Math.sin(tt * Math.PI) * p.h * 0.25;
              ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + s * 1.8, qy - 1.6); ctx.stroke();
            }
          }
          break;
        case 'mushroom':
          ctx.fillStyle = '#e9dcc6'; ctx.fillRect(bx - 0.7, by - p.h * 0.45, 1.4, p.h * 0.45);
          ctx.fillStyle = '#b5482e'; ctx.beginPath(); ctx.ellipse(bx, by - p.h * 0.45, 3.6, 2.2, 0, Math.PI, TAU); ctx.fill();
          ctx.fillStyle = '#f3e9da'; ctx.fillRect(bx - 1.6, by - p.h * 0.45 - 1.4, 0.8, 0.8); ctx.fillRect(bx + 1, by - p.h * 0.45 - 1, 0.7, 0.7);
          break;
        case 'sapling': {
          const s2 = sway * 0.6;
          ctx.strokeStyle = '#5b4030'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s2 * 0.3, by - p.h * 0.5, bx + s2, by - p.h); ctx.stroke();
          ctx.lineWidth = 0.7;
          const leaves = [[-0.75, 0.55], [0.7, 0.62], [-0.5, 0.8], [0.45, 0.9], [0, 1.02], [-0.85, 0.72], [0.85, 0.78]];
          for (let k = 0; k < leaves.length; k++) {
            const [lx, ly] = leaves[k];
            const x = bx + s2 * ly + lx * p.h * 0.3, y = by - p.h * ly;
            const ls = Math.sin(t * 2 + k + p.ph) * 0.3;
            ctx.beginPath(); ctx.moveTo(bx + s2 * ly, y + 2); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = k % 2 ? '#5f9b3c' : '#6fae45';
            ctx.beginPath(); ctx.ellipse(x, y, 4.2, 2.2, lx * 0.8 + ls, 0, TAU); ctx.fill();
          }
          break;
        }
      }
    }
  },

  drawGrass(ctx) {
    const b = World.blades, v = Sim.view, t = this.time, wind = Sim.env.wind;
    const x0 = v.x0 * CS, x1 = v.x1 * CS;
    const cols = ['#4f8d34', '#5fa03e', '#3f7a2c'];
    ctx.lineWidth = 0.75; ctx.lineCap = 'round';
    for (let shade = 0; shade < 3; shade++) {
      ctx.strokeStyle = cols[shade]; ctx.beginPath();
      for (let i = 0; i < b.length; i += 4) {
        if (b[i + 3] !== shade) continue;
        const bx = b[i]; if (bx < x0 || bx > x1) continue;
        const by = b[i + 1], h = b[i + 2];
        const sw = (Math.sin(t * 1.7 + bx * 0.045) + Math.sin(t * 2.9 + bx * 0.11) * 0.4) * wind * h * 0.32;
        ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sw * 0.4, by - h * 0.6, bx + sw, by - h);
      }
      ctx.stroke();
    }
  },

  drawFireflies(ctx) {
    const e = Sim.env, night = 1 - e.daylight;
    if (night < 0.45 || e.rain > 0.2) return;
    const a0 = (night - 0.45) * 1.8;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const fx = f.x + Math.sin(this.time * 0.4 * f.s + f.p) * 30;
      const col = clamp(Math.floor(fx / CS), 0, W - 1);
      const fy = World.surfTop[col] * CS - f.o - Math.sin(this.time * 0.7 + f.p) * 8;
      const a = a0 * (0.5 + 0.5 * Math.sin(this.time * 3 * f.s + f.p));
      if (a < 0.05) continue;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 6);
      g.addColorStop(0, `rgba(220,255,140,${a})`); g.addColorStop(1, 'rgba(220,255,140,0)');
      ctx.fillStyle = g; ctx.fillRect(fx - 6, fy - 6, 12, 12);
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  /* ---------- food & brood ---------- */
  drawFoods(ctx) {
    const v = Sim.view;
    for (const f of Sim.foods) {
      if (f.dead || f.x < v.x0 || f.x > v.x1 || f.y < v.y0 || f.y > v.y1) continue;
      const k = Math.sqrt(f.units / f.max);
      const x = (f.x + 0.5) * CS, y = (f.y + 1) * CS;
      switch (f.type) {
        case 'seed':
          ctx.fillStyle = '#c9a46a'; ctx.beginPath(); ctx.ellipse(x, y - 1.1, 1.6, 1.05, f.rot, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(90,60,30,0.6)'; ctx.beginPath(); ctx.ellipse(x + 0.3, y - 1.2, 0.9, 0.3, f.rot, 0, TAU); ctx.fill();
          break;
        case 'sugar': {
          const n = Math.ceil(f.units / 3);
          let i = 0;
          for (let row = 0; i < n; row++) {
            const inRow = Math.max(1, 6 - row);
            for (let c = 0; c < inRow && i < n; c++, i++) {
              const px = x + (c - (inRow - 1) / 2) * 1.9, py = y - 1.7 - row * 1.6;
              ctx.fillStyle = (i % 3) ? '#f7f4ee' : '#e4ddd0';
              ctx.fillRect(px - 0.85, py - 0.85, 1.7, 1.7);
            }
          }
          break;
        }
        case 'leaf': {
          const L = 3 + 5 * k;
          ctx.save(); ctx.translate(x, y - 1.2); ctx.rotate(f.rot * 0.4);
          ctx.fillStyle = '#76ad42'; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -L * 0.55, L, 0); ctx.quadraticCurveTo(0, L * 0.35, -L, 0); ctx.fill();
          ctx.strokeStyle = 'rgba(40,70,20,0.7)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'insect': {
          const s = 0.6 + 0.6 * k;
          ctx.save(); ctx.translate(x, y - 2 * s); ctx.rotate(f.rot * 0.3); ctx.scale(s, s);
          ctx.strokeStyle = '#2b211b'; ctx.lineWidth = 0.6; ctx.beginPath();
          for (let l = -1; l <= 1; l++) { ctx.moveTo(l * 1.8, 0); ctx.lineTo(l * 2.6, 3); ctx.moveTo(l * 1.8, 0); ctx.lineTo(l * 2.2 + 0.6, -2.4); }
          ctx.stroke();
          ctx.fillStyle = '#3d2f26'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.2, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5a4535'; ctx.beginPath(); ctx.arc(4.2, 0, 1.4, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(200,220,255,0.3)'; ctx.beginPath(); ctx.ellipse(-0.5, -1.6, 3, 1, -0.2, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'corpse':
          ctx.fillStyle = 'rgba(70,56,48,0.9)';
          ctx.beginPath(); ctx.ellipse(x - 1.5, y - 1, 1.8, 1.1, 0, 0, TAU); ctx.moveTo(x + 2.5, y - 1); ctx.ellipse(x + 1.3, y - 1, 1.1, 0.8, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(60,46,40,0.9)'; ctx.lineWidth = 0.4; ctx.beginPath();
          for (let l = -1; l <= 1; l++) { ctx.moveTo(x + l, y - 1.2); ctx.lineTo(x + l * 1.5, y - 2.8); }
          ctx.stroke();
          break;
      }
    }
  },

  drawBrood(ctx) {
    const v = Sim.view;
    for (const c of Sim.colonies) {
      for (const b of c.brood) {
        if (b.x < v.x0 || b.x > v.x1 || b.y < v.y0 || b.y > v.y1) continue;
        const x = b.x * CS, y = b.y * CS;
        if (b.stage === 0) {
          ctx.fillStyle = '#f7f1e2'; ctx.beginPath(); ctx.ellipse(x, y - 0.6, 0.95, 0.65, 0.3, 0, TAU); ctx.fill();
        } else if (b.stage === 1) {
          const g = Math.min(1, b.age / 30), rx = 1.2 + g * 1.1, ry = 0.85 + g * 0.55;
          ctx.fillStyle = b.hungry() ? '#e8d3b4' : '#f2e7d0';
          ctx.beginPath(); ctx.ellipse(x, y - ry, rx, ry, Math.sin(Render.time * 2 + b.wob) * 0.15, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(150,120,90,0.5)'; ctx.lineWidth = 0.25; ctx.beginPath();
          for (let s = -1; s <= 1; s++) { ctx.moveTo(x + s * rx * 0.45, y - ry * 1.8); ctx.lineTo(x + s * rx * 0.45, y - ry * 0.2); }
          ctx.stroke();
        } else {
          ctx.fillStyle = '#e0cba0'; ctx.beginPath(); ctx.ellipse(x, y - 1.2, 2.3, 1.2, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(130,100,60,0.55)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(x - 1.6, y - 1.2); ctx.lineTo(x + 1.6, y - 1.2); ctx.stroke();
        }
      }
    }
  },

  /* ---------- ants (batched per colony) ---------- */
  antPos(a) {
    const c = Math.cos(a.angle), s = Math.sin(a.angle);
    return [a.fx * CS - s * a.lane, a.fy * CS + c * a.lane, c, s];
  },
  drawAnts(ctx) {
    const v = Sim.view, z = this.cam.z, detail = z >= 0.85, t = this.time;
    const groups = new Map();
    for (const a of Sim.ants) {
      if (a.dead) continue;
      const x = a.fx, y = a.fy;
      if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
      let g = groups.get(a.colony);
      if (!g) { g = []; groups.set(a.colony, g); }
      g.push(a);
    }
    const k = this.dpr * z, tx = -this.cam.x * k, ty = -this.cam.y * k, m = k / SPR_SCALE;
    for (const [col, list] of groups) {
      const spr = this.antSprites(col);
      for (const a of list) {
        const frames = spr[a.role];
        const fi = (a.moving || a.foe) ? ((Math.floor(a.legPhase / TAU * SPR_FRAMES) % SPR_FRAMES) + SPR_FRAMES) % SPR_FRAMES : SPR_FRAMES;
        const c = Math.cos(a.angle), s = Math.sin(a.angle);
        const X = a.fx * CS - s * a.lane, Y = a.fy * CS + c * a.lane;
        ctx.setTransform(m * c, m * s, -m * s, m * c, k * X + tx, k * Y + ty);
        ctx.drawImage(frames[fi], -SPR_OX, -SPR_OY);
      }
    }
    ctx.setTransform(k, 0, 0, k, tx, ty);
    for (const list of groups.values()) for (const a of list) if (a.carry) this.antCarry(ctx, a);
  },
  /* pre-rendered gait frames per colony & role (index SPR_FRAMES = idle pose) */
  antSprites(col) {
    if (col._spr) return col._spr;
    const pal = col.pal, out = [];
    for (let role = 0; role < 3; role++) {
      const frames = [];
      for (let f = 0; f <= SPR_FRAMES; f++) {
        const cv = document.createElement('canvas');
        cv.width = SPR_OX * 2; cv.height = SPR_OY * 2;
        const g = cv.getContext('2d');
        g.setTransform(SPR_SCALE, 0, 0, SPR_SCALE, SPR_OX, SPR_OY);
        g.lineCap = 'round'; g.lineJoin = 'round';
        const fake = { fx: 0, fy: 0, angle: 0, lane: 0, id: 0, role, size: role === SOLDIER ? 1.2 : role === QUEEN ? 1.15 : 1,
          legPhase: f < SPR_FRAMES ? (f + 0.5) / SPR_FRAMES * TAU : 0, moving: f < SPR_FRAMES, busy: 0 };
        g.strokeStyle = pal.leg; g.lineWidth = role === QUEEN ? 0.6 : 0.5;
        g.beginPath(); this.antLegs(g, fake, 0); g.stroke();
        g.fillStyle = pal.body; g.beginPath(); this.antBody(g, fake); g.fill();
        g.fillStyle = pal.hi; g.beginPath(); this.antHi(g, fake); g.fill();
        frames.push(cv);
      }
      out.push(frames);
    }
    col._spr = out;
    return out;
  },
  _e(ctx, X, Y, c, s, S, ang, lx, ly, rx, ry) {
    const ex = X + (lx * c - ly * s) * S, ey = Y + (lx * s + ly * c) * S;
    ctx.moveTo(ex + rx * S * c, ey + rx * S * s);
    ctx.ellipse(ex, ey, rx * S, ry * S, ang, 0, TAU);
  },
  antBody(ctx, a) {
    const [X, Y, c, s] = this.antPos(a), S = a.size, ang = a.angle, e = this._e;
    if (a.role === QUEEN) {
      e(ctx, X, Y, c, s, S, ang, 3.7, 0, 1.5, 1.3);
      e(ctx, X, Y, c, s, S, ang, 1.2, 0, 2.2, 1.45);
      e(ctx, X, Y, c, s, S, ang, -1.0, 0, 0.65, 0.6);
      e(ctx, X, Y, c, s, S, ang, -4.6, 0, 3.9, 2.5);
    } else if (a.role === SOLDIER) {
      e(ctx, X, Y, c, s, S, ang, 3.2, 0, 1.9, 1.65);
      e(ctx, X, Y, c, s, S, ang, 0.6, 0, 1.6, 0.95);
      e(ctx, X, Y, c, s, S, ang, -0.95, 0, 0.55, 0.5);
      e(ctx, X, Y, c, s, S, ang, -3.0, 0, 2.2, 1.65);
    } else {
      e(ctx, X, Y, c, s, S, ang, 3.0, 0, 1.35, 1.15);
      e(ctx, X, Y, c, s, S, ang, 0.7, 0, 1.6, 0.9);
      e(ctx, X, Y, c, s, S, ang, -0.9, 0, 0.55, 0.5);
      e(ctx, X, Y, c, s, S, ang, -3.0, 0, 2.3, 1.7);
    }
  },
  antHi(ctx, a) {
    const [X, Y, c, s] = this.antPos(a), S = a.size, ang = a.angle, e = this._e;
    if (a.role === QUEEN) { e(ctx, X, Y, c, s, S, ang, -4.0, -0.9, 1.6, 0.6); e(ctx, X, Y, c, s, S, ang, 1.4, -0.5, 0.8, 0.35); }
    else { e(ctx, X, Y, c, s, S, ang, -2.5, -0.6, 0.95, 0.42); e(ctx, X, Y, c, s, S, ang, a.role === SOLDIER ? 3.3 : 3.1, -0.45, 0.5, 0.28); }
  },
  antLegs(ctx, a, t) {
    const [X, Y, c, s] = this.antPos(a), S = a.size;
    const P = (lx, ly) => [X + (lx * c - ly * s) * S, Y + (lx * s + ly * c) * S];
    const ph = a.legPhase, amp = a.moving || a.busy > 0 ? 1.1 : 0.12;
    const q = a.role === QUEEN ? 1.25 : 1;
    const ax = a.role === QUEEN ? [1.9, 1.2, 0.4] : [1.3, 0.6, -0.1];
    const fo = [2.2, 0.4, -2.1];
    for (let i = 0; i < 3; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const off = ((i + (side > 0 ? 1 : 0)) & 1) * Math.PI;
        const sw = Math.sin(ph + off) * amp;
        const p0 = P(ax[i], side * 0.5), p1 = P(ax[i] + fo[i] * 0.45 * q + sw * 0.4, side * 1.9 * q), p2 = P(ax[i] + fo[i] * q + sw, side * 3.3 * q);
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
    }
    const wig = Math.sin(t * 7 + a.id) * 0.35;
    const hx = a.role === SOLDIER ? 4.4 : a.role === QUEEN ? 4.6 : 3.9;
    for (let side = -1; side <= 1; side += 2) {
      const p0 = P(hx, side * 0.4), p1 = P(hx + 1.1, side * (1.3 + wig)), p2 = P(hx + 2.4, side * (0.9 + wig));
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
    }
    if (a.role === SOLDIER) {
      for (let side = -1; side <= 1; side += 2) {
        const p0 = P(4.6, side * 0.8), p1 = P(5.8, side * 0.2);
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
      }
    }
  },
  antCarry(ctx, a) {
    const [X, Y, c, s] = this.antPos(a), S = a.size;
    const fx = X + c * 5.6 * S, fy = Y + s * 5.6 * S;
    const k = a.carry.kind;
    if (k === 'brood') return; // drawn in brood pass (position follows the carrier)
    ctx.fillStyle = a.carry.color || '#d9c27a';
    ctx.beginPath();
    if (k === 'soil') ctx.rect(fx - 1, fy - 1, 2, 2);
    else if (k === 'corpse') ctx.ellipse(fx, fy, 1.8, 1.1, a.angle, 0, TAU);
    else if (a.carry.type === 'leaf') ctx.ellipse(fx, fy - 1, 2.6, 1.2, a.angle + 0.6, 0, TAU);
    else ctx.arc(fx, fy, 1.15, 0, TAU);
    ctx.fill();
  },

  /* ---------- predators ---------- */
  drawPredators(ctx) {
    const v = Sim.view, t = this.time;
    for (const p of Sim.predators) {
      if (p.dead || p.fx < v.x0 - 4 || p.fx > v.x1 + 4 || p.fy < v.y0 - 4 || p.fy > v.y1 + 4) continue;
      const X = p.fx * CS, Y = p.fy * CS, c = Math.cos(p.angle), s = Math.sin(p.angle);
      const P = (lx, ly) => [X + lx * c - ly * s, Y + lx * s + ly * c];
      const ph = p.legPhase, amp = p.moving ? 1.6 : 0.2;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (p.kind === 'spider') {
        ctx.strokeStyle = '#2a1d15'; ctx.lineWidth = 0.95; ctx.beginPath();
        const at = [2.6, 1.8, 1.0, 0.2], kx = [4.5, 2, -1.2, -3.8], fx = [8, 3.2, -3.2, -7.5];
        for (let i = 0; i < 4; i++) for (let sd = -1; sd <= 1; sd += 2) {
          const sw = Math.sin(ph * 1.2 + i * 1.7 + (sd > 0 ? Math.PI : 0)) * amp;
          const a0 = P(at[i], sd * 1.2), a1 = P(kx[i] + sw * 0.5, sd * 5.8), a2 = P(fx[i] + sw, sd * 8.6);
          ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]);
        }
        ctx.stroke();
        ctx.fillStyle = '#4a3426'; ctx.beginPath(); const ab = P(-4, 0); ctx.ellipse(ab[0], ab[1], 4.8, 3.9, p.angle, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a5a40'; ctx.beginPath(); ctx.ellipse(ab[0], ab[1], 3, 0.9, p.angle, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a291e'; ctx.beginPath(); const ce = P(1.7, 0); ctx.ellipse(ce[0], ce[1], 3.1, 2.6, p.angle, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,160,0.85)';
        for (const sd of [-1, 1]) { const ey = P(4.2, sd * 0.9); ctx.beginPath(); ctx.arc(ey[0], ey[1], 0.55, 0, TAU); ctx.fill(); }
      } else {
        ctx.strokeStyle = '#141b1e'; ctx.lineWidth = 0.9; ctx.beginPath();
        const at = [2.5, 0.5, -1.5], fx = [5.5, 0.8, -5];
        for (let i = 0; i < 3; i++) for (let sd = -1; sd <= 1; sd += 2) {
          const sw = Math.sin(ph + i * 2.1 + (sd > 0 ? Math.PI : 0)) * amp;
          const a0 = P(at[i], sd * 2), a1 = P(at[i] + fx[i] * 0.4 + sw * 0.4, sd * 5), a2 = P(at[i] + fx[i] + sw, sd * 7);
          ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]);
        }
        const h0 = P(6.5, 0);
        for (const sd of [-1, 1]) { const a1 = P(8.5, sd * 2.2), a2 = P(10, sd * 3.6); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); }
        ctx.stroke();
        const sh = P(-1, 0);
        const g = ctx.createLinearGradient(sh[0] - 4, sh[1] - 4, sh[0] + 4, sh[1] + 4);
        g.addColorStop(0, '#3b5157'); g.addColorStop(0.5, '#1d2a2e'); g.addColorStop(1, '#0f1517');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], 6.4, 4.2, p.angle, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,170,180,0.35)'; ctx.lineWidth = 0.4; ctx.beginPath(); const l0 = P(-7, 0), l1 = P(4.5, 0); ctx.moveTo(l0[0], l0[1]); ctx.lineTo(l1[0], l1[1]); ctx.stroke();
        ctx.fillStyle = '#1a2326'; ctx.beginPath(); ctx.ellipse(h0[0], h0[1], 2.2, 1.9, p.angle, 0, TAU); ctx.fill();
      }
      if (p.hp < p.maxHp) this.hpBar(ctx, X, Y - 12, p.hp / p.maxHp);
    }
  },
  hpBar(ctx, x, y, f) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 7, y, 14, 1.8);
    ctx.fillStyle = f > 0.5 ? '#7fd36a' : f > 0.25 ? '#f0c13a' : '#ff5b3d';
    ctx.fillRect(x - 7, y, 14 * clamp(f, 0, 1), 1.8);
  },

  drawParticles(ctx) {
    for (const p of Sim.particles) {
      ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },

  /* ---------- weather ---------- */
  drawRain(ctx, dt) {
    const e = Sim.env, target = Math.floor(e.rain * 420), cam = this.cam, z = cam.z;
    const vx0 = cam.x, vy0 = cam.y, vw = this.vw / z, vh = this.vh / z;
    while (this.rain.length < target) this.rain.push({ x: vx0 + rand() * vw, y: vy0 + rand() * vh - vh, v: rr(260, 380), l: rr(5, 10) });
    if (this.rain.length > target) this.rain.length = target;
    if (this.rain.length) {
      const wx = -e.wind * 70;
      ctx.strokeStyle = 'rgba(190,210,235,0.5)'; ctx.lineWidth = Math.max(0.6, 1.1 / z); ctx.beginPath();
      for (const d of this.rain) {
        d.y += d.v * dt; d.x += wx * dt;
        const col = clamp(Math.floor(d.x / CS), 0, W - 1);
        const ground = World.surfTop[col] * CS;
        if (d.y >= ground || d.y > vy0 + vh + 20 || d.x < vx0 - 30 || d.x > vx0 + vw + 30) {
          if (d.y >= ground && this.splashes.length < 160 && d.x > vx0 && d.x < vx0 + vw) this.splashes.push({ x: d.x, y: ground, t: 0 });
          d.x = vx0 + rand() * (vw + 60); d.y = vy0 - rand() * 60;
          continue;
        }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + wx * 0.02, d.y - d.l);
      }
      ctx.stroke();
    }
    if (this.splashes.length) {
      ctx.strokeStyle = 'rgba(200,220,240,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath();
      for (const s of this.splashes) {
        s.t += dt;
        const r = 0.5 + s.t * 10;
        ctx.moveTo(s.x - r, s.y); ctx.quadraticCurveTo(s.x, s.y - r * 0.7, s.x + r, s.y);
      }
      ctx.stroke();
      this.splashes = this.splashes.filter(s => s.t < 0.25);
    }
  },

  drawShade(ctx, sx, sy, sw, sh) {
    const e = Sim.env;
    // underground depth darkness
    const top = World.minSurf * CS + 20, bot = H * CS;
    if (sy + sh > top) {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, 'rgba(6,4,3,0)'); g.addColorStop(1, 'rgba(6,4,3,0.5)');
      ctx.fillStyle = g; ctx.fillRect(sx, Math.max(top, sy), sw, sy + sh - Math.max(top, sy));
    }
    // night / overcast on the surface
    const night = (1 - e.daylight) * 0.5 + e.rain * 0.12;
    if (night > 0.01) {
      const bottom = World.maxSurf * CS + 60;
      if (sy < bottom) {
        const g = ctx.createLinearGradient(0, 0, 0, bottom);
        g.addColorStop(0, `rgba(8,12,34,${night})`); g.addColorStop(0.75, `rgba(8,12,34,${night})`); g.addColorStop(1, 'rgba(8,12,34,0)');
        ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, bottom - sy);
      }
    }
  },

  /* ---------- selection & cursor ---------- */
  drawSelection(ctx) {
    const s = Sim.selected;
    if (!s) return;
    if (s.dead) return;
    let x, y, r = 7;
    if (s instanceof Ant || s instanceof Predator) { x = s.fx * CS; y = s.fy * CS; r = s instanceof Predator ? 14 : s.role === QUEEN ? 10 : 7; }
    else if (s instanceof Food) { x = (s.x + 0.5) * CS; y = (s.y + 0.5) * CS; }
    else if (s instanceof Brood) { x = s.x * CS; y = s.y * CS; r = 5; }
    else return;
    // route preview
    if (s instanceof Ant || s instanceof Predator) {
      const pts = this.routeOf(s);
      if (pts.length > 1) {
        ctx.strokeStyle = 'rgba(255,214,120,0.75)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (const [px, py] of pts) ctx.lineTo(px, py);
        ctx.stroke(); ctx.setLineDash([]);
        const [ex, ey] = pts[pts.length - 1];
        ctx.fillStyle = 'rgba(255,214,120,0.9)'; ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, TAU); ctx.fill();
      }
    }
    const pulse = 1 + Math.sin(this.time * 5) * 0.12;
    ctx.strokeStyle = 'rgba(255,230,170,0.95)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, TAU); ctx.stroke();
    if (s.hp !== undefined && s.maxHp) this.hpBar(ctx, x, y - r - 4, s.hp / s.maxHp);
  },
  routeOf(a) {
    const pts = [];
    if (a.mode === M_PATH && a.path) {
      for (let k = a.pathI; k < a.path.length; k += 2) { const i = a.path[k], x = i % W; pts.push([(x + 0.5) * CS, ((i - x) / W + 0.5) * CS]); }
      const i = a.path[a.path.length - 1], x = i % W; pts.push([(x + 0.5) * CS, ((i - x) / W + 0.5) * CS]);
    } else if ((a.mode === M_FIELD || a.mode === M_ZONE) && a.field) {
      const f = a.field;
      let x = a.cx, y = a.cy;
      for (let s = 0; s < 400; s++) {
        const v = f[y * W + x];
        if (v === 0 || v === INF) break;
        let bx = -1, by = -1, bv = v;
        for (let k = 0; k < 8; k++) {
          const x2 = x + DX[k], y2 = y + DY[k];
          if (!inB(x2, y2)) continue;
          const v2 = f[y2 * W + x2];
          if (v2 < bv) { bv = v2; bx = x2; by = y2; }
        }
        if (bx < 0) break;
        x = bx; y = by;
        if (s % 2 === 0 || bv === 0) pts.push([(x + 0.5) * CS, (y + 0.5) * CS]);
      }
    } else if (a.mode === M_TOWARD) pts.push([(a.tx + 0.5) * CS, (a.ty + 0.5) * CS]);
    return pts;
  },

  drawCursor(ctx) {
    if (!this.cursor.on) return;
    const tool = UI.tool;
    const brushTools = { dig: '#ffd27a', soil: '#c99a62', rock: '#b9b5ac', remove: '#ff6b5a', zone: '#d6a8ff' };
    const x = this.cursor.x * CS, y = this.cursor.y * CS;
    if (brushTools[tool]) {
      let col = brushTools[tool];
      if (tool === 'zone') col = rgbStr(ZONE_RGB[UI.zoneType] || [255, 255, 255]);
      if (tool === 'dig' && UI.digMode === 'mark') col = '#fff0c8';
      const r = (UI.brush + 0.5) * CS;
      ctx.strokeStyle = col; ctx.lineWidth = 1 / this.cam.z * 1.5;
      ctx.setLineDash([3 / this.cam.z * 2, 3 / this.cam.z * 2]);
      ctx.beginPath(); ctx.arc(Math.floor(this.cursor.x) * CS + 2, Math.floor(this.cursor.y) * CS + 2, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool !== 'inspect') {
      ctx.strokeStyle = 'rgba(255,240,210,0.8)'; ctx.lineWidth = 1 / this.cam.z * 1.5;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 9); ctx.stroke();
    }
  },
};
