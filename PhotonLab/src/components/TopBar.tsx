import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FilePlus2, FlaskConical, FolderOpen, ImageDown, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { PRESETS } from '../scene/presets';
import { parseScene, serializeScene } from '../scene/serialize';
import { useStore, useToasts } from '../state/store';
import { canvasApi } from './CanvasView';
import { IconButton } from './controls';
import brainMark from '../assets/brain-mark.png';

/** Shared (sandboxed) builds cannot trigger downloads, so they use the clipboard and an image preview instead. */
export const SANDBOXED = import.meta.env.VITE_SANDBOXED === '1';

export function saveSceneFile() {
  const s = useStore.getState();
  const json = serializeScene({ objects: s.objects, settings: s.settings });
  if (SANDBOXED) {
    navigator.clipboard
      .writeText(json)
      .then(() => useToasts.getState().push('Scene JSON copied. Paste it into a .json file to keep it.'))
      .catch(() => useToasts.getState().push('Clipboard is blocked here, so the scene could not be copied.', 'error'));
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `optics-scene-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  useToasts.getState().push('Scene saved as JSON');
}

function PresetMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const presetId = useStore((s) => s.presetId);
  const loadPreset = useStore((s) => s.loadPreset);
  const current = PRESETS.find((p) => p.id === presetId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-2 rounded-md border border-white/15 bg-ink-900/40 px-3 text-[13px] font-medium text-slate-100 hover:border-coral-400/60 hover:bg-ink-900/60"
      >
        <FlaskConical className="h-3.5 w-3.5 text-coral-400" />
        <span className="max-w-[220px] truncate">{current ? current.name : 'Experiments'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
      {open && (
        <div className="scroll-thin absolute left-0 top-11 z-50 max-h-[70vh] w-[360px] overflow-y-auto rounded-xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                loadPreset(p.id);
                setOpen(false);
              }}
              className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] ${p.id === presetId ? 'bg-coral-500/10' : ''}`}
            >
              <span className="brand-label mt-0.5 text-[12px] text-coral-500/80">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="block text-[12.5px] text-slate-100">{p.name}</span>
                <span className="block text-[11px] leading-snug text-slate-500">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { undo, redo, resetScene, clearScene, loadScene } = useStore.getState();
  const toast = useToasts((s) => s.push);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = parseScene(await f.text());
      loadScene(data, null);
      toast(`Loaded “${f.name}” (${data.objects.length} objects)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load file', 'error');
    }
  };

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b-2 border-coral-500/70 bg-ink-700 pr-3">
      {/* Brand lock-up mirrors the logo: coral brain square, wordmark, rule + sub-name */}
      <div className="flex h-full items-center gap-3 pr-1">
        <img src={brainMark} alt="The Brain Maze" className="h-full w-14 bg-coral-500 object-contain" />
        <div className="leading-none">
          <div className="brand-label text-[19px] text-coral-500">The Brain Maze</div>
          <div className="mt-1 hidden items-center gap-2 sm:flex">
            <span className="h-[3px] w-7 bg-coral-500" />
            <span className="brand-label text-[11px] text-coral-200">Photon Lab</span>
          </div>
        </div>
      </div>
      <div className="h-7 w-px bg-white/15" />
      <PresetMenu />
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
        <IconButton title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </IconButton>
        <div className="mx-1 h-6 w-px bg-white/10" />
        <IconButton title="Reset scene to its initial state" onClick={resetScene}>
          <RotateCcw className="h-4 w-4" />
          <span className="hidden lg:inline">Reset</span>
        </IconButton>
        <IconButton title="New empty scene" onClick={clearScene}>
          <FilePlus2 className="h-4 w-4" />
          <span className="hidden lg:inline">New</span>
        </IconButton>
        <IconButton title="Load scene JSON" onClick={() => fileRef.current?.click()}>
          <FolderOpen className="h-4 w-4" />
          <span className="hidden lg:inline">Open</span>
        </IconButton>
        <IconButton title={SANDBOXED ? 'Copy scene JSON to clipboard (Ctrl+S)' : 'Save scene as JSON (Ctrl+S)'} onClick={saveSceneFile}>
          <Download className="h-4 w-4" />
          <span className="hidden lg:inline">{SANDBOXED ? 'Copy' : 'Save'}</span>
        </IconButton>
        <IconButton title="Export canvas as PNG" onClick={() => canvasApi.exportPNG()}>
          <ImageDown className="h-4 w-4" />
          <span className="hidden lg:inline">PNG</span>
        </IconButton>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
