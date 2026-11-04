import { useRef } from 'react';
import { useEngine, useSim, useSimFrame } from '../sim/context';
import { derive } from '../sim/derive';
import { useCanvas } from '../hooks/useCanvas';
import { prefersReducedMotion, useElementSize } from '../hooks/useElementSize';
import {
  UNIT_SECONDS, formatBreakdown, formatInUnit, formatPercentC, preciseClockPair, withThousands, type TimeUnit,
} from '../physics/format';
import { properTime } from '../physics/relativity';
import { clamp, drawEarth, drawGrid, drawObserver, drawShip, drawStaticStars, fmtTick, makeStars, niceStep } from './draw';
import { Term } from './Term';
import { TIPS } from './tips';

const UNIT_LABEL: Record<TimeUnit, string> = {
  seconds: 'seconds', minutes: 'minutes', hours: 'hours', days: 'days', years: 'years',
};
const LIGHT_UNIT: Record<TimeUnit, string> = {
  seconds: 'light-seconds', minutes: 'light-minutes', hours: 'light-hours', days: 'light-days', years: 'light-years',
};
const DECIMALS: Record<TimeUnit, number> = { seconds: 2, minutes: 2, hours: 3, days: 3, years: 4 };

/** Geometry shared by the canvas drawing and the DOM clock overlay. */
function earthGeom(w: number, h: number) {
  const compact = w < 640;
  const R = compact ? 22 : clamp(h * 0.19, 26, 44);
  const ex = compact ? 42 : clamp(w * 0.07, 54, 96);
  return {
    compact, R, ex,
    ey: compact ? h * 0.62 : h * 0.42,
    scaleY: h - 44,
    x0: ex,
    x1: w - (compact ? 22 : 34),
    clockLeft: ex + R + 40,
  };
}

function shipGeom(w: number, h: number) {
  const compact = w < 640;
  const s = compact ? 10 : clamp(h * 0.085, 12, 19);
  const sx = compact ? w * 0.36 : clamp(w * 0.17, 96, 200);
  return { compact, s, sx, sy: compact ? h * 0.68 : h * 0.5, clockLeft: sx + 3.3 * s + 40 };
}

// ------------------------------------------------------------------ Clocks

