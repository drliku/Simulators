import { useEffect, useRef } from 'react';
import { useEngine } from '../sim/context';

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, realDt: number) => void;

/**
 * A HiDPI canvas redrawn from the engine's single requestAnimationFrame loop, so every
 * view advances from the same frame delta.
 */
export function useCanvas(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const engine = useEngine();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const off = engine.onFrame((dt) => {
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h, dt);
    });
    return () => { ro.disconnect(); off(); };
  }, [engine]);

  return ref;
}
