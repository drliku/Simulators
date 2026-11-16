import brainMazeLogo from '../assets/brainmaze-logo.png';
import { useUi } from '../runtime/context';
import { SPEEDS, type CameraMode } from '../runtime/controller';
import type { HeatKind } from '../sim/heatmaps';
import { seasonName } from '../sim/vegetation';
import { WEATHER_ICON, WEATHER_LABEL } from '../sim/weather';

function clock(t: number) {
  const m = Math.floor(t * 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function Header() {
  const ctl = useUi();
  const sim = ctl.sim;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-3">
        <a href="https://thebrainmaze.com/" target="_top" className="inline-flex flex-none items-center">
          <img src={brainMazeLogo} alt="The Brain Maze" width={839} height={256} className="block h-9 w-auto" />
        </a>
        <span className="h-8 w-px bg-line" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold leading-tight text-ink">Forest Ecosystem Lab</h1>
          <p className="hidden text-[12px] text-ink-muted md:block">Fourteen species of a northern forest, simulated animal by animal</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-baseline gap-2 rounded-md border border-line px-2.5 py-1 font-mono text-[12px]" aria-live="off">
          <span className="text-ink">Day {Math.floor(sim.day)}</span>
          <span className="text-ink-muted">{clock(sim.timeOfDay)}</span>
          <span className="text-forest-soft">{seasonName(sim.day)}</span>
          <span className="text-ink" title="Current weather (see the Environment tab for its effects)"><span aria-hidden="true">{WEATHER_ICON[sim.weather.kind]}</span> {WEATHER_LABEL[sim.weather.kind]}</span>
        </div>
        <button type="button" className="btn btn-primary w-24 whitespace-nowrap" onClick={() => ctl.toggle()} aria-label={ctl.playing ? 'Pause' : 'Play'}>
          {ctl.playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button type="button" className="btn" onClick={() => ctl.stepOnce()} title="Advance one tick (about 12 minutes)">Step</button>
        <div className="flex gap-1" role="group" aria-label="Speed">
          {SPEEDS.map((s) => <button key={s} type="button" className="chip" aria-pressed={ctl.speed === s} onClick={() => ctl.setSpeed(s)}>{s}×</button>)}
        </div>
        <button type="button" className="btn" onClick={() => ctl.reset()} title="Restore the initial conditions">Reset</button>
      </div>
    </header>
  );
}

const CAMERAS: { id: CameraMode; label: string }[] = [
  { id: 'free', label: 'Free' }, { id: 'follow', label: 'Follow' }, { id: 'top', label: 'Top' }, { id: 'cinematic', label: 'Cinematic' },
];
const HEATS: { id: HeatKind | null; label: string }[] = [
  { id: null, label: 'Off' }, { id: 'vegetation', label: 'Vegetation' }, { id: 'deer', label: 'Deer' }, { id: 'wolves', label: 'Wolves' },
  { id: 'resources', label: 'Resources' }, { id: 'predation', label: 'Predation' },
];

/** Camera, heatmap and lighting options, overlaid on the 3D view. */
export function ViewToolbar() {
  const ctl = useUi();
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap justify-between gap-2">
      <div className="scroll-thin pointer-events-auto flex flex-wrap items-center gap-1 float-card rounded-[14px] p-1 backdrop-blur max-sm:max-w-full max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[&>*]:shrink-0" role="group" aria-label="Camera">
        {CAMERAS.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={ctl.cameraMode === c.id}
            disabled={c.id === 'follow' && ctl.selectedId === -1}
            title={c.id === 'follow' && ctl.selectedId === -1 ? 'Click an animal first' : undefined}
            onClick={() => ctl.setCamera(c.id)}>{c.label}</button>
        ))}
        <button type="button" className="chip" onClick={() => ctl.resetCamera()}>Reset view</button>
      </div>
      <div className="scroll-thin pointer-events-auto flex flex-wrap items-center gap-1 float-card rounded-[14px] p-1 backdrop-blur max-sm:max-w-full max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[&>*]:shrink-0">
        <label className="flex items-center gap-1.5 px-1 text-[12px] text-ink-muted">
          Heatmap
          <select className="h-7 px-1 text-[12px]" value={ctl.heat ?? ''}
            onChange={(e) => ctl.setHeat((e.target.value || null) as HeatKind | null)}>
            {HEATS.map((h) => <option key={h.label} value={h.id ?? ''}>{h.label}</option>)}
          </select>
        </label>
        <button type="button" className="chip" aria-pressed={ctl.dayNight} onClick={() => ctl.setDayNight(!ctl.dayNight)}>Day/night</button>
        <button type="button" className="chip" aria-pressed={ctl.huntAlerts} onClick={() => ctl.setHuntAlerts(!ctl.huntAlerts)} title="Highlight hunts in the forest and announce them">Hunt alerts</button>
        <button type="button" className="chip" aria-pressed={ctl.huntCam} onClick={() => ctl.setHuntCam(!ctl.huntCam)} title="Automatically slow to 1× and follow every new hunt">Hunt cam</button>
      </div>
      {ctl.speed > 2 && ctl.dayNight && (
        <p className="pointer-events-none w-full text-right text-[11px] text-ink-faint">Lighting is held at daylight above 2× so it does not flicker.</p>
      )}
    </div>
  );
}
