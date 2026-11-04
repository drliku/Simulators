import { createContext, useContext, useSyncExternalStore } from 'react';
import type { MirrorEngine } from './engine';

export const EngineContext = createContext<MirrorEngine | null>(null);

export function useEngine(): MirrorEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('useEngine must be used inside <EngineContext.Provider>');
  return engine;
}

/** Subscribe to one primitive engine value; re-renders only when it changes. */
export function useSim<T extends string | number | boolean>(select: (e: MirrorEngine) => T): T {
  const engine = useEngine();
  return useSyncExternalStore(engine.subscribe, () => select(engine));
}

/** Re-render on every simulation frame (for live readouts). */
export function useSimFrame(): MirrorEngine {
  const engine = useEngine();
  useSyncExternalStore(engine.subscribe, () => engine.version);
  return engine;
}
