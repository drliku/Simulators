/**
 * Renderers for the two reference frames.
 *
 * Physical quantities (positions of the passenger, mirror, train walls and photon) are in
 * metres and drawn at a uniform scale in each view, with a scale bar. Scenery, poles and
 * the track observer's icon are illustrative and not to scale.
 */
import { C, photonInTrain, photonOnTrack, type Trip, type Orientation } from '../physics/mirror';
import { CEILING_GAP, CEILING_HEIGHT, EYE_HEIGHT, L0_MAX } from '../sim/engine';
import { drawHead, drawPerson } from './person';

export interface Panel { x: number; y: number; w: number; h: number }

/** Car interior, metres, relative to the passenger's eye (train frame). */
const CAR_REAR = -2.5;
const CAR_FRONT = L0_MAX + 0.9;
const MIRROR_W = 0.4;
const FLOOR_T = 0.34;
/** Height of the text band at the top of each view, px. */
const OVERLAY_H = 74;

const PHOTON = '255,224,102';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISPLAY = 'Brain, "Saira Semi Condensed", sans-serif';
const SANS = 'Saira, system-ui, sans-serif';

export const ns = (s: number) => `${(s * 1e9).toFixed(2)} ns`;

// ------------------------------------------------------------------ layout

function trainScale(p: Panel) {
  // Keep the top band free for the frame title, clock and status text.
  const k = Math.min((p.w - 28) / (CAR_FRONT - CAR_REAR + 0.4), (p.h - 44 - OVERLAY_H - 8) / (CEILING_HEIGHT + 0.32));
  const floorY = p.y + p.h - 44;
  const eyeX = p.x + (p.w - (CAR_FRONT - CAR_REAR) * k) / 2 - CAR_REAR * k;
  return { k, floorY, eyeX };
}

// ------------------------------------------------------------------ shared pieces

function hash(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function sky(ctx: CanvasRenderingContext2D, p: Panel) {
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  g.addColorStop(0, '#0f1631');
  g.addColorStop(0.65, '#1c2650');
  g.addColorStop(1, '#2a2f55');
  ctx.fillStyle = g;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(230,236,255,${0.2 + hash(i) * 0.5})`;
    ctx.fillRect(p.x + hash(i + 3) * p.w, p.y + hash(i + 7) * p.h * 0.5, 1.2, 1.2);
  }
}

/** City skyline and hills. `offset` scrolls them (train view); 0 keeps them still (track view). */
function skyline(ctx: CanvasRenderingContext2D, p: Panel, groundY: number, offset: number) {
  // Far buildings
  const span = 900;
  const o1 = ((offset * 0.12) % span + span) % span;
  ctx.fillStyle = 'rgba(159,176,255,0.10)';
  for (let rep = -1; rep <= Math.ceil(p.w / span) + 1; rep++) {
    let x = p.x + rep * span - o1;
    for (let i = 0; i < 18; i++) {
      const w = 26 + hash(i) * 34, h = 30 + hash(i + 50) * 90;
      ctx.fillRect(x, groundY - 46 - h, w, h + 46);
      if (hash(i + 9) > 0.55) ctx.fillRect(x + w * 0.4, groundY - 46 - h - 14, 3, 14);
      x += w + 4 + hash(i + 20) * 14;
    }
  }
  // Hills
  const o2 = offset * 0.35;
  ctx.fillStyle = '#1a2246';
  ctx.beginPath();
  ctx.moveTo(p.x, groundY);
  for (let x = 0; x <= p.w + 8; x += 8) {
    const wx = x + o2;
    const y = groundY - 34 - 16 * Math.sin(wx * 0.006) - 9 * Math.sin(wx * 0.017 + 1.3);
    ctx.lineTo(p.x + x, y);
  }
  ctx.lineTo(p.x + p.w, groundY);
  ctx.closePath();
  ctx.fill();
}

function photonDot(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
  g.addColorStop(0, `rgba(${PHOTON},0.9)`);
  g.addColorStop(0.35, `rgba(${PHOTON},0.35)`);
  g.addColorStop(1, `rgba(${PHOTON},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - 18, y - 18, 36, 36);
  ctx.fillStyle = '#fffbe6';
  ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
}

function trail(ctx: CanvasRenderingContext2D, pts: [number, number][], dashed = false) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = `rgba(${PHOTON},0.18)`;
  ctx.lineWidth = 7;
  ctx.stroke();
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.strokeStyle = `rgba(${PHOTON},0.9)`;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.restore();
}

