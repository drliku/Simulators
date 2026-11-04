import { useCallback, useEffect, useRef, useState } from 'react';

export type DemoPhase = 'highlightA' | 'highlightB' | 'highlightC' | 'shear1' | 'rotate' | 'shear2' | 'conclude';

interface PhaseDef {
  id: DemoPhase;
  duration: number;
}

export const DEMO_PHASES: PhaseDef[] = [
  { id: 'highlightA', duration: 1500 },
  { id: 'highlightB', duration: 1500 },
  { id: 'highlightC', duration: 1500 },
  { id: 'shear1', duration: 1800 },
  { id: 'rotate', duration: 1800 },
  { id: 'shear2', duration: 1800 },
  { id: 'conclude', duration: 1600 },
];

const TOTAL = DEMO_PHASES.reduce((s, p) => s + p.duration, 0);

export interface DemoFrame {
  phase: DemoPhase;
  index: number;
  /** Eased progress within the phase, 0 → 1. */
  t: number;
  /** Linear progress of the whole demo, 0 → 1. */
  overall: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function frameAt(ms: number): DemoFrame {
  let acc = 0;
  for (let i = 0; i < DEMO_PHASES.length; i++) {
    const p = DEMO_PHASES[i];
    if (ms < acc + p.duration) {
      return { phase: p.id, index: i, t: easeInOut((ms - acc) / p.duration), overall: ms / TOTAL };
    }
    acc += p.duration;
  }
  const last = DEMO_PHASES.length - 1;
  return { phase: DEMO_PHASES[last].id, index: last, t: 1, overall: 1 };
}

/**
 * Drives the animated proof. `frame` is null when the demo is not showing.
 * After finishing, the final frame stays on screen until `stop()`.
 */
export function useDemo() {
  const [frame, setFrame] = useState<DemoFrame | null>(null);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setRunning(false);
    setFrame(null);
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    setRunning(true);
    const tick = (now: number) => {
      const ms = now - start;
      setFrame(frameAt(ms));
      if (ms < TOTAL) raf.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return { frame, running, play, stop };
}
