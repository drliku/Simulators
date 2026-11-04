import { Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AtomScene } from './components/AtomScene';
import type { Selection } from './components/AtomScene';
import { ParticleControls } from './components/ParticleControls';
import type { ParticleKind } from './components/ParticleControls';
import { InfoPanel } from './components/InfoPanel';
import { PeriodicTable } from './components/PeriodicTable';
import { EXTRA_ELECTRONS, MAX_NEUTRONS, maxElectrons, SHELL_LETTERS, shellCapacity, summarize } from './lib/atom';
import type { AtomCounts } from './lib/atom';
import { elementByZ, MAX_Z } from './lib/elements';

const HYDROGEN: AtomCounts = { protons: 1, neutrons: 0, electrons: 1 };

const PRESETS: { label: string; sub: string; counts: AtomCounts }[] = [
  { label: 'H', sub: 'Hydrogen', counts: { protons: 1, neutrons: 0, electrons: 1 } },
  { label: 'He', sub: 'Helium', counts: { protons: 2, neutrons: 2, electrons: 2 } },
  { label: 'C', sub: 'Carbon', counts: { protons: 6, neutrons: 6, electrons: 6 } },
  { label: 'O', sub: 'Oxygen', counts: { protons: 8, neutrons: 8, electrons: 8 } },
  { label: 'Na', sub: 'Sodium', counts: { protons: 11, neutrons: 12, electrons: 11 } },
];

const EXTRAS: { label: string; hint: string; counts: AtomCounts }[] = [
  { label: 'Deuterium', hint: 'Isotope: hydrogen with one neutron', counts: { protons: 1, neutrons: 1, electrons: 1 } },
  { label: 'Carbon-14', hint: 'Radioactive isotope used in dating', counts: { protons: 6, neutrons: 8, electrons: 6 } },
  { label: 'Na⁺', hint: 'Sodium ion: lost one electron', counts: { protons: 11, neutrons: 12, electrons: 10 } },
  { label: 'Cl⁻', hint: 'Chloride ion: gained one electron', counts: { protons: 17, neutrons: 18, electrons: 18 } },
  { label: 'O²⁻', hint: 'Oxide ion: gained two electrons', counts: { protons: 8, neutrons: 8, electrons: 10 } },
];

