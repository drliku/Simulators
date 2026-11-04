/**
 * Canvas 2D renderer. Draws grid, objects, ray segments (additively blended),
 * angle annotations and selection handles. Pure function of its input.
 */
import type { Compiled } from '../engine/compile';
import { wavelengthToCss } from '../engine/color';
import { SEG_STRIDE, type TraceResult } from '../engine/tracer';
import { deg2rad, rad2deg } from '../engine/vec';
import { getHandles } from '../interaction/handles';
import type { SceneObject, SimSettings, SourceObject } from '../scene/types';
import type { UIState, ViewState } from '../state/store';
import { gridStep, screenToWorld } from './camera';

export interface RenderInput {
  w: number;
  h: number;
  view: ViewState;
  compiled: Compiled[];
  trace: TraceResult | null;
  ui: UIState;
  settings: SimSettings;
  selectedId: string | null;
  hoverId: string | null;
  showSelection: boolean;
}

type Ctx = CanvasRenderingContext2D;

const MONO = '10px "JetBrains Mono", ui-monospace, Consolas, monospace';
const SANS = '12px Barlow, ui-sans-serif, system-ui, sans-serif';

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function sourceCss(s: SourceObject): string {
  if (s.spectrum === 'white') return '#ffffff';
  if (s.spectrum === 'rgb') return '#e9d5ff';
  return wavelengthToCss(s.wavelength);
}

