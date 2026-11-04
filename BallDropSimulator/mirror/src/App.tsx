import { useEffect, useRef, useState } from 'react';
import { EngineContext } from './sim/context';
import { MirrorEngine } from './sim/engine';
import { SceneCanvas } from './components/SceneCanvas';
import { Narration, Timeline, Toolbar } from './components/Playback';
import { ControlsPanel } from './components/ControlsPanel';
import { Dashboard } from './components/Dashboard';
import { Experiments } from './components/Experiments';
import { Explanation } from './components/Explanation';
import { Notes } from './components/Notes';
import brainMark from './assets/brain-mark.png';

export default function App() {
  const [engine] = useState(() => new MirrorEngine());
  const sceneRef = useRef<HTMLElement>(null);

  useEffect(() => { engine.start(); return () => engine.stop(); }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select')) return;
      if (e.code === 'Space' && !el.closest('button, [role="button"]')) { e.preventDefault(); engine.toggle(); }
      else if (e.key === ',' || e.key === 'ArrowLeft') { if (!el.closest('button')) { e.preventDefault(); engine.stepFrame(-1); } }
      else if (e.key === '.' || e.key === 'ArrowRight') { if (!el.closest('button')) { e.preventDefault(); engine.stepFrame(1); } }
      else if (e.key === 'r' || e.key === 'R') engine.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  const scrollToScene = () => sceneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <EngineContext.Provider value={engine}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2" aria-label="The Brain Maze">
              <span className="grid font-display text-[21px] uppercase leading-[0.92] tracking-[0.04em] text-coral" aria-hidden="true">
                <span>The Brain</span>
                <span className="flex items-center justify-end gap-1.5 before:block before:h-[3px] before:w-[34px] before:bg-coral">Maze</span>
              </span>
              <img src={brainMark} alt="" width={42} height={42} className="h-[42px] w-[42px]" />
            </div>
            <span className="w-px self-stretch bg-white/15" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-normal uppercase leading-tight tracking-[0.04em] text-ink sm:text-3xl">Einstein's Mirror</h1>
              <p className="hidden text-[13.5px] text-ink-muted sm:block">An interactive relativity experiment</p>
            </div>
          </div>
          <span className="font-mono text-[11.5px] text-ink-faint">Space play/pause · ← → step · R reset</span>
        </header>

        <section className="glass flex flex-col gap-1 px-6 py-5">
          <p className="font-display text-[24px] uppercase leading-tight tracking-[0.03em] text-ink sm:text-[30px]">
            If you're travelling almost as fast as light, can you still see yourself in a mirror?
          </p>
          <p className="text-[14px] text-ink-muted">
            Speed the train up to 99.9% of c and watch both views. Einstein's answer is yes, and the reason is that light moves at c for every
            inertial observer.
          </p>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
          <section ref={sceneRef} className="glass flex min-w-0 scroll-mt-4 flex-col gap-4 p-4 xl:col-start-1 xl:row-start-1" aria-label="Experiment">
            <Toolbar />
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              <SceneCanvas />
            </div>
            <Timeline />
            <Narration />
          </section>
          <div className="flex min-w-0 flex-col gap-5 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <ControlsPanel />
            <Dashboard />
          </div>
        </div>

        <Experiments onRun={scrollToScene} />
        <Explanation />
        <Notes />

        <footer className="pt-2 text-center text-[12px] text-ink-faint">
          Special relativity with c = 299,792,458 m/s. Built with React, TypeScript, Tailwind CSS and Canvas.
        </footer>
      </div>
    </EngineContext.Provider>
  );
}