export default function App() {
  const [counts, setCounts] = useState<AtomCounts>(HYDROGEN);
  const [selected, setSelected] = useState<Selection>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const atom = useMemo(() => summarize(counts), [counts]);
  // Stable array identity for the scene's presence tracking.
  const shellsKey = atom.shells.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shells = useMemo(() => atom.shells, [shellsKey]);

  // Drop a shell selection that no longer exists.
  const sel: Selection = selected?.kind === 'shell' && selected.index >= shells.length ? null : selected;

  const limits = {
    protons: {
      min: 1,
      max: MAX_Z,
      minReason: 'An atom needs at least one proton — with none there is no element.',
      maxReason: `This simulator covers elements 1–${MAX_Z}.`,
    },
    neutrons: { min: 0, max: MAX_NEUTRONS, minReason: 'No neutrons left to remove.', maxReason: `Up to ${MAX_NEUTRONS} neutrons are supported.` },
    electrons: {
      min: 0,
      max: maxElectrons(counts.protons),
      minReason: 'No electrons left to remove.',
      maxReason: `At most ${EXTRA_ELECTRONS} extra electrons — more would not stay bound to the atom.`,
    },
  };

  const change = (kind: ParticleKind, delta: number) => {
    setCounts((c) => {
      const next = { ...c, [kind]: c[kind] + delta };
      next.protons = Math.min(MAX_Z, Math.max(1, next.protons));
      next.neutrons = Math.min(MAX_NEUTRONS, Math.max(0, next.neutrons));
      next.electrons = Math.min(maxElectrons(next.protons), Math.max(0, next.electrons));
      return next;
    });
  };

  const build = (c: AtomCounts) => {
    setCounts(c);
    setSelected(null);
  };

  const pickElement = (z: number) => {
    const el = elementByZ(z)!;
    build({ protons: z, neutrons: el.common - z, electrons: z });
  };

  const reset = () => {
    build(HYDROGEN);
    setResetSignal((n) => n + 1);
  };

  const isActive = (c: AtomCounts) => c.protons === counts.protons && c.neutrons === counts.neutrons && c.electrons === counts.electrons;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 lg:px-8">
        {/* Wordmark laid out like The Brain Maze logo */}
        <div className="flex items-stretch gap-3 sm:gap-4">
          <div className="flex flex-col justify-center">
            <h1 className="font-display text-[34px] font-bold uppercase leading-[0.9] tracking-wide text-coral sm:text-[52px]">Atom</h1>
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <span className="h-[3px] w-10 bg-coral sm:h-1 sm:w-20" />
              <span className="font-display text-[34px] font-bold uppercase leading-[0.9] tracking-wide text-coral sm:text-[52px]">Builder</span>
            </div>
          </div>
          <AtomLogo />
          <p className="hidden max-w-[220px] self-center text-sm leading-snug text-lab-300 lg:block">
            Add protons, neutrons and electrons and watch the element, isotope and charge change.
          </p>
        </div>
        <button type="button" onClick={reset} className="btn-coral" title="Return to a hydrogen atom">
          <ResetIcon /> Reset to hydrogen
        </button>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 pb-10 pt-2 sm:px-6 lg:px-8 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        {/* Stage */}
        <section className="relative order-1 min-w-0 xl:order-2">
          <div className="panel stage-grid relative h-[440px] overflow-hidden sm:h-[560px] xl:h-[720px]">
            <Suspense fallback={null}>
              <AtomScene
                protons={counts.protons}
                neutrons={counts.neutrons}
                shells={shells}
                showLabels={showLabels}
                animate={animate}
                autoRotate={autoRotate}
                selected={sel}
                onSelect={setSelected}
                resetSignal={resetSignal}
              />
            </Suspense>

            {/* HUD: identity */}
            <div className="pointer-events-none absolute left-4 top-4 sm:left-5 sm:top-5">
              <div key={atom.element.z} className="animate-rise">
                <div className="font-math text-4xl font-extrabold leading-none text-white sm:text-5xl">
                  {atom.ionSymbol}
                </div>
                <div className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-coral">{atom.element.name}</div>
                <div className="font-mono text-[11px] text-lab-400">
                  Z = {counts.protons} · A = {atom.massNumber}
                </div>
              </div>
            </div>

            {/* HUD: view controls */}
            <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
              <div className="flex gap-2">
                <HudToggle label="Labels" on={showLabels} onClick={() => setShowLabels((v) => !v)} />
                <button type="button" className="chip bg-lab-950/60 font-display text-sm font-bold uppercase tracking-wide backdrop-blur" onClick={() => setResetSignal((n) => n + 1)} title="Reset camera">
                  Reset view
                </button>
              </div>
            </div>

            {/* HUD: legend */}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-lab-950/70 font-math px-3 py-2 text-[11px] text-lab-200 backdrop-blur sm:bottom-4 sm:left-4">
              <Legend color="#F37367" label="Proton p⁺" />
              <Legend color="#a9b4c8" label="Neutron n⁰" />
              <Legend color="#4cb5ff" label="Electron e⁻" />
            </div>

            <div className="pointer-events-none absolute bottom-3 right-3 hidden max-w-[260px] text-right text-[11px] leading-snug text-lab-400 sm:bottom-4 sm:right-4 sm:block">
              Drag to rotate · scroll or pinch to zoom · tap the nucleus or a shell
            </div>

            {/* Selection explainer */}
            {sel && (
              <div className="absolute inset-x-3 bottom-14 flex justify-center sm:bottom-16">
                <div key={JSON.stringify(sel)} className="animate-rise max-w-md rounded-2xl border border-white/10 bg-lab-950/85 p-4 shadow-panel backdrop-blur-xl">
                  <SelectionText selection={sel} protons={counts.protons} neutrons={counts.neutrons} shells={shells} />
                  <button type="button" className="mt-2 font-display text-sm font-bold uppercase tracking-wide text-coral hover:text-coral-400" onClick={() => setSelected(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-lab-400">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-coral">Bohr model:</span> a simplified educational picture. Real electrons don’t follow
            circular orbits — they occupy fuzzy probability clouds (orbitals). Sizes are not to scale: a real nucleus is about
            100,000× smaller than its atom.
          </p>
        </section>

        {/* Controls */}
        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          <ParticleControls
            counts={counts}
            limits={limits}
            onChange={change}
            footer={
              <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
                <Switch label="Particle labels" hint="Show + n − on each particle and shell letters" on={showLabels} onChange={setShowLabels} />
                <Switch label="Auto-rotate" hint="Slowly turn the atom" on={autoRotate} onChange={setAutoRotate} />
                <Switch label="Electron motion" hint="Animate electrons around their shells" on={animate} onChange={setAnimate} />
              </div>
            }
          />

          <div className="panel p-5">
            <h2 className="panel-title mb-3">Examples</h2>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => build(p.counts)}
                  className={`flex flex-col items-center rounded-2xl border py-2.5 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-electron/60 ${
                    isActive(p.counts) ? 'border-coral bg-coral/20' : 'border-white/15 bg-white/[0.03] hover:border-coral/60 hover:bg-white/[0.06]'
                  }`}
                  title={p.sub}
                >
                  <span className="font-math text-lg font-bold text-white">{p.label}</span>
                  <span className="text-[10px] text-lab-300">{p.sub}</span>
                </button>
              ))}
            </div>
            <h3 className="mb-2 mt-4 font-display text-sm font-bold uppercase tracking-wide text-lab-300">Isotopes & ions</h3>
            <div className="flex flex-wrap gap-2">
              {EXTRAS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => build(p.counts)}
                  title={p.hint}
                  className={`chip font-math text-[13px] ${isActive(p.counts) ? 'border-coral bg-coral/20' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="order-3 min-w-0">
          <InfoPanel
            atom={atom}
            protons={counts.protons}
            neutrons={counts.neutrons}
            electrons={counts.electrons}
            selected={sel}
            onSelect={setSelected}
            onMakeNeutral={() => setCounts((c) => ({ ...c, electrons: c.protons }))}
            onCommonIsotope={() => setCounts((c) => ({ ...c, neutrons: elementByZ(c.protons)!.common - c.protons }))}
          />
        </div>

        {/* Periodic table */}
        <div className="order-4 min-w-0 xl:col-span-3">
          <PeriodicTable activeZ={counts.protons} onPick={pickElement} />
        </div>

        {/* Learn */}
        <section className="order-5 grid gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-4">
          <LearnCard color="#F37367" title="Protons" symbol="p⁺" tag="Identity">
            Positively charged particles in the nucleus. The number of protons is the <b>atomic number</b> and decides which element the atom
            is: 1 proton is always hydrogen, 6 is always carbon.
          </LearnCard>
          <LearnCard color="#a9b4c8" title="Neutrons" symbol="n⁰" tag="Isotope">
            Neutral particles in the nucleus with almost the same mass as a proton. Changing them makes a different <b>isotope</b> of the same
            element, such as carbon-12 and carbon-14.
          </LearnCard>
          <LearnCard color="#4cb5ff" title="Electrons" symbol="e⁻" tag="Charge">
            Tiny negative particles around the nucleus. Equal electrons and protons make a neutral atom; losing electrons makes a positive{' '}
            <b>cation</b>, gaining them makes a negative <b>anion</b>.
          </LearnCard>
          <LearnCard color="#F37367" title="About this model" tag="Bohr model">
            Electrons are drawn on circular shells holding up to 2n² electrons (2, 8, 18, 32). This is a simplified teaching model: real
            electrons live in probability clouds called orbitals.
          </LearnCard>
        </section>
      </main>
    </div>
  );
}

function SelectionText({ selection, protons, neutrons, shells }: { selection: NonNullable<Selection>; protons: number; neutrons: number; shells: number[] }) {
  if (selection.kind === 'nucleus') {
    return (
      <>
        <div className="font-display text-lg font-bold uppercase tracking-wide text-coral">The nucleus</div>
        <p className="mt-1 text-sm leading-relaxed text-lab-200">
          {protons} proton{protons === 1 ? '' : 's'} and {neutrons} neutron{neutrons === 1 ? '' : 's'} packed together. The nucleus holds
          over 99.9% of the atom’s mass. Its protons decide the element; neutrons add mass and help hold the nucleus together.
        </p>
      </>
    );
  }
  const i = selection.index;
  const n = i + 1;
  const isOuter = i === shells.length - 1;
  return (
    <>
      <div className="font-display text-lg font-bold uppercase tracking-wide text-electron">
        Shell {n} ({SHELL_LETTERS[i]}) · {shells[i]} of {shellCapacity(n)} electrons
      </div>
      <p className="mt-1 text-sm leading-relaxed text-lab-200">
        In the Bohr model, shell n can hold up to 2n² = {shellCapacity(n)} electrons. Shells farther from the nucleus hold electrons with
        more energy.
        {isOuter && ' This is the outer (valence) shell — its electrons take part in chemical bonding.'}
      </p>
    </>
  );
}

function LearnCard({ color, title, symbol, tag, children }: { color: string; title: string; symbol?: string; tag: string; children: ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
          {title}
          {symbol && <span className="font-math text-sm font-semibold normal-case" style={{ color }}>{symbol}</span>}
        </span>
        <span className="rounded-md border border-coral/40 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-coral">{tag}</span>
      </div>
      <p className="text-sm leading-relaxed text-lab-300 [&_b]:font-semibold [&_b]:text-white">{children}</p>
    </div>
  );
}

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-electron/60"
    >
      <span>
        <span className="block font-display text-base font-bold uppercase tracking-wide text-lab-100">{label}</span>
        <span className="block text-[11px] text-lab-400">{hint}</span>
      </span>
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-md transition-colors duration-300 ${on ? 'bg-coral' : 'bg-white/15'}`}>
        <span className={`inline-block h-5 w-5 rounded bg-white shadow transition-transform duration-300 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function HudToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`chip font-display text-sm font-bold uppercase tracking-wide backdrop-blur ${on ? 'border-coral bg-coral text-white' : 'bg-lab-950/60'}`}
    >
      <span className={`h-1.5 w-1.5 ${on ? 'bg-white' : 'bg-lab-400'}`} />
      {label}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function AtomLogo() {
  return (
    <div className="grid aspect-square w-[68px] shrink-0 place-items-center bg-coral sm:w-[104px]">
      <svg viewBox="0 0 32 32" className="h-[78%] w-[78%]" aria-hidden>
        <ellipse cx="16" cy="16" rx="12.5" ry="4.8" fill="none" stroke="#232F5B" strokeWidth="1.9" />
        <ellipse cx="16" cy="16" rx="12.5" ry="4.8" fill="none" stroke="#232F5B" strokeWidth="1.9" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="12.5" ry="4.8" fill="none" stroke="#232F5B" strokeWidth="1.9" transform="rotate(120 16 16)" />
        <circle cx="16" cy="16" r="3.1" fill="#232F5B" />
      </svg>
    </div>
  );
}

const ResetIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
    <path d="M3.5 3.5v3.5H7" />
  </svg>
);
