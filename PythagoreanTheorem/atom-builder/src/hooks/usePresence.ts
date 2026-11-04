import { useEffect, useRef, useState } from 'react';

export interface Presence<T> {
  key: string;
  item: T;
  alive: boolean;
}

/**
 * Keeps removed items around for `exitMs` so they can animate out.
 * Items are matched by `getKey`; re-added keys come back to life.
 */
export function usePresence<T>(items: T[], getKey: (t: T) => string, exitMs = 600): Presence<T>[] {
  const [exiting, setExiting] = useState<Map<string, T>>(new Map());
  const prev = useRef<Map<string, T>>(new Map());

  const current = new Map(items.map((t) => [getKey(t), t] as const));

  useEffect(() => {
    const removed: [string, T][] = [];
    prev.current.forEach((item, key) => {
      if (!current.has(key)) removed.push([key, item]);
    });
    prev.current = current;
    if (removed.length === 0) {
      setExiting((ex) => {
        let changed = false;
        const next = new Map(ex);
        current.forEach((_, k) => {
          if (next.delete(k)) changed = true;
        });
        return changed ? next : ex;
      });
      return;
    }
    setExiting((ex) => {
      const next = new Map(ex);
      removed.forEach(([k, v]) => next.set(k, v));
      current.forEach((_, k) => next.delete(k));
      return next;
    });
    // Not cancelled on re-run: each batch of removals expires on its own schedule.
    window.setTimeout(() => {
      setExiting((ex) => {
        const next = new Map(ex);
        removed.forEach(([k]) => {
          if (!prev.current.has(k)) next.delete(k);
        });
        return next;
      });
    }, exitMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const out: Presence<T>[] = items.map((item) => ({ key: getKey(item), item, alive: true }));
  exiting.forEach((item, key) => {
    if (!current.has(key)) out.push({ key, item, alive: false });
  });
  return out;
}