type LabelSide = 'above' | 'below' | 'left';
function eventMarker(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, side: LabelSide, bounds?: Panel) {
  ctx.strokeStyle = `rgba(${PHOTON},0.85)`;
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `600 10px ${MONO}`;
  const w = ctx.measureText(label).width;
  let tx = side === 'left' ? x - 10 - w / 2 : x;
  // Keep the label inside its panel.
  if (bounds) tx = Math.min(Math.max(tx, bounds.x + w / 2 + 8), bounds.x + bounds.w - w / 2 - 8);
  const ty = side === 'above' ? y - 15 : side === 'below' ? y + 15 : y;
  ctx.fillStyle = 'rgba(11,16,34,0.78)';
  ctx.beginPath(); ctx.roundRect(tx - w / 2 - 4, ty - 7, w + 8, 14, 4); ctx.fill();
  ctx.fillStyle = `rgba(${PHOTON},0.95)`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx, ty + 0.5);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'top') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}

function scaleBar(ctx: CanvasRenderingContext2D, p: Panel, pxPerM: number, note?: string) {
  const options = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  const metres = options.find((m) => m * pxPerM >= 60) ?? 500;
  const len = metres * pxPerM;
  const x1 = p.x + p.w - 16, x0 = x1 - len, y = p.y + p.h - 14;
  ctx.strokeStyle = 'rgba(246,239,234,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y - 4);
  ctx.stroke();
  text(ctx, `${metres} m`, (x0 + x1) / 2, y - 6, `500 10.5px ${MONO}`, 'rgba(246,239,234,0.85)', 'center', 'bottom');
  if (note) text(ctx, note, x0 - 10, y, `10.5px ${SANS}`, 'rgba(163,172,201,0.85)', 'right', 'bottom');
}

function chip(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, align: 'left' | 'right' = 'left') {
  ctx.font = `600 11px ${SANS}`;
  const w = ctx.measureText(s).width + 16;
  const bx = align === 'left' ? x : x - w;
  ctx.fillStyle = 'rgba(11,16,34,0.82)';
  ctx.beginPath(); ctx.roundRect(bx, y, w, 22, 11); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  text(ctx, s, bx + 8, y + 11, `600 11px ${SANS}`, color, 'left', 'middle');
}

// ------------------------------------------------------------------ the car (metres)

interface CarState { L0: number; orientation: Orientation; blink: boolean; transparentWalls: boolean }

/**
 * Draw the car with its origin at the passenger's eye x, floor level, in metres
 * (y negative upwards). The caller's transform supplies the scale and any contraction.
 */
