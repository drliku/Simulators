/**
 * The passenger, drawn in train-frame metres. The origin is his eye's x position at floor
 * level; y is negative going up (canvas convention), so the eye sits at y = −EYE_HEIGHT.
 * Callers set the transform (scale, and horizontal contraction in the track view).
 */
import { EYE_HEIGHT } from '../sim/engine';

export interface PersonStyle {
  facing: 1 | -1;
  blink: boolean;
  /** 0 = looking ahead, 1 = looking up at a ceiling mirror. */
  lookUp: number;
  /** Fade for reflections. */
  alpha?: number;
}

const SKIN = '#f2c7a5';
const SKIN_SHADE = '#d9a582';
const HAIR = '#1d2645';
const JACKET = '#f37064';
const JACKET_SHADE = '#cf564b';
const SHIRT = '#fff1ec';
const TROUSERS = '#56689f';
const SHOES = '#0f142b';

export function drawPerson(ctx: CanvasRenderingContext2D, s: PersonStyle) {
  const f = s.facing;
  ctx.save();
  if (s.alpha !== undefined) ctx.globalAlpha *= s.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hx = -0.075 * f;           // head centre is just behind the eye
  const shoulderY = -1.43;
  const hipY = -0.93;

  // Back leg, then back arm (further from the viewer, slightly darker)
  ctx.strokeStyle = '#46578c';
  ctx.lineWidth = 0.12;
  line(ctx, hx - 0.03 * f, hipY, hx - 0.07 * f, -0.06);
  ctx.fillStyle = SHOES;
  ellipse(ctx, hx - 0.04 * f, -0.035, 0.13, 0.045);
  ctx.strokeStyle = JACKET_SHADE;
  ctx.lineWidth = 0.085;
  path(ctx, [[hx - 0.04 * f, shoulderY + 0.03], [hx - 0.1 * f, -1.18], [hx - 0.06 * f, -0.98]]);
  ctx.fillStyle = SKIN_SHADE;
  circle(ctx, hx - 0.06 * f, -0.96, 0.045);

  // Front leg
  ctx.strokeStyle = TROUSERS;
  ctx.lineWidth = 0.125;
  line(ctx, hx + 0.04 * f, hipY, hx + 0.08 * f, -0.06);
  ctx.fillStyle = SHOES;
  ellipse(ctx, hx + 0.12 * f, -0.035, 0.14, 0.048);

  // Torso: jacket over a light shirt
  ctx.fillStyle = JACKET;
  roundRect(ctx, hx - 0.16, shoulderY - 0.02, 0.32, hipY - shoulderY + 0.1, 0.07);
  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.moveTo(hx + 0.04 * f, shoulderY);
  ctx.lineTo(hx + 0.13 * f, shoulderY);
  ctx.lineTo(hx + 0.08 * f, shoulderY + 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#243056';
  roundRect(ctx, hx - 0.16, hipY - 0.04, 0.32, 0.06, 0.02); // belt

  // Neck
  ctx.fillStyle = SKIN_SHADE;
  roundRect(ctx, hx - 0.045, -1.56, 0.09, 0.15, 0.03);

  // Head (rotates when looking up)
  const neckX = hx, neckY = -1.52;
  ctx.save();
  ctx.translate(neckX, neckY);
  ctx.rotate(-0.42 * s.lookUp * f);
  ctx.translate(-neckX, -neckY);
  const headY = -EYE_HEIGHT - 0.015;
  const r = 0.118;
  ctx.fillStyle = SKIN;
  ellipse(ctx, hx, headY, r, r * 1.08);
  // Hair: covers the top of the head and the back of the head
  ctx.save();
  ctx.beginPath();
  ctx.rect(hx - 0.3, headY - 0.3, 0.6, 0.3 - 0.035);
  ctx.rect(f > 0 ? hx - 0.3 : hx + 0.02, headY - 0.3, 0.28, 0.33);
  ctx.clip();
  ctx.fillStyle = HAIR;
  ellipse(ctx, hx - 0.015 * f, headY - 0.02, r * 1.07, r * 1.02);
  ctx.restore();
  // Ear
  ctx.fillStyle = SKIN_SHADE;
  ellipse(ctx, hx - 0.02 * f, headY + 0.01, 0.025, 0.04);
  // Nose
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.92 * f, headY - 0.01);
  ctx.lineTo(hx + (r + 0.035) * f, headY + 0.03);
  ctx.lineTo(hx + r * 0.9 * f, headY + 0.045);
  ctx.closePath();
  ctx.fill();
  // Eye
  const ex = hx + 0.07 * f, ey = -EYE_HEIGHT;
  if (s.blink) {
    ctx.strokeStyle = '#3b2a22';
    ctx.lineWidth = 0.012;
    line(ctx, ex - 0.022, ey + 0.004, ex + 0.022, ey + 0.004);
  } else {
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, ex, ey, 0.026, 0.019);
    ctx.fillStyle = '#1d2645';
    circle(ctx, ex + 0.011 * f, ey - 0.006 * s.lookUp, 0.012);
    ctx.fillStyle = '#ffffff';
    circle(ctx, ex + 0.015 * f, ey - 0.004 - 0.006 * s.lookUp, 0.004);
  }
  // Eyebrow and smile
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 0.012;
  line(ctx, ex - 0.025 * f, ey - 0.042, ex + 0.028 * f, ey - 0.05);
  ctx.strokeStyle = '#9c4a3c';
  ctx.lineWidth = 0.011;
  ctx.beginPath();
  ctx.arc(hx + 0.06 * f, headY + 0.055, 0.03, f > 0 ? 0.15 * Math.PI : 0.55 * Math.PI, f > 0 ? 0.45 * Math.PI : 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // Front arm, raised a little as if gesturing at the mirror
  ctx.strokeStyle = JACKET;
  ctx.lineWidth = 0.09;
  path(ctx, [[hx + 0.05 * f, shoulderY + 0.03], [hx + 0.14 * f, -1.18], [hx + 0.27 * f, -1.12]]);
  ctx.fillStyle = SKIN;
  circle(ctx, hx + 0.29 * f, -1.115, 0.045);

  ctx.restore();
}

/** Only the head, for the small ceiling-mirror reflection. */
export function drawHead(ctx: CanvasRenderingContext2D, facing: 1 | -1, blink: boolean) {
  ctx.save();
  ctx.translate(0, EYE_HEIGHT);
  drawPerson(ctx, { facing, blink, lookUp: 1 });
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function path(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
