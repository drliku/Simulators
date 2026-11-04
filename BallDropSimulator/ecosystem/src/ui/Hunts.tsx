import { useUi } from '../runtime/context';
import type { Hunt } from '../sim/hunts';
import { speciesName } from '../sim/species';

const hunters = (h: Hunt) => (h.predator === 'wolf' ? `Pack ${h.packId} (${h.wolfIds.length} ${h.wolfIds.length > 1 ? 'wolves' : 'wolf'})` : h.wolfIds.length > 1 ? `${h.wolfIds.length} ${speciesName(h.predator, 2)}` : `A ${speciesName(h.predator)}`);
const preyName = (h: { prey: Hunt['prey']; deerId: number }) => `${speciesName(h.prey)} #${h.deerId}`;

/** Banner that announces the hunt about to happen (or happening), with a one-click Watch. */
export function HuntBanner() {
  const ctl = useUi();
  if (!ctl.huntAlerts) return null;
  const ht = ctl.sim.hunts;
  const h = ht.focus();
  const others = ht.active.size - (h ? 1 : 0);
  const watching = !!h && ctl.cameraMode === 'follow' && ctl.selectedId === h.deerId;
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-7 flex flex-col items-center gap-1.5">
      {h && (
        <div
          role="status"
          className={`pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border px-3 py-2 shadow-xl backdrop-blur ${h.phase === 'chase' ? 'hunt-banner-chase border-[#ff3b30] bg-[#3a0d0b]/90' : 'border-[#ffb02e]/80 bg-[#2e2108]/90'}`}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[18px] ${h.phase === 'chase' ? 'bg-[#ff3b30] text-white' : 'bg-[#ffb02e] text-[#1b1205]'}`} aria-hidden="true">!</span>
          <div className="min-w-0">
            <div className={`font-display text-[16px] uppercase tracking-[0.06em] ${h.phase === 'chase' ? 'text-[#ff6b5e]' : 'text-[#ffc65c]'}`}>
              {h.phase === 'chase' ? 'Chase in progress!' : 'Hunt about to start'}
            </div>
            <div className="truncate text-[12px] text-ink">
              {h.phase === 'chase'
                ? `${hunters(h)} ${h.wolfIds.length > 1 ? 'are' : 'is'} running down ${preyName(h)}: ${h.gap.toFixed(0)} m between them.`
                : `${hunters(h)} ${h.wolfIds.length > 1 ? 'are' : 'is'} stalking ${preyName(h)}, ${h.gap.toFixed(0)} m away.`}
              {others > 0 && <span className="text-ink-muted"> +{others} more hunt{others > 1 ? 's' : ''}</span>}
            </div>
          </div>
          <button type="button" className={`btn shrink-0 ${watching ? '' : 'btn-primary'}`} onClick={() => (watching ? ctl.deselect() : ctl.watchHunt(h.deerId))}>
            {watching ? 'Stop watching' : '▶ Watch'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Short-lived notices for how each hunt ended. */
export function HuntToasts() {
  const ctl = useUi();
  if (!ctl.huntAlerts || ctl.huntFlashes.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-2 top-[84px] flex w-64 flex-col gap-1.5" aria-live="polite">
      {ctl.huntFlashes.slice(-3).reverse().map((f) => (
        <div key={f.seq} className={`rounded-lg border px-2.5 py-1.5 text-[12px] shadow-lg backdrop-blur ${f.outcome === 'kill' ? 'border-[#ff3b30]/70 bg-[#3a0d0b]/90' : 'border-[#5eea8a]/60 bg-[#0d2a17]/90'}`}>
          <span className={`font-display text-[14px] uppercase tracking-[0.06em] ${f.outcome === 'kill' ? 'text-[#ff6b5e]' : 'text-[#6ff09a]'}`}>{f.outcome === 'kill' ? 'Kill' : 'Escaped'}</span>
          <span className="ml-2 text-ink">
            {f.outcome === 'kill'
              ? `${f.predator === 'wolf' ? `Pack ${f.packId}` : `A ${speciesName(f.predator)}`} caught ${preyName(f)}.`
              : `${preyName(f)} got away from ${f.predator === 'wolf' ? `pack ${f.packId}` : `a ${speciesName(f.predator)}`}.`}
          </span>
        </div>
      ))}
    </div>
  );
}
