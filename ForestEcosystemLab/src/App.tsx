import { useEffect, useState } from 'react';
import { Scene } from './render/Scene';
import { ControllerContext } from './runtime/context';
import { Controller, SPEEDS } from './runtime/controller';
import { Chart } from './ui/Chart';
import { Header, ViewToolbar } from './ui/Header';
import { HuntBanner, HuntToasts } from './ui/Hunts';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';

export default function App() {
  const [controller] = useState(() => new Controller());
  // Handy for exploring the model from the browser console (and for automated checks).
  (window as unknown as { ecosystem: Controller }).ecosystem = controller;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); controller.toggle(); }
      else if (e.key === '.' || e.key === 'ArrowRight') controller.stepOnce();
      else if (e.key >= '1' && e.key <= '4') controller.setSpeed(SPEEDS[Number(e.key) - 1]);
      else if (e.key === 'Escape') controller.deselect();
      else if (e.key === 'f' && controller.selectedId !== -1) controller.follow();
      else if (e.key === 'h') controller.watchHunt();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller]);

  return (
    <ControllerContext.Provider value={controller}>
      <div className="flex min-h-full flex-col lg:h-full lg:min-h-[680px] gap-2 bg-char-950 p-2 font-sans text-ink">
        <Header />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)_230px]">
          <div className="order-2 h-[420px] lg:order-none lg:row-span-2 lg:h-auto lg:min-h-0 [&>aside]:h-full"><LeftPanel /></div>
          <main className="relative order-1 h-[52vh] min-h-[320px] overflow-hidden rounded-xl border border-white/[0.07] lg:order-none lg:h-auto" aria-label="3D forest view">
            <Scene controller={controller} />
            <ViewToolbar />
            <HuntToasts />
            <HuntBanner />
            <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/60">Drag to orbit · scroll to zoom · right-drag to pan · click an animal to inspect</p>
          </main>
          <div className="order-3 h-[420px] lg:order-none lg:row-span-2 lg:h-auto lg:min-h-0 [&>aside]:h-full"><RightPanel /></div>
          <div className="order-4 h-[240px] min-w-0 lg:order-none lg:col-start-2 lg:row-start-2 lg:h-auto lg:min-h-0 [&>section]:h-full"><Chart /></div>
        </div>
        <p className="px-1 text-[11px] text-ink-faint">Space play/pause · → step · 1–4 speed · F follow · H watch a hunt · Esc deselect. An agent-based model for exploring ideas, not a forecast of any real population.</p>
      </div>
    </ControllerContext.Provider>
  );
}
