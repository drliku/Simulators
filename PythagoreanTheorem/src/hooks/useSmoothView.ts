import { useEffect, useRef, useState } from 'react';

export interface View {
  /** Pixels per world unit. */
  scale: number;
  /** Screen position (px) of the world origin. */
  tx: number;
  ty: number;
}

/**
 * Eases the camera toward `target` every animation frame. While `frozen` is
 * true the camera holds still, so a vertex being dragged stays under the
 * pointer; it glides to the new framing once the drag ends.
 */
export function useSmoothView(target: View, frozen: boolean): View {
  const [view, setView] = useState(target);
  const viewRef = useRef(view);
  const targetRef = useRef(target);
  const frozenRef = useRef(frozen);
  const initialised = useRef(false);

  targetRef.current = target;
  frozenRef.current = frozen;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const cur = viewRef.current;
      const tgt = targetRef.current;
      if (!initialised.current && tgt.scale > 0) {
        initialised.current = true;
        viewRef.current = tgt;
        setView(tgt);
      } else if (!frozenRef.current) {
        const k = 1 - Math.exp(-dt / 110);
        const next = {
          scale: cur.scale + (tgt.scale - cur.scale) * k,
          tx: cur.tx + (tgt.tx - cur.tx) * k,
          ty: cur.ty + (tgt.ty - cur.ty) * k,
        };
        const settled =
          Math.abs(next.scale - tgt.scale) < 0.01 && Math.abs(next.tx - tgt.tx) < 0.1 && Math.abs(next.ty - tgt.ty) < 0.1;
        const value = settled ? tgt : next;
        if (value.scale !== cur.scale || value.tx !== cur.tx || value.ty !== cur.ty) {
          viewRef.current = value;
          setView(value);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return view;
}