function DigitalClock({
  tone, label, sub, value, unit, secondary,
}: { tone: 'earth' | 'ship'; label: string; sub: React.ReactNode; value: string; unit: string; secondary: string }) {
  const c = tone === 'earth'
    ? { border: 'border-earth/35', label: 'text-earth-soft', glow: 'shadow-[0_0_40px_rgba(159,176,255,0.12)]', text: 'text-[#eef1ff] [text-shadow:0_0_22px_rgba(159,176,255,0.45)]' }
    : { border: 'border-ship/40', label: 'text-ship-soft', glow: 'shadow-[0_0_40px_rgba(243,112,100,0.12)]', text: 'text-[#fff1ec] [text-shadow:0_0_22px_rgba(243,112,100,0.45)]' };
  return (
    <div className={`rounded-xl border ${c.border} ${c.glow} bg-space-950/75 px-4 py-3 backdrop-blur-md`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-display text-[16px] font-normal uppercase tracking-[0.12em] ${c.label}`}>{label}</span>
        <span className="truncate text-[11px] text-ink-faint">{sub}</span>
      </div>
      <div className={`clock-value mt-1 font-display text-[36px] leading-none sm:text-[46px] ${c.text}`}>
        {[...value].map((ch, i) => (
          <span key={i} className={/\d/.test(ch) ? 'digit' : undefined}>{ch}</span>
        ))}
        <span className="ml-2 font-sans text-sm font-normal text-ink-muted">{unit}</span>
      </div>
      <div className="mt-1.5 font-mono text-[11.5px] tabular-nums text-ink-muted">{secondary}</div>
    </div>
  );
}

function EarthClock() {
  const e = useSimFrame();
  const d = derive(e);
  const shipFrame = e.frame === 'ship';
  const value = shipFrame ? d.earthInShipFrame : d.earthTime;
  const precise = !shipFrame && d.earthTime > 0 && d.difference < 1e-3;
  return (
    <DigitalClock
      tone="earth"
      label="Earth Time"
      sub={shipFrame ? 'reading simultaneous in ship frame' : 'Observer A · at rest'}
      value={formatInUnit(value, d.unit, DECIMALS[d.unit])}
      unit={UNIT_LABEL[d.unit]}
      secondary={precise ? preciseClockPair(d.earthTime, d.difference).earth : formatBreakdown(value)}
    />
  );
}

function ShipClock() {
  const e = useSimFrame();
  const d = derive(e);
  const precise = e.frame === 'earth' && d.earthTime > 0 && d.difference < 1e-3;
  return (
    <DigitalClock
      tone="ship"
      label="Spaceship Time"
      sub={e.frame === 'ship' ? 'Observer B · at rest' : 'Observer B · proper time'}
      value={formatInUnit(d.shipTime, d.unit, DECIMALS[d.unit])}
      unit={UNIT_LABEL[d.unit]}
      secondary={precise ? preciseClockPair(d.earthTime, d.difference).ship : formatBreakdown(d.shipTime)}
    />
  );
}

// ------------------------------------------------------------------ Earth lane

function EarthLane() {
  const engine = useEngine();
  const frame = useSim((e) => e.frame);
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const stars = useRef(makeStars(70, 7));
  const anim = useRef({ spin: 0, time: 0 });

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const e = engine;
    const d = derive(e);
    const g = earthGeom(w, h);
    const a = anim.current;
    a.time += dt;
    if (e.running && !prefersReducedMotion()) a.spin += dt * 0.08;

    drawGrid(ctx, w, h);
    drawStaticStars(ctx, stars.current, w, h, a.time);

    const u = UNIT_SECONDS[d.unit];
    const shipFrame = e.frame === 'ship';
    // Light distance over the whole experiment in the viewed frame sets the scale.
    const frameDuration = shipFrame ? properTime(d.duration, d.beta) : d.duration;
    const Lmax = frameDuration / u;
    const frameNow = shipFrame ? d.shipTime : d.earthTime;
    const lightFrac = frameDuration > 0 ? frameNow / frameDuration : 0;
    const bodyFrac = d.beta * lightFrac; // ship (Earth frame) or Earth (ship frame)

    const { x0, x1, scaleY } = g;
    const len = x1 - x0;

    // Scale bar
    ctx.strokeStyle = 'rgba(148,163,196,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, scaleY + 0.5); ctx.lineTo(x1, scaleY + 0.5); ctx.stroke();
    const step = niceStep(Lmax, g.compact ? 3 : 6);
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(148,163,196,0.8)';
    for (let v = 0; v <= Lmax * 1.0001; v += step) {
      const f = v / Lmax;
      const x = shipFrame ? x1 - f * len : x0 + f * len;
      ctx.beginPath(); ctx.moveTo(x, scaleY - 4); ctx.lineTo(x, scaleY + 4); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(fmtTick(v, step), x, scaleY + 7);
    }
    // Axis caption on its own line below the tick labels, clear of every marker.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(148,163,196,0.6)';
    ctx.font = '10.5px Saira, sans-serif';
    ctx.fillText(`Distance from ${shipFrame ? 'the ship, in the ship frame' : 'Earth, in the Earth frame'} (${LIGHT_UNIT[d.unit]})`, (x0 + x1) / 2, h - 5);
    ctx.font = '10.5px "JetBrains Mono", monospace';

    const posOf = (f: number) => (shipFrame ? x1 - f * len : x0 + f * len);

    // Light front: where a flash sent at departure would be now.
    const lx = posOf(lightFrac);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(195,205,255,0.75)';
    ctx.beginPath(); ctx.moveTo(lx, scaleY - 18); ctx.lineTo(lx, scaleY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(195,205,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '10px Saira, sans-serif';
    if (lightFrac > 0.02) ctx.fillText('light', lx, scaleY - 19);

    if (!shipFrame) {
      // Earth at rest, ship moving right along the scale.
      drawEarth(ctx, g.ex, g.ey, g.R, a.spin);
      drawObserver(ctx, g.ex - g.R * 0.15, g.ey - g.R * 0.98, Math.max(5, g.R * 0.22), '#c3cdff', 'A');
      const sx = posOf(bodyFrac);
      const trail = ctx.createLinearGradient(x0, 0, sx, 0);
      trail.addColorStop(0, 'rgba(243,112,100,0.05)');
      trail.addColorStop(1, 'rgba(243,112,100,0.8)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, scaleY + 0.5); ctx.lineTo(sx, scaleY + 0.5); ctx.stroke();
      drawShipMarker(ctx, sx, scaleY);
    } else {
      // Ship at rest at the right end; Earth recedes to the left at −v.
      const exNow = posOf(bodyFrac);
      const r = g.R * 0.75;
      drawEarth(ctx, exNow, g.ey, r, a.spin);
      drawObserver(ctx, exNow - r * 0.15, g.ey - r * 0.98, Math.max(4.5, r * 0.22), '#c3cdff', 'A');
      ctx.strokeStyle = 'rgba(195,205,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, scaleY + 0.5); ctx.lineTo(exNow, scaleY + 0.5); ctx.stroke();
      drawShipMarker(ctx, x1, scaleY);
      ctx.fillStyle = 'rgba(195,205,255,0.9)';
      ctx.beginPath(); ctx.arc(exNow, scaleY + 0.5, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  });

  const g = earthGeom(size.width, size.height);
  return (
    <div ref={wrapRef} className="relative h-[250px] overflow-hidden sm:h-[230px]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className="absolute top-3 w-[min(340px,calc(100%-24px))]"
        // In the ship frame Earth recedes leftwards, so the card moves right to keep Earth in view.
        style={g.compact ? { left: 12 } : frame === 'ship' ? { right: 16 } : { left: g.clockLeft }}
      >
        <EarthClock />
      </div>
    </div>
  );
}

function drawShipMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
  glow.addColorStop(0, 'rgba(243,112,100,0.55)');
  glow.addColorStop(1, 'rgba(243,112,100,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 14, y - 14, 28, 28);
  ctx.fillStyle = '#ff9488';
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 0.5); ctx.lineTo(x - 5, y - 5); ctx.lineTo(x - 2, y + 0.5); ctx.lineTo(x - 5, y + 6);
  ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------------ Ship lane

function ShipLane() {
  const engine = useEngine();
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const layers = useRef([makeStars(60, 11), makeStars(40, 23), makeStars(22, 37)]);
  const anim = useRef({ offsets: [0, 0, 0], time: 0, thrust: 0 });

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const e = engine;
    const a = anim.current;
    const g = shipGeom(w, h);
    a.time += dt;
    const moving = e.running && e.beta > 0;
    // Visual scroll speed only hints at motion; it is not to scale with the real velocity.
    const visual = moving && !prefersReducedMotion() ? 30 + 900 * Math.pow(e.beta, 1.4) : 0;
    const target = moving ? 0.25 + 0.75 * e.beta : 0.05;
    a.thrust += (target - a.thrust) * Math.min(1, dt * 4);

    drawGrid(ctx, w, h);
    const factors = [0.18, 0.45, 1];
    layers.current.forEach((stars, i) => {
      a.offsets[i] = (a.offsets[i] + visual * factors[i] * dt) % (w + 40);
      const streak = Math.max(1, (visual / 900) * 26 * factors[i]);
      for (const st of stars) {
        const x = (((st.x * (w + 40) - a.offsets[i]) % (w + 40)) + (w + 40)) % (w + 40) - 20;
        const y = st.y * h;
        ctx.fillStyle = `rgba(226,236,255,${st.a * (0.5 + 0.5 * factors[i])})`;
        if (streak > 1.5) ctx.fillRect(x, y, streak, Math.max(0.8, st.r * 0.8));
        else ctx.fillRect(x, y, st.r, st.r);
      }
    });

    const bob = Math.sin(a.time * 1.4) * 1.5;
    drawShip(ctx, g.sx, g.sy + bob, g.s, a.thrust, a.time);
    // Observer B badge above the cockpit
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bx = g.sx + 1.9 * g.s, by = g.sy + bob - 0.95 * g.s - 9;
    ctx.fillStyle = 'rgba(5,10,24,0.85)';
    ctx.beginPath(); ctx.roundRect(bx - 8, by - 8, 16, 16, 4); ctx.fill();
    ctx.strokeStyle = '#ffb4a8'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffb4a8';
    ctx.fillText('B', bx, by + 0.5);
  });

  const g = shipGeom(size.width, size.height);
  return (
    <div ref={wrapRef} className="relative h-[250px] overflow-hidden sm:h-[230px]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="absolute top-3 w-[min(340px,calc(100%-24px))]" style={{ left: g.compact ? 12 : g.clockLeft }}>
        <ShipClock />
      </div>
      <VelocityBadge />
    </div>
  );
}

function VelocityBadge() {
  const beta = useSim((e) => e.beta);
  const frame = useSim((e) => e.frame);
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-ship/30 bg-space-950/80 px-3 py-1.5 font-mono text-[12px] text-ship-soft backdrop-blur">
      <span className="text-ink-faint">{frame === 'earth' ? 'v =' : 'Earth moves at −v,'}</span>
      <span className="font-semibold">{formatPercentC(beta)} c</span>
      <span className="hidden text-ink-faint sm:inline">· {withThousands((beta * 299_792_458) / 1000, beta < 0.001 ? 6 : 0)} km/s</span>
    </div>
  );
}

// ------------------------------------------------------------------ Stage

function StageHeader() {
  const e = useSimFrame();
  const d = derive(e);
  const status = e.running ? 'Running' : e.finished ? 'Complete' : e.earthTime > 0 ? 'Paused' : 'Ready';
  const statusColor = e.running ? 'bg-emerald-400' : e.finished ? 'bg-ship' : 'bg-ink-faint';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[11px] text-ink">
          <span className={`h-1.5 w-1.5 rounded-full ${statusColor} ${e.running ? 'animate-pulse' : ''}`} />
          {status}
        </span>
        <span className="text-[12.5px] text-ink-muted">
          Viewing the{' '}
          <Term tip={TIPS.frame}>
            <b className={e.frame === 'earth' ? 'text-earth-soft' : 'text-ship-soft'}>{e.frame === 'earth' ? "Earth's frame" : "ship's frame"}</b>
          </Term>
        </span>
      </div>
      <div className="flex min-w-[180px] flex-1 items-center gap-3 sm:max-w-[320px]">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-earth-deep via-earth to-ship" style={{ width: `${(d.progress * 100).toFixed(2)}%` }} />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">{(d.progress * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function SimulationStage() {
  return (
    <section className="glass overflow-hidden" aria-label="Earth and spaceship clocks">
      <StageHeader />
      <EarthLane />
      <div className="relative h-px bg-gradient-to-r from-earth/30 via-white/10 to-ship/40" />
      <ShipLane />
      <p className="border-t border-white/[0.06] px-4 py-2.5 text-[12px] leading-relaxed text-ink-faint">
        Both clocks start at zero as the ship passes Earth (event O). They then show the time between O and the ship's current
        event E. Star motion and markers are illustrations; the scale bar and clocks are exact.
      </p>
    </section>
  );
}