export function render(ctx: Ctx, inp: RenderInput): void {
  const { w, h, view } = inp;
  const S = (x: number, y: number): [number, number] => [w / 2 + (x - view.cx) * view.zoom, h / 2 - (y - view.cy) * view.zoom];

  drawBackground(ctx, w, h);
  if (inp.ui.showGrid) drawGrid(ctx, inp);

  for (const c of inp.compiled) if (c.obj.kind === 'body') drawBody(ctx, c, S);
  if (inp.trace && inp.ui.showRays) drawRays(ctx, inp);
  for (const c of inp.compiled) if (c.obj.kind !== 'body') drawThin(ctx, c, S, inp);

  if (inp.trace && (inp.ui.showNormals || inp.ui.showAngles)) drawAnnotations(ctx, inp, S);

  if (inp.showSelection) {
    const hover = inp.compiled.find((c) => c.obj.id === inp.hoverId && c.obj.id !== inp.selectedId);
    if (hover) strokeOutline(ctx, hover, S, 'rgba(243,112,100,0.45)', 1.5, 0);
    const sel = inp.compiled.find((c) => c.obj.id === inp.selectedId);
    if (sel) drawSelection(ctx, sel, S, inp);
  }

  if (inp.ui.paused) {
    ctx.font = SANS;
    const text = 'Simulation paused — ray paths are frozen';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(234,179,8,0.14)';
    roundRect(ctx, w / 2 - tw / 2 - 12, 12, tw + 24, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 24);
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx: Ctx, w: number, h: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0b1022';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(36,48,86,0.62)');
  g.addColorStop(1, 'rgba(11,16,34,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx: Ctx, inp: RenderInput) {
  const { w, h, view } = inp;
  const step = gridStep(view.zoom);
  const [x0, y1] = screenToWorld(view, w, h, 0, 0);
  const [x1, y0] = screenToWorld(view, w, h, w, h);
  const minor = new Path2D();
  const major = new Path2D();
  const axes = new Path2D();
  const i0 = Math.floor(x0 / step);
  const i1 = Math.ceil(x1 / step);
  const j0 = Math.floor(y0 / step);
  const j1 = Math.ceil(y1 / step);
  const labels: [string, number, number, CanvasTextAlign][] = [];
  for (let i = i0; i <= i1; i++) {
    const sx = Math.round(w / 2 + (i * step - view.cx) * view.zoom) + 0.5;
    const p = i === 0 ? axes : i % 5 === 0 ? major : minor;
    p.moveTo(sx, 0);
    p.lineTo(sx, h);
    if (i % 5 === 0) labels.push([fmtGrid(i * step), sx + 3, h - 6, 'left']);
  }
  for (let j = j0; j <= j1; j++) {
    const sy = Math.round(h / 2 - (j * step - view.cy) * view.zoom) + 0.5;
    const p = j === 0 ? axes : j % 5 === 0 ? major : minor;
    p.moveTo(0, sy);
    p.lineTo(w, sy);
    if (j % 5 === 0 && j !== 0) labels.push([fmtGrid(j * step), 4, sy - 3, 'left']);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150,160,205,0.055)';
  ctx.stroke(minor);
  ctx.strokeStyle = 'rgba(150,160,205,0.11)';
  ctx.stroke(major);
  ctx.strokeStyle = 'rgba(243,112,100,0.3)';
  ctx.stroke(axes);
  ctx.font = MONO;
  ctx.fillStyle = 'rgba(170,178,215,0.42)';
  ctx.textBaseline = 'alphabetic';
  for (const [t, x, y, al] of labels) {
    ctx.textAlign = al;
    ctx.fillText(t, x, y);
  }
}

function fmtGrid(v: number): string {
  if (Math.abs(v) >= 1000) return `${+(v / 1000).toFixed(2)} m`;
  return `${+v.toFixed(2)}`;
}

function tracePath(ctx: Ctx, pts: number[], closed: boolean, S: (x: number, y: number) => [number, number]) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = S(pts[i], pts[i + 1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (closed) ctx.closePath();
}

function strokeOutline(ctx: Ctx, c: Compiled, S: (x: number, y: number) => [number, number], color: string, width: number, blur: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineJoin = 'round';
  for (const ol of c.outlines) {
    tracePath(ctx, ol.pts, ol.closed, S);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBody(ctx: Ctx, c: Compiled, S: (x: number, y: number) => [number, number]) {
  const o = c.obj;
  if (o.kind !== 'body') return;
  const m = o.material;
  const opaque = m.transmission <= 0;
  for (const ol of c.outlines) {
    tracePath(ctx, ol.pts, true, S);
    if (opaque) {
      const [x0, y0] = S(c.bounds[0], c.bounds[3]);
      const [x1, y1] = S(c.bounds[2], c.bounds[1]);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, hexToRgba(m.color, 0.95));
      g.addColorStop(0.5, hexToRgba(m.color, 0.6));
      g.addColorStop(1, hexToRgba(m.color, 0.85));
      ctx.fillStyle = g;
    } else {
      const a = Math.min(0.32, 0.07 + (m.ior - 1) * 0.13 + m.roughness * 0.25 + Math.min(0.15, m.absorption * 0.3));
      ctx.fillStyle = hexToRgba(m.color, a);
    }
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = hexToRgba(opaque && m.color === '#111827' ? '#64748b' : m.color, opaque ? 0.9 : 0.7);
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (m.roughness > 0.05 && !opaque) {
      // Frosted surface stipple
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Liang–Barsky clip of a segment to a rectangle. Returns false if fully outside.
const clipOut = [0, 0, 0, 0];
function clip(x1: number, y1: number, x2: number, y2: number, b: number[]): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - b[0], b[2] - x1, y1 - b[1], b[3] - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  clipOut[0] = x1 + t0 * dx;
  clipOut[1] = y1 + t0 * dy;
  clipOut[2] = x1 + t1 * dx;
  clipOut[3] = y1 + t1 * dy;
  return true;
}

function drawRays(ctx: Ctx, inp: RenderInput) {
  const tr = inp.trace!;
  const { w, h, view } = inp;
  const [vx0, vy1] = screenToWorld(view, w, h, -20, -20);
  const [vx1, vy0] = screenToWorld(view, w, h, w + 20, h + 20);
  const box = [vx0, vy0, vx1, vy1];
  const gain = inp.settings.brightness;
  const groups = new Map<string, { color: string; alpha: number; pts: number[] }>();
  const segs = tr.segs;
  for (let i = 0; i < tr.segCount; i++) {
    const o = i * SEG_STRIDE;
    const I = (segs[o + 4] + segs[o + 5]) * 0.5 * gain;
    const r = segs[o + 6] * I;
    const g = segs[o + 7] * I;
    const b = segs[o + 8] * I;
    const m = Math.max(r, g, b);
    if (m < 0.003) continue;
    if (!clip(segs[o], segs[o + 1], segs[o + 2], segs[o + 3], box)) continue;
    const alpha = Math.min(1, Math.pow(Math.min(1, m), 0.7));
    const R = Math.round((r / m) * 255);
    const G = Math.round((g / m) * 255);
    const B = Math.round((b / m) * 255);
    const ab = Math.max(1, Math.round(alpha * 24));
    const key = `${R},${G},${B},${ab}`;
    let grp = groups.get(key);
    if (!grp) {
      grp = { color: `rgb(${R},${G},${B})`, alpha: ab / 24, pts: [] };
      groups.set(key, grp);
    }
    grp.pts.push(
      w / 2 + (clipOut[0] - view.cx) * view.zoom,
      h / 2 - (clipOut[1] - view.cy) * view.zoom,
      w / 2 + (clipOut[2] - view.cx) * view.zoom,
      h / 2 - (clipOut[3] - view.cy) * view.zoom,
    );
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass === 0 ? 5 : 1.5;
    for (const grp of groups.values()) {
      ctx.strokeStyle = grp.color;
      ctx.globalAlpha = pass === 0 ? grp.alpha * 0.16 : grp.alpha;
      ctx.beginPath();
      const p = grp.pts;
      for (let k = 0; k < p.length; k += 4) {
        ctx.moveTo(p[k], p[k + 1]);
        ctx.lineTo(p[k + 2], p[k + 3]);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawThin(ctx: Ctx, c: Compiled, S: (x: number, y: number) => [number, number], inp: RenderInput) {
  const o = c.obj;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (o.kind) {
    case 'mirror': {
      const ol = c.outlines[0];
      if (!ol) break;
      // Back-side hatching for one-sided mirrors
      if (!o.twoSided && !o.partial) {
        ctx.strokeStyle = 'rgba(100,116,139,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const fn = c.frontNormals;
        for (let i = 0; i < fn.length; i += 4) {
          const [x, y] = S(fn[i], fn[i + 1]);
          const nx = fn[i + 2];
          const ny = -fn[i + 3];
          ctx.moveTo(x - nx * 2, y - ny * 2);
          ctx.lineTo(x - nx * 8 - ny * 4, y - ny * 8 + nx * 4);
        }
        ctx.stroke();
      }
      tracePath(ctx, ol.pts, false, S);
      if (o.partial) {
        ctx.strokeStyle = 'rgba(147,197,253,0.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 4]);
      } else {
        ctx.strokeStyle = o.roughness > 0.05 ? '#94a3b8' : '#e2e8f0';
        ctx.lineWidth = o.twoSided ? 4 : 3.2;
        ctx.shadowColor = 'rgba(226,232,240,0.6)';
        ctx.shadowBlur = 6;
      }
      ctx.stroke();
      break;
    }
    case 'thinlens': {
      const ol = c.outlines[0];
      const [ax, ay] = S(ol.pts[0], ol.pts[1]);
      const [bx, by] = S(ol.pts[2], ol.pts[3]);
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(125,211,252,0.6)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const conv = o.focalLength > 0;
      for (const [px, py, sgn] of [
        [bx, by, 1],
        [ax, ay, -1],
      ] as const) {
        const tipBack = conv ? -1 : 1; // arrow arms go back along the lens (convex) or outward (concave)
        const bxp = px + ux * sgn * 9 * tipBack;
        const byp = py + uy * sgn * 9 * tipBack;
        ctx.moveTo(bxp - uy * 7, byp + ux * 7);
        ctx.lineTo(px, py);
        ctx.lineTo(bxp + uy * 7, byp - ux * 7);
      }
      ctx.stroke();
      break;
    }
    case 'detector': {
      const ol = c.outlines[0];
      tracePath(ctx, ol.pts, false, S);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();
      const rd = inp.trace?.detectors[o.id];
      const [lx, ly] = S(ol.pts[2], ol.pts[3]);
      label(ctx, `${o.name}: ${rd ? rd.power.toFixed(3) : '—'}`, lx + 8, ly - 8, '#fbbf24');
      break;
    }
    case 'source':
      drawSource(ctx, c, o, S);
      break;
    case 'ruler':
      drawRuler(ctx, o, S, inp.view.zoom);
      break;
    case 'protractor':
      drawProtractor(ctx, o, S);
      break;
  }
  ctx.restore();
}

function label(ctx: Ctx, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.save();
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const tw = ctx.measureText(text).width;
  const bx = align === 'center' ? x - tw / 2 - 5 : align === 'right' ? x - tw - 5 : x - 5;
  ctx.fillStyle = 'rgba(11,16,34,0.84)';
  roundRect(ctx, bx, y - 9, tw + 10, 18, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawSource(ctx: Ctx, c: Compiled, o: SourceObject, S: (x: number, y: number) => [number, number]) {
  const col = sourceCss(o);
  ctx.globalAlpha = o.enabled ? 1 : 0.45;
  const [cx, cy] = S(o.x, o.y);
  if (o.emitter === 'point' || o.emitter === 'fan') {
    const ol = c.outlines[0];
    const rr = Math.max(5, Math.hypot(...(S(ol.pts[0], ol.pts[1]).map((v, i) => v - [cx, cy][i]) as [number, number])));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 2.2);
    g.addColorStop(0, col);
    g.addColorStop(0.35, hexToRgbaCss(col, 0.55));
    g.addColorStop(1, hexToRgbaCss(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (o.emitter === 'fan') {
      const a = deg2rad(o.rotation);
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rr, cy - Math.sin(a) * rr);
      ctx.lineTo(cx + Math.cos(a) * rr * 1.9, cy - Math.sin(a) * rr * 1.9);
      ctx.stroke();
    }
    return;
  }
  const ol = c.outlines[0];
  tracePath(ctx, ol.pts, true, S);
  const g = ctx.createLinearGradient(...S(ol.pts[0], ol.pts[1]), ...S(ol.pts[6], ol.pts[7]));
  g.addColorStop(0, '#334155');
  g.addColorStop(0.5, '#1e293b');
  g.addColorStop(1, '#0f172a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hexToRgbaCss(col, 0.9);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // Emission aperture
  ctx.shadowColor = col;
  ctx.shadowBlur = 10;
  ctx.fillStyle = col;
  if (o.emitter === 'beam') {
    const a = deg2rad(o.rotation);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    const [x1, y1] = S(o.x + (px * o.width) / 2, o.y + (py * o.width) / 2);
    const [x2, y2] = S(o.x - (px * o.width) / 2, o.y - (py * o.width) / 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (o.spectrum === 'rgb' || o.spectrum === 'white') {
    const a = deg2rad(o.rotation);
    const cols = o.spectrum === 'rgb' ? ['#ef4444', '#22c55e', '#3b82f6'] : ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
    const back = o.emitter === 'beam' ? 6 : 20;
    cols.forEach((cc, i) => {
      const off = (i - (cols.length - 1) / 2) * 3.2;
      const [x, y] = S(o.x - Math.cos(a) * back - Math.sin(a) * off, o.y - Math.sin(a) * back + Math.cos(a) * off);
      ctx.fillStyle = cc;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/** Accepts '#rrggbb' or 'rgb(r, g, b)'. */
function hexToRgbaCss(c: string, a: number): string {
  if (c.startsWith('#')) return hexToRgba(c, a);
  const m = c.match(/\d+/g);
  if (!m) return c;
  return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`;
}

function drawRuler(ctx: Ctx, o: Extract<SceneObject, { kind: 'ruler' }>, S: (x: number, y: number) => [number, number], zoom: number) {
  const a = deg2rad(o.rotation);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const [x0, y0] = S(o.x, o.y);
  const [x1, y1] = S(o.x + ux * o.length, o.y + uy * o.length);
  // screen-space perpendicular (left of direction)
  const sx = x1 - x0;
  const sy = y1 - y0;
  const sl = Math.hypot(sx, sy) || 1;
  const px = sy / sl;
  const py = -sx / sl;
  ctx.fillStyle = 'rgba(250,204,21,0.10)';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + px * 16, y1 + py * 16);
  ctx.lineTo(x0 + px * 16, y0 + py * 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const step = gridStep(zoom) / 2 >= 1 ? gridStep(zoom) / 2 : gridStep(zoom);
  const n = Math.floor(o.length / step + 1e-9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= n && i < 2000; i++) {
    const t = (i * step) / o.length;
    const tx = x0 + sx * t;
    const ty = y0 + sy * t;
    const len = i % 10 === 0 ? 12 : i % 2 === 0 ? 8 : 4;
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + px * len, ty + py * len);
  }
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + px * 12, y1 + py * 12);
  ctx.stroke();
  label(ctx, `${o.length.toFixed(1)} mm`, (x0 + x1) / 2 + px * 30, (y0 + y1) / 2 + py * 30, '#fde68a', 'center');
}

function drawProtractor(ctx: Ctx, o: Extract<SceneObject, { kind: 'protractor' }>, S: (x: number, y: number) => [number, number]) {
  const a0 = deg2rad(o.rotation);
  const a1 = a0 + deg2rad(o.angle);
  const [cx, cy] = S(o.x, o.y);
  const [p1x, p1y] = S(o.x + Math.cos(a0) * o.radius, o.y + Math.sin(a0) * o.radius);
  const [p2x, p2y] = S(o.x + Math.cos(a1) * o.radius, o.y + Math.sin(a1) * o.radius);
  const sr = Math.hypot(p1x - cx, p1y - cy);
  ctx.fillStyle = 'rgba(251,191,36,0.08)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, sr, -a0, -a1, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(cx, cy);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, sr * 0.35, -a0, -a1, true);
  ctx.stroke();
  // degree ticks on the outer arc
  ctx.strokeStyle = 'rgba(251,191,36,0.5)';
  ctx.beginPath();
  for (let d = 0; d <= o.angle + 1e-9; d += 5) {
    const a = a0 + deg2rad(d);
    const len = d % 30 === 0 ? 10 : d % 10 === 0 ? 6 : 3;
    ctx.moveTo(cx + Math.cos(a) * sr, cy - Math.sin(a) * sr);
    ctx.lineTo(cx + Math.cos(a) * (sr - len), cy - Math.sin(a) * (sr - len));
  }
  ctx.stroke();
  const am = (a0 + a1) / 2;
  label(ctx, `${o.angle.toFixed(1)}°`, cx + Math.cos(am) * (sr * 0.35 + 26), cy - Math.sin(am) * (sr * 0.35 + 26), '#fde68a', 'center');
}

function drawArcBetween(ctx: Ctx, x: number, y: number, r: number, ax: number, ay: number, bx: number, by: number) {
  // inputs are world-space unit vectors; convert to screen angles (y flipped)
  const sa = Math.atan2(-ay, ax);
  const sb = Math.atan2(-by, bx);
  let diff = sb - sa;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ctx.beginPath();
  ctx.arc(x, y, r, sa, sa + diff, diff < 0);
  ctx.stroke();
  return sa + diff / 2;
}

function drawAnnotations(ctx: Ctx, inp: RenderInput, S: (x: number, y: number) => [number, number]) {
  const tr = inp.trace!;
  const sel = inp.compiled.find((c) => c.obj.id === inp.selectedId)?.obj;
  let hits = tr.hits;
  if (sel && sel.kind === 'source') hits = hits.filter((h) => h.source === sel.id);
  else if (sel && sel.kind !== 'ruler' && sel.kind !== 'protractor') {
    const own = hits.filter((h) => h.optic === sel.id);
    if (own.length) hits = own;
  }
  const { w, h } = inp;
  let nNorm = 0;
  let nAng = 0;
  ctx.save();
  ctx.font = MONO;
  for (const hr of hits) {
    if (hr.kind === 'thinlens') continue;
    const [x, y] = S(hr.x, hr.y);
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
    if (inp.ui.showNormals && nNorm < 200) {
      nNorm++;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(226,232,240,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - hr.nx * 34, y + hr.ny * 34);
      ctx.lineTo(x + hr.nx * 34, y - hr.ny * 34);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (inp.ui.showAngles && nAng < 40 && hr.intensity > 0.03) {
      nAng++;
      ctx.lineWidth = 1.2;
      const deg = (ax: number, ay: number, bx: number, by: number) => rad2deg(Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by))));
      // Incidence: between reversed incoming ray and the normal
      ctx.strokeStyle = '#facc15';
      const mi = drawArcBetween(ctx, x, y, 22, -hr.dx, -hr.dy, hr.nx, hr.ny);
      label(ctx, `θi ${deg(-hr.dx, -hr.dy, hr.nx, hr.ny).toFixed(1)}°`, x + Math.cos(mi) * 48, y + Math.sin(mi) * 48, '#fde047', 'center');
      if (hr.hasR) {
        ctx.strokeStyle = '#fb923c';
        const mr = drawArcBetween(ctx, x, y, 28, hr.nx, hr.ny, hr.rx, hr.ry);
        label(ctx, `θr ${deg(hr.nx, hr.ny, hr.rx, hr.ry).toFixed(1)}°`, x + Math.cos(mr) * 56, y + Math.sin(mr) * 56, '#fdba74', 'center');
      }
      if (hr.hasT && hr.kind === 'body') {
        ctx.strokeStyle = '#22d3ee';
        const mt = drawArcBetween(ctx, x, y, 22, -hr.nx, -hr.ny, hr.tx, hr.ty);
        label(ctx, `θt ${deg(-hr.nx, -hr.ny, hr.tx, hr.ty).toFixed(1)}°`, x + Math.cos(mt) * 50, y + Math.sin(mt) * 50, '#67e8f9', 'center');
      }
      if (hr.tir) label(ctx, 'TIR', x - hr.nx * 30, y + hr.ny * 30, '#f87171', 'center');
    }
  }
  ctx.restore();
}

function drawSelection(ctx: Ctx, c: Compiled, S: (x: number, y: number) => [number, number], inp: RenderInput) {
  strokeOutline(ctx, c, S, 'rgba(243,112,100,0.95)', 2, 10);
  ctx.save();
  // Focal points
  for (const [fx, fy] of c.foci) {
    const [x, y] = S(fx, fy);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 5);
    ctx.lineTo(x + 5, y + 5);
    ctx.moveTo(x - 5, y + 5);
    ctx.lineTo(x + 5, y - 5);
    ctx.stroke();
    ctx.font = SANS;
    ctx.fillStyle = '#f9a8d4';
    ctx.textAlign = 'left';
    ctx.fillText('F', x + 6, y - 6);
  }
  // Origin marker
  const [ox, oy] = S(c.obj.x, c.obj.y);
  ctx.fillStyle = '#f37064';
  ctx.beginPath();
  ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  for (const hd of getHandles(c, inp.view.zoom)) {
    const [x, y] = S(hd.x, hd.y);
    if (hd.id === 'rotate') {
      const [ax, ay] = S(hd.ax!, hd.ay!);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(243,112,100,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#243056';
      ctx.strokeStyle = '#f37064';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3.2, -Math.PI * 0.9, Math.PI * 0.4);
      ctx.stroke();
    } else if (hd.id === 'resize') {
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#f37064';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(x - 5, y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
