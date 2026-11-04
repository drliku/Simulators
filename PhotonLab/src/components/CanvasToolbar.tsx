import { Activity, Grid3x3, Magnet, Maximize, Pause, Play, Spline, Triangle, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore, useTraceStore } from '../state/store';
import { canvasApi } from './CanvasView';
import { IconButton } from './controls';

export function CanvasToolbar() {
  const ui = useStore((s) => s.ui);
  const setUI = useStore((s) => s.setUI);
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/10 bg-ink-900/85 p-1 shadow-lg shadow-black/40 backdrop-blur">
        <IconButton title="Toggle ray paths" active={ui.showRays} onClick={() => setUI({ showRays: !ui.showRays })}>
          <Activity className="h-4 w-4" />
          <span className="hidden xl:inline">Rays</span>
        </IconButton>
        <IconButton title="Show surface normals" active={ui.showNormals} onClick={() => setUI({ showNormals: !ui.showNormals })}>
          <Spline className="h-4 w-4" />
          <span className="hidden xl:inline">Normals</span>
        </IconButton>
        <IconButton title="Show incidence / reflection / refraction angles" active={ui.showAngles} onClick={() => setUI({ showAngles: !ui.showAngles })}>
          <Triangle className="h-4 w-4" />
          <span className="hidden xl:inline">Angles</span>
        </IconButton>
        <div className="mx-0.5 h-5 w-px bg-white/10" />
        <IconButton title="Toggle grid" active={ui.showGrid} onClick={() => setUI({ showGrid: !ui.showGrid })}>
          <Grid3x3 className="h-4 w-4" />
        </IconButton>
        <IconButton title="Snap to grid (hold Alt to bypass)" active={ui.snap} onClick={() => setUI({ snap: !ui.snap })}>
          <Magnet className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/10 bg-ink-900/85 p-1 shadow-lg shadow-black/40 backdrop-blur">
        <IconButton title="Zoom out (-)" onClick={() => canvasApi.zoomBy(1 / 1.25)}>
          <ZoomOut className="h-4 w-4" />
        </IconButton>
        <ZoomReadout />
        <IconButton title="Zoom in (+)" onClick={() => canvasApi.zoomBy(1.25)}>
          <ZoomIn className="h-4 w-4" />
        </IconButton>
        <IconButton title="Fit view to scene (F)" onClick={() => canvasApi.fit()}>
          <Maximize className="h-4 w-4" />
        </IconButton>
        <div className="mx-0.5 h-5 w-px bg-white/10" />
        <IconButton title={ui.paused ? 'Resume simulation (P)' : 'Pause simulation (P)'} active={ui.paused} onClick={() => setUI({ paused: !ui.paused })}>
          {ui.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span className="hidden xl:inline">{ui.paused ? 'Resume' : 'Pause'}</span>
        </IconButton>
      </div>
    </div>
  );
}

function ZoomReadout() {
  const zoom = useStore((s) => s.view.zoom);
  return <span className="w-14 text-center font-mono text-[11px] text-slate-400">{Math.round(zoom * 100)}%</span>;
}

export function StatusBar() {
  const cursor = useTraceStore((s) => s.cursor);
  const fps = useTraceStore((s) => s.fps);
  const renderMs = useTraceStore((s) => s.renderMs);
  const result = useTraceStore((s) => s.result);
  const count = useStore((s) => s.objects.length);
  const st = result?.stats;
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-white/[0.07] bg-ink-900/80 px-3 font-mono text-[10.5px] text-slate-500">
      <span className="w-40">{cursor ? `x ${cursor.x.toFixed(1)}  y ${cursor.y.toFixed(1)} mm` : 'x —  y —'}</span>
      <span>{count} objects</span>
      {st && (
        <>
          <span>{st.primaryRays} rays</span>
          <span className={st.limitReached ? 'text-amber-400' : ''}>
            {st.segments} segments{st.limitReached ? ' (budget hit)' : ''}
          </span>
          <span>trace {result!.timeMs.toFixed(1)} ms</span>
        </>
      )}
      <span>render {renderMs.toFixed(1)} ms</span>
      <span className={fps && fps < 45 ? 'text-amber-400' : 'text-emerald-400/80'}>{fps} fps</span>
      <span className="ml-auto hidden text-slate-600 lg:inline">Drag empty space to pan · wheel to zoom · Del delete · Ctrl+D duplicate · R rotate</span>
    </footer>
  );
}
