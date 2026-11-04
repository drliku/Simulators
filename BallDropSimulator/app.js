/*
 * Galton Board Probability Simulator
 *
 * Each ball's route is decided up front by an exact random walk: one
 * independent Bernoulli(p) trial per peg row. The landing bin is the number of
 * rightward bounces, so bin counts follow Binomial(rows, p) exactly. The
 * animation only *renders* that path — peg-to-peg parabolic hops whose
 * geometry keeps the ball clear of every peg — so physics never biases the
 * statistics.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const fmtInt = (n) => n.toLocaleString('en-US');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const FONT_DISPLAY = '"Brain", "Saira Semi Condensed", "Arial Narrow", sans-serif';
  const FONT_BODY = '"Saira", system-ui, sans-serif';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ Math

  function binomialPmf(n, p) {
    const pmf = new Float64Array(n + 1);
    if (p <= 0) { pmf[0] = 1; return pmf; }
    if (p >= 1) { pmf[n] = 1; return pmf; }
    const lp = Math.log(p), lq = Math.log(1 - p);
    let logC = 0;
    for (let k = 0; k <= n; k++) {
      if (k > 0) logC += Math.log((n - k + 1) / k);
      pmf[k] = Math.exp(logC + k * lp + (n - k) * lq);
    }
    return pmf;
  }

  function lnGamma(z) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // Regularized upper incomplete gamma Q(a, x) (Numerical Recipes gser/gcf).
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    const lnPre = -x + a * Math.log(x) - lnGamma(a);
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let i = 0; i < 500; i++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
      }
      return Math.max(0, 1 - sum * Math.exp(lnPre));
    }
    const tiny = 1e-300;
    let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(lnPre) * h;
  }

  // Pearson χ² against the binomial, merging sparse tail bins so each group
  // has an expected count of at least 5.
  function chiSquare(counts, pmf, n) {
    const groups = [];
    let o = 0, e = 0;
    for (let k = 0; k < counts.length; k++) {
      o += counts[k]; e += pmf[k] * n;
      if (e >= 5) { groups.push([o, e]); o = 0; e = 0; }
    }
    if (groups.length) { groups[groups.length - 1][0] += o; groups[groups.length - 1][1] += e; }
    if (groups.length < 2) return null;
    let chi = 0;
    for (const [go, ge] of groups) chi += (go - ge) * (go - ge) / ge;
    const df = groups.length - 1;
    return { chi, df, p: gammaQ(df / 2, chi / 2) };
  }

  // ------------------------------------------------------------------ State

  const SPEED_MIN = 1, SPEED_MAX = 400;
  const sliderToRate = (v) => Math.round(Math.exp(Math.log(SPEED_MIN) + (v / 100) * (Math.log(SPEED_MAX) - Math.log(SPEED_MIN))));

  const state = {
    rows: 12,
    p: 0.5,
    target: 1000,
    rate: sliderToRate(62),
    running: false,
    unit: 'count',
    showNormal: false,

    pmf: null,
    counts: [],
    flash: [],
    landed: 0,
    dropped: 0,
    sumK: 0,
    sumK2: 0,
    balls: [],
    releaseAcc: 0,
    tracer: null,      // { ball, trail: [], hits: [], fade }
    hoverBin: -1,
    hoverSource: null,
    displayScale: 1,
    statsDirty: true,
    histDirty: true,
  };

  function resetStats() {
    const n = state.rows;
    state.pmf = binomialPmf(n, state.p);
    state.counts = new Array(n + 1).fill(0);
    state.flash = new Float32Array(n + 1);
    state.landed = 0;
    state.dropped = 0;
    state.sumK = 0;
    state.sumK2 = 0;
    state.balls.length = 0;
    state.releaseAcc = 0;
    state.tracer = null;
    state.displayScale = targetScale();
    hidePathChip();
    buildBinTable();
    state.statsDirty = state.histDirty = true;
  }

  // ------------------------------------------------------------------ DOM

  const boardCanvas = $('board'), boardCtx = boardCanvas.getContext('2d');
  const histCanvas = $('hist'), histCtx = histCanvas.getContext('2d');
  const tooltip = $('tooltip');
  const btnRun = $('btnRun');
  const els = {
    rows: $('rows'), rowsOut: $('rowsOut'),
    speed: $('speed'), speedOut: $('speedOut'),
    prob: $('prob'), probOut: $('probOut'), probLeft: $('probLeft'), probRight: $('probRight'),
    progressFill: $('progressFill'), progressText: $('progressText'), progressState: $('progressState'),
    dropped: $('statDropped'), landed: $('statLanded'), flight: $('statFlight'),
    mean: $('statMean'), meanExp: $('statMeanExp'),
    sd: $('statSd'), sdExp: $('statSdExp'),
    mode: $('statMode'), modeExp: $('statModeExp'),
    chi: $('statChi'), chiP: $('statChiP'), tvd: $('statTvd'), fitNote: $('fitNote'),
    binTable: $('binTable'),
    pathChip: $('pathChip'), pathSteps: $('pathSteps'), pathResult: $('pathResult'),
    legendNormal: document.querySelector('.legend-normal'),
  };

  // ------------------------------------------------------------------ Geometry

  let dpr = 1;
  const geo = {};
  let staticLayer = null;
  let sprites = [];
  let tracerSprite = null;
  let binPattern = null;

  function computeGeometry() {
    const w = boardCanvas.clientWidth, h = boardCanvas.clientHeight;
    const N = state.rows;
    geo.w = w; geo.h = h; geo.N = N;
    geo.cx = w / 2;

    const padX = Math.max(16, w * 0.04);
    const binBottom = h - 16;
    const binH = clamp(h * 0.3, 90, 260);
    const binTop = binBottom - binH;
    const topReserve = Math.max(90, h * 0.15);       // dispenser area
    const dyMax = (binTop - topReserve) / (N - 1 + 0.9);
    const dx = Math.min((w - 2 * padX) / (N + 1), dyMax * 1.6, 84);
    const dy = Math.min(dyMax, dx * 0.92);

    geo.dx = dx; geo.dy = dy;
    geo.binTop = binTop; geo.binBottom = binBottom; geo.binH = binH;
    geo.lastRowY = binTop - 0.9 * dy;
    geo.row0Y = geo.lastRowY - (N - 1) * dy;
    const m = Math.min(dx, dy);
    // Radii scale with peg spacing; verified offline that hops with bounce
    // heights in [0.3, 0.7]·dy never bring a ball inside pegR + ballR.
    geo.pegR = clamp(m * 0.11, 1.4, 5);
    geo.ballR = clamp(m * 0.12, 1.7, 4.5);
    geo.contact = geo.pegR + geo.ballR;
    geo.wall = Math.max(1, Math.min(2, dx * 0.05));
    geo.dispY = geo.row0Y - clamp(dy * 1.1, 26, 56);                  // nozzle exit

    // Hop timing: constant per row (bouncy look) with gravity kept consistent
    // across hops and the initial free fall from the dispenser.
    geo.T = clamp(0.03 * Math.sqrt(dy), 0.075, 0.15);
    geo.g = 2 * (dy + 0.5 * dy) / (geo.T * geo.T);           // using mean bounce height A = 0.5 dy
    const fall0 = geo.row0Y - geo.contact - geo.dispY;
    geo.T0 = Math.sqrt(2 * Math.max(fall0, 1) / geo.g) * 1.4;
  }

  const pegX = (r, j) => geo.cx + (j - r / 2) * geo.dx;
  const pegY = (r) => geo.row0Y + r * geo.dy;
  const binX = (k) => geo.cx + (k - geo.N / 2) * geo.dx;

  function resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeSprite(core, glow, r) {
    const size = Math.ceil(r * 6);
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    const mid = size / 2;
    const halo = x.createRadialGradient(mid, mid, r * 0.6, mid, mid, size / 2);
    halo.addColorStop(0, glow.replace('A', '0.45'));
    halo.addColorStop(1, glow.replace('A', '0'));
    x.fillStyle = halo;
    x.fillRect(0, 0, size, size);
    const body = x.createRadialGradient(mid - r * 0.35, mid - r * 0.35, r * 0.1, mid, mid, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.35, core);
    body.addColorStop(1, glow.replace('A', '1'));
    x.fillStyle = body;
    x.beginPath(); x.arc(mid, mid, r, 0, Math.PI * 2); x.fill();
    return { canvas: c, size };
  }

  function buildSprites() {
    const r = geo.ballR;
    sprites = [
      makeSprite('#ffd6cd', 'rgba(243,112,100,A)', r),
      makeSprite('#ffbcae', 'rgba(232,88,78,A)', r),
      makeSprite('#ffc9b2', 'rgba(247,138,104,A)', r),
      makeSprite('#ffe0da', 'rgba(255,130,120,A)', r),
    ];
    tracerSprite = makeSprite('#ffffff', 'rgba(255,244,236,A)', r * 1.25);
  }

  function buildBinPattern() {
    // A tile of stacked "balls" used to texture the bin columns.
    const inner = Math.max(2, geo.dx - geo.wall * 2);
    const r = geo.ballR * 0.85;
    const cols = Math.max(1, Math.floor(inner / (r * 2.1)));
    const step = inner / cols;
    const rowH = step * 0.866;
    const c = document.createElement('canvas');
    const tw = inner, th = rowH * 2;
    c.width = Math.max(1, Math.round(tw * dpr));
    c.height = Math.max(1, Math.round(th * dpr));
    const x = c.getContext('2d');
    x.scale(c.width / tw, c.height / th);
    const dot = (cx, cy) => {
      const gr = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,240,235,0.5)');
      gr.addColorStop(1, 'rgba(243,112,100,0.05)');
      x.fillStyle = gr;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    };
    for (let i = 0; i < cols; i++) dot(step * (i + 0.5), rowH * 0.5);
    for (let i = 0; i <= cols; i++) dot(step * i, rowH * 1.5);
    binPattern = boardCtx.createPattern(c, 'repeat');
    if (binPattern && binPattern.setTransform && window.DOMMatrix) {
      binPattern.setTransform(new DOMMatrix().scale(tw / c.width, th / c.height));
    }
    geo.patternTileH = th;
  }

  function buildStaticLayer() {
    const { w, h, N } = geo;
    staticLayer = document.createElement('canvas');
    staticLayer.width = Math.round(w * dpr);
    staticLayer.height = Math.round(h * dpr);
    const x = staticLayer.getContext('2d');
    x.scale(dpr, dpr);

    // Background + subtle grid
    const bg = x.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#202c56');
    bg.addColorStop(1, '#111831');
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(170,182,230,0.06)';
    x.lineWidth = 1;
    x.beginPath();
    const gs = 24;
    for (let gx = (w / 2) % gs; gx < w; gx += gs) { x.moveTo(Math.round(gx) + 0.5, 0); x.lineTo(Math.round(gx) + 0.5, h); }
    for (let gy = 0; gy < h; gy += gs) { x.moveTo(0, Math.round(gy) + 0.5); x.lineTo(w, Math.round(gy) + 0.5); }
    x.stroke();

    // Triangle guides (the reachable region of the walk)
    const half = geo.dx * 0.5;
    x.strokeStyle = 'rgba(243,112,100,0.16)';
    x.lineWidth = 1;
    x.setLineDash([3, 5]);
    x.beginPath();
    x.moveTo(geo.cx - half, pegY(0) - geo.dy * 0.7);
    x.lineTo(binX(0) - half, geo.binTop);
    x.moveTo(geo.cx + half, pegY(0) - geo.dy * 0.7);
    x.lineTo(binX(N) + half, geo.binTop);
    x.stroke();
    x.setLineDash([]);

    // Dispenser funnel
    const fw = Math.max(geo.dx * 1.6, 40), fTop = Math.max(8, geo.dispY - clamp(geo.dy * 1.3, 30, 60));
    const neck = geo.ballR * 2.2;
    x.beginPath();
    x.moveTo(geo.cx - fw, fTop);
    x.lineTo(geo.cx - neck, geo.dispY - 6);
    x.lineTo(geo.cx - neck, geo.dispY);
    x.moveTo(geo.cx + fw, fTop);
    x.lineTo(geo.cx + neck, geo.dispY - 6);
    x.lineTo(geo.cx + neck, geo.dispY);
    x.strokeStyle = 'rgba(243,112,100,0.85)';
    x.lineWidth = 2;
    x.lineCap = 'round';
    x.shadowColor = 'rgba(243,112,100,0.45)';
    x.shadowBlur = 8;
    x.stroke();
    x.shadowBlur = 0;
    geo.funnel = { fw, fTop, neck };

    // Pegs
    for (let r = 0; r < N; r++) {
      const y = pegY(r);
      for (let j = 0; j <= r; j++) {
        const px = pegX(r, j);
        const halo = x.createRadialGradient(px, y, 0, px, y, geo.pegR * 3);
        halo.addColorStop(0, 'rgba(255,228,220,0.13)');
        halo.addColorStop(1, 'rgba(255,228,220,0)');
        x.fillStyle = halo;
        x.beginPath(); x.arc(px, y, geo.pegR * 3, 0, Math.PI * 2); x.fill();
        const body = x.createRadialGradient(px - geo.pegR * 0.4, y - geo.pegR * 0.4, 0, px, y, geo.pegR);
        body.addColorStop(0, '#fff6f2');
        body.addColorStop(1, '#8e94b4');
        x.fillStyle = body;
        x.beginPath(); x.arc(px, y, geo.pegR, 0, Math.PI * 2); x.fill();
      }
    }

    // Bins: back panel, walls and floor
    const left = binX(0) - half, right = binX(N) + half;
    const back = x.createLinearGradient(0, geo.binTop, 0, geo.binBottom);
    back.addColorStop(0, 'rgba(10,14,30,0.04)');
    back.addColorStop(1, 'rgba(10,14,30,0.32)');
    x.fillStyle = back;
    x.fillRect(left, geo.binTop, right - left, geo.binH);
    x.fillStyle = 'rgba(255,228,220,0.28)';
    for (let k = 0; k <= N + 1; k++) {
      const wx = binX(0) - half + k * geo.dx;
      x.fillRect(wx - geo.wall / 2, geo.binTop, geo.wall, geo.binH);
    }
    x.fillStyle = 'rgba(255,228,220,0.5)';
    x.fillRect(left - geo.wall / 2, geo.binBottom, right - left + geo.wall, 2);

    // Bin labels (thinned out when crowded)
    const every = geo.dx < 18 ? 4 : geo.dx < 26 ? 2 : 1;
    x.fillStyle = 'rgba(163,172,201,0.8)';
    x.font = `400 ${geo.dx < 26 ? 11 : 13}px ${FONT_DISPLAY}`;
    x.textAlign = 'center';
    x.textBaseline = 'top';
    if (geo.binBottom + 13 < h) {
      for (let k = 0; k <= N; k += every) x.fillText(String(k), binX(k), geo.binBottom + 3);
    }
  }

  function layoutBoard() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    resizeCanvas(boardCanvas, boardCtx);
    computeGeometry();
    buildSprites();
    buildBinPattern();
    buildStaticLayer();
    // Balls already in the bin-fall phase hold pixel positions; land them so
    // nothing is drawn at stale coordinates after a resize.
    for (let i = state.balls.length - 1; i >= 0; i--) {
      if (state.balls[i].phase === 2) landBall(i);
    }
  }

  function layoutHist() {
    resizeCanvas(histCanvas, histCtx);
    state.histDirty = true;
  }

  // ------------------------------------------------------------------ Balls

  function randomBounce() { return geo.dy * (0.3 + 0.4 * Math.random()); }

  function spawnBall(tracer = false, head = 0) {
    const N = state.rows;
    const path = new Uint8Array(N);
    let k = 0;
    for (let r = 0; r < N; r++) {
      const right = Math.random() < state.p ? 1 : 0;   // the only source of randomness
      path[r] = right;
      k += right;
    }
    const b = {
      path, bin: k, phase: 0, t: head, r: 0, j: 0, A: randomBounce(),
      x: geo.cx, y: geo.dispY, vy: 0,
      sprite: sprites[(Math.random() * sprites.length) | 0],
      tracer,
    };
    state.balls.push(b);
    state.dropped++;
    if (tracer) startTracer(b);
    state.statsDirty = true;
    return b;
  }

  // Hop from the top of peg (r, j) to the top of the next peg (or the bin
  // mouth after the last row). y(s) = y0 − A·s + (Δy + A)·s² gives a small
  // rebound followed by a gravity-like fall.
  function hopEnd(b) {
    const N = geo.N;
    const x0 = pegX(b.r, b.j), y0 = pegY(b.r) - geo.contact;
    const x1 = x0 + (b.path[b.r] ? 0.5 : -0.5) * geo.dx;
    const y1 = b.r < N - 1 ? pegY(b.r + 1) - geo.contact : geo.binTop;
    return { x0, y0, x1, y1 };
  }

  function stackTopY(k) {
    return geo.binBottom - state.counts[k] * unitHeight() - geo.ballR;
  }

  function updateBall(b, i, dt) {
    let t = b.t + dt;
    for (;;) {
      if (b.phase === 0) {                                  // falling out of the dispenser
        if (t < 0) { b.t = t; b.x = geo.cx; b.y = geo.dispY - 4; return; }
        const yEnd = pegY(0) - geo.contact;
        if (t < geo.T0) {
          const s = t / geo.T0;
          b.x = geo.cx; b.y = geo.dispY + (yEnd - geo.dispY) * s * s;
          b.t = t; return;
        }
        t -= geo.T0; b.phase = 1; b.r = 0; b.j = 0; b.A = randomBounce();
        if (b.tracer) tracerHit(b);
      } else if (b.phase === 1) {                           // peg-to-peg hops
        const { x0, y0, x1, y1 } = hopEnd(b);
        if (t < geo.T) {
          const s = t / geo.T, dy = y1 - y0;
          b.x = x0 + (x1 - x0) * (s + 0.3 * s * (1 - s));   // quick sideways kick off the peg
          b.y = y0 - b.A * s + (dy + b.A) * s * s;
          b.t = t; return;
        }
        t -= geo.T;
        const dyLast = y1 - y0;
        b.j += b.path[b.r];
        b.r++;
        if (b.tracer) tracerStep(b);
        if (b.r >= geo.N) {
          b.phase = 2;
          b.x = binX(b.bin);
          b.y = geo.binTop;
          b.vy = (dyLast + b.A) * 2 / geo.T - b.A / geo.T;  // dy/dt at s = 1
          b.t = 0;
          dt = t; t = 0;
          // fall through into phase 2 with the leftover time
        } else {
          b.A = randomBounce();
          if (b.tracer) tracerHit(b);
        }
      } else {                                              // dropping into the bin
        const target = stackTopY(b.bin);
        b.vy += geo.g * dt;
        b.y += b.vy * dt;
        if (b.y >= target) { landBall(i); }
        return;
      }
    }
  }

  function landBall(i) {
    const b = state.balls[i];
    const k = b.bin;
    state.counts[k]++;
    state.landed++;
    state.sumK += k;
    state.sumK2 += k * k;
    state.flash[k] = 1;
    // swap-remove
    const last = state.balls.pop();
    if (last !== b) state.balls[i] = last;
    if (b.tracer && state.tracer && state.tracer.ball === b) finishTracer(b);
    state.statsDirty = state.histDirty = true;
  }

  // ------------------------------------------------------------------ Tracer

  function startTracer(b) {
    state.tracer = { ball: b, trail: [], hits: [], fade: 1, done: false };
    const steps = Array.from(b.path, () => '<i>·</i>').join('');
    els.pathSteps.innerHTML = steps;
    els.pathResult.textContent = '';
    els.pathChip.hidden = false;
    els.pathChip.classList.remove('fading');
  }

  function tracerHit(b) {
    if (state.tracer && state.tracer.ball === b) state.tracer.hits.push([b.r, b.j]);
  }

  function tracerStep(b) {
    const idx = b.r - 1;
    const node = els.pathSteps.children[idx];
    if (node) {
      const right = b.path[idx] === 1;
      node.textContent = right ? 'R' : 'L';
      node.className = 'on ' + (right ? 'r' : 'l');
    }
  }

  function finishTracer(b) {
    const rights = b.bin, lefts = geo.N - b.bin;
    els.pathResult.textContent = `${rights}R + ${lefts}L → bin ${b.bin}`;
    state.tracer.done = true;
    state.tracer.doneAt = performance.now();
  }

  function hidePathChip() {
    els.pathChip.hidden = true;
    els.pathChip.classList.remove('fading');
  }

  // ------------------------------------------------------------------ Scaling

  function targetScale() {
    const pmfMax = Math.max(...state.pmf);
    const maxCount = state.counts.length ? Math.max(...state.counts) : 0;
    return Math.max(state.target * pmfMax * 1.12, maxCount * 1.08, 6);
  }
  function unitHeight() {
    return (geo.binH - 6) / state.displayScale;
  }

  // ------------------------------------------------------------------ Render: board

  function smoothPath(ctx, pts) {
    if (pts.length < 2) return;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
  }

  function drawBoard(now) {
    const ctx = boardCtx;
    const { N, dx, wall } = geo;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(staticLayer, 0, 0, geo.w, geo.h);

    // Hopper level shows how many balls remain to be released.
    const remaining = Math.max(0, state.target - state.dropped);
    const level = state.target ? remaining / state.target : 0;
    if (level > 0) {
      const { fw, fTop, neck } = geo.funnel;
      const yNeck = geo.dispY - 6;
      const yLevel = yNeck - (yNeck - fTop) * Math.sqrt(level);   // area-ish scaling
      const halfAt = (y) => neck + (fw - neck) * (yNeck - y) / (yNeck - fTop);
      ctx.beginPath();
      ctx.moveTo(geo.cx - halfAt(yLevel) + 2, yLevel);
      ctx.lineTo(geo.cx + halfAt(yLevel) - 2, yLevel);
      ctx.lineTo(geo.cx + neck - 1.5, yNeck);
      ctx.lineTo(geo.cx - neck + 1.5, yNeck);
      ctx.closePath();
      const hg = ctx.createLinearGradient(0, yLevel, 0, yNeck);
      hg.addColorStop(0, 'rgba(255,160,146,0.45)');
      hg.addColorStop(1, 'rgba(243,112,100,0.75)');
      ctx.fillStyle = hg;
      ctx.fill();
    }

    // Bin columns
    const uh = unitHeight();
    const inner = dx - wall * 2;
    for (let k = 0; k <= N; k++) {
      const c = state.counts[k];
      const left = binX(k) - dx / 2 + wall;
      const f = state.flash[k];
      if (c > 0) {
        const hgt = Math.min(geo.binH, c * uh);
        const top = geo.binBottom - hgt;
        const grad = ctx.createLinearGradient(0, geo.binBottom - geo.binH, 0, geo.binBottom);
        grad.addColorStop(0, 'rgba(255,152,138,0.97)');
        grad.addColorStop(1, 'rgba(214,80,70,0.9)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = state.hoverBin === k ? 1 : 0.82;
        ctx.fillRect(left, top, inner, hgt);
        ctx.globalAlpha = 1;
        if (binPattern) {
          ctx.save();
          ctx.translate(left, geo.binBottom);
          ctx.fillStyle = binPattern;
          ctx.fillRect(0, -hgt, inner, hgt);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(255,238,232,${0.55 + 0.45 * f})`;
        ctx.fillRect(left, top, inner, 1.5);
      }
      if (f > 0.02) {
        const top = geo.binBottom - Math.min(geo.binH, c * uh);
        const glow = ctx.createRadialGradient(binX(k), top, 0, binX(k), top, dx * 0.9);
        glow.addColorStop(0, `rgba(255,150,135,${0.4 * f})`);
        glow.addColorStop(1, 'rgba(255,150,135,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(binX(k) - dx, top - dx, dx * 2, dx * 2);
      }
      if (state.hoverBin === k) {
        ctx.strokeStyle = 'rgba(243,112,100,0.95)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left - 0.5, geo.binTop, inner + 1, geo.binH);
      }
    }

    // Expected counts for the balls that have landed so far.
    if (state.landed > 0) {
      const pts = [];
      for (let k = 0; k <= N; k++) {
        pts.push([binX(k), geo.binBottom - Math.min(geo.binH + 12, state.landed * state.pmf[k] * uh)]);
      }
      ctx.save();
      ctx.beginPath();
      smoothPath(ctx, pts);
      ctx.strokeStyle = 'rgba(255,201,168,0.95)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255,201,168,0.5)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffe2cf';
      const pr = dx < 20 ? 1.6 : 2.4;
      for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    // Tracer trail + highlighted pegs
    const tr = state.tracer;
    if (tr) {
      let alpha = 1;
      if (tr.done) {
        const age = (now - tr.doneAt) / 1000;
        alpha = clamp(1 - (age - 2.5) / 1.5, 0, 1);
        if (age > 2.5 && !els.pathChip.classList.contains('fading')) els.pathChip.classList.add('fading');
        if (alpha <= 0) { state.tracer = null; hidePathChip(); }
      }
      if (state.tracer) {
        ctx.save();
        ctx.globalAlpha = alpha;
        for (const [r, j] of tr.hits) {
          ctx.beginPath();
          ctx.arc(pegX(r, j), pegY(r), geo.pegR + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,244,236,0.9)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (tr.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(tr.trail[0][0], tr.trail[0][1]);
          for (let i = 1; i < tr.trail.length; i++) ctx.lineTo(tr.trail[i][0], tr.trail[i][1]);
          ctx.strokeStyle = 'rgba(255,244,236,0.5)';
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Balls
    const balls = state.balls;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.phase === 0 && b.t < 0) continue;
      const s = b.tracer ? tracerSprite : b.sprite;
      ctx.drawImage(s.canvas, b.x - s.size / 2, b.y - s.size / 2, s.size, s.size);
    }
  }

  // ------------------------------------------------------------------ Render: histogram

  const hist = { padL: 44, padR: 12, padT: 10, padB: 24 };

  function histBinRect(k) {
    const w = histCanvas.clientWidth;
    const n = state.rows + 1;
    const plotW = w - hist.padL - hist.padR;
    const bw = plotW / n;
    return { x: hist.padL + k * bw, w: bw };
  }

  function niceStep(max, ticks) {
    const raw = max / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  }

  function drawHist() {
    const ctx = histCtx;
    const w = histCanvas.clientWidth, h = histCanvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const N = state.rows;
    const isProb = state.unit === 'prob';
    const n = state.landed;
    const ref = n > 0 ? n : state.target;            // preview the expected shape before any data
    const value = (c) => (isProb ? (n ? c / n : 0) : c);
    const theory = (k) => (isProb ? state.pmf[k] : ref * state.pmf[k]);

    let maxV = 0;
    for (let k = 0; k <= N; k++) maxV = Math.max(maxV, value(state.counts[k]), theory(k));
    const mean = N * state.p, variance = N * state.p * (1 - state.p);
    if (state.showNormal && variance > 0) {
      const peak = 1 / Math.sqrt(2 * Math.PI * variance);
      maxV = Math.max(maxV, isProb ? peak : ref * peak);
    }
    maxV = maxV * 1.12 || 1;

    const plotT = hist.padT, plotB = h - hist.padB, plotH = plotB - plotT;
    const plotL = hist.padL, plotR = w - hist.padR;
    const yOf = (v) => plotB - (v / maxV) * plotH;

    // Grid + y axis
    const step = niceStep(maxV, 4);
    ctx.font = `400 12px ${FONT_DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= maxV + 1e-12; v += step) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? 'rgba(170,182,230,0.35)' : 'rgba(170,182,230,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke();
      ctx.fillStyle = 'rgba(163,172,201,0.85)';
      const label = isProb ? (step < 0.01 ? v.toFixed(3) : v.toFixed(2)) : (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v)));
      ctx.fillText(label, plotL - 6, y);
    }

    // Bars
    const bwAll = histBinRect(0).w;
    const gap = Math.min(4, bwAll * 0.18);
    const barGrad = ctx.createLinearGradient(0, plotT, 0, plotB);
    barGrad.addColorStop(0, '#ff9a8d');
    barGrad.addColorStop(1, '#d4524a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelEvery = bwAll < 14 ? 4 : bwAll < 22 ? 2 : 1;
    for (let k = 0; k <= N; k++) {
      const { x, w: bw } = histBinRect(k);
      const v = value(state.counts[k]);
      const y = yOf(v);
      const hovered = state.hoverBin === k;
      if (hovered) {
        ctx.fillStyle = 'rgba(243,112,100,0.1)';
        ctx.fillRect(x, plotT, bw, plotH);
      }
      if (v > 0) {
        ctx.fillStyle = barGrad;
        ctx.globalAlpha = hovered ? 1 : 0.78;
        const r = Math.min(3, (bw - gap) / 2);
        roundRectTop(ctx, x + gap / 2, y, bw - gap, plotB - y, r);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (k % labelEvery === 0) {
        ctx.fillStyle = hovered ? '#fff3ea' : 'rgba(163,172,201,0.85)';
        ctx.fillText(String(k), x + bw / 2, plotB + 6);
      }
    }

    // Normal approximation
    if (state.showNormal && variance > 0) {
      const sd = Math.sqrt(variance);
      const scale = isProb ? 1 : ref;
      ctx.beginPath();
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const kx = -0.5 + (N + 1) * (i / steps);
        const dens = Math.exp(-0.5 * ((kx - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
        const px = plotL + (kx + 0.5) * bwAll;
        const py = yOf(dens * scale);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(159,176,255,0.95)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Binomial curve
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([histBinRect(k).x + bwAll / 2, yOf(theory(k))]);
    ctx.save();
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.strokeStyle = 'rgba(255,201,168,0.95)';
    ctx.lineWidth = 2;
    if (n === 0) ctx.setLineDash([4, 4]);
    ctx.shadowColor = 'rgba(255,201,168,0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffe2cf';
    for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, bwAll < 16 ? 1.8 : 2.6, 0, Math.PI * 2); ctx.fill(); }

    if (n === 0) {
      ctx.fillStyle = 'rgba(163,172,201,0.75)';
      ctx.font = `500 13px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isProb ? 'Theoretical probabilities — drop balls to compare' : `Expected shape for ${fmtInt(state.target)} balls — drop balls to compare`, (plotL + plotR) / 2, plotT + 14);
    }
  }

  function roundRectTop(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, h, w / 2));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  // ------------------------------------------------------------------ Stats panel

  function buildBinTable() {
    const rows = [];
    for (let k = 0; k <= state.rows; k++) {
      rows.push(`<tr data-k="${k}"><td>${k}</td><td>0</td><td>—</td><td class="theory">${(state.pmf[k] * 100).toFixed(2)}%</td></tr>`);
    }
    els.binTable.innerHTML = rows.join('');
  }

  function fmtP(p) {
    if (p < 0.0001) return '< 0.0001';
    return p.toFixed(p < 0.01 ? 4 : 3);
  }

  function updateStats() {
    const n = state.landed, N = state.rows, p = state.p;
    els.dropped.textContent = fmtInt(state.dropped);
    els.landed.textContent = fmtInt(n);
    els.flight.textContent = fmtInt(state.balls.length);

    const expMean = N * p, expSd = Math.sqrt(N * p * (1 - p));
    els.meanExp.textContent = expMean.toFixed(2);
    els.sdExp.textContent = expSd.toFixed(2);
    let modeK = 0;
    for (let k = 1; k <= N; k++) if (state.pmf[k] > state.pmf[modeK] + 1e-15) modeK = k;
    const modes = [];
    for (let k = 0; k <= N; k++) if (Math.abs(state.pmf[k] - state.pmf[modeK]) < 1e-12) modes.push(k);
    els.modeExp.textContent = modes.join(' & ');

    if (n > 0) {
      const mean = state.sumK / n;
      const variance = n > 1 ? (state.sumK2 - n * mean * mean) / (n - 1) : 0;
      els.mean.textContent = mean.toFixed(2);
      els.sd.textContent = Math.sqrt(Math.max(0, variance)).toFixed(2);
      let best = 0;
      for (let k = 1; k <= N; k++) if (state.counts[k] > state.counts[best]) best = k;
      els.mode.textContent = `${best} (${fmtInt(state.counts[best])})`;

      let tvd = 0;
      for (let k = 0; k <= N; k++) tvd += Math.abs(state.counts[k] / n - state.pmf[k]);
      els.tvd.textContent = (tvd / 2 * 100).toFixed(2) + '%';
    } else {
      els.mean.textContent = els.sd.textContent = els.mode.textContent = els.tvd.textContent = '—';
    }

    const chi = n >= 30 ? chiSquare(state.counts, state.pmf, n) : null;
    if (chi) {
      els.chi.textContent = `${chi.chi.toFixed(2)} (df ${chi.df})`;
      els.chiP.textContent = fmtP(chi.p);
      if (chi.p >= 0.05) {
        els.fitNote.textContent = 'Consistent with the binomial model — differences are what chance alone produces.';
        els.fitNote.className = 'fit-note good';
      } else {
        els.fitNote.textContent = 'An unusually large deviation (p < 0.05). This happens about 1 run in 20 by chance alone.';
        els.fitNote.className = 'fit-note warn';
      }
    } else {
      els.chi.textContent = els.chiP.textContent = '—';
      els.fitNote.textContent = n >= 30
        ? 'All outcomes fall in one bin — nothing to test (p is 0% or 100%).'
        : 'Drop at least 30 balls to test how well the data match the binomial model.';
      els.fitNote.className = 'fit-note';
    }

    // Bin table
    const trs = els.binTable.children;
    for (let k = 0; k <= N && k < trs.length; k++) {
      const tds = trs[k].children;
      tds[1].textContent = fmtInt(state.counts[k]);
      tds[2].textContent = n ? (state.counts[k] / n * 100).toFixed(2) + '%' : '—';
      trs[k].classList.toggle('hl', state.hoverBin === k);
    }

    // Progress
    const pct = state.target ? Math.min(1, state.dropped / state.target) : 0;
    els.progressFill.style.width = (pct * 100).toFixed(1) + '%';
    els.progressText.textContent = `${fmtInt(Math.min(state.dropped, state.target))} / ${fmtInt(state.target)}`;
    let label;
    if (state.running) label = 'Dropping…';
    else if (state.dropped >= state.target && state.balls.length === 0) label = 'Complete';
    else if (state.dropped >= state.target) label = 'Finishing…';
    else if (state.dropped > 0) label = 'Paused';
    else label = 'Ready';
    els.progressState.textContent = label;

    updateRunButton();
    if (state.hoverBin >= 0 && !tooltip.hidden) renderTooltip(state.hoverBin);
  }

  function updateRunButton() {
    btnRun.classList.toggle('is-running', state.running);
    const label = btnRun.querySelector('.btn-label');
    if (state.running) label.textContent = 'Pause';
    else if (state.dropped >= state.target) label.textContent = 'Run Again';
    else if (state.dropped > 0) label.textContent = 'Resume';
    else label.textContent = 'Drop Balls';
    btnRun.setAttribute('aria-pressed', String(state.running));
  }

  // ------------------------------------------------------------------ Tooltip / hover

  function renderTooltip(k) {
    const n = state.landed, c = state.counts[k] || 0;
    const expected = n * state.pmf[k];
    tooltip.innerHTML = `
      <h4>Bin ${k} · ${k} right, ${state.rows - k} left</h4>
      <div class="tt-row"><span>Observed count</span><b>${fmtInt(c)}</b></div>
      <div class="tt-row"><span>Relative frequency</span><b>${n ? (c / n * 100).toFixed(2) + '%' : '—'}</b></div>
      <div class="tt-row"><span>Theoretical probability</span><b class="exp">${(state.pmf[k] * 100).toFixed(2)}%</b></div>
      <div class="tt-row"><span>Expected count</span><b class="exp">${expected.toFixed(1)}</b></div>`;
  }

  function showTooltip(k, clientX, clientY) {
    if (state.hoverBin !== k) {
      state.hoverBin = k;
      state.histDirty = true;
      state.statsDirty = true;
    }
    renderTooltip(k);
    tooltip.hidden = false;
    const tw = tooltip.offsetWidth;
    const x = clamp(clientX, tw / 2 + 8, window.innerWidth - tw / 2 - 8);
    const y = Math.max(clientY, tooltip.offsetHeight + 22);
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    if (state.hoverBin !== -1) { state.hoverBin = -1; state.histDirty = true; state.statsDirty = true; }
    tooltip.hidden = true;
  }

  function boardHover(e) {
    const rect = boardCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const k = Math.round((x - geo.cx) / geo.dx + geo.N / 2);
    const inX = k >= 0 && k <= geo.N && Math.abs(x - binX(k)) <= geo.dx / 2;
    if (inX && y >= geo.binTop - geo.dy * 0.5 && y <= geo.binBottom + 16) showTooltip(k, e.clientX, rect.top + geo.binTop);
    else hideTooltip();
  }

  function histHover(e) {
    const rect = histCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bw = histBinRect(0).w;
    const k = Math.floor((x - hist.padL) / bw);
    if (k >= 0 && k <= state.rows) showTooltip(k, e.clientX, e.clientY);
    else hideTooltip();
  }

  for (const [canvas, fn] of [[boardCanvas, boardHover], [histCanvas, histHover]]) {
    canvas.addEventListener('pointermove', fn);
    canvas.addEventListener('pointerdown', fn);
    canvas.addEventListener('pointerleave', hideTooltip);
  }
  window.addEventListener('scroll', () => { if (!tooltip.hidden) hideTooltip(); }, { passive: true });

  // ------------------------------------------------------------------ Controls

  function setRunning(on) {
    if (on && state.dropped >= state.target) {
      if (state.balls.length > 0) return;   // let the last balls land first
      resetStats();
    }
    state.running = on;
    state.statsDirty = true;
  }

  btnRun.addEventListener('click', () => setRunning(!state.running));
  $('btnSingle').addEventListener('click', dropSingle);
  $('btnReset').addEventListener('click', () => { state.running = false; resetStats(); });

  function dropSingle() {
    spawnBall(true);
  }

  const countButtons = document.querySelectorAll('#countGroup button');
  function selectCount(n) {
    state.target = n;
    countButtons.forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.count) === n)));
    if (state.dropped >= state.target) state.running = false;
    state.statsDirty = state.histDirty = true;
  }
  countButtons.forEach((b) => b.addEventListener('click', () => selectCount(Number(b.dataset.count))));

  const unitButtons = document.querySelectorAll('#unitGroup button');
  unitButtons.forEach((b) => b.addEventListener('click', () => {
    state.unit = b.dataset.unit;
    unitButtons.forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    state.histDirty = true;
  }));

  $('normalToggle').addEventListener('change', (e) => {
    state.showNormal = e.target.checked;
    els.legendNormal.hidden = !state.showNormal;
    state.histDirty = true;
  });

  function paintRange(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--pct', pct + '%');
  }

  function updateLearnText() {
    document.querySelectorAll('.v-rows').forEach((e) => { e.textContent = state.rows; });
    document.querySelectorAll('.v-p').forEach((e) => { e.textContent = `p = ${state.p.toFixed(2)}`; });
    document.querySelectorAll('.v-q').forEach((e) => { e.textContent = `1 − p = ${(1 - state.p).toFixed(2)}`; });
  }

  els.rows.addEventListener('input', () => {
    const v = Number(els.rows.value);
    els.rowsOut.textContent = v;
    paintRange(els.rows);
    if (v === state.rows) return;
    state.rows = v;
    resetStats();
    layoutBoard();
    updateLearnText();
  });

  els.speed.addEventListener('input', () => {
    state.rate = sliderToRate(Number(els.speed.value));
    els.speedOut.textContent = `${state.rate} ball${state.rate === 1 ? '' : 's'}/s`;
    paintRange(els.speed);
  });

  els.prob.addEventListener('input', () => {
    const v = Number(els.prob.value);
    state.p = v / 100;
    els.probOut.textContent = v + '%';
    els.probLeft.textContent = `← Left ${100 - v}%`;
    els.probRight.textContent = `Right ${v}% →`;
    paintRange(els.prob);
    resetStats();
    updateLearnText();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) {
      if (e.code === 'Space') return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      if (e.target.closest && e.target.closest('button, summary')) return; // native activation
      e.preventDefault();
      setRunning(!state.running);
    } else if (e.key === 's' || e.key === 'S') {
      dropSingle();
    } else if (e.key === 'r' || e.key === 'R') {
      state.running = false;
      resetStats();
    }
  });

  // ------------------------------------------------------------------ Main loop

  let last = performance.now();
  let lastStats = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Release balls at the configured rate, staggering them within the frame.
    if (state.running) {
      state.releaseAcc += state.rate * dt;
      while (state.releaseAcc >= 1 && state.dropped < state.target) {
        state.releaseAcc -= 1;
        const head = -state.releaseAcc / state.rate;   // ≤ 0: a not-yet-visible delay
        spawnBall(false, head - dt);
      }
      if (state.dropped >= state.target) { state.running = false; state.releaseAcc = 0; state.statsDirty = true; }
    }

    const balls = state.balls;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      updateBall(b, i, dt);
    }
    if (state.tracer && !state.tracer.done) {
      const b = state.tracer.ball;
      if (!(b.phase === 0 && b.t < 0)) state.tracer.trail.push([b.x, b.y]);
    }

    // Smoothly ease the bin scale so columns never jump.
    const want = targetScale();
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 6);
    state.displayScale += (want - state.displayScale) * k;
    for (let i = 0; i < state.flash.length; i++) state.flash[i] *= Math.exp(-dt * 5);

    drawBoard(now);
    if (state.histDirty) { drawHist(); state.histDirty = false; }
    if (now - lastStats > 100 && (state.statsDirty || state.balls.length)) {
      updateStats();
      state.statsDirty = false;
      lastStats = now;
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Init

  [els.rows, els.speed, els.prob].forEach(paintRange);
  els.speedOut.textContent = `${state.rate} balls/s`;
  state.pmf = binomialPmf(state.rows, state.p);
  selectCount(1000);
  resetStats();
  layoutBoard();
  layoutHist();
  updateLearnText();
  updateStats();

  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === boardCanvas) layoutBoard();
      else if (entry.target === histCanvas) layoutHist();
    }
  });
  ro.observe(boardCanvas);
  ro.observe(histCanvas);
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', () => { layoutBoard(); layoutHist(); });

  // Canvas text is rasterized once into the static layer; redraw when the brand font arrives.
  if (document.fonts) document.fonts.ready.then(() => { layoutBoard(); state.histDirty = true; });

  requestAnimationFrame((t) => { last = t; frame(t); });
})();
