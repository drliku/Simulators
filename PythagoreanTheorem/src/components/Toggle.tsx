interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}

export function Toggle({ label, checked, onChange, description }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <span>
        <span className="block font-display text-[16px] font-bold uppercase tracking-wide text-navy">{label}</span>
        {description && <span className="block text-xs text-slate-400">{description}</span>}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-md transition-colors duration-300 ${
          checked ? 'bg-coral' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded bg-white shadow transition-transform duration-300 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
