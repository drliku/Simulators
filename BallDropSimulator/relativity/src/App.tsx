import { useEffect, useRef, useState } from 'react';
import { EngineContext } from './sim/context';
import { SimEngine } from './sim/engine';
import { SimulationStage } from './components/SimulationStage';
import { ControlsPanel } from './components/ControlsPanel';
import { StatsPanel } from './components/StatsPanel';
import { TimeGraph } from './components/TimeGraph';
import { LightClock, type LightClockSettings } from './components/LightClock';
import { Scenarios } from './components/Scenarios';
import { Notes } from './components/Notes';
import brainMark from './assets/brain-mark.png';

export default function App() {
  const [engine] = useState(() => new SimEngine({ autoStart: false }));
  const [lc, setLc] = useState<LightClockSettings>({ linked: true, beta: 0.8, slow: false });
  const lightClockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select')) return;
      if (e.code === 'Space' && !el.closest('button, summary, [role="button"]')) {
        e.preventDefault();
        engine.toggle();
      } else if (e.key === 'r' || e.key === 'R') {
        engine.reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  const showLightClock = () => {
    setLc({ linked: false, beta: 0.8, slow: true });
    lightClockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <EngineContext.Provider value={engine}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2" aria-label="The Brain Maze">
              <span className="grid font-display text-[21px] uppercase leading-[0.92] tracking-[0.04em] text-ship" aria-hidden="true">
                <span>The Brain</span>
                <span className="flex items-center justify-end gap-1.5 before:block before:h-[3px] before:w-[34px] before:bg-ship">Maze</span>
              </span>
              <img src={brainMark} alt="" width={42} height={42} className="h-[42px] w-[42px]" />
            </div>
            <span className="w-px self-stretch bg-white/15" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-normal uppercase leading-tight tracking-[0.04em] text-ink sm:text-3xl">Time Dilation Lab</h1>
              <p className="hidden text-[13.5px] text-ink-muted sm:block">Two perfect clocks, two observers in relative motion, two different elapsed times.</p>
            </div>
          </div>
          <p className="max-w-md text-[12.5px] leading-relaxed text-ink-faint">
            Special relativity, constant velocity, one-way trip. All values are computed live from γ = 1/√(1 − β²).
          </p>
        </header>

        {/* Phones: stage, controls, stats, graph. Desktop: stage and graph left, controls and stats right. */}
        <div id="lab" className="grid scroll-mt-4 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <SimulationStage />
          </div>
          <div className="flex min-w-0 flex-col gap-5 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <ControlsPanel />
            <StatsPanel />
          </div>
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <TimeGraph />
          </div>
        </div>

        <LightClock ref={lightClockRef} settings={lc} onChange={setLc} />
        <Scenarios onLightClock={showLightClock} />
        <Notes />

        <footer className="pt-2 text-center text-[12px] text-ink-faint">
          Built with React, TypeScript, Tailwind CSS and Canvas. Years are Julian (365.25 days); a light-year is c × 1 Julian year.
        </footer>
      </div>
    </EngineContext.Provider>
  );
}