function drawCar(ctx: CanvasRenderingContext2D, s: CarState) {
  const top = -(CEILING_HEIGHT + 0.3);
  // Neighbouring cars, partially visible through the gangways
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? CAR_REAR - 0.5 - 6 : CAR_FRONT + 0.5;
    const body = ctx.createLinearGradient(0, top, 0, FLOOR_T);
    body.addColorStop(0, '#c9d1e3');
    body.addColorStop(1, '#6f7a96');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(x0, top, 6, FLOOR_T - top, 0.25); ctx.fill();
    ctx.fillStyle = '#f37064';
    ctx.fillRect(x0, 0.05, 6, 0.1);
    ctx.fillStyle = 'rgba(36,48,86,0.85)';
    for (let wx = x0 + 0.4; wx < x0 + 5.6; wx += 1.3) ctx.fillRect(wx, -2.25, 1.0, 1.0);
    ctx.fillStyle = '#4b5574';
    ctx.fillRect(dir < 0 ? CAR_REAR - 0.5 : CAR_FRONT + 0.12, -2.2, 0.38, 2.15); // gangway bellows
  }

  // Exterior shell
  const shell = ctx.createLinearGradient(0, top, 0, FLOOR_T);
  shell.addColorStop(0, '#eef2fa');
  shell.addColorStop(0.5, '#b8c1d6');
  shell.addColorStop(1, '#6b7592');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.roundRect(CAR_REAR - 0.12, top, CAR_FRONT - CAR_REAR + 0.24, FLOOR_T - top, 0.28);
  ctx.rect(CAR_REAR, -CEILING_HEIGHT, CAR_FRONT - CAR_REAR, CEILING_HEIGHT);
  ctx.fill('evenodd');

  // Interior back wall with windows cut out, so the scenery shows through
  ctx.save();
  ctx.beginPath();
  ctx.rect(CAR_REAR, -CEILING_HEIGHT, CAR_FRONT - CAR_REAR, CEILING_HEIGHT);
  for (let wx = CAR_REAR + 0.35; wx + 1.0 < CAR_FRONT - 0.2; wx += 1.32) ctx.roundRect(wx, -2.32, 1.0, 1.05, 0.12);
  ctx.fillStyle = 'rgba(30,40,76,0.94)';
  ctx.fill('evenodd');
  ctx.restore();
  ctx.fillStyle = 'rgba(159,176,255,0.07)';
  for (let wx = CAR_REAR + 0.35; wx + 1.0 < CAR_FRONT - 0.2; wx += 1.32) ctx.fillRect(wx, -2.32, 1.0, 1.05);

  // Ceiling light strip and floor
  ctx.fillStyle = 'rgba(255,241,236,0.85)';
  ctx.fillRect(CAR_REAR + 0.3, -CEILING_HEIGHT + 0.02, CAR_FRONT - CAR_REAR - 0.6, 0.035);
  const glow = ctx.createLinearGradient(0, -CEILING_HEIGHT, 0, -CEILING_HEIGHT + 0.6);
  glow.addColorStop(0, 'rgba(255,241,236,0.16)');
  glow.addColorStop(1, 'rgba(255,241,236,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(CAR_REAR, -CEILING_HEIGHT, CAR_FRONT - CAR_REAR, 0.6);
  ctx.fillStyle = '#39456f';
  ctx.fillRect(CAR_REAR, -0.05, CAR_FRONT - CAR_REAR, 0.05);
  // Grab poles
  ctx.fillStyle = 'rgba(214,222,240,0.55)';
  ctx.fillRect(CAR_REAR + 0.45, -CEILING_HEIGHT, 0.035, CEILING_HEIGHT);
  ctx.fillRect(CAR_FRONT - 0.4, -CEILING_HEIGHT, 0.035, CEILING_HEIGHT);

  // Livery
  ctx.fillStyle = '#f37064';
  ctx.fillRect(CAR_REAR - 0.12, 0.06, CAR_FRONT - CAR_REAR + 0.24, 0.1);
  ctx.fillStyle = '#243056';
  ctx.fillRect(CAR_REAR - 0.12, 0.17, CAR_FRONT - CAR_REAR + 0.24, 0.04);

  // Mirror
  if (s.orientation === 'front') drawFrontMirror(ctx, s.L0, s.blink);
  else drawCeilingMirror(ctx, s.blink);

  // Passenger
  drawPerson(ctx, { facing: 1, blink: s.blink, lookUp: s.orientation === 'above' ? 1 : 0 });

  // Cutaway near wall: glass edge and reflections
  ctx.strokeStyle = 'rgba(214,222,240,0.45)';
  ctx.lineWidth = 0.025;
  ctx.strokeRect(CAR_REAR, -CEILING_HEIGHT, CAR_FRONT - CAR_REAR, CEILING_HEIGHT);
  if (s.transparentWalls) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 3; i++) {
      const x = CAR_REAR + 0.8 + i * 2.6;
      ctx.beginPath();
      ctx.moveTo(x, -CEILING_HEIGHT); ctx.lineTo(x + 0.5, -CEILING_HEIGHT); ctx.lineTo(x - 0.4, 0); ctx.lineTo(x - 0.9, 0);
      ctx.closePath(); ctx.fill();
    }
  }

  // Bogies
  ctx.fillStyle = '#20284a';
  for (const bx of [CAR_REAR + 0.7, CAR_FRONT - 0.7]) {
    ctx.fillRect(bx - 0.55, FLOOR_T - 0.02, 1.1, 0.12);
    for (const wx of [bx - 0.32, bx + 0.32]) { ctx.beginPath(); ctx.arc(wx, FLOOR_T + 0.12, 0.15, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawFrontMirror(ctx: CanvasRenderingContext2D, L0: number, blink: boolean) {
  const x0 = L0, x1 = L0 + MIRROR_W, top = -2.3, bottom = -0.45;
  // Stand
  ctx.fillStyle = '#8c96b2';
  ctx.fillRect(x0 + MIRROR_W / 2 - 0.025, bottom, 0.05, -bottom);
  ctx.fillRect(x0 - 0.05, -0.04, MIRROR_W + 0.1, 0.04);
  // Frame and glass
  ctx.fillStyle = '#d7dded';
  ctx.beginPath(); ctx.roundRect(x0 - 0.04, top - 0.04, MIRROR_W + 0.08, bottom - top + 0.08, 0.05); ctx.fill();
  const glass = ctx.createLinearGradient(x0, top, x1, bottom);
  glass.addColorStop(0, '#b9c7ee');
  glass.addColorStop(0.5, '#7f91c8');
  glass.addColorStop(1, '#5b6ba3');
  ctx.fillStyle = glass;
  ctx.fillRect(x0, top, MIRROR_W, bottom - top);
  // Reflection: the passenger seen in the glass, facing back toward him
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, top, MIRROR_W, bottom - top); ctx.clip();
  ctx.translate(x0 + MIRROR_W / 2 + 0.03, -0.8);
  ctx.scale(0.5, 0.5);
  drawPerson(ctx, { facing: -1, blink, lookUp: 0, alpha: 0.92 });
  ctx.restore();
  // Sheen
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x0 + 0.06, top); ctx.lineTo(x0 + 0.16, top); ctx.lineTo(x0 + 0.02, top + 0.6); ctx.lineTo(x0, top + 0.6);
  ctx.closePath(); ctx.fill();
  // The reflecting surface faces the passenger
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x0 - 0.012, top, 0.024, bottom - top);
}

