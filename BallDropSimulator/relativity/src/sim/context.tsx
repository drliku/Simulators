import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SimEngine } from './engine';

export const EngineContext = createContext<SimEngine | null>(null);

export function useEngine(): SimEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('useEngine must be used inside <EngineContext.Provider>');
  return engine;
}

/** Subscribe to one primitive engine value; re-renders only when it changes. */
export function useSim<T extends string | number | boolean>(select: (e: SimEngine) => T): T {
  const engine = useEngine();
  return useSyncExternalStore(engine.subscribe, () => select(engine));
}

/** Re-render on every simulation frame (for live readouts). */
export function useSimFrame(): SimEngine {
  const engine = useEngine();
  useSyncExternalStore(engine.subscribe, () => engine.version);
  return engine;
}
