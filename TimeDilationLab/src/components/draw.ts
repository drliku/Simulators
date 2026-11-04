/** Canvas drawing helpers shared by the simulation views. All sizes are in CSS pixels. */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface Star { x: number; y: number; r: number; a: number; tw: number }

/** Deterministic star field in unit coordinates, so resizes don't reshuffle it. */
export function makeStars(count: number, seed: number): Star[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: count }, () => ({
    x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.1, a: 0.25 + rnd() * 0.6, tw: rnd() * Math.PI * 2,
  }));
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step = 32) {
  ctx.strokeStyle = 'rgba(148,163,196,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0.5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0.5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}

export function drawStaticStars(ctx: CanvasRenderingContext2D, stars: Star[], w: number, h: number, time: number) {
  for (const st of stars) {
    const a = st.a * (0.75 + 0.25 * Math.sin(time * 1.3 + st.tw));
    ctx.fillStyle = `rgba(226,236,255,${a})`;
    ctx.fillRect(st.x * w, st.y * h, st.r, st.r);
  }
}

/** Earth with oceans, landmasses, clouds, terminator and a cyan atmosphere. */
export function drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, spin: number) {
  const glow = ctx.createRadialGradient(x, y, R * 0.85, x, y, R * 1.75);
  glow.addColorStop(0, 'rgba(159,176,255,0.38)');
  glow.addColorStop(1, 'rgba(159,176,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, R * 1.75, 0, Math.PI * 2); ctx.fill();

  const ocean = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
  ocean.addColorStop(0, '#7dd3fc');
  ocean.addColorStop(0.45, '#2563eb');
  ocean.addColorStop(1, '#0b2a6b');
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = ocean;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);

  // Landmasses drift with the spin and wrap around the disc.
  const lands: [number, number, number, number][] = [
    [-0.55, -0.25, 0.42, 0.28], [-0.2, 0.3, 0.3, 0.22], [0.35, -0.45, 0.28, 0.18],
    [0.6, 0.15, 0.36, 0.26], [1.05, -0.1, 0.3, 0.35], [1.4, 0.4, 0.25, 0.16],
  ];
  ctx.fillStyle = 'rgba(45,212,191,0.55)';
  for (const [lx, ly, rx, ry] of lands) {
    let px = ((lx + spin) % 2.4 + 2.4) % 2.4 - 1.2;
    ctx.beginPath();
    ctx.ellipse(x + px * R, y + ly * R, rx * R, ry * R, 0.3, 0, Math.PI * 2);
    ctx.fill();
    px = px - 2.4;
    ctx.beginPath();
    ctx.ellipse(x + px * R, y + ly * R, rx * R, ry * R, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (const [cx, cy, rx] of [[-0.1, -0.6, 0.5], [0.3, 0.55, 0.45], [-0.6, 0.2, 0.3]] as const) {
    const px = ((cx + spin * 1.3) % 2.4 + 2.4) % 2.4 - 1.2;
    ctx.beginPath(); ctx.ellipse(x + px * R, y + cy * R, rx * R, 0.07 * R, 0, 0, Math.PI * 2); ctx.fill();
  }
  const shade = ctx.createLinearGradient(x - R, y, x + R, y);
  shade.addColorStop(0, 'rgba(2,6,23,0)');
  shade.addColorStop(0.55, 'rgba(2,6,23,0.05)');
  shade.addColorStop(1, 'rgba(2,6,23,0.65)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  ctx.restore();

  ctx.strokeStyle = 'rgba(195,205,255,0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
}

/** A small standing observer with a label badge. */
export function drawObserver(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, label: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, size * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y - size * 1.55, size * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.2); ctx.lineTo(x, y - size * 0.45);
  ctx.moveTo(x - size * 0.45, y - size * 0.95); ctx.lineTo(x + size * 0.45, y - size * 0.95);
  ctx.moveTo(x, y - size * 0.45); ctx.lineTo(x - size * 0.35, y);
  ctx.moveTo(x, y - size * 0.45); ctx.lineTo(x + size * 0.35, y);
  ctx.stroke();
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bx = x + size * 1.3, by = y - size * 1.6;
  ctx.fillStyle = 'rgba(5,10,24,0.85)';
  ctx.beginPath(); ctx.roundRect(bx - 8, by - 8, 16, 16, 4); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, bx, by + 0.5);
}

/**
 * A detailed ship pointing right, centred at (x, y). `s` is half the hull height; the hull
 * spans about 5.6s. `thrust` (0–1) sets the exhaust length.
 */
export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, thrust: number, time: number) {
  // Exhaust plume
  if (thrust > 0.001) {
    const flick = 0.9 + 0.1 * Math.sin(time * 37) + 0.05 * Math.sin(time * 91);
    const len = s * (1.4 + 5.5 * thrust) * flick;
    const rx = x - 2.95 * s;
    const plume = ctx.createLinearGradient(rx, y, rx - len, y);
    plume.addColorStop(0, 'rgba(255,241,236,0.95)');
    plume.addColorStop(0.25, 'rgba(255,148,136,0.75)');
    plume.addColorStop(0.6, 'rgba(224,86,74,0.35)');
    plume.addColorStop(1, 'rgba(224,86,74,0)');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(rx, y - 0.34 * s);
    ctx.quadraticCurveTo(rx - len * 0.45, y - 0.42 * s, rx - len, y);
    ctx.quadraticCurveTo(rx - len * 0.45, y + 0.42 * s, rx, y + 0.34 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Fins
  const fin = ctx.createLinearGradient(0, y - 1.35 * s, 0, y + 1.35 * s);
  fin.addColorStop(0, '#ff9488');
  fin.addColorStop(0.5, '#b8443a');
  fin.addColorStop(1, '#ff9488');
  ctx.fillStyle = fin;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x - 2.4 * s, y + dir * 0.5 * s);
    ctx.lineTo(x - 3.05 * s, y + dir * 1.38 * s);
    ctx.lineTo(x - 2.35 * s, y + dir * 1.38 * s);
    ctx.lineTo(x - 1.2 * s, y + dir * 0.5 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Engine block and nozzle
  ctx.fillStyle = '#2f3749';
  ctx.beginPath(); ctx.roundRect(x - 3.0 * s, y - 0.4 * s, 0.5 * s, 0.8 * s, 0.1 * s); ctx.fill();
  ctx.fillStyle = `rgba(255,148,136,${0.35 + 0.6 * thrust})`;
  ctx.fillRect(x - 3.02 * s, y - 0.28 * s, 0.08 * s, 0.56 * s);
  // Hull
  const hull = ctx.createLinearGradient(0, y - 0.6 * s, 0, y + 0.6 * s);
  hull.addColorStop(0, '#f1f5fb');
  hull.addColorStop(0.45, '#a7b1c6');
  hull.addColorStop(1, '#4a546a');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(x - 2.6 * s, y - 0.56 * s);
  ctx.lineTo(x + 1.2 * s, y - 0.56 * s);
  ctx.quadraticCurveTo(x + 2.6 * s, y - 0.52 * s, x + 3.05 * s, y);
  ctx.quadraticCurveTo(x + 2.6 * s, y + 0.52 * s, x + 1.2 * s, y + 0.56 * s);
  ctx.lineTo(x - 2.6 * s, y + 0.56 * s);
  ctx.closePath();
  ctx.fill();
  // Panel lines and amber livery stripe
  ctx.strokeStyle = 'rgba(15,23,42,0.35)';
  ctx.lineWidth = 1;
  for (const px of [-1.7, -0.4, 0.9]) {
    ctx.beginPath(); ctx.moveTo(x + px * s, y - 0.55 * s); ctx.lineTo(x + px * s, y + 0.55 * s); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(243,112,100,0.9)';
  ctx.fillRect(x - 2.5 * s, y + 0.12 * s, 3.4 * s, 0.13 * s);
  // Portholes
  ctx.fillStyle = '#ffd6cd';
  for (const px of [-1.25, -0.85, -0.45]) {
    ctx.beginPath(); ctx.arc(x + px * s, y - 0.2 * s, 0.09 * s, 0, Math.PI * 2); ctx.fill();
  }
  // Cockpit canopy
  const glass = ctx.createLinearGradient(x + 1.3 * s, y - 0.45 * s, x + 2.5 * s, y);
  glass.addColorStop(0, '#fff1ec');
  glass.addColorStop(1, '#f37064');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.ellipse(x + 1.85 * s, y - 0.17 * s, 0.62 * s, 0.24 * s, -0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(x + 1.65 * s, y - 0.27 * s, 0.22 * s, 0.06 * s, -0.1, 0, Math.PI * 2); ctx.fill();
  // Blinking nav lights on the fin tips
  const blink = Math.sin(time * 4) > 0.6 ? 1 : 0.25;
  ctx.fillStyle = `rgba(255,180,168,${blink})`;
  ctx.beginPath(); ctx.arc(x - 2.7 * s, y - 1.38 * s, 0.09 * s + 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 2.7 * s, y + 1.38 * s, 0.09 * s + 0.6, 0, Math.PI * 2); ctx.fill();
}

/** "Nice" tick step for an axis spanning `max`. */
export function niceStep(max: number, target = 5): number {
  if (max <= 0) return 1;
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export function fmtTick(v: number, step: number): string {
  const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return v.toFixed(d);
}
