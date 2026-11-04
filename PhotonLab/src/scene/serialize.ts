import { MATERIALS } from '../engine/materials';
import { defaultsFor, uid } from './factory';
import { DEFAULT_SETTINGS, type Material, type SceneData, type SceneObject, type SimSettings } from './types';

export const FILE_FORMAT = 'photon-lab-scene';
export const FILE_VERSION = 1;

const KINDS = new Set(['source', 'mirror', 'body', 'thinlens', 'detector', 'ruler', 'protractor']);

const ENUMS: Record<string, string[]> = {
  emitter: ['laser', 'beam', 'point', 'fan'],
  spectrum: ['mono', 'white', 'rgb'],
  shape: ['flat', 'concave', 'convex', 'parabolic', 'arc', 'rect', 'circle', 'prism', 'lens', 'fiber'],
  polarization: ['unpolarized', 's', 'p'],
  preset: Object.keys(MATERIALS),
};

export function serializeScene(data: SceneData): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, settings: data.settings, objects: data.objects }, null, 2);
}

/** Copies fields from `src` that match the type of the template field (with enum validation). */
function mergeTyped<T extends object>(template: T, src: unknown): T {
  const out = { ...template } as Record<string, unknown>;
  if (!src || typeof src !== 'object') return out as T;
  const s = src as Record<string, unknown>;
  for (const key of Object.keys(template)) {
    const tv = (template as Record<string, unknown>)[key];
    const v = s[key];
    if (v === undefined || key === 'kind') continue;
    if (typeof tv === 'number' && typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof tv === 'boolean' && typeof v === 'boolean') out[key] = v;
    else if (typeof tv === 'string' && typeof v === 'string') {
      if (ENUMS[key] && !ENUMS[key].includes(v)) continue;
      out[key] = v.slice(0, 200);
    }
  }
  return out as T;
}

export function sanitizeObject(raw: unknown): SceneObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const kind = (raw as { kind?: unknown }).kind;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  const template = defaultsFor(kind as SceneObject['kind']);
  const obj = mergeTyped(template, raw);
  if (obj.kind === 'body') {
    const m = (raw as { material?: unknown }).material;
    obj.material = mergeTyped<Material>(template.kind === 'body' ? template.material : obj.material, m);
  }
  const shapeOk =
    obj.kind === 'mirror'
      ? ['flat', 'concave', 'convex', 'parabolic', 'arc'].includes(obj.shape)
      : obj.kind === 'body'
        ? ['rect', 'circle', 'prism', 'lens', 'fiber'].includes(obj.shape)
        : true;
  if (!shapeOk) return null;
  return obj;
}

export function parseScene(text: string): SceneData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!json || typeof json !== 'object') throw new Error('Unexpected file contents.');
  const j = json as { objects?: unknown; settings?: unknown };
  if (!Array.isArray(j.objects)) throw new Error('No "objects" array found in the scene file.');
  const seen = new Set<string>();
  const objects: SceneObject[] = [];
  for (const raw of j.objects) {
    const o = sanitizeObject(raw);
    if (!o) continue;
    if (seen.has(o.id) || !o.id) o.id = uid(o.kind.slice(0, 3));
    seen.add(o.id);
    objects.push(o);
  }
  const settings = mergeTyped<SimSettings>(DEFAULT_SETTINGS, j.settings);
  return { objects, settings };
}