function drawCeilingMirror(ctx: CanvasRenderingContext2D, blink: boolean) {
  const face = -(EYE_HEIGHT + CEILING_GAP);
  const x0 = -0.55, w = 1.1, top = -CEILING_HEIGHT;
  ctx.fillStyle = '#d7dded';
  ctx.fillRect(x0 - 0.04, top, w + 0.08, face - top + 0.02);
  const glass = ctx.createLinearGradient(x0, top, x0 + w, face);
  glass.addColorStop(0, '#b9c7ee');
  glass.addColorStop(1, '#5b6ba3');
  ctx.fillStyle = glass;
  ctx.fillRect(x0, top + 0.02, w, face - top - 0.02);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, top + 0.02, w, face - top - 0.02); ctx.clip();
  ctx.translate(0, (top + face) / 2 + 0.01);
  ctx.scale(0.32, -0.32);
  drawHead(ctx, 1, blink);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x0, face - 0.012, w, 0.024);
}

// ------------------------------------------------------------------ train view

export interface TrainViewState {
  trip: Trip;
  tPrime: number;
  L0: number;
  blink: boolean;
  scenery: number;
  speech: string;
}

export function renderTrainView(ctx: CanvasRenderingContext2D, p: Panel, s: TrainViewState) {
  const { k, floorY, eyeX } = trainScale(p);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 14); ctx.clip();
  sky(ctx, p);
  const offset = s.scenery * 60;
  skyline(ctx, p, floorY + FLOOR_T * k, offset);

  // Catenary masts rush past (illustrative speed)
  const speed = Math.min(1, s.trip.beta * 1.05);
  const spacing = 300;
  const o = ((offset % spacing) + spacing) % spacing;
  for (let x = p.x - o; x < p.x + p.w + spacing; x += spacing) {
    const blur = 3 + speed * 70;
    const grad = ctx.createLinearGradient(x, 0, x + blur, 0);
    grad.addColorStop(0, 'rgba(120,132,170,0)');
    grad.addColorStop(0.5, `rgba(120,132,170,${0.75 - speed * 0.45})`);
    grad.addColorStop(1, 'rgba(120,132,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, p.y + 16, blur, floorY - p.y + FLOOR_T * k - 16);
  }

  // Track rushing past
  const railY = floorY + (FLOOR_T + 0.27) * k;
  ctx.fillStyle = '#151b38';
  ctx.fillRect(p.x, railY, p.w, p.y + p.h - railY);
  const sl = 26;
  const so = ((offset * 1.0) % sl + sl) % sl;
  ctx.fillStyle = `rgba(110,120,160,${0.6 - speed * 0.4})`;
  for (let x = p.x - so; x < p.x + p.w; x += sl) ctx.fillRect(x, railY + 2, 12 + speed * 12, 5);
  ctx.fillStyle = '#a4adc9';
  ctx.fillRect(p.x, railY - 1, p.w, 3);

  // The car, at rest in this frame
  ctx.save();
  ctx.translate(eyeX, floorY);
  ctx.scale(k, k);
  drawCar(ctx, { L0: s.L0, orientation: s.trip.orientation, blink: s.blink, transparentWalls: true });
  ctx.restore();

  // Photon in the train frame
  const toScreen = (x: number, y: number): [number, number] => [eyeX + x * k, floorY - (EYE_HEIGHT + y) * k];
  const ph = photonInTrain(s.trip, s.tPrime);
  const [e0, e1] = s.trip.train;
  const P0 = toScreen(e0.x, e0.y), P1 = toScreen(e1.x, e1.y), Pn = toScreen(ph.x, ph.y);
  if (ph.leg === 'outbound') trail(ctx, [P0, Pn]);
  else {
    trail(ctx, [P0, P1]);
    trail(ctx, [P1, Pn], true);
    eventMarker(ctx, P1[0], P1[1], 'reflection', s.trip.orientation === 'above' ? 'below' : 'above');
  }
  eventMarker(ctx, P0[0], P0[1], ph.leg === 'arrived' ? 'return' : 'departure', 'left');
  if (ph.leg !== 'arrived') photonDot(ctx, Pn[0], Pn[1]);

  // Speech bubble
  speechBubble(ctx, eyeX - 0.1 * k, floorY - (EYE_HEIGHT + 0.25) * k, s.speech, p);

  // Overlays
  const status = ph.leg === 'outbound' ? 'Photon → mirror' : ph.leg === 'returning' ? 'Photon → eyes' : 'Back at his eyes';
  header(ctx, p, 'INSIDE THE TRAIN', '#ffb4a8', 'Train frame · the train is at rest', `t′ = ${ns(s.tPrime)}`, status);
  scaleBar(ctx, p, k);
  ctx.restore();
}

