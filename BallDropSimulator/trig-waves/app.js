/*
 * Unit Circle Waves
 *
 * One canvas holds both halves of the picture: the unit circle on the left and
 * the wave graph on the right. Both use the same vertical scale (U pixels per
 * unit), so a horizontal line from the rotating point lands exactly on the
 * sine curve at t = θ. Math coordinates are y-up, angles counter-clockwise.
 */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const MINUS = '−';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = {
    sin: '#f37064', sinRGB: '243,112,100',
    cos: '#9fb0ff', cosRGB: '159,176,255',
    text: '#f6efea', muted: '#a3acc9', faint: '#6f7aa0',
    grid: 'rgba(170,182,230,0.07)', axis: 'rgba(170,182,230,0.38)',
  };
  const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const FONT_MATH = '"STIX Two Text", "Cambria Math", "Times New Roman", serif';
  const FONT_SANS = '"Saira", system-ui, sans-serif';
  const FONT_DISPLAY = '"Brain", "Saira Semi Condensed", "Arial Narrow", sans-serif';

  // ------------------------------------------------------------------ State

  const DEFAULTS = {
    theta: 0, playing: !reduceMotion, speed: 45, slow: false,
    A: 1, w: 1, phiDeg: 0,
    showSin: true, showCos: true, trace: false, compare: false,
  };
  const S = { ...DEFAULTS, dragging: null, sliderHeld: false, tween: null, hoverPoint: false, time: 0 };
  const C = { active: false, revealed: false, mode: 'special', fn: 'sin', deg: 0, guess: 0, score: 0, total: 0, streak: 0 };

  const phi = () => S.phiDeg * DEG;
  const isTransformed = () => Math.abs(S.A - 1) > 1e-9 || Math.abs(S.w - 1) > 1e-9 || Math.abs(S.phiDeg) > 1e-9;
  const angleLocked = () => C.active && !C.revealed;

  // ------------------------------------------------------------------ Formatting

  function num(v, d = 4) {
    const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
    return (r < 0 ? MINUS : '') + Math.abs(r).toFixed(d);
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  // x (radians) as a multiple of π, e.g. "3π/4"; null when no small fraction fits.
  function piFrac(x, maxDen = 12) {
    const f = x / Math.PI;
    if (Math.abs(f) < 1e-9) return '0';
    for (let m = 1; m <= maxDen; m++) {
      const n = Math.round(f * m);
      if (n !== 0 && Math.abs(f * m - n) < 1e-6) {
        const g = gcd(Math.abs(n), m);
        const nn = Math.abs(n / g), mm = m / g;
        const top = nn === 1 ? 'π' : nn + 'π';
        return (n < 0 ? MINUS : '') + (mm === 1 ? top : top + '/' + mm);
      }
    }
    return null;
  }

  // Exact values at multiples of 30° and 45°, signed by quadrant.
  const EXACT = { 0: ['0', '1', '0'], 30: ['1/2', '√3/2', '√3/3'], 45: ['√2/2', '√2/2', '1'], 60: ['√3/2', '1/2', '√3'], 90: ['1', '0', null] };
  function quadrantInfo(deg) {
    const a = ((deg % 360) + 360) % 360;
    if (a <= 90) return { ref: a, sx: 1, sy: 1 };
    if (a <= 180) return { ref: 180 - a, sx: -1, sy: 1 };
    if (a <= 270) return { ref: a - 180, sx: -1, sy: -1 };
    return { ref: 360 - a, sx: 1, sy: -1 };
  }
  function exactTrig(deg) {
    if (Math.abs(deg - Math.round(deg)) > 1e-6) return null;
    const { ref, sx, sy } = quadrantInfo(Math.round(deg));
    const e = EXACT[ref];
    if (!e) return null;
    const signed = (s, v) => (v === '0' ? '0' : (s < 0 ? MINUS : '') + v);
    return {
      sin: signed(sy, e[0]),
      cos: signed(sx, e[1]),
      tan: e[2] === null ? null : signed(sx * sy, e[2]),
    };
  }

  // ------------------------------------------------------------------ DOM

  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const els = {
    play: $('btnPlay'), slow: $('btnSlow'), reset: $('btnReset'),
    tgSin: $('tgSin'), tgCos: $('tgCos'), tgTrace: $('tgTrace'), tgCompare: $('tgCompare'),
    angle: $('angle'), angleOut: $('angleOut'), presets: [...document.querySelectorAll('.presets button')],
    speed: $('speed'), speedOut: $('speedOut'),
    amp: $('amp'), ampOut: $('ampOut'),
    freq: $('freq'), freqOut: $('freqOut'),
    phase: $('phase'), phaseOut: $('phaseOut'),
    dDeg: $('dDeg'), dRad: $('dRad'), dRadPi: $('dRadPi'), dQuad: $('dQuad'),
    dSin: $('dSin'), dCos: $('dCos'), dTan: $('dTan'), exactRow: $('exactRow'), dExact: $('dExact'),
    dA: $('dA'), dW: $('dW'), dT: $('dT'), dPhi: $('dPhi'), dShift: $('dShift'), dYs: $('dYs'), dYc: $('dYc'),
    eqSin: $('eqSin'), eqCos: $('eqCos'), eqNote: $('eqNote'),
    hint: $('dragHint'),
    chIdle: $('chIdle'), chActive: $('chActive'), chStart: $('chStart'), chMode: $('chMode'),
    chQuestion: $('chQuestion'), chGuess: $('chGuess'), chGuessOut: $('chGuessOut'), chChips: $('chChips'),
    chFeedback: $('chFeedback'), chReveal: $('chReveal'), chNext: $('chNext'), chExit: $('chExit'), chScore: $('chScore'),
  };

  // Only touch the DOM when a value actually changes.
  function setText(el, text) {
    if (el._v !== text) { el._v = text; el.textContent = text; }
  }
  function setClass(el, cls, on) {
    if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
  }

  // ------------------------------------------------------------------ Geometry

  const G = {};
  let dpr = 1;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    const pad = W < 520 ? 12 : 18;
    const gap = clamp(W * 0.045, 20, 56);           // room for the projection lines
    // Vertical fit: the graph must hold amplitudes up to 2 with the circle's scale.
    let U = (H / 2 - 30) / 2.06;
    // Horizontal fit: keep the circle region to about half the width.
    U = Math.min(U, (W * 0.5 - pad - gap) / 2.32);
    G.W = W; G.H = H; G.U = U; G.pad = pad;
    G.cx = pad + 1.16 * U + 4;
    G.cy = H / 2 + 4;
    G.gx0 = G.cx + 1.16 * U + gap;
    G.gx1 = W - pad - 6;
    G.gw = G.gx1 - G.gx0;
    G.small = W < 560;
  }

  const X = (t) => G.gx0 + (t / TAU) * G.gw;          // graph: t → px
  const Y = (v) => G.cy - v * G.U;                    // shared vertical scale
  const CX = (x) => G.cx + x * G.U;                   // circle: x → px

  // ------------------------------------------------------------------ Drawing helpers

  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function dot(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function glowDot(x, y, r, rgb) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, `rgba(${rgb},0.45)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    dot(x, y, r, `rgb(${rgb})`);
    dot(x, y, r * 0.42, '#ffffff');
  }
  function text(str, x, y, { font = `12px ${FONT_MONO}`, color = COLORS.muted, align = 'left', base = 'middle' } = {}) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(str, x, y);
  }

  // Polyline of y = A·f(ω t + φ − ω·shift) over t ∈ [0, tEnd].
  function wavePath(fn, A, w, ph, tEnd, shift = 0) {
    const n = Math.max(24, Math.ceil((tEnd / TAU) * G.gw / 1.5));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = (tEnd * i) / n;
      const v = A * fn(w * (t - shift) + ph);
      if (i === 0) ctx.moveTo(X(t), Y(v)); else ctx.lineTo(X(t), Y(v));
    }
  }

  function strokeGlow(rgb, width, alpha = 1, dash = null) {
    ctx.save();
    if (dash) ctx.setLineDash(dash);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (!dash) {
      ctx.strokeStyle = `rgba(${rgb},${0.13 * alpha})`;
      ctx.lineWidth = width + 5;
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${rgb},${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ Render

  function render() {
    const { W, H, U, cx, cy } = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#141c38';
    ctx.fillRect(0, 0, W, H);

    const th = S.theta;
    const s = Math.sin(th), c = Math.cos(th);
    const locked = angleLocked();
    const showSin = S.showSin, showCos = S.showCos;
    const transformed = isTransformed();

    // ---- Grid (half-unit spacing, shared by both halves)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -8; k <= 8; k++) {
      const y = Math.round(Y(k / 2)) + 0.5;
      if (y < 0 || y > H) continue;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    for (let k = -6; k <= 6; k++) {
      const x = Math.round(CX(k / 2)) + 0.5;
      if (x < 0 || x > G.gx0 - 10) continue;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let k = 0; k <= 8; k++) {
      const x = Math.round(X((k * TAU) / 8)) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    ctx.stroke();

    // ---- Graph axes and labels
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    line(G.gx0, Y(0), G.gx1 + 4, Y(0));
    line(G.gx0, Y(2.08), G.gx0, Y(-2.08));
    const yLabelFont = `${G.small ? 11 : 13}px ${FONT_DISPLAY}`;
    for (const v of [-2, -1, 1, 2]) {
      line(G.gx0 - 4, Y(v), G.gx0, Y(v));
      text(v < 0 ? MINUS + Math.abs(v) : String(v), G.gx0 - 7, Y(v), { font: yLabelFont, color: COLORS.faint, align: 'right' });
    }
    const tickLabels = ['π/2', 'π', '3π/2', '2π'];
    const degLabels = ['90°', '180°', '270°', '360°'];
    for (let k = 1; k <= 4; k++) {
      const x = X((k * Math.PI) / 2);
      line(x, Y(0) - 4, x, Y(0) + 4);
      text(tickLabels[k - 1], x, H - 22, { font: `italic ${G.small ? 13 : 14}px ${FONT_MATH}`, color: COLORS.muted, align: 'center' });
      if (!G.small) text(degLabels[k - 1], x, H - 8, { font: `11px ${FONT_DISPLAY}`, color: COLORS.faint, align: 'center' });
    }
    text('t', G.gx1 + 2, Y(0) - 10, { font: `italic 15px ${FONT_MATH}`, color: COLORS.muted, align: 'right' });

    // ---- Circle axes, circle, ticks
    ctx.strokeStyle = COLORS.axis;
    line(CX(-1.15), cy, CX(1.15), cy);
    line(cx, Y(1.15), cx, Y(-1.15));
    ctx.beginPath();
    ctx.arc(cx, cy, U, 0, TAU);
    ctx.strokeStyle = 'rgba(255,236,228,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(219,228,255,0.28)';
    for (let d = 0; d < 360; d += 15) {
      const a = d * DEG, len = d % 90 === 0 ? 0 : d % 45 === 0 || d % 30 === 0 ? 6 : 3;
      if (!len) continue;
      line(cx + Math.cos(a) * U, cy - Math.sin(a) * U, cx + Math.cos(a) * (U - len), cy - Math.sin(a) * (U - len));
    }
    const lf = `${G.small ? 11 : 13}px ${FONT_DISPLAY}`;
    text('1', CX(1) + 5, cy + 10, { font: lf, color: COLORS.faint });
    text(MINUS + '1', CX(-1) - 5, cy + 10, { font: lf, color: COLORS.faint, align: 'right' });
    text('1', cx + 6, Y(1) - 8, { font: lf, color: COLORS.faint });
    text(MINUS + '1', cx + 6, Y(-1) + 9, { font: lf, color: COLORS.faint });

    const px = CX(c), py = Y(s);
    const tCur = th;
    const gxCur = X(tCur);

    // ---- Graph content
    if (locked) {
      text('WAVES HIDDEN UNTIL YOU REVEAL THE ANSWER', (G.gx0 + G.gx1) / 2, Y(0) - 18,
        { font: `16px ${FONT_DISPLAY}`, color: COLORS.faint, align: 'center' });
    } else {
      const tEnd = S.trace ? tCur : TAU;
      const ph = phi();

      // Compare mode: slide a ghost cosine by a quarter period onto the sine wave.
      if (S.compare && showCos && tEnd > 0) {
        const cycle = (S.time % 3.2) / 3.2;
        const k = reduceMotion ? 1 : clamp(cycle / 0.55, 0, 1);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const alpha = reduceMotion ? 0.5 : 0.65 * (cycle < 0.85 ? 1 : 1 - (cycle - 0.85) / 0.15);
        wavePath(Math.cos, S.A, S.w, ph, tEnd, (ease * Math.PI) / (2 * S.w));
        strokeGlow(COLORS.cosRGB, 1.4, alpha, [5, 5]);
        drawPhaseBracket(ph);
      }

      // Original unit-circle projections, dashed, when the wave is transformed.
      if (transformed) {
        if (showSin) { wavePath(Math.sin, 1, 1, 0, tEnd); strokeGlow(COLORS.sinRGB, 1.2, 0.45, [4, 5]); }
        if (showCos) { wavePath(Math.cos, 1, 1, 0, tEnd); strokeGlow(COLORS.cosRGB, 1.2, 0.45, [4, 5]); }
      }
      if (showCos) { wavePath(Math.cos, S.A, S.w, ph, tEnd); strokeGlow(COLORS.cosRGB, 2); }
      if (showSin) { wavePath(Math.sin, S.A, S.w, ph, tEnd); strokeGlow(COLORS.sinRGB, 2); }

      // Time cursor
      ctx.strokeStyle = 'rgba(255,236,228,0.16)';
      ctx.lineWidth = 1;
      line(gxCur, Y(2.08), gxCur, Y(-2.08));

      // Projection lines from the circle to the graph
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1.2;
      if (showSin) {
        ctx.strokeStyle = `rgba(${COLORS.sinRGB},0.6)`;
        line(px, py, gxCur, Y(s));
      }
      if (showCos) {
        // Turn the cosine length a quarter turn onto the y-axis, then carry it across.
        const r = Math.abs(c) * U;
        ctx.strokeStyle = `rgba(${COLORS.cosRGB},0.6)`;
        if (r > 2) {
          const a0 = c >= 0 ? 0 : Math.PI;
          ctx.beginPath();
          ctx.arc(cx, cy, r, -a0, -(a0 + Math.PI / 2), true);
          ctx.stroke();
        }
        line(cx, Y(c), gxCur, Y(c));
      }
      ctx.restore();
      if (showCos) dot(cx, Y(c), 2.6, COLORS.cos);

      // Indicators on the graph
      const ys = S.A * Math.sin(S.w * tCur + ph);
      const yc = S.A * Math.cos(S.w * tCur + ph);
      const labelX = gxCur + 10;
      const labels = [];
      if (showSin) {
        if (transformed) {
          ring(gxCur, Y(s), 4, COLORS.sin);
          ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = `rgba(${COLORS.sinRGB},0.35)`; line(gxCur, Y(s), gxCur, Y(ys)); ctx.restore();
        }
        glowDot(gxCur, Y(ys), 5, COLORS.sinRGB);
        labels.push({ y: Y(ys), str: num(ys, 3), color: COLORS.sin });
      }
      if (showCos) {
        if (transformed) {
          ring(gxCur, Y(c), 4, COLORS.cos);
          ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = `rgba(${COLORS.cosRGB},0.35)`; line(gxCur, Y(c), gxCur, Y(yc)); ctx.restore();
        }
        glowDot(gxCur, Y(yc), 5, COLORS.cosRGB);
        labels.push({ y: Y(yc), str: num(yc, 3), color: COLORS.cos });
      }
      // Keep the two value labels from overlapping.
      if (labels.length === 2 && Math.abs(labels[0].y - labels[1].y) < 15) {
        const mid = (labels[0].y + labels[1].y) / 2;
        const up = labels[0].y <= labels[1].y ? 0 : 1;
        labels[up].y = mid - 8; labels[1 - up].y = mid + 8;
      }
      const flip = labelX + 50 > G.W;
      for (const l of labels) {
        text(l.str, flip ? gxCur - 10 : labelX, l.y, { font: `500 11.5px ${FONT_MONO}`, color: l.color, align: flip ? 'right' : 'left' });
      }

      // Legend for the transformed state
      if (transformed && !G.small) {
        const lx = G.gx1 - 210, ly = 16;
        ctx.save();
        ctx.lineWidth = 2; ctx.strokeStyle = COLORS.text;
        line(lx, ly, lx + 18, ly);
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = COLORS.muted;
        line(lx + 112, ly, lx + 130, ly);
        ctx.restore();
        text('transformed', lx + 24, ly, { font: `11px ${FONT_SANS}`, color: COLORS.muted });
        text('unit circle', lx + 136, ly, { font: `11px ${FONT_SANS}`, color: COLORS.muted });
      }
    }

    // ---- Circle: triangle, radius, angle arc
    if (!locked) {
      ctx.lineCap = 'round';
      if (showCos) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy);
        strokeGlow(COLORS.cosRGB, C.active && C.fn === 'cos' ? 4 : 3);
      }
      if (showSin) {
        ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py);
        strokeGlow(COLORS.sinRGB, C.active && C.fn === 'sin' ? 4 : 3);
      }
      // Right-angle marker
      if (Math.abs(s) > 0.08 && Math.abs(c) > 0.08) {
        const m = 7, sx = -Math.sign(c), sy = Math.sign(s);
        ctx.strokeStyle = 'rgba(255,236,228,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + sx * m, cy); ctx.lineTo(px + sx * m, cy - sy * m); ctx.lineTo(px, cy - sy * m);
        ctx.stroke();
      }
    }

    // Guess marker for the challenge
    if (C.active) drawGuess();

    // Radius (hypotenuse = 1)
    ctx.strokeStyle = 'rgba(240,245,255,0.92)';
    ctx.lineWidth = 2;
    line(cx, cy, px, py);
    dot(cx, cy, 2.5, '#ffece4');

    // Angle arc
    if (th > 0.001) {
      const r = Math.max(16, U * 0.22);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, -th, true);
      ctx.strokeStyle = 'rgba(255,226,207,0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,226,207,0.08)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, 0, -th, true); ctx.closePath(); ctx.fill();
      const lr = r + 11, la = th / 2;
      text('θ', cx + Math.cos(la) * lr, cy - Math.sin(la) * lr, { font: `italic 15px ${FONT_MATH}`, color: '#ffe2cf', align: 'center' });
    }

    // Leg labels
    if (!locked && !G.small) {
      if (showCos && Math.abs(c) > 0.18) {
        text('cos θ', (cx + px) / 2, cy + (s >= 0 ? 13 : -13), { font: `italic 13px ${FONT_MATH}`, color: COLORS.cos, align: 'center' });
      }
      if (showSin && Math.abs(s) > 0.18) {
        text('sin θ', px + (c >= 0 ? 8 : -8), (cy + py) / 2, { font: `italic 13px ${FONT_MATH}`, color: COLORS.sin, align: c >= 0 ? 'left' : 'right' });
      }
    }

    // The rotating point
    const pr = S.dragging === 'circle' || S.hoverPoint ? 8 : 6.5;
    const halo = ctx.createRadialGradient(px, py, 0, px, py, pr * 4);
    halo.addColorStop(0, 'rgba(255,255,255,0.35)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - pr * 4, py - pr * 4, pr * 8, pr * 8);
    dot(px, py, pr, '#ffffff');
    ctx.beginPath(); ctx.arc(px, py, pr + 3, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();

    // Coordinates next to the point
    if (!locked) {
      const ox = Math.cos(th) * 18, oy = -Math.sin(th) * 18;
      const label = `(${num(c, 2)}, ${num(s, 2)})`;
      const font = `${G.small ? 10 : 11}px ${FONT_MONO}`;
      ctx.font = font;
      const lw = ctx.measureText(label).width;
      // Keep the label inside the canvas on both sides.
      const want = c >= 0 ? px + ox : px + ox - lw;
      const lx = clamp(want, 4, G.gx0 - lw - 6);
      // If the edge pushed the label back over the point, move it off the point on the side
      // away from the "cos θ" leg label (which sits below the axis when sin θ ≥ 0).
      const ly = Math.abs(lx - want) > 2 ? py + (s >= 0 ? -20 : 20) : py + oy;
      text(label, lx, clamp(ly, 50, G.H - 30), { font, color: COLORS.text });
    }

    // Angle readout (top-left)
    const deg = th / DEG;
    const fr = piFrac(th);
    text(`θ = ${deg.toFixed(1)}°`, G.pad, 18, { font: `500 ${G.small ? 13 : 15}px ${FONT_MONO}`, color: COLORS.text });
    text(`${th.toFixed(3)} rad${fr && fr !== '0' ? '  ·  ' + fr : ''}`, G.pad, 37, { font: `${G.small ? 11 : 12}px ${FONT_MONO}`, color: COLORS.muted });
  }

  function ring(x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
    dot(x, y, r - 1.5, '#141c38');
  }

  // Bracket between a cosine peak and the next sine peak: a quarter period.
  function drawPhaseBracket(ph) {
    const w = S.w, A = S.A, q = Math.PI / (2 * w);
    const topRoom = Y(A) - 30;
    const useTop = topRoom > 6;
    const base = useTop ? 0 : Math.PI;                 // peaks, or troughs if there is no room above
    let tc = null;
    for (let k = -6; k <= 20; k++) {
      const t = (base + TAU * k - ph) / w;
      if (t >= -1e-9 && t + q <= TAU + 1e-9) { tc = t; break; }
    }
    if (tc === null) return;
    const ts = tc + q;
    const yb = useTop ? Y(A) - 16 : Y(-A) + 16;
    const x1 = X(tc), x2 = X(ts);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,236,228,0.75)';
    ctx.lineWidth = 1.2;
    line(x1, yb, x2, yb);
    line(x1, yb - 4, x1, yb + 4);
    line(x2, yb - 4, x2, yb + 4);
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(255,236,228,0.3)';
    line(x1, yb, x1, useTop ? Y(A) : Y(-A));
    line(x2, yb, x2, useTop ? Y(A) : Y(-A));
    ctx.restore();
    // Brain draws lowercase as capitals, so the Δt part is set in the math face.
    const head = '90° PHASE GAP';
    const tail = w === 1 ? '' : `  ·  Δt = ${piFrac(q, 24) || q.toFixed(2)}`;
    const headFont = `13px ${FONT_DISPLAY}`, tailFont = `italic 14px ${FONT_MATH}`;
    ctx.font = headFont; const hw = ctx.measureText(head).width;
    ctx.font = tailFont; const tw = tail ? ctx.measureText(tail).width : 0;
    const total = hw + tw;
    const lx = clamp((x1 + x2) / 2 - total / 2, G.gx0 + 4, G.gx1 - total);
    const ly = yb + (useTop ? -10 : 11);
    text(head, lx, ly, { font: headFont, color: COLORS.text });
    if (tail) text(tail, lx + hw, ly, { font: tailFont, color: COLORS.text });
  }

  function drawGuess() {
    const { cx, cy } = G;
    const g = C.guess;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    const col = C.fn === 'sin' ? COLORS.sinRGB : COLORS.cosRGB;
    ctx.strokeStyle = `rgba(${col},${C.revealed ? 0.45 : 0.9})`;
    if (C.fn === 'sin') {
      line(CX(-1.12), Y(g), CX(1.12), Y(g));
      ctx.restore();
      dot(cx, Y(g), 3, `rgb(${col})`);
      text('your guess', CX(-1.12), Y(g) - 9, { font: `11px ${FONT_SANS}`, color: `rgb(${col})` });
    } else {
      line(CX(g), Y(1.12), CX(g), Y(-1.12));
      ctx.restore();
      dot(CX(g), cy, 3, `rgb(${col})`);
      text('your guess', CX(g) + 6, Y(1.08), { font: `11px ${FONT_SANS}`, color: `rgb(${col})` });
    }
  }

  // ------------------------------------------------------------------ Data panel

  const QUAD_SIGNS = { 1: 'sin +, cos +', 2: 'sin +, cos −', 3: 'sin −, cos −', 4: 'sin −, cos +' };
  function quadrantText(deg) {
    const a = ((deg % 360) + 360) % 360;
    const near = (v) => Math.abs(a - v) < 0.05 || (v === 0 && Math.abs(a - 360) < 0.05);
    if (near(0)) return 'On the positive x-axis';
    if (near(90)) return 'On the positive y-axis';
    if (near(180)) return 'On the negative x-axis';
    if (near(270)) return 'On the negative y-axis';
    const q = a < 90 ? 1 : a < 180 ? 2 : a < 270 ? 3 : 4;
    return `Quadrant ${['I', 'II', 'III', 'IV'][q - 1]} · ${QUAD_SIGNS[q].replace(/-/g, MINUS)}`;
  }

  function updatePanel() {
    const th = S.theta, deg = th / DEG;
    const s = Math.sin(th), c = Math.cos(th);
    const locked = angleLocked();

    setText(els.dDeg, deg.toFixed(1) + '°');
    setText(els.dRad, th.toFixed(4) + ' rad');
    const fr = piFrac(th);
    setText(els.dRadPi, fr && fr !== '0' ? '= ' + fr : '');
    setText(els.dQuad, quadrantText(deg));

    const mask = (el, str, extra) => {
      setText(el, locked ? '?' : str);
      setClass(el, 'masked', locked);
      if (extra !== undefined) setClass(el, 'undef', !locked && extra);
    };
    mask(els.dSin, num(s));
    mask(els.dCos, num(c));
    const undef = Math.abs(c) < 0.01;
    mask(els.dTan, undef ? 'undefined' : num(s / c), undef);

    const ex = locked ? null : exactTrig(Math.round(deg * 1e4) / 1e4);
    els.exactRow.hidden = !ex;
    if (ex) setText(els.dExact, `sin = ${ex.sin},  cos = ${ex.cos},  tan = ${ex.tan === null ? 'undefined' : ex.tan}`);

    const ph = phi();
    setText(els.dA, S.A.toFixed(2));
    setText(els.dW, S.w.toFixed(2));
    const T = TAU / S.w;
    setText(els.dT, `${piFrac(T, 24) || T.toFixed(3)} ≈ ${T.toFixed(3)} rad`);
    setText(els.dPhi, `${S.phiDeg < 0 ? MINUS : ''}${Math.abs(S.phiDeg)}° = ${piFrac(ph, 36) || num(ph, 3)} rad`);
    const shift = -ph / S.w;
    const shiftStr = Math.abs(shift) < 1e-9 ? 'none' : `${piFrac(Math.abs(shift), 72) || Math.abs(shift).toFixed(3)} ${shift < 0 ? 'left' : 'right'}`;
    setText(els.dShift, shiftStr);
    mask(els.dYs, num(S.A * Math.sin(S.w * th + ph)));
    mask(els.dYc, num(S.A * Math.cos(S.w * th + ph)));

    if (!S.sliderHeld) {
      const v = Math.round(deg * 2) / 2;
      if (Number(els.angle.value) !== v) { els.angle.value = String(v); paintRange(els.angle); }
    }
    setText(els.angleOut, deg.toFixed(1) + '°');
    for (const b of els.presets) {
      const d = Number(b.dataset.deg);
      const on = d === 360 ? Math.abs(th - TAU) < 1e-6 : Math.abs(deg - d) < 1e-6;
      setClass(b, 'active', on);
    }
  }

  // ------------------------------------------------------------------ Formula

  function buildFormula() {
    const tpl = (fn) =>
      `<i>y</i> = <span class="param" tabindex="0" role="slider" data-for="amp" aria-label="Amplitude"></span>` +
      `<span class="fn"> ${fn}</span>(<span class="param" tabindex="0" role="slider" data-for="freq" aria-label="Frequency"></span>` +
      `<i>t</i> <span class="op"></span> <span class="param" tabindex="0" role="slider" data-for="phase" aria-label="Phase shift"></span>)`;
    els.eqSin.innerHTML = tpl('sin');
    els.eqCos.innerHTML = tpl('cos');
    for (const p of document.querySelectorAll('.param')) attachScrub(p);
  }

  function updateFormula() {
    const ph = phi();
    const phStr = piFrac(Math.abs(ph), 36) || Math.abs(ph).toFixed(3);
    for (const eq of [els.eqSin, els.eqCos]) {
      const [a, w, p] = eq.querySelectorAll('.param');
      setText(a, S.A.toFixed(2).replace(/\.?0+$/, '') || '0');
      setText(w, S.w.toFixed(2).replace(/\.?0+$/, ''));
      setText(eq.querySelector('.op'), S.phiDeg < 0 ? MINUS : '+');
      setText(p, phStr);
      a.setAttribute('aria-valuenow', S.A); w.setAttribute('aria-valuenow', S.w); p.setAttribute('aria-valuenow', S.phiDeg);
    }
    let note;
    if (!isTransformed()) {
      note = 'With A = 1, ω = 1 and φ = 0 these are exactly the unit-circle projections sin t and cos t.';
    } else {
      const T = TAU / S.w;
      const parts = [`Peaks reach ±${S.A.toFixed(2)}`, `period 2π/ω = ${piFrac(T, 24) || T.toFixed(3)}`];
      if (S.phiDeg !== 0) {
        const sh = Math.abs(ph / S.w);
        parts.push(`shifted ${piFrac(sh, 72) || sh.toFixed(3)} to the ${S.phiDeg > 0 ? 'left' : 'right'}`);
      }
      note = parts.join(' · ') + '.';
    }
    setText(els.eqNote, note);
  }

  function attachScrub(el) {
    const slider = $(el.dataset.for);
    let startX = 0, startVal = 0, active = false;
    const step = () => Number(slider.step);
    const setVal = (v) => {
      const val = clamp(v, Number(slider.min), Number(slider.max));
      slider.value = String(Math.round(val / step()) * step());
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    };
    el.addEventListener('pointerdown', (e) => {
      active = true; startX = e.clientX; startVal = Number(slider.value);
      el.setPointerCapture(e.pointerId); el.classList.add('scrubbing'); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!active) return;
      setVal(startVal + Math.round((e.clientX - startX) / 8) * step());
    });
    const end = () => { active = false; el.classList.remove('scrubbing'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!dir) return;
      e.preventDefault(); e.stopPropagation();
      setVal(Number(slider.value) + dir * step());
    });
  }

  // ------------------------------------------------------------------ Angle control

  function setTheta(rad) {
    S.theta = clamp(rad, 0, TAU);
  }

  // Snap to multiples of 15° when the pointer is within ~1.2° of one.
  function snapAngle(rad) {
    const d = rad / DEG, nearest = Math.round(d / 15) * 15;
    return Math.abs(d - nearest) < 1.2 ? nearest * DEG : rad;
  }

  function tweenTo(rad, dur = 0.7) {
    S.tween = { from: S.theta, to: rad, t: 0, dur: reduceMotion ? 0.001 : dur };
  }

  function setPlaying(on) {
    if (on && angleLocked()) return;
    S.playing = on;
    els.play.setAttribute('aria-pressed', String(on));
    els.play.querySelector('.btn-label').textContent = on ? 'Pause' : 'Play';
  }

  // ------------------------------------------------------------------ Pointer interaction

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function zoneAt(x, y) {
    const dx = x - G.cx, dy = y - G.cy;
    if (Math.hypot(dx, dy) <= G.U * 1.45) return 'circle';
    if (x >= G.gx0 - 6 && x <= G.gx1 + 6 && Math.abs(y - G.cy) <= G.U * 2.2) return 'graph';
    return null;
  }
  function applyDrag(x, y) {
    let rad;
    if (S.dragging === 'circle') {
      rad = Math.atan2(-(y - G.cy), x - G.cx);
      if (rad < 0) rad += TAU;
    } else {
      rad = clamp((x - G.gx0) / G.gw, 0, 1) * TAU;
    }
    setTheta(snapAngle(rad));
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (angleLocked()) return;
    const { x, y } = localPoint(e);
    const zone = zoneAt(x, y);
    if (!zone) return;
    S.dragging = zone;
    S.tween = null;
    canvas.setPointerCapture(e.pointerId);
    applyDrag(x, y);
    hideHint();
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = localPoint(e);
    if (S.dragging) { applyDrag(x, y); return; }
    const px = CX(Math.cos(S.theta)), py = Y(Math.sin(S.theta));
    S.hoverPoint = Math.hypot(x - px, y - py) < 18;
    const zone = angleLocked() ? null : zoneAt(x, y);
    canvas.style.cursor = zone === 'circle' ? (S.hoverPoint ? 'grab' : 'pointer') : zone === 'graph' ? 'ew-resize' : 'default';
  });
  const endDrag = () => { S.dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { S.hoverPoint = false; });

  function hideHint() { els.hint.classList.add('gone'); }
  setTimeout(hideHint, 7000);

  // ------------------------------------------------------------------ Controls

  function paintRange(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--pct', pct + '%');
  }

  els.play.addEventListener('click', () => setPlaying(!S.playing));
  els.slow.addEventListener('click', () => {
    S.slow = !S.slow;
    els.slow.setAttribute('aria-pressed', String(S.slow));
    syncSpeedLabel();
  });

  function setToggle(btn, key, on) {
    S[key] = on;
    btn.setAttribute('aria-pressed', String(on));
  }
  els.tgSin.addEventListener('click', () => {
    setToggle(els.tgSin, 'showSin', !S.showSin);
    if (!S.showSin && S.compare) setToggle(els.tgCompare, 'compare', false);
  });
  els.tgCos.addEventListener('click', () => {
    setToggle(els.tgCos, 'showCos', !S.showCos);
    if (!S.showCos && S.compare) setToggle(els.tgCompare, 'compare', false);
  });
  els.tgTrace.addEventListener('click', () => setToggle(els.tgTrace, 'trace', !S.trace));
  els.tgCompare.addEventListener('click', () => {
    setToggle(els.tgCompare, 'compare', !S.compare);
    if (S.compare) {
      setToggle(els.tgSin, 'showSin', true);
      setToggle(els.tgCos, 'showCos', true);
      S.time = 0;
    }
  });

  els.angle.addEventListener('pointerdown', () => { S.sliderHeld = true; });
  window.addEventListener('pointerup', () => { S.sliderHeld = false; });
  els.angle.addEventListener('input', () => {
    if (angleLocked()) return;
    S.tween = null;
    setTheta(Number(els.angle.value) * DEG);
    paintRange(els.angle);
  });

  for (const b of els.presets) {
    b.addEventListener('click', () => {
      if (angleLocked()) return;
      setPlaying(false);
      tweenTo(Number(b.dataset.deg) * DEG);
    });
  }

  function syncSpeedLabel() {
    setText(els.speedOut, `${S.speed}°/s${S.slow ? ' × 0.2' : ''}`);
  }
  els.speed.addEventListener('input', () => {
    S.speed = Number(els.speed.value);
    paintRange(els.speed);
    syncSpeedLabel();
  });
  els.amp.addEventListener('input', () => {
    S.A = Number(els.amp.value);
    setText(els.ampOut, S.A.toFixed(2));
    paintRange(els.amp);
    updateFormula();
  });
  els.freq.addEventListener('input', () => {
    S.w = Number(els.freq.value);
    setText(els.freqOut, S.w.toFixed(2));
    paintRange(els.freq);
    updateFormula();
  });
  els.phase.addEventListener('input', () => {
    S.phiDeg = Number(els.phase.value);
    const fr = piFrac(Math.abs(S.phiDeg * DEG), 36);
    setText(els.phaseOut, `${S.phiDeg < 0 ? MINUS : ''}${Math.abs(S.phiDeg)}°${fr && fr !== '0' ? ' (' + (S.phiDeg < 0 ? MINUS : '') + fr + ')' : ''}`);
    paintRange(els.phase);
    updateFormula();
  });

  function applyDefaults() {
    exitChallenge();
    S.tween = null;
    setTheta(DEFAULTS.theta);
    setPlaying(DEFAULTS.playing);
    S.slow = DEFAULTS.slow; els.slow.setAttribute('aria-pressed', 'false');
    setToggle(els.tgSin, 'showSin', DEFAULTS.showSin);
    setToggle(els.tgCos, 'showCos', DEFAULTS.showCos);
    setToggle(els.tgTrace, 'trace', DEFAULTS.trace);
    setToggle(els.tgCompare, 'compare', DEFAULTS.compare);
    for (const [el, v] of [[els.speed, DEFAULTS.speed], [els.amp, DEFAULTS.A], [els.freq, DEFAULTS.w], [els.phase, DEFAULTS.phiDeg]]) {
      el.value = String(v);
      el.dispatchEvent(new Event('input'));
    }
  }
  els.reset.addEventListener('click', applyDefaults);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.code === 'Space') {
      if (inField || tag === 'BUTTON' || e.target.classList.contains('param')) return;
      e.preventDefault();
      setPlaying(!S.playing);
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !inField && !e.target.classList.contains('param')) {
      if (angleLocked()) return;
      e.preventDefault();
      const step = (e.shiftKey ? 15 : 1) * DEG * (e.key === 'ArrowRight' ? 1 : -1);
      S.tween = null;
      let t = S.theta + step;
      if (t < -1e-9) t += TAU; else if (t > TAU + 1e-9) t -= TAU;
      setTheta(Math.round(t / DEG * 2) / 2 * DEG);
    }
  });

  // ------------------------------------------------------------------ Challenge

  const SPECIAL_POOL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
  const EXACT_CHOICES = [
    ['−1', -1], ['−√3/2', -Math.sqrt(3) / 2], ['−√2/2', -Math.SQRT1_2], ['−1/2', -0.5], ['0', 0],
    ['1/2', 0.5], ['√2/2', Math.SQRT1_2], ['√3/2', Math.sqrt(3) / 2], ['1', 1],
  ];

  els.chChips.innerHTML = EXACT_CHOICES.map(([l, v]) => `<button type="button" data-v="${v}">${l}</button>`).join('');
  for (const b of els.chChips.children) {
    b.addEventListener('click', () => { if (!C.revealed) setGuess(Number(b.dataset.v)); });
  }

  for (const b of els.chMode.children) {
    b.addEventListener('click', () => {
      C.mode = b.dataset.mode;
      for (const o of els.chMode.children) o.setAttribute('aria-checked', String(o === b));
    });
  }

  function setGuess(v) {
    C.guess = clamp(v, -1, 1);
    els.chGuess.value = String(C.guess);
    paintRange(els.chGuess);
    setText(els.chGuessOut, num(C.guess, 2));
    for (const b of els.chChips.children) setClass(b, 'active', Math.abs(Number(b.dataset.v) - C.guess) < 1e-9);
  }
  els.chGuess.addEventListener('input', () => { if (!C.revealed) setGuess(Number(els.chGuess.value)); else setGuess(C.guess); });

  function setLockedUI(locked) {
    els.angle.disabled = locked;
    els.play.disabled = locked;
    for (const b of els.presets) b.disabled = locked;
  }

  function startChallenge() {
    C.active = true; C.score = 0; C.total = 0; C.streak = 0;
    els.chIdle.hidden = true;
    els.chActive.hidden = false;
    els.chScore.hidden = false;
    nextChallenge();
  }

  function nextChallenge() {
    C.deg = C.mode === 'special' ? SPECIAL_POOL[(Math.random() * SPECIAL_POOL.length) | 0] : 1 + ((Math.random() * 359) | 0);
    C.fn = Math.random() < 0.5 ? 'sin' : 'cos';
    C.revealed = false;
    setPlaying(false);
    tweenTo(C.deg * DEG, 0.9);
    setGuess(0);
    els.chGuess.disabled = false;
    els.chChips.hidden = C.mode !== 'special';
    els.chQuestion.innerHTML = `What is <span class="q-${C.fn}">${C.fn}</span>(${C.deg}°)?`;
    els.chFeedback.hidden = true;
    els.chReveal.hidden = false;
    els.chNext.hidden = true;
    setLockedUI(true);
    updateScore();
  }

  function revealChallenge() {
    const actual = C.fn === 'sin' ? Math.sin(C.deg * DEG) : Math.cos(C.deg * DEG);
    const ex = exactTrig(C.deg);
    const err = Math.abs(C.guess - actual);
    const tol = C.mode === 'special' ? 0.02 : 0.05;
    const grade = err <= tol ? 'good' : err <= 0.15 ? 'close' : 'miss';
    C.revealed = true;
    C.total++;
    if (grade === 'good') { C.score++; C.streak++; } else C.streak = 0;

    const { ref, sx, sy } = quadrantInfo(C.deg);
    const a = C.deg % 360;
    let why;
    if (a % 90 === 0) {
      why = `${C.deg}° lies on an axis, so the point is at (${num(Math.cos(C.deg * DEG), 0)}, ${num(Math.sin(C.deg * DEG), 0)}).`;
    } else {
      const q = a < 90 ? 'I' : a < 180 ? 'II' : a < 270 ? 'III' : 'IV';
      const sign = (C.fn === 'sin' ? sy : sx) > 0 ? 'positive' : 'negative';
      why = `${C.deg}° is in Quadrant ${q} with reference angle ${ref}°, where ${C.fn === 'sin' ? 'sine (height)' : 'cosine (horizontal position)'} is ${sign}.`;
    }
    const title = { good: 'Spot on!', close: 'Close.', miss: 'Not quite.' }[grade];
    const exactStr = ex ? `${ex[C.fn]} ≈ ` : '';
    els.chFeedback.className = 'ch-feedback ' + grade;
    els.chFeedback.innerHTML =
      `<strong>${title}</strong><span class="ans">${C.fn} ${C.deg}° = ${exactStr}${num(actual, 3)}</span><br>` +
      `Your prediction was ${num(C.guess, 2)}, off by ${err.toFixed(2)}. ${why}`;
    els.chFeedback.hidden = false;
    els.chReveal.hidden = true;
    els.chNext.hidden = false;
    els.chGuess.disabled = true;
    setLockedUI(false);
    updateScore();
  }

  function exitChallenge() {
    if (!C.active) return;
    C.active = false;
    C.revealed = false;
    els.chIdle.hidden = false;
    els.chActive.hidden = true;
    els.chScore.hidden = true;
    setLockedUI(false);
  }

  function updateScore() {
    setText(els.chScore, `${C.score} / ${C.total} correct${C.streak > 1 ? ` · streak ${C.streak}` : ''}`);
  }

  els.chStart.addEventListener('click', startChallenge);
  els.chReveal.addEventListener('click', revealChallenge);
  els.chNext.addEventListener('click', nextChallenge);
  els.chExit.addEventListener('click', exitChallenge);

  // ------------------------------------------------------------------ Loop

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.time += dt;

    if (S.tween) {
      const tw = S.tween;
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setTheta(tw.from + (tw.to - tw.from) * e);
      if (k >= 1) S.tween = null;
    } else if (S.playing && !S.dragging && !S.sliderHeld) {
      let t = S.theta + S.speed * (S.slow ? 0.2 : 1) * DEG * dt;
      if (t >= TAU) t -= TAU;
      S.theta = t;
    }

    render();
    updatePanel();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Init

  buildFormula();
  for (const el of [els.angle, els.speed, els.amp, els.freq, els.phase, els.chGuess]) paintRange(el);
  els.speed.style.setProperty('--fill', 'var(--accent)');
  for (const el of [els.amp, els.freq, els.phase]) el.dispatchEvent(new Event('input'));
  setPlaying(S.playing);
  syncSpeedLabel();
  layout();
  new ResizeObserver(layout).observe(canvas);
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
