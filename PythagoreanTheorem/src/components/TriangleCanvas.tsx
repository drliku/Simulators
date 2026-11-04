import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  add,
  bounds,
  buildGeometry,
  clamp,
  dot,
  dragRightAngle,
  euclidFrames,
  euclidQuad,
  len,
  MAX_LEG,
  MIN_LEG,
  mid,
  norm,
  round2,
  scale,
  snapLength,
  sub,
  v,
} from '../lib/geometry';
import type { Quad, Square, TriangleState, Vec } from '../lib/geometry';
import { fmtLength, fmtTenThousandths, hypotenuse, squareTenThousandths } from '../lib/format';
import { COLORS } from '../lib/theme';
import type { SideKey } from '../lib/theme';
import { useElementSize } from '../hooks/useElementSize';
import { useSmoothView } from '../hooks/useSmoothView';
import type { View } from '../hooks/useSmoothView';
import type { DemoFrame } from '../hooks/useDemo';

type Handle = 'A' | 'B' | 'C';

interface DragState {
  handle: Handle;
  pointerId: number;
  start: TriangleState;
  A: Vec;
  B: Vec;
}

interface Props {
  state: TriangleState;
  onChange: (s: TriangleState) => void;
  onInteract: () => void;
  showSquares: boolean;
  showUnitGrid: boolean;
  demo: DemoFrame | null;
  caption: string | null;
}

const PAD = 44;

