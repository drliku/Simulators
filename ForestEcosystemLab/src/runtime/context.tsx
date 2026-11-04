import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Controller } from './controller';

export const ControllerContext = createContext<Controller | null>(null);

export function useController(): Controller {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('ControllerContext missing');
  return c;
}

/** Re-render with the controller's throttled UI updates (~6 per second). */
export function useUi(): Controller {
  const c = useController();
  useSyncExternalStore(c.subscribe, () => c.uiVersion);
  return c;
}
