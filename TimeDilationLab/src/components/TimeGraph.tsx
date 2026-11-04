import { useEngine, useSim } from '../sim/context';
import { derive } from '../sim/derive';
import { useCanvas } from '../hooks/useCanvas';
import { UNIT_SECONDS, UNIT_SHORT } from '../physics/format';
import { properTime } from '../physics/relativity';
import { fmtTick, niceStep } from './draw';

/**
 * Earth frame: x = Earth time Δt, y = ship proper time Δτ = Δt/γ.
 * Ship frame:  x = ship time τ,  y = Earth readings: τ/γ (ship-frame simultaneity) and γτ
 * (Earth-frame simultaneity), showing that the symmetric picture depends on simultaneity.
 */
export function TimeGraph() {
  const engine = useEngine();
  const frame = useSim((e) => e.frame);

  const ref = useCanvas((ctx, w, h) => {
    const d = derive(engine);
    const shipFrame = engine.frame === 'ship';
    const u = UNIT_SECONDS[d.unit];
    const pad = { l: 52, r: 18, t: 16, b: 40 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const max = (shipFrame ? properTime(d.duration, d.beta) : d.duration) / u || 1;
    const X = (v: number) => pad.l + (v / max) * pw;
    const Y = (v: number) => pad.t + ph - (v / max) * ph;

    // Grid and axes
    const step = niceStep(max, w < 480 ? 4 : 6);
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.lineWidth = 1;
    for (let v = 0; v <= max * 1.0001; v += step) {
      ctx.strokeStyle = 'rgba(148,163,196,0.08)';
      ctx.beginPath(); ctx.moveTo(X(v) + 0.5, pad.t); ctx.lineTo(X(v) + 0.5, pad.t + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v) + 0.5); ctx.lineTo(pad.l + pw, Y(v) + 0.5); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,196,0.75)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(fmtTick(v, step), X(v), pad.t + ph + 6);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtTick(v, step), pad.l - 7, Y(v));
    }
    ctx.strokeStyle = 'rgba(148,163,196,0.4)';
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();

    ctx.font = '11.5px Saira, sans-serif';
    ctx.fillStyle = shipFrame ? 'rgba(255,180,168,0.9)' : 'rgba(195,205,255,0.9)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(shipFrame ? `Ship time τ (${UNIT_SHORT[d.unit]})` : `Earth time Δt (${UNIT_SHORT[d.unit]})`, pad.l + pw / 2, h - 4);
    ctx.save();
    ctx.translate(13, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = shipFrame ? 'rgba(195,205,255,0.9)' : 'rgba(255,180,168,0.9)';
    ctx.textBaseline = 'middle';
    ctx.fillText(shipFrame ? `Earth clock (${UNIT_SHORT[d.unit]})` : `Ship time Δτ (${UNIT_SHORT[d.unit]})`, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, pad.t - 2, pw + 2, ph + 4); ctx.clip();

    // Equal-time reference
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(226,232,240,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(max), Y(max)); ctx.stroke();
    ctx.setLineDash([]);

    const inv = 1 / d.gamma;
    const nowX = (shipFrame ? d.shipTime : d.earthTime) / u;
    const tone = shipFrame ? ['195,205,255', '#c3cdff'] : ['243,112,100', '#ff9488'];

    if (shipFrame) {
      // Earth-frame simultaneity: Earth reading γτ (dotted, for contrast)
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(195,205,255,0.4)';
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(max), Y(max * d.gamma)); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Projection for the full experiment
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = `rgba(${tone[0]},0.35)`;
    ctx.beginPath(); ctx.moveTo(X(nowX), Y(nowX * inv)); ctx.lineTo(X(max), Y(max * inv)); ctx.stroke();
    ctx.setLineDash([]);
    // Actual line so far
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${tone[0]},0.18)`;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(nowX), Y(nowX * inv)); ctx.stroke();
    ctx.strokeStyle = tone[1];
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();

    // Current point and its gap to the diagonal
    const px = X(nowX), py = Y(nowX * inv);
    if (nowX > 0) {
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(226,232,240,0.35)';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, Y(nowX)); ctx.stroke();
      ctx.setLineDash([]);
    }
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 14);
    glow.addColorStop(0, `rgba(${tone[0]},0.6)`);
    glow.addColorStop(1, `rgba(${tone[0]},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(px - 14, py - 14, 28, 28);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  });

  return (
    <section className="glass flex flex-col gap-3 p-5" aria-label="Time comparison graph">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="panel-title">Time comparison</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t border-dashed border-slate-300/70" />equal elapsed time</span>
          {frame === 'earth' ? (
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded bg-ship" />ship clock, Δτ = Δt/γ</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded bg-earth" />Earth clock, ship-frame "now" (τ/γ)</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t border-dotted border-earth/70" />Earth-frame "now" (γτ)</span>
            </>
          )}
        </div>
      </div>
      <div className="h-[260px] sm:h-[300px]">
        <canvas ref={ref} className="h-full w-full" role="img" aria-label="Graph of ship proper time against Earth time, with the equal-time diagonal for reference" />
      </div>
      <p className="text-[12px] leading-relaxed text-ink-faint">
        At constant velocity the ship's line is straight with slope 1/γ. The vertical gap to the diagonal is the time difference.
      </p>
    </section>
  );
}