/** Title, frame, clock and status in a band above the scene; extra detail only when there is room. */
function header(ctx: CanvasRenderingContext2D, p: Panel, title: string, color: string, frame: string, clock: string, status: string) {
  const wide = p.w >= 620;
  ctx.fillStyle = 'rgba(11,16,34,0.55)';
  ctx.fillRect(p.x, p.y, p.w, OVERLAY_H);
  text(ctx, title, p.x + 16, p.y + 12, `16px ${DISPLAY}`, color);
  text(ctx, frame, p.x + 16, p.y + 32, `11.5px ${SANS}`, 'rgba(163,172,201,0.95)');
  text(ctx, clock, p.x + 16, p.y + 51, `600 14px ${MONO}`, '#fff3b0');
  if (wide) {
    ctx.font = `600 14px ${MONO}`;
    const cw = ctx.measureText(clock).width;
    text(ctx, `· ${status}`, p.x + 24 + cw, p.y + 53, `11.5px ${MONO}`, 'rgba(246,239,234,0.85)');
  }
  chip(ctx, '✓ Reflection visible', p.x + p.w - 14, p.y + 12, '#6ee7b7', 'right');
  if (wide) chip(ctx, 'light speed measured: c', p.x + p.w - 14, p.y + 40, '#fff3b0', 'right');
}

function speechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, msg: string, p: Panel) {
  ctx.font = `600 13px ${SANS}`;
  const w = ctx.measureText(msg).width + 22;
  const h = 30;
  const bx = Math.max(p.x + 8, Math.min(x - w + 30, p.x + p.w - w - 8));
  const by = Math.max(p.y + OVERLAY_H + 6, y - h - 22);
  ctx.fillStyle = 'rgba(255,248,244,0.96)';
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, 12); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(Math.min(Math.max(x - 10, bx + 12), bx + w - 20), by + h);
  ctx.lineTo(x + 2, Math.max(by + h + 12, y - 6));
  ctx.lineTo(Math.min(Math.max(x + 6, bx + 20), bx + w - 10), by + h);
  ctx.closePath(); ctx.fill();
  text(ctx, msg, bx + 11, by + h / 2 + 1, `600 13px ${SANS}`, '#243056', 'left', 'middle');
}

// ------------------------------------------------------------------ track view

export interface TrackViewState { trip: Trip; t: number; L0: number; blink: boolean }

/** World range (metres, track frame) that keeps the whole trip and the moving car in view. */
function trackRange(trip: Trip) {
  const g = trip.gamma, v = trip.beta * C;
  const end = trip.trackRoundTrip;
  const lo = Math.min(CAR_REAR / g, 0) - 0.5;
  const hi = Math.max(v * end + CAR_FRONT / g, ...trip.track.map((e) => e.x)) + 0.5;
  return { lo, hi };
}

export function trackScale(p: Panel, trip: Trip) {
  const { k: kTrain, floorY } = trainScale(p);
  const { lo, hi } = trackRange(trip);
  const avail = p.w - 40;
  const k = Math.min(kTrain, avail / (hi - lo));
  const x0 = p.x + 20 + (avail - (hi - lo) * k) / 2 - lo * k;
  return { k, floorY, x0, zoom: kTrain / k };
}

