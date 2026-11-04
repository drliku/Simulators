import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** An inline term with a tooltip. Hover or focus to open, tap to toggle on touch screens. */
export function Term({ children, tip }: { children: ReactNode; tip: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const width = Math.min(290, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    const above = r.top > 180;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <span
      ref={ref}
      className="term"
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      {children}
      {open && pos && createPortal(
        <div
          id={id}
          role="tooltip"
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, transform: pos.above ? 'translateY(-100%)' : undefined }}
          className="pointer-events-none z-50 rounded-xl border border-white/10 bg-space-900/95 px-3.5 py-3 text-left text-[12.5px] font-normal normal-case leading-relaxed tracking-normal text-ink-muted shadow-glass backdrop-blur"
        >
          {tip}
        </div>,
        document.body,
      )}
    </span>
  );
}