export function TriangleCanvas({ state, onChange, onInteract, showSquares, showUnitGrid, demo, caption }: Props) {
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<Handle | null>(null);

  const g = useMemo(() => buildGeometry(state), [state]);
  const demoOn = demo !== null;
  const squaresVisible = showSquares || demoOn;

  // ---- camera -------------------------------------------------------------
  const target: View = useMemo(() => {
    const pts = [g.A, g.B, g.C];
    if (squaresVisible) pts.push(...g.squareA.pts, ...g.squareB.pts, ...g.squareC.pts);
    const bb = bounds(pts);
    const w = Math.max(bb.maxX - bb.minX, 1);
    const h = Math.max(bb.maxY - bb.minY, 1);
    const W = Math.max(size.width, 1);
    const H = Math.max(size.height, 1);
    const pad = Math.min(PAD, W * 0.08);
    const top = demoOn ? 56 : 0; // keep clear of the caption pill
    const sc = Math.max(0.0001, Math.min((W - 2 * pad) / w, (H - 2 * pad - top) / h, 160));
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    return { scale: sc, tx: W / 2 - cx * sc, ty: (H + top) / 2 + cy * sc };
  }, [g, squaresVisible, demoOn, size.width, size.height]);

  const view = useSmoothView(target, drag !== null || size.width === 0);
  const sc = view.scale;
  const S = (p: Vec) => v(view.tx + p.x * sc, view.ty - p.y * sc);
  const ptsAttr = (pts: Vec[]) => pts.map((p) => S(p)).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  const toWorld = (clientX: number, clientY: number): Vec => {
    const r = svgRef.current!.getBoundingClientRect();
    return v((clientX - r.left - view.tx) / sc, -(clientY - r.top - view.ty) / sc);
  };

  // ---- dragging -----------------------------------------------------------
  const beginDrag = (handle: Handle) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onInteract();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ handle, pointerId: e.pointerId, start: state, A: g.A, B: g.B });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const P = toWorld(e.clientX, e.clientY);
    const s = drag.start;
    const u = v(Math.cos(s.rot), Math.sin(s.rot));
    const w = v(-u.y, u.x);
    const rel = sub(P, s.origin);
    if (drag.handle === 'A') {
      const b = snapLength(dot(rel, u));
      if (b !== state.b) onChange({ ...state, b });
    } else if (drag.handle === 'B') {
      const a = snapLength(dot(rel, w));
      if (a !== state.a) onChange({ ...state, a });
    } else {
      const next = dragRightAngle(drag.A, drag.B, s, P);
      if (next) onChange(next);
    }
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (drag && e.pointerId === drag.pointerId) {
      svgRef.current?.releasePointerCapture(e.pointerId);
      setDrag(null);
    }
  };

  const onHandleKey = (handle: Handle) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    const dir =
      e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onInteract();
    if (handle === 'A') onChange({ ...state, b: round2(clamp(state.b + dir * step, MIN_LEG, MAX_LEG)) });
    else if (handle === 'B') onChange({ ...state, a: round2(clamp(state.a + dir * step, MIN_LEG, MAX_LEG)) });
    else onChange({ ...state, rot: state.rot + (dir * (e.shiftKey ? 15 : 5) * Math.PI) / 180 });
  };

  // ---- demo -------------------------------------------------------------------
  const frames = useMemo(() => euclidFrames(g), [g]);
  const demoStage = demo
    ? ({ highlightA: 0, highlightB: 0, highlightC: 0, shear1: 1, rotate: 2, shear2: 3, conclude: 4 } as const)[demo.phase]
    : 0;
  const pulse = (phase: DemoFrame['phase']) => (demo && demo.phase === phase ? Math.sin(Math.PI * demo.t) : 0);
  const morphing = demo !== null && demoStage >= 1;
  const altitudeOpacity = !demo ? 0 : demoStage >= 3 ? 1 : demoStage === 2 ? demo.t : 0;
  const concludeGlow = demo?.phase === 'conclude' ? Math.sin(Math.PI * Math.min(1, demo.t * 1.4)) : 0;

  // ---- render helpers -------------------------------------------------------
  const unitGrid = (sq: Square, color: string) => {
    if (!showUnitGrid || sc < 7) return null;
    const [P, Q] = sq.pts;
    const L = sq.side;
    const u = norm(sub(Q, P));
    const n = sq.normal;
    const lines: [Vec, Vec][] = [];
    for (let k = 1; k < L - 1e-3; k++) {
      const p1 = add(P, scale(u, k));
      lines.push([p1, add(p1, scale(n, L))]);
      const p2 = add(P, scale(n, k));
      lines.push([p2, add(p2, scale(u, L))]);
    }
    return (
      <g stroke={color} strokeOpacity={0.28} strokeWidth={1} pointerEvents="none">
        {lines.map(([p, q], i) => {
          const s1 = S(p);
          const s2 = S(q);
          return <line key={i} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} />;
        })}
      </g>
    );
  };

  const squareLayer = (key: SideKey, sq: Square, extraOpacity: number, ghost: boolean, showLabel = true) => {
    const color = COLORS[key];
    const sidePx = sq.side * sc;
    const side = key === 'a' ? state.a : key === 'b' ? state.b : null;
    const area =
      side !== null
        ? fmtTenThousandths(squareTenThousandths(side))
        : fmtTenThousandths(squareTenThousandths(state.a) + squareTenThousandths(state.b));
    const fs = clamp(sidePx * 0.13, 10, 22);
    const c = S(sq.center);
    return (
      <g key={key} className="transition-opacity duration-500" style={{ opacity: ghost ? 0.45 : 1 }}>
        <polygon
          points={ptsAttr(sq.pts)}
          fill={color}
          fillOpacity={ghost ? 0.04 : 0.12 + extraOpacity * 0.3}
          stroke={color}
          strokeOpacity={0.85}
          strokeWidth={1.75 + extraOpacity * 2}
          strokeDasharray={ghost ? '6 6' : undefined}
          strokeLinejoin="round"
        />
        {!ghost && unitGrid(sq, color)}
        {!ghost && showLabel && sidePx > 34 && (
          <g pointerEvents="none" transform={`translate(${c.x} ${c.y})`}>
            <text
              textAnchor="middle"
              y={sidePx > 70 ? -fs * 0.25 : fs * 0.35}
              className="font-math"
              fontWeight={800}
              fontSize={fs * 1.15}
              fill={color}
            >
              {key}²
            </text>
            {sidePx > 70 && (
              <text textAnchor="middle" y={fs * 1.05} className="font-mono" fontWeight={600} fontSize={fs * 0.72} fill={COLORS.ink} fillOpacity={0.7}>
                = {area}
              </text>
            )}
          </g>
        )}
      </g>
    );
  };

  const morphQuad = (key: 'a' | 'b', quad: Quad) => {
    const color = COLORS[key];
    const centre = scale(quad.reduce((acc, p) => add(acc, p), v(0, 0)), 0.25);
    const c = S(centre);
    const sidePx = Math.sqrt((key === 'a' ? state.a * state.a : state.b * state.b)) * sc;
    const fs = clamp(sidePx * 0.12, 10, 20);
    return (
      <g key={`m-${key}`} pointerEvents="none">
        <polygon
          points={ptsAttr(quad)}
          fill={color}
          fillOpacity={0.38}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 6px 12px rgba(35,47,91,0.12))' }}
        />
        {sidePx > 40 && (
          <text x={c.x} y={c.y + fs * 0.35} textAnchor="middle" fontSize={fs * 1.1} fontWeight={800} fill="#fff" className="font-math">
            {key}²
          </text>
        )}
      </g>
    );
  };

  // Right-angle marker
  const u = norm(sub(g.A, g.C));
  const wv = norm(sub(g.B, g.C));
  const markerWorld = clamp(Math.min(state.a, state.b) * 0.18, 8 / sc, 18 / sc);
  const m1 = add(g.C, scale(u, markerWorld));
  const m2 = add(m1, scale(wv, markerWorld));
  const m3 = add(g.C, scale(wv, markerWorld));

  // Side labels
  const sideLabel = (key: SideKey, P: Vec, Q: Vec, value: string, approx = false) => {
    const m = mid(P, Q);
    const outward = norm(sub(m, g.centroid));
    const pos = S(m);
    const dir = v(outward.x, -outward.y); // screen space
    const offset = squaresVisible ? 0 : 22;
    const x = pos.x + dir.x * offset;
    const y = pos.y + dir.y * offset;
    const text = `${key} ${approx ? '≈' : '='} ${value}`;
    const width = text.length * 7.4 + 18;
    return (
      <g key={`l-${key}`} transform={`translate(${x} ${y})`} pointerEvents="none">
        <rect x={-width / 2} y={-13} width={width} height={26} rx={4} fill="#fff" stroke={COLORS[key]} strokeWidth={1.5} />
        <text textAnchor="middle" y={4.5} fontSize={13} className="font-mono" fontWeight={600} fill={COLORS[key]}>
          {text}
        </text>
      </g>
    );
  };

  const handle = (id: Handle, p: Vec, color: string, label: string) => {
    const s = S(p);
    const active = drag?.handle === id;
    const hot = active || hover === id;
    const away = norm(sub(p, g.centroid));
    const lx = s.x + away.x * 24;
    const ly = s.y - away.y * 24;
    return (
      <g key={id}>
        <text x={lx} y={ly + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={COLORS.ink} fillOpacity={0.55} className="font-math" pointerEvents="none">
          {id}
        </text>
        <g
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuetext={id === 'A' ? `b = ${state.b}` : id === 'B' ? `a = ${state.a}` : 'right angle'}
          className="cursor-grab outline-none focus-visible:[&>circle:nth-child(2)]:stroke-[6px]"
          style={{ touchAction: 'none', cursor: active ? 'grabbing' : 'grab' }}
          onPointerDown={beginDrag(id)}
          onPointerEnter={() => setHover(id)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onHandleKey(id)}
        >
          <circle cx={s.x} cy={s.y} r={24} fill="transparent" />
          <circle
            cx={s.x}
            cy={s.y}
            r={hot ? 16 : 0}
            fill={color}
            fillOpacity={0.14}
            stroke={color}
            strokeOpacity={0.25}
            style={{ transition: 'r 180ms ease' }}
          />
          <circle
            cx={s.x}
            cy={s.y}
            r={hot ? 8.5 : 7}
            fill="#fff"
            stroke={color}
            strokeWidth={3}
            style={{ transition: 'r 180ms ease', filter: 'drop-shadow(0 2px 4px rgba(35,47,91,0.25))' }}
          />
        </g>
      </g>
    );
  };

  // Grid pattern (anchored to world units)
  const unit = sc >= 9 ? 1 : sc >= 2.5 ? 5 : 25;
  const minor = unit * sc;
  const major = minor * 5;

  const hyp = hypotenuse(state.a, state.b);
  const sA = S(g.A);
  const sB = S(g.B);
  const sC = S(g.C);

  const altFar = add(g.H, scale(g.squareC.normal, g.squareC.side));
  const sH = S(g.H);
  const sHF = S(altFar);

  return (
    <div ref={boxRef} className="relative h-full w-full select-none">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="absolute inset-0 block"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label={`Right triangle with legs a = ${state.a} and b = ${state.b}, hypotenuse c ≈ ${g.c.toFixed(3)}`}
      >
        <defs>
          <pattern id="grid-minor" width={minor} height={minor} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.tx} ${view.ty})`}>
            <path d={`M ${minor} 0 L 0 0 0 ${minor}`} fill="none" stroke="#232F5B" strokeOpacity={0.05} strokeWidth={1} />
          </pattern>
          <pattern id="grid-major" width={major} height={major} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.tx} ${view.ty})`}>
            <rect width={major} height={major} fill="url(#grid-minor)" />
            <path d={`M ${major} 0 L 0 0 0 ${major}`} fill="none" stroke="#232F5B" strokeOpacity={0.08} strokeWidth={1} />
          </pattern>
          <linearGradient id="tri-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.96} />
            <stop offset="100%" stopColor="#f7f7fa" stopOpacity={0.96} />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-major)" />

        {/* Squares */}
        <g
          style={{
            opacity: squaresVisible ? 1 : 0,
            transition: 'opacity 450ms ease',
          }}
          pointerEvents="none"
        >
          {squareLayer('c', g.squareC, pulse('highlightC') + concludeGlow * 0.6, false, !morphing)}
          {squareLayer('a', g.squareA, pulse('highlightA'), morphing)}
          {squareLayer('b', g.squareB, pulse('highlightB'), morphing)}
        </g>

        {/* Euclid's proof: altitude + morphing shapes */}
        {demo && (
          <g pointerEvents="none">
            <line
              x1={sC.x}
              y1={sC.y}
              x2={sHF.x}
              y2={sHF.y}
              stroke={COLORS.ink}
              strokeOpacity={0.45 * altitudeOpacity}
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />
            {altitudeOpacity > 0 && <circle cx={sH.x} cy={sH.y} r={3.5} fill={COLORS.ink} fillOpacity={0.6 * altitudeOpacity} />}
            {morphing && morphQuad('a', euclidQuad(frames.a, demoStage, demo.t))}
            {morphing && morphQuad('b', euclidQuad(frames.b, demoStage, demo.t))}
          </g>
        )}

        {/* Triangle */}
        <polygon
          points={ptsAttr([g.A, g.B, g.C])}
          fill="url(#tri-fill)"
          style={{ filter: 'drop-shadow(0 10px 18px rgba(35,47,91,0.10))' }}
          pointerEvents="none"
        />
        <polyline
          points={ptsAttr([m1, m2, m3])}
          fill="none"
          stroke={COLORS.ink}
          strokeOpacity={0.55}
          strokeWidth={1.5}
          pointerEvents="none"
        />
        <g strokeLinecap="round" strokeWidth={4} pointerEvents="none">
          <line x1={sB.x} y1={sB.y} x2={sC.x} y2={sC.y} stroke={COLORS.a} />
          <line x1={sC.x} y1={sC.y} x2={sA.x} y2={sA.y} stroke={COLORS.b} />
          <line x1={sA.x} y1={sA.y} x2={sB.x} y2={sB.y} stroke={COLORS.c} />
        </g>

        {sideLabel('a', g.B, g.C, fmtLength(state.a))}
        {sideLabel('b', g.C, g.A, fmtLength(state.b))}
        {sideLabel('c', g.A, g.B, hyp.text, !hyp.exact)}

        {handle('C', g.C, COLORS.ink, 'Right-angle vertex C: drag to swing the triangle around its hypotenuse (Thales circle)')}
        {handle('A', g.A, COLORS.b, 'Vertex A: drag to change side b')}
        {handle('B', g.B, COLORS.a, 'Vertex B: drag to change side a')}
      </svg>

      {caption && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <div
            key={caption}
            className="animate-fade-in max-w-full rounded-lg bg-navy px-4 py-2 text-center font-math text-xs font-semibold tracking-wide text-white shadow-lift sm:text-sm"
          >
            {caption}
          </div>
        </div>
      )}

      {drag?.handle === 'C' && (
        <ThalesHint A={drag.A} B={drag.B} S={S} sc={sc} />
      )}
    </div>
  );
}

/** Faint Thales circle shown while the right-angle vertex is being dragged. */
function ThalesHint({ A, B, S, sc }: { A: Vec; B: Vec; S: (p: Vec) => Vec; sc: number }) {
  const M = S(mid(A, B));
  const r = (len(sub(B, A)) / 2) * sc;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      <circle cx={M.x} cy={M.y} r={r} fill="none" stroke={COLORS.ink} strokeOpacity={0.25} strokeDasharray="4 6" strokeWidth={1.5} />
      <circle cx={M.x} cy={M.y} r={3} fill={COLORS.ink} fillOpacity={0.3} />
    </svg>
  );
}