export function renderTrackView(ctx: CanvasRenderingContext2D, p: Panel, s: TrackViewState) {
  const { trip } = s;
  const { k, floorY, x0, zoom } = trackScale(p, trip);
  const X = (x: number) => x0 + x * k;
  const Y = (y: number) => floorY - (EYE_HEIGHT + y) * k;
  const g = trip.gamma, v = trip.beta * C;

  ctx.save();
  ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 14); ctx.clip();
  sky(ctx, p);
  const groundY = floorY + FLOOR_T * k;
  skyline(ctx, p, Math.max(groundY, p.y + p.h - 40), 0);

  // Track, at rest: sleepers every 0.75 m of real track
  const railY = floorY + (FLOOR_T + 0.27) * k;
  ctx.fillStyle = '#151b38';
  ctx.fillRect(p.x, railY, p.w, p.y + p.h - railY);
  const sleeper = 0.75;
  const every = Math.max(1, Math.ceil(5 / (sleeper * k)));
  ctx.fillStyle = 'rgba(110,120,160,0.55)';
  const first = Math.floor((p.x - x0) / (sleeper * k));
  for (let i = first; X(i * sleeper) < p.x + p.w; i++) {
    if (i % every === 0) ctx.fillRect(X(i * sleeper) - 3, railY + 2, 6, 5);
  }
  ctx.fillStyle = '#a4adc9';
  ctx.fillRect(p.x, railY - 1, p.w, 3);

  // The departure point stays fixed on the track
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(255,224,102,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(0), railY + 10); ctx.lineTo(X(0), Y(0)); ctx.stroke();
  ctx.restore();

  // The moving, length-contracted car: eye at x = v t, every length along x divided by γ
  ctx.save();
  ctx.translate(X(v * s.t), floorY);
  ctx.scale(k / g, k);
  drawCar(ctx, { L0: s.L0, orientation: trip.orientation, blink: s.blink, transparentWalls: false });
  ctx.restore();

  // Track observer (illustrative icon, not to scale)
  ctx.save();
  ctx.translate(p.x + 20, p.y + p.h - 10);
  ctx.scale(28, 28);
  drawPerson(ctx, { facing: 1, blink: s.blink, lookUp: 0 });
  ctx.restore();

  // Photon path in the track frame
  const ph = photonOnTrack(trip, s.t);
  const [e0, e1, e2] = trip.track;
  const P0: [number, number] = [X(e0.x), Y(e0.y)];
  const P1: [number, number] = [X(e1.x), Y(e1.y)];
  const Pn: [number, number] = [X(ph.x), Y(ph.y)];
  if (ph.leg === 'outbound') trail(ctx, [P0, Pn]);
  else {
    trail(ctx, [P0, P1]);
    trail(ctx, [P1, Pn], true);
    // Where the mirror was when the photon hit it
    eventMarker(ctx, P1[0], P1[1], 'reflection', trip.orientation === 'above' ? 'below' : 'above', p);
  }
  eventMarker(ctx, P0[0], P0[1], 'departure', P0[0] - p.x > 110 ? 'left' : 'below', p);
  if (ph.leg === 'arrived') eventMarker(ctx, X(e2.x), Y(e2.y), 'return', 'below', p);
  else photonDot(ctx, Pn[0], Pn[1]);

  // Labels for the passenger and mirror when the zoomed-out car is small: stacked to the
  // left of the car so they never run off the panel.
  if (k < 60) {
    const eyeNow = X(v * s.t);
    const mirrorX = trip.orientation === 'front' ? X(v * s.t + s.L0 / g) : eyeNow;
    const mirrorY = trip.orientation === 'front' ? Y(0.3) : Y(CEILING_GAP);
    const tagX = Math.max(p.x + 90, Math.min(eyeNow, mirrorX) - 14);
    const baseY = Y(CEILING_HEIGHT - EYE_HEIGHT) - 16;
    leader(ctx, mirrorX, mirrorY, tagX, baseY - 18, 'mirror');
    leader(ctx, eyeNow, Y(0), tagX, baseY, 'passenger');
  }

  // Overlays
  const status = ph.leg === 'outbound'
    ? trip.orientation === 'front' ? 'Photon chasing the receding mirror' : 'Photon rising on a diagonal'
    : ph.leg === 'returning'
      ? trip.orientation === 'front' ? 'Photon meeting the oncoming passenger' : 'Photon descending on a diagonal'
      : 'Back at his eyes';
  header(ctx, p, 'TRACK OBSERVER', '#c3cdff', `Track frame · train moving at ${(trip.beta * 100).toFixed(1)}% of c`, `t = ${ns(s.t)}`, status);
  scaleBar(ctx, p, k, zoom > 1.05 ? `zoomed out ×${zoom.toFixed(1)} to fit the trip` : undefined);
  ctx.restore();
}

function leader(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, label: string) {
  ctx.strokeStyle = 'rgba(246,239,234,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ty); ctx.lineTo(tx + 4, ty); ctx.stroke();
  ctx.fillStyle = 'rgba(246,239,234,0.9)';
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  text(ctx, label, tx, ty, `11px ${SANS}`, 'rgba(246,239,234,0.9)', 'right', 'middle');
}
