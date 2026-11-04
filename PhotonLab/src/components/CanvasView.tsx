import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { compileObject } from '../engine/compile';
import { traceScene } from '../engine/tracer';
import { applyHandle, getHandles, hitTest, type HandleId } from '../interaction/handles';
import { gridStep, screenToWorld, worldToScreen, zoomAt } from '../render/camera';
import { render } from '../render/renderer';
import { libraryItem } from '../scene/factory';
import { useStore, useToasts, useTraceStore } from '../state/store';

type Drag =
  | { type: 'pan'; sx: number; sy: number; cx: number; cy: number }
  | { type: 'move'; id: string; offX: number; offY: number; sx: number; sy: number; started: boolean }
  | { type: 'handle'; id: string; handle: HandleId; started: boolean };

export const DRAG_MIME = 'application/x-photon-item';

/** Exported image shown in a preview dialog when downloads are not possible. */
export const useExportImage = create<{ url: string | null }>(() => ({ url: null }));

/** Imperative API used by toolbars (export, zoom, fit, centre). */
export const canvasApi: {
  exportPNG: () => void;
  zoomBy: (f: number) => void;
  fit: () => void;
  center: () => [number, number];
} = {
  exportPNG: () => {},
  zoomBy: () => {},
  fit: () => {},
  center: () => [0, 0],
};

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export function CanvasView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const dirty = useRef(true);
  const hover = useRef<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);

  const compiledAll = () => useStore.getState().objects.map(compileObject);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  // ── Resize ──
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      dirty.current = true;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── Main loop: trace when the scene changes, render when anything changes ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let lastObjs: unknown = null;
    let lastSettings: unknown = null;
    let lastFit = -1;
    let frames = 0;
    let fpsT = performance.now();
    let renderMs = 0;
    const unsub = useStore.subscribe(() => (dirty.current = true));
    const unsubT = useTraceStore.subscribe((s, p) => {
      if (s.result !== p.result) dirty.current = true;
    });

    const fit = () => {
      const s = useStore.getState();
      const { w, h } = size.current;
      if (!s.objects.length) {
        s.setView({ cx: 0, cy: 0, zoom: 1.2 });
        return;
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const c of compiledAll()) {
        x0 = Math.min(x0, c.bounds[0]);
        y0 = Math.min(y0, c.bounds[1]);
        x1 = Math.max(x1, c.bounds[2]);
        y1 = Math.max(y1, c.bounds[3]);
      }
      const bw = Math.max(50, x1 - x0);
      const bh = Math.max(50, y1 - y0);
      const zoom = Math.min(4, Math.max(0.1, Math.min((w - 160) / bw, (h - 140) / bh)));
      s.setView({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom });
    };
    canvasApi.fit = fit;
    canvasApi.zoomBy = (f) => {
      const s = useStore.getState();
      const { w, h } = size.current;
      s.setView(zoomAt(s.view, w, h, w / 2, h / 2, f));
    };
    canvasApi.center = () => {
      const v = useStore.getState().view;
      return [v.cx, v.cy];
    };
    canvasApi.exportPNG = () => {
      const s = useStore.getState();
      const { w, h, dpr } = size.current;
      const off = document.createElement('canvas');
      off.width = Math.round(w * dpr);
      off.height = Math.round(h * dpr);
      const octx = off.getContext('2d')!;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(octx, {
        w,
        h,
        view: s.view,
        compiled: compiledAll(),
        trace: useTraceStore.getState().result,
        ui: s.ui,
        settings: s.settings,
        selectedId: null,
        hoverId: null,
        showSelection: false,
      });
      if (import.meta.env.VITE_SANDBOXED === '1') {
        useExportImage.setState({ url: off.toDataURL('image/png') });
        return;
      }
      off.toBlob((blob) => {
        if (!blob) {
          useToasts.getState().push('PNG export failed', 'error');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photon-lab-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        useToasts.getState().push('Canvas exported as PNG');
      }, 'image/png');
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      frames++;
      if (now - fpsT >= 1000) {
        useTraceStore.setState({ fps: Math.round((frames * 1000) / (now - fpsT)), renderMs });
        frames = 0;
        fpsT = now;
      }
      const s = useStore.getState();
      if (s.fitRequest !== lastFit && size.current.w > 1) {
        lastFit = s.fitRequest;
        fit();
        return;
      }
      if (!s.ui.paused && (s.objects !== lastObjs || s.settings !== lastSettings)) {
        lastObjs = s.objects;
        lastSettings = s.settings;
        const result = traceScene(s.objects, s.settings);
        useTraceStore.setState({ result });
        dirty.current = true;
      }
      if (!dirty.current) return;
      dirty.current = false;
      const t0 = performance.now();
      const { w, h, dpr } = size.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, {
        w,
        h,
        view: s.view,
        compiled: compiledAll(),
        trace: useTraceStore.getState().result,
        ui: s.ui,
        settings: s.settings,
        selectedId: s.selectedId,
        hoverId: hover.current,
        showSelection: true,
      });
      renderMs = performance.now() - t0;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      unsubT();
    };
  }, []);

  // ── Wheel zoom (non-passive) and space-to-pan ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useStore.getState();
      const { w, h } = size.current;
      const [sx, sy] = local(e);
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
      s.setView(zoomAt(s.view, w, h, sx, sy, factor));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditable(e.target)) {
        space.current = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space.current = false;
        canvas.style.cursor = 'default';
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.focus();
    const s = useStore.getState();
    const { w, h } = size.current;
    const [sx, sy] = local(e);
    const [wx, wy] = screenToWorld(s.view, w, h, sx, sy);
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || space.current) {
      drag.current = { type: 'pan', sx, sy, cx: s.view.cx, cy: s.view.cy };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    const compiled = compiledAll();
    const sel = compiled.find((c) => c.obj.id === s.selectedId);
    if (sel) {
      for (const hd of getHandles(sel, s.view.zoom)) {
        const [hx, hy] = worldToScreen(s.view, w, h, hd.x, hd.y);
        if (Math.hypot(hx - sx, hy - sy) <= 10) {
          drag.current = { type: 'handle', id: sel.obj.id, handle: hd.id, started: false };
          return;
        }
      }
    }
    const hit = hitTest(compiled, wx, wy, 7 / s.view.zoom);
    if (hit) {
      const o = s.objects.find((x) => x.id === hit)!;
      s.select(hit);
      drag.current = { type: 'move', id: hit, offX: wx - o.x, offY: wy - o.y, sx, sy, started: false };
      canvas.style.cursor = 'move';
    } else {
      s.select(null);
      drag.current = { type: 'pan', sx, sy, cx: s.view.cx, cy: s.view.cy };
      canvas.style.cursor = 'grabbing';
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const s = useStore.getState();
    const { w, h } = size.current;
    const [sx, sy] = local(e);
    const [wx, wy] = screenToWorld(s.view, w, h, sx, sy);
    useTraceStore.setState({ cursor: { x: wx, y: wy } });
    const d = drag.current;
    const snapOn = s.ui.snap && !e.altKey;
    const step = gridStep(s.view.zoom);
    if (!d) {
      if (space.current) return;
      const compiled = compiledAll();
      const sel = compiled.find((c) => c.obj.id === s.selectedId);
      let cursor = 'default';
      if (sel) {
        for (const hd of getHandles(sel, s.view.zoom)) {
          const [hx, hy] = worldToScreen(s.view, w, h, hd.x, hd.y);
          if (Math.hypot(hx - sx, hy - sy) <= 10) cursor = hd.id === 'rotate' ? 'alias' : 'crosshair';
        }
      }
      const hit = hitTest(compiled, wx, wy, 7 / s.view.zoom);
      if (hit && cursor === 'default') cursor = 'move';
      canvas.style.cursor = cursor;
      if (hit !== hover.current) {
        hover.current = hit;
        dirty.current = true;
      }
      return;
    }
    if (d.type === 'pan') {
      s.setView({ cx: d.cx - (sx - d.sx) / s.view.zoom, cy: d.cy + (sy - d.sy) / s.view.zoom });
      return;
    }
    if (d.type === 'move') {
      if (!d.started) {
        if (Math.hypot(sx - d.sx, sy - d.sy) < 3) return;
        s.checkpoint();
        d.started = true;
      }
      let nx = wx - d.offX;
      let ny = wy - d.offY;
      if (snapOn) {
        nx = Math.round(nx / step) * step;
        ny = Math.round(ny / step) * step;
      }
      s.updateObject(d.id, { x: nx, y: ny }, { record: false });
      return;
    }
    const o = s.objects.find((x) => x.id === d.id);
    if (!o) return;
    const patch = applyHandle(o, d.handle, wx, wy, { shift: e.shiftKey, snap: snapOn, step });
    if (!patch) return;
    if (!d.started) {
      s.checkpoint();
      d.started = true;
    }
    s.updateObject(d.id, patch, { record: false });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    drag.current = null;
    canvas.style.cursor = space.current ? 'grab' : 'default';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME);
    const item = libraryItem(id);
    if (!item) return;
    const s = useStore.getState();
    const { w, h } = size.current;
    const [sx, sy] = local(e);
    let [wx, wy] = screenToWorld(s.view, w, h, sx, sy);
    if (s.ui.snap) {
      const st = gridStep(s.view.zoom);
      wx = Math.round(wx / st) * st;
      wy = Math.round(wy / st) * st;
    }
    s.addObject(item.create(wx, wy));
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block h-full w-full touch-none outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => useTraceStore.setState({ cursor: null })}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
