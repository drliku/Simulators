import { create } from 'zustand';
import { cloneObject } from '../scene/factory';
import { buildPreset, STARTUP_PRESET } from '../scene/presets';
import { DEFAULT_SETTINGS, type SceneData, type SceneObject, type SimSettings } from '../scene/types';
import type { TraceResult } from '../engine/tracer';

export interface UIState {
  showGrid: boolean;
  snap: boolean;
  showRays: boolean;
  showNormals: boolean;
  showAngles: boolean;
  paused: boolean;
}

export interface ViewState {
  cx: number;
  cy: number;
  /** Pixels per millimetre. */
  zoom: number;
}

interface Snapshot {
  objects: SceneObject[];
  settings: SimSettings;
}

export type ObjectPatch = Record<string, unknown>;

interface UpdateOpts {
  /** Push an undo step (default true). */
  record?: boolean;
  /** Merge rapid successive edits with the same key into one undo step. */
  coalesce?: string;
}

interface AppState {
  objects: SceneObject[];
  settings: SimSettings;
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  coalesce: { key: string; time: number } | null;
  baseline: Snapshot;
  presetId: string | null;
  ui: UIState;
  view: ViewState;
  fitRequest: number;

  checkpoint: () => void;
  addObject: (o: SceneObject) => void;
  updateObject: (id: string, patch: ObjectPatch, opts?: UpdateOpts) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  reorder: (id: string, where: 'front' | 'back') => void;
  select: (id: string | null) => void;
  setSettings: (patch: Partial<SimSettings>, coalesce?: string) => void;
  loadScene: (data: SceneData, presetId?: string | null, ui?: Partial<UIState>) => void;
  loadPreset: (id: string) => void;
  resetScene: () => void;
  clearScene: () => void;
  undo: () => void;
  redo: () => void;
  setUI: (patch: Partial<UIState>) => void;
  setView: (patch: Partial<ViewState>) => void;
  requestFit: () => void;
}

const HISTORY_LIMIT = 200;
const COALESCE_MS = 900;

const initial = buildPreset(STARTUP_PRESET)!;

export const useStore = create<AppState>((set, get) => {
  const snap = (): Snapshot => ({ objects: get().objects, settings: get().settings });

  /** Push current state to the undo stack, unless coalesced with the previous edit. */
  const record = (key?: string) => {
    const now = Date.now();
    const c = get().coalesce;
    if (key && c && c.key === key && now - c.time < COALESCE_MS) {
      set({ coalesce: { key, time: now } });
      return;
    }
    set((s) => ({
      past: [...s.past, snap()].slice(-HISTORY_LIMIT),
      future: [],
      coalesce: key ? { key, time: now } : null,
    }));
  };

  return {
    objects: initial.objects,
    settings: initial.settings,
    selectedId: null,
    past: [],
    future: [],
    coalesce: null,
    baseline: { objects: initial.objects, settings: initial.settings },
    presetId: STARTUP_PRESET,
    ui: {
      showGrid: true,
      snap: false,
      showRays: true,
      showNormals: !!initial.ui.showNormals,
      showAngles: !!initial.ui.showAngles,
      paused: false,
    },
    view: { cx: 0, cy: 0, zoom: 1.2 },
    fitRequest: 1,

    checkpoint: () => record(),

    addObject: (o) => {
      record();
      set((s) => ({ objects: [...s.objects, o], selectedId: o.id }));
    },

    updateObject: (id, patch, opts = {}) => {
      if (opts.record !== false) record(opts.coalesce);
      set((s) => ({
        objects: s.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as SceneObject) : o)),
      }));
    },

    removeObject: (id) => {
      if (!get().objects.some((o) => o.id === id)) return;
      record();
      set((s) => ({ objects: s.objects.filter((o) => o.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }));
    },

    duplicateObject: (id) => {
      const o = get().objects.find((x) => x.id === id);
      if (!o) return;
      const c = cloneObject(o);
      c.x += 20;
      c.y -= 20;
      c.name = o.name.endsWith(' copy') ? o.name : `${o.name} copy`;
      get().addObject(c);
    },

    reorder: (id, where) => {
      const objs = get().objects;
      const o = objs.find((x) => x.id === id);
      if (!o) return;
      record();
      const rest = objs.filter((x) => x.id !== id);
      set({ objects: where === 'front' ? [...rest, o] : [o, ...rest] });
    },

    select: (id) => set({ selectedId: id }),

    setSettings: (patch, coalesce) => {
      record(coalesce);
      set((s) => ({ settings: { ...s.settings, ...patch } }));
    },

    loadScene: (data, presetId = null, ui) => {
      record();
      set((s) => ({
        objects: data.objects,
        settings: data.settings,
        baseline: { objects: data.objects, settings: data.settings },
        presetId,
        selectedId: null,
        ui: { ...s.ui, ...(ui ?? {}) },
        fitRequest: s.fitRequest + 1,
      }));
    },

    loadPreset: (id) => {
      const p = buildPreset(id);
      if (!p) return;
      get().loadScene({ objects: p.objects, settings: p.settings }, id, {
        showNormals: !!p.ui.showNormals,
        showAngles: !!p.ui.showAngles,
      });
    },

    resetScene: () => {
      const id = get().presetId;
      if (id) {
        get().loadPreset(id);
        return;
      }
      const b = get().baseline;
      get().loadScene({ objects: b.objects, settings: b.settings }, null);
    },

    clearScene: () => {
      record();
      set((s) => ({
        objects: [],
        settings: { ...DEFAULT_SETTINGS },
        baseline: { objects: [], settings: { ...DEFAULT_SETTINGS } },
        presetId: null,
        selectedId: null,
        fitRequest: s.fitRequest,
      }));
    },

    undo: () => {
      const { past, future } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      const cur = snap();
      set((s) => ({
        past: past.slice(0, -1),
        future: [cur, ...future].slice(0, HISTORY_LIMIT),
        objects: prev.objects,
        settings: prev.settings,
        coalesce: null,
        selectedId: prev.objects.some((o) => o.id === s.selectedId) ? s.selectedId : null,
      }));
    },

    redo: () => {
      const { past, future } = get();
      if (!future.length) return;
      const next = future[0];
      const cur = snap();
      set((s) => ({
        past: [...past, cur].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        objects: next.objects,
        settings: next.settings,
        coalesce: null,
        selectedId: next.objects.some((o) => o.id === s.selectedId) ? s.selectedId : null,
      }));
    },

    setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
    setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
    requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  };
});

/** Results of the latest trace plus live performance info (not part of undo history). */
interface TraceState {
  result: TraceResult | null;
  fps: number;
  renderMs: number;
  cursor: { x: number; y: number } | null;
}

export const useTraceStore = create<TraceState>(() => ({ result: null, fps: 0, renderMs: 0, cursor: null }));

export const useSelected = () => useStore((s) => s.objects.find((o) => o.id === s.selectedId) ?? null);

/** Simple toast notifications. */
interface ToastState {
  toasts: { id: number; text: string; tone: 'info' | 'error' }[];
  push: (text: string, tone?: 'info' | 'error') => void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
}));
