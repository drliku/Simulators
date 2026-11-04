import { useEffect, useState } from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { CanvasToolbar, StatusBar } from './components/CanvasToolbar';
import { canvasApi, CanvasView, useExportImage } from './components/CanvasView';
import { Library } from './components/Library';
import { PropertiesPanel } from './components/PropertiesPanel';
import { saveSceneFile, TopBar } from './components/TopBar';
import { wrapDeg } from './engine/vec';
import { useStore, useToasts } from './state/store';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const sel = s.objects.find((o) => o.id === s.selectedId);
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if (mod && key === 's') {
        e.preventDefault();
        saveSceneFile();
      } else if (mod && key === 'd') {
        e.preventDefault();
        if (sel) s.duplicateObject(sel.id);
      } else if ((key === 'delete' || key === 'backspace') && sel) {
        e.preventDefault();
        s.removeObject(sel.id);
      } else if (key === 'escape') {
        s.select(null);
      } else if (key === 'r' && sel && !mod) {
        s.updateObject(sel.id, { rotation: wrapDeg(sel.rotation + (e.shiftKey ? -15 : 15)) }, { coalesce: `rot:${sel.id}` });
      } else if (key === 'p' && !mod) {
        s.setUI({ paused: !s.ui.paused });
      } else if (key === 'f' && !mod) {
        canvasApi.fit();
      } else if ((key === '+' || key === '=') && !mod) {
        canvasApi.zoomBy(1.25);
      } else if (key === '-' && !mod) {
        canvasApi.zoomBy(1 / 1.25);
      } else if (sel && key.startsWith('arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -d : key === 'arrowright' ? d : 0;
        const dy = key === 'arrowdown' ? -d : key === 'arrowup' ? d : 0;
        s.updateObject(sel.id, { x: sel.x + dx, y: sel.y + dy }, { coalesce: `nudge:${sel.id}` });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in rounded-lg border px-3 py-2 text-[12px] shadow-xl backdrop-blur ${
            t.tone === 'error' ? 'border-red-500/40 bg-red-950/90 text-red-200' : 'border-white/10 bg-ink-800/95 text-slate-200'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ExportPreview() {
  const url = useExportImage((s) => s.url);
  if (!url) return null;
  const close = () => useExportImage.setState({ url: null });
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-xl border border-white/10 bg-ink-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-slate-300">Right-click the image (or long-press on a phone) and choose “Save image”.</p>
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-[12px] text-slate-300 hover:bg-white/10">
            Close
          </button>
        </div>
        <img src={url} alt="Exported simulation canvas" className="min-h-0 rounded-lg border border-white/10 object-contain" />
      </div>
    </div>
  );
}

export default function App() {
  useShortcuts();
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const [showLeft, setShowLeft] = useState(wide);
  const [showRight, setShowRight] = useState(wide);

  return (
    <div className="flex h-full flex-col bg-ink-950 text-slate-200">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        {showLeft && (
          <div className="absolute inset-y-0 left-0 z-30 w-[248px] shrink-0 border-r border-white/[0.07] bg-ink-900/95 backdrop-blur lg:static lg:z-auto lg:bg-ink-900/70">
            <Library />
          </div>
        )}
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <CanvasView />
          <CanvasToolbar />
          <div className="absolute bottom-3 left-3 flex gap-1">
            <button
              type="button"
              title="Toggle object library"
              onClick={() => setShowLeft(!showLeft)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-ink-900/85 text-slate-300 hover:text-white"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Toggle properties panel"
              onClick={() => setShowRight(!showRight)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-ink-900/85 text-slate-300 hover:text-white"
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
          <Toasts />
          <ExportPreview />
        </main>
        {showRight && (
          <div className="absolute inset-y-0 right-0 z-30 w-[300px] shrink-0 border-l border-white/[0.07] bg-ink-900/95 backdrop-blur lg:static lg:z-auto lg:bg-ink-900/70">
            <PropertiesPanel />
          </div>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
