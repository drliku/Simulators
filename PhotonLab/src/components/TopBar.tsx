import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FilePlus2, FlaskConical, FolderOpen, ImageDown, MoreHorizontal, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { PRESETS } from '../scene/presets';
import { parseScene, serializeScene } from '../scene/serialize';
import { useStore, useToasts } from '../state/store';
import { canvasApi } from './CanvasView';
import { IconButton } from './controls';
import brainMazeLogo from '../assets/brainmaze-logo.png';

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
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="tap flex h-8 max-w-full items-center gap-2 rounded-full border-2 border-bm-mist bg-white px-3.5 text-[13px] font-semibold text-bm-navy transition-colors hover:border-bm-coral"
      >
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-bm-coral-text" />
        <span className="max-w-[220px] truncate">{current ? current.name : 'Experiments'}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-bm-faint" />
      </button>
      {open && (
        <div className="scroll-thin absolute left-0 top-11 z-50 max-h-[70vh] w-[360px] overflow-y-auto max-sm:fixed max-sm:inset-x-2 max-sm:top-[60px] max-sm:w-auto max-sm:max-h-[calc(100dvh-72px)] rounded-xl border border-bm-line bg-white p-1.5 shadow-bm-hover">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                loadPreset(p.id);
                setOpen(false);
              }}
              className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left max-sm:py-2.5 hover:bg-bm-mist ${p.id === presetId ? 'bg-bm-blush' : ''}`}
            >
              <span className="brand-label mt-0.5 text-[12px] text-bm-coral-text/80">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="block text-[12.5px] text-bm-navy">{p.name}</span>
                <span className="block text-[11px] leading-snug text-bm-faint">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Phones: the scene/file actions collapse into one menu so the header fits. */
function FileMenu({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { resetScene, clearScene } = useStore.getState();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const items: { label: string; icon: typeof RotateCcw; run: () => void }[] = [
    { label: 'Reset scene', icon: RotateCcw, run: resetScene },
    { label: 'New empty scene', icon: FilePlus2, run: clearScene },
    { label: 'Open scene JSON', icon: FolderOpen, run: onOpen },
    { label: SANDBOXED ? 'Copy scene JSON' : 'Save scene JSON', icon: Download, run: saveSceneFile },
    { label: 'Export PNG', icon: ImageDown, run: () => canvasApi.exportPNG() },
  ];

  return (
    <div ref={ref} className="relative sm:hidden">
      <IconButton title="Scene and file actions" active={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-bm-line bg-white p-1.5 shadow-bm-hover">
          {items.map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setOpen(false);
                run();
              }}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-bm-navy hover:bg-bm-mist"
            >
              <Icon className="h-4 w-4 text-bm-muted" />
              {label}
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
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 bg-white pr-2 shadow-[0_2px_10px_rgba(48,65,105,0.08)] sm:gap-3 sm:pr-3">
      {/* Brand lock-up: The Brain Maze logo (links to the site) + the simulation name */}
      <a
        href="https://thebrainmaze.com/"
        target="_top"
        className="flex h-full shrink-0 items-center gap-3 pl-4 pr-1 max-sm:pl-3"
      >
        <img src={brainMazeLogo} alt="The Brain Maze" width={111} height={34} className="block h-[34px] w-auto max-sm:h-7" />
        <span className="brand-label hidden border-l-2 border-bm-line pl-3 leading-none text-bm-coral-text sm:block">Photon Lab</span>
      </a>
      <div className="hidden h-7 w-px shrink-0 bg-bm-line sm:block" />
      <PresetMenu />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
        <IconButton title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </IconButton>
        <div className="mx-1 h-6 w-px bg-bm-line" />
        <FileMenu onOpen={() => fileRef.current?.click()} />
        <div className="hidden items-center gap-0.5 sm:flex">
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
        </div>
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
