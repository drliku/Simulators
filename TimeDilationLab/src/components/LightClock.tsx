import { forwardRef, useRef, useState } from 'react';
import { useSim } from '../sim/context';
import { useCanvas } from '../hooks/useCanvas';
import { BETA_MAX, lightClockLeg, lorentzFactor } from '../physics/relativity';
import { formatGamma, formatPercentC } from '../physics/format';
import { Term } from './Term';
import { TIPS } from './tips';

export interface LightClockSettings {
  linked: boolean;
  beta: number;
  slow: boolean;
}

interface Props {
  settings: LightClockSettings;
  onChange: (s: LightClockSettings) => void;
}

/**
 * Two light clocks seen from Earth's frame. The photon always moves at the same visual
 * speed c. The moving clock's photon has to cover the diagonal, γL per leg, so each tick
 * takes γ times longer. The mirror gap is perpendicular to the motion and unchanged; only
 * the mirrors' width along the motion is contracted by 1/γ.
 */
export const LightClock = forwardRef<HTMLElement, Props>(function LightClock({ settings, onChange }, ref) {
  const shipBeta = useSim((e) => e.beta);
  const beta = settings.linked ? shipBeta : settings.beta;
  const sim = useRef({ t: 0, beta, slow: settings.slow });
  sim.current.beta = beta;
  sim.current.slow = settings.slow;
  const [ticks, setTicks] = useState({ rest: 0, moving: 0 });
  const tickRef = useRef(ticks);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const s = sim.current;
    s.t += dt;
    const b = s.beta;
    const g = lorentzFactor(b);
    const stacked = w < 720;
    const gap = 14;
    const pw = stacked ? w : (w - gap) / 2;
    const ph = stacked ? (h - gap) / 2 : h;
    const L = ph * 0.52;
    const c = L * (s.slow ? 0.32 : 1.3);            // visual light speed, px per second
    const t = s.t;

    const panels = [
      { x: 0, y: 0, moving: false },
      { x: stacked ? 0 : pw + gap, y: stacked ? ph + gap : 0, moving: true },
    ];
    let restTicks = 0, movingTicks = 0;

    for (const p of panels) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(p.x, p.y, pw, ph, 12); ctx.clip();
      ctx.fillStyle = 'rgba(2,4,11,0.55)';
      ctx.fillRect(p.x, p.y, pw, ph);
      ctx.strokeStyle = 'rgba(148,163,196,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = p.x + 0.5; gx < p.x + pw; gx += 24) { ctx.moveTo(gx, p.y); ctx.lineTo(gx, p.y + ph); }
      for (let gy = p.y + 0.5; gy < p.y + ph; gy += 24) { ctx.moveTo(p.x, gy); ctx.lineTo(p.x + pw, gy); }
      ctx.stroke();

      const top = p.y + ph * 0.24;
      const bottom = top + L;
      const M0 = Math.min(pw * 0.26, 110);
      const accent = p.moving ? '243,112,100' : '159,176,255';

      ctx.font = '14px Brain, "Saira Semi Condensed", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(${accent},0.95)`;
      // Brain draws lowercase as capitals, so the title avoids a bare "c".
      ctx.fillText(p.moving ? `MOVING AT ${formatPercentC(b)} OF LIGHT SPEED · EARTH FRAME` : 'CLOCK AT REST', p.x + 14, p.y + 12);

      if (!p.moving) {
        const cx = p.x + pw / 2;
        const phase = (t * c) % (2 * L);
        const sUp = phase <= L ? phase : 2 * L - phase;
        const py = bottom - sUp;
        restTicks = Math.floor((t * c) / (2 * L));
        ctx.strokeStyle = 'rgba(195,205,255,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
        drawMirrors(ctx, cx, top, bottom, M0, accent);
        drawPhoton(ctx, cx, py, '195,205,255');
        drawGapLabel(ctx, cx + M0 / 2 + 10, top, bottom, 'L');
        drawFooter(ctx, p.x, p.y, ph, `path per leg: L · ticks: ${restTicks}`);
      } else {
        const leg = lightClockLeg(b, L);
        const T = leg.pathLength / c;               // time per leg: γL / c
        const vx = b * c;
        const M = M0 / g;                           // contracted along the motion only
        const span = pw + M0;
        const cx = p.x - M0 / 2 + ((pw * 0.22 + M0 / 2 + vx * t) % span);
        const k = Math.floor(t / T);
        const frac = t / T - k;
        const upLeg = k % 2 === 0;
        const py = upLeg ? bottom - frac * L : top + frac * L;
        movingTicks = Math.floor(t / (2 * T));

        // Ghost clocks at the last two reflections show where the mirrors were.
        for (const back of [1, 2]) {
          const tr = (k + 1 - back) * T;
          if (tr < 0) continue;
          const gx = cx - vx * (t - tr);
          ctx.globalAlpha = 0.16 / back;
          drawMirrors(ctx, gx, top, bottom, M, accent);
          ctx.globalAlpha = 1;
        }
        // Diagonal photon trail (Earth frame), drawn back over about one tick.
        const history = Math.min(t, 2.2 * T);
        const N = 90;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = t - (history * i) / N;
          const kk = Math.floor(tt / T);
          const ff = tt / T - kk;
          const yy = kk % 2 === 0 ? bottom - ff * L : top + ff * L;
          const xx = cx - vx * (t - tt);
          if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.strokeStyle = 'rgba(255,180,168,0.55)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        drawMirrors(ctx, cx, top, bottom, M, accent);
        drawPhoton(ctx, cx, py, '255,180,168');
        drawFooter(ctx, p.x, p.y, ph, `path per leg: γL = ${g.toFixed(3)} L · ticks: ${movingTicks}`);
      }
      ctx.restore();
      ctx.strokeStyle = `rgba(${accent},0.25)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(p.x + 0.5, p.y + 0.5, pw - 1, ph - 1, 12); ctx.stroke();
    }

    if (restTicks !== tickRef.current.rest || movingTicks !== tickRef.current.moving) {
      tickRef.current = { rest: restTicks, moving: movingTicks };
      setTicks(tickRef.current);
    }
  });

  const restart = () => { sim.current.t = 0; };
  const pctVal = Math.round(beta * 1000) / 10;

  return (
    <section ref={ref} id="light-clock" className="glass flex flex-col gap-4 p-5" aria-label="Light clock experiment">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="panel-title">Light clock experiment</h2>
        <span className="text-[12px] text-ink-faint">
          Why moving clocks tick slower, seen from Earth's frame · <Term tip={TIPS.lightClock}>what is a light clock?</Term>
        </span>
      </div>

      <div className="h-[520px] sm:h-[300px]">
        <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label="A photon bouncing vertically in a clock at rest, and along a longer diagonal path in a moving clock" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="lcVelocity" className="text-[13px] font-medium text-ink-muted">Relative velocity</label>
            <span className="font-mono text-[15px] font-semibold tabular-nums text-ship-soft">{formatPercentC(beta)} c</span>
          </div>
          <input
            id="lcVelocity"
            type="range"
            min={0}
            max={BETA_MAX * 100}
            step={0.1}
            value={pctVal}
            style={{ ['--pct' as string]: `${(pctVal / (BETA_MAX * 100)) * 100}%` }}
            onChange={(e) => onChange({ ...settings, linked: false, beta: Math.min(BETA_MAX, Number(e.target.value) / 100) })}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={settings.linked}
              onClick={() => onChange({ ...settings, linked: !settings.linked, beta })}
              className="btn h-9 text-[12.5px] aria-pressed:border-ship/50 aria-pressed:bg-ship/10 aria-pressed:text-ship-soft"
            >
              {settings.linked ? 'Linked to ship velocity' : 'Link to ship velocity'}
            </button>
            <button
              type="button"
              aria-pressed={settings.slow}
              onClick={() => onChange({ ...settings, slow: !settings.slow })}
              className="btn h-9 text-[12.5px] aria-pressed:border-earth/50 aria-pressed:bg-earth/10 aria-pressed:text-earth-soft"
            >
              Slow motion {settings.slow ? 'on' : 'off'}
            </button>
            <button type="button" onClick={restart} className="btn h-9 text-[12.5px]">Restart clocks</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-earth/25 bg-black/25 px-2 py-2">
            <div className="text-[11px] text-ink-faint">Ticks at rest</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-earth-soft">{ticks.rest}</div>
          </div>
          <div className="rounded-lg border border-ship/25 bg-black/25 px-2 py-2">
            <div className="text-[11px] text-ink-faint">Ticks moving</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-ship-soft">{ticks.moving}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
            <div className="text-[11px] text-ink-faint"><Term tip={TIPS.gamma}>γ</Term> (tick ratio)</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-ink">{formatGamma(beta, 3)}</div>
          </div>
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        In Earth's frame the moving photon travels a diagonal of length γL on each leg while the clock slides sideways. Light
        still moves at c, so each leg takes γ times longer and the moving clock ticks slower. The mirror gap L is perpendicular to
        the motion, so it is not contracted; only the mirrors' width along the motion shrinks by 1/γ (
        <Term tip={TIPS.contraction}>length contraction</Term>). In the clock's own frame its photon simply goes up and down.
        Photon speed on screen is a fixed visual rate, not to scale.
      </p>
    </section>
  );
});

function drawMirrors(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number, width: number, rgb: string) {
  for (const y of [top, bottom]) {
    const grad = ctx.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0);
    grad.addColorStop(0, `rgba(${rgb},0.35)`);
    grad.addColorStop(0.5, `rgba(${rgb},0.95)`);
    grad.addColorStop(1, `rgba(${rgb},0.35)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - width / 2, y + (y === top ? -5 : 1), width, 4);
  }
  ctx.strokeStyle = `rgba(${rgb},0.18)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, top - 5); ctx.lineTo(cx - width / 2, bottom + 5);
  ctx.moveTo(cx + width / 2, top - 5); ctx.lineTo(cx + width / 2, bottom + 5);
  ctx.stroke();
}

function drawPhoton(ctx: CanvasRenderingContext2D, x: number, y: number, rgb: string) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 16);
  glow.addColorStop(0, `rgba(${rgb},0.75)`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
}

function drawGapLabel(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, label: string) {
  ctx.strokeStyle = 'rgba(226,232,240,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top); ctx.lineTo(x, bottom);
  ctx.moveTo(x - 4, top); ctx.lineTo(x + 4, top);
  ctx.moveTo(x - 4, bottom); ctx.lineTo(x + 4, bottom);
  ctx.stroke();
  ctx.fillStyle = 'rgba(226,232,240,0.8)';
  ctx.font = 'italic 13px Saira, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 7, (top + bottom) / 2);
}

function drawFooter(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, text: string) {
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(148,163,196,0.85)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x + 14, y + h - 10);
}
