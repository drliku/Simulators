import type { ReactNode } from 'react';
import type { AtomSummary } from '../lib/atom';
import { chargeSuperscript, chargeText, formatConfiguration, SHELL_LETTERS, shellCapacity } from '../lib/atom';
import { CATEGORY_INFO } from '../lib/elements';
import type { Selection } from './AtomScene';

interface Props {
  atom: AtomSummary;
  protons: number;
  neutrons: number;
  electrons: number;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onMakeNeutral: () => void;
  onCommonIsotope: () => void;
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <div className="text-[11px] font-medium text-lab-300">{label}</div>
      <div className={`font-display text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

const ION_STYLE = {
  neutral: { label: 'Neutral atom', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  cation: { label: 'Cation · positive ion', cls: 'border-proton/40 bg-proton/10 text-proton' },
  anion: { label: 'Anion · negative ion', cls: 'border-electron/40 bg-electron/10 text-electron' },
} as const;

const STABILITY = {
  stable: { label: 'Stable isotope', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  'long-lived': { label: 'Radioactive · very long-lived', cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
  unstable: { label: 'Unstable · radioactive or unknown', cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
} as const;

export function InfoPanel({ atom, protons, neutrons, electrons, selected, onSelect, onMakeNeutral, onCommonIsotope }: Props) {
  const el = atom.element;
  const cat = CATEGORY_INFO[el.category];
  const ion = ION_STYLE[atom.ionType];
  const stab = STABILITY[atom.stability];
  const isCommonIsotope = atom.massNumber === el.common;

  return (
    <div className="panel p-5">
      <h2 className="panel-title mb-4">Element information</h2>

      {/* Identity */}
      <div key={el.z} className="animate-rise flex items-center gap-4">
        <div
          className="relative grid h-[104px] w-[104px] shrink-0 place-items-center border-2 bg-lab-850"
          style={{ borderColor: `${cat.color}55`, boxShadow: `0 0 40px -12px ${cat.color}aa inset` }}
        >
          {/* Nuclide notation: mass number top-left, atomic number bottom-left, charge top-right */}
          <span className="absolute left-3 top-2.5 font-mono text-xs font-semibold text-lab-200">{atom.massNumber}</span>
          <span className="absolute bottom-2.5 left-3 font-mono text-xs font-semibold text-proton">{protons}</span>
          {atom.charge !== 0 && (
            <span className={`absolute right-2.5 top-2 font-math text-sm font-bold ${atom.charge > 0 ? 'text-proton' : 'text-electron'}`}>
              {chargeSuperscript(atom.charge)}
            </span>
          )}
          <span className="font-math text-5xl font-extrabold tracking-tight text-white">{el.symbol}</span>
        </div>
        <div className="min-w-0">
          <div className="font-display text-3xl font-bold uppercase tracking-wide text-coral">{el.name}</div>
          <div className="mt-0.5 text-sm text-lab-300">
            {atom.isotopeName}
            {atom.isotopeAlias && <span className="text-lab-400"> ({atom.isotopeAlias})</span>}
          </div>
          <span
            className="mt-2 inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ color: cat.color, borderColor: `${cat.color}44`, background: `${cat.color}14` }}
          >
            {cat.label}
          </span>
        </div>
      </div>

      {/* Numbers */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Atomic no. (Z)" value={protons} accent="text-proton" />
        <Stat label="Mass no. (A)" value={atom.massNumber} />
        <Stat label="Charge" value={chargeText(atom.charge)} accent={atom.charge > 0 ? 'text-proton' : atom.charge < 0 ? 'text-electron' : 'text-white'} />
        <Stat label="Protons" value={protons} accent="text-proton" />
        <Stat label="Neutrons" value={neutrons} accent="text-neutron" />
        <Stat label="Electrons" value={electrons} accent="text-electron" />
      </div>

      {/* Charge status */}
      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${ion.cls}`}>{ion.label}</span>
          <span className="font-math text-lg font-bold text-white">{atom.ionSymbol}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-lab-300">
          <span className="text-proton">{protons} protons (+{protons})</span> and{' '}
          <span className="text-electron">
            {electrons} electrons ({electrons === 0 ? '0' : `−${electrons}`})
          </span>{' '}
          give a net charge of <span className="font-semibold text-white">{chargeText(atom.charge)}</span>
          {atom.ionType === 'cation' && ` — the atom has lost ${atom.charge} electron${atom.charge > 1 ? 's' : ''}.`}
          {atom.ionType === 'anion' && ` — the atom has gained ${-atom.charge} electron${atom.charge < -1 ? 's' : ''}.`}
          {atom.ionType === 'neutral' && ' — equal numbers of protons and electrons.'}
        </p>
        {atom.ionType !== 'neutral' && (
          <p className={`mt-1.5 text-xs ${atom.commonIon ? 'text-emerald-300' : 'text-amber-300'}`}>
            {atom.commonIon
              ? `${atom.ionSymbol} is a common ion: the ${atom.ionName}.`
              : `${atom.ionSymbol} is not an ion ${el.name.toLowerCase()} normally forms.`}
          </p>
        )}
        {atom.ionType !== 'neutral' && (
          <button type="button" className="chip mt-2.5" onClick={onMakeNeutral}>
            Make neutral
          </button>
        )}
      </div>

