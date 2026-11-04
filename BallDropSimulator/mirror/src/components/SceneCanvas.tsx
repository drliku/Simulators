import { useEngine, useSim } from '../sim/context';
import { useCanvas } from '../hooks/useCanvas';
import { renderTrackView, renderTrainView, type Panel } from '../draw/scene';
import type { View } from '../sim/engine';

export function speechFor(beta: number): string {
  if (beta >= 0.995) return 'I can still see my reflection?!';
  if (beta >= 0.85) return "We're moving incredibly fast!";
  return 'I can see myself!';
}

function panels(view: View, w: number, h: number): { train?: Panel; track?: Panel } {
  if (view === 'train') return { train: { x: 0, y: 0, w, h } };
  if (view === 'track') return { track: { x: 0, y: 0, w, h } };
  const gap = 10, ph = (h - gap) / 2;
  return { train: { x: 0, y: 0, w, h: ph }, track: { x: 0, y: ph + gap, w, h: ph } };
}

export function SceneCanvas() {
  const engine = useEngine();
  const view = useSim((e) => e.view);

  const ref = useCanvas((ctx, w, h) => {
    const e = engine;
    const trip = e.trip;
    const p = panels(e.view, w, h);
    if (p.train) {
      renderTrainView(ctx, p.train, {
        trip, tPrime: e.tPrime, L0: e.L0, blink: e.blinking, scenery: e.scenery, speech: speechFor(e.beta),
      });
    }
    if (p.track) renderTrackView(ctx, p.track, { trip, t: e.t, L0: e.L0, blink: e.blinking });
  });

  const height = view === 'both' ? 'h-[580px] sm:h-[760px]' : 'h-[320px] sm:h-[460px]';
  return (
    <canvas
      ref={ref}
      className={`block w-full ${height}`}
      role="img"
      aria-label={view === 'both'
        ? 'Side by side: the mirror experiment inside the train, and the same experiment seen from the track'
        : view === 'train' ? 'The mirror experiment seen inside the train' : 'The mirror experiment seen from the track'}
    />
  );
}
