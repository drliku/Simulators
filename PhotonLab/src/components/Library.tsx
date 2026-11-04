import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { CATEGORY_LABELS, LIBRARY, type LibraryCategory, type LibraryItem } from '../scene/factory';
import { useStore } from '../state/store';
import { canvasApi, DRAG_MIME } from './CanvasView';
import { ItemIcon } from './ItemIcon';

const ORDER: LibraryCategory[] = ['sources', 'mirrors', 'lenses', 'prisms', 'materials', 'tools'];

export function Library() {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const addCount = useRef(0);
  const addObject = useStore((s) => s.addObject);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORDER.map((cat) => ({
      cat,
      items: LIBRARY.filter((i) => i.category === cat && (!q || `${i.label} ${i.hint}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
  }, [query]);

  const add = (item: LibraryItem) => {
    const [cx, cy] = canvasApi.center();
    const k = addCount.current++ % 6;
    addObject(item.create(Math.round(cx + k * 20), Math.round(cy - k * 20)));
  };

  return (
    <aside className="flex h-full w-full flex-col">
      <div className="border-b border-white/[0.06] p-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-ink-950/60 px-2.5 focus-within:border-coral-500/60">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input
            className="w-full bg-transparent text-[12px] text-slate-200 outline-none placeholder:text-slate-600"
            placeholder="Search components…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto pb-6">
        {groups.map(({ cat, items }) => (
          <div key={cat} className="px-3 pt-3">
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-1.5 brand-label text-[12.5px] text-slate-400 hover:text-coral-300"
              onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${collapsed[cat] ? '-rotate-90' : ''}`} />
              {CATEGORY_LABELS[cat]}
              <span className="ml-auto font-mono text-[10px] text-slate-600">{items.length}</span>
            </button>
            {!collapsed[cat] && (
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, item.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => add(item)}
                    title={`${item.label} — ${item.hint}\nClick to add, or drag onto the canvas`}
                    className="group flex aspect-square cursor-grab flex-col items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.025] p-1 text-center transition-all hover:-translate-y-px hover:border-coral-400/40 hover:bg-coral-400/[0.07] active:cursor-grabbing"
                  >
                    <ItemIcon icon={item.icon} swatch={item.swatch} />
                    <span className="line-clamp-2 text-[10px] leading-tight text-slate-400 group-hover:text-slate-200">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {!groups.length && <p className="p-6 text-center text-[12px] text-slate-500">No components match “{query}”.</p>}
      </div>
      <div className="border-t border-white/[0.06] p-3 text-[10.5px] leading-relaxed text-slate-500">
        Click to add at view centre or drag onto the canvas.
      </div>
    </aside>
  );
}