      {/* Isotope */}
      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-lab-300">Isotope</span>
          <span className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${stab.cls}`}>{stab.label}</span>
        </div>
        <div className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-white">
          {atom.isotopeName}{' '}
          <span className="font-mono text-xs font-normal normal-case tracking-normal text-lab-300">
            ({protons} p + {neutrons} n = {atom.massNumber})
          </span>
        </div>
        <p className="mt-1 text-xs text-lab-300">
          Standard atomic weight of {el.name.toLowerCase()}: <span className="font-mono text-lab-100">{el.weight} u</span>
          {isCommonIsotope ? ` · ${atom.isotopeName} is its most abundant isotope.` : ''}
        </p>
        {!isCommonIsotope && (
          <button type="button" className="chip mt-2.5" onClick={onCommonIsotope}>
            Use most common isotope ({el.name}-{el.common})
          </button>
        )}
      </div>

      {/* Shells */}
      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-lab-300">Electron shells</span>
          <span className="text-[11px] text-lab-400">Tap a shell to highlight it</span>
        </div>
        {atom.shells.length === 0 ? (
          <p className="mt-2 text-sm text-lab-300">No electrons — a bare nucleus.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {atom.shells.map((count, i) => {
              const active = selected?.kind === 'shell' && selected.index === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(active ? null : { kind: 'shell', index: i })}
                  className={`rounded-xl border px-2.5 py-1.5 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-electron/60 ${
                    active ? 'border-electron/70 bg-electron/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                  }`}
                  aria-pressed={active}
                >
                  <div className="font-mono text-[10px] text-lab-300">
                    n={i + 1} · {SHELL_LETTERS[i]}
                  </div>
                  <div className="font-display text-lg font-bold text-white">
                    {count}
                    <span className="text-[10px] font-medium text-lab-400"> / {shellCapacity(i + 1)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-2.5 font-mono text-sm font-semibold text-electron">{atom.shells.join(', ') || '0'}</div>
        <div className="mt-1 break-words font-mono text-[11px] leading-relaxed text-lab-300">{formatConfiguration(atom.config)}</div>
        {atom.shells.length > 0 && (
          <p className="mt-1.5 text-xs text-lab-300">
            Outer (valence) shell: <span className="font-semibold text-white">{atom.valence}</span> electron{atom.valence === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(selected?.kind === 'nucleus' ? null : { kind: 'nucleus' })}
        className={`mt-3 w-full rounded-lg border-2 px-3 py-2.5 font-display text-base font-bold uppercase tracking-wide transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-proton/60 ${
          selected?.kind === 'nucleus' ? 'border-coral bg-coral text-white' : 'border-coral/60 bg-transparent text-coral hover:bg-coral/10'
        }`}
        aria-pressed={selected?.kind === 'nucleus'}
      >
        {selected?.kind === 'nucleus' ? 'Nucleus highlighted' : 'Highlight the nucleus'}
      </button>
    </div>
  );
}
