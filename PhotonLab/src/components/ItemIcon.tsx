/** Small schematic glyphs for the object library. */
export function ItemIcon({ icon, swatch }: { icon: string; swatch?: string }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const glass = { fill: 'rgba(125,211,252,0.18)', stroke: '#7dd3fc', strokeWidth: 1.4 };
  const mirror = { fill: 'none', stroke: '#e2e8f0', strokeWidth: 2.2, strokeLinecap: 'round' as const };
  const ray = (c: string) => ({ stroke: c, strokeWidth: 1.4, strokeLinecap: 'round' as const });
  let body: JSX.Element;
  switch (icon) {
    case 'laser':
      body = (
        <>
          <rect x="2" y="9.5" width="9" height="5" rx="1" {...s} />
          <path d="M11 12 H22" {...ray('#ef4444')} />
        </>
      );
      break;
    case 'beam':
      body = (
        <>
          <rect x="2" y="4" width="3" height="16" rx="1" {...s} />
          <path d="M5 7 H22 M5 12 H22 M5 17 H22" {...ray('#22c55e')} />
        </>
      );
      break;
    case 'point':
      body = (
        <>
          <path d="M12 12 L21 12 M12 12 L3 12 M12 12 L12 3 M12 12 L12 21 M12 12 L18.5 5.5 M12 12 L5.5 18.5 M12 12 L18.5 18.5 M12 12 L5.5 5.5" {...ray('#facc15')} />
          <circle cx="12" cy="12" r="2.6" fill="#facc15" />
        </>
      );
      break;
    case 'white':
      body = (
        <>
          <rect x="2" y="9.5" width="8" height="5" rx="1" {...s} />
          <path d="M10 12 H22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </>
      );
      break;
    case 'rgb':
      body = (
        <>
          <rect x="2" y="9.5" width="7" height="5" rx="1" {...s} />
          <path d="M9 11 L22 7" {...ray('#ef4444')} />
          <path d="M9 12 L22 12" {...ray('#22c55e')} />
          <path d="M9 13 L22 17" {...ray('#3b82f6')} />
        </>
      );
      break;
    case 'fan':
      body = (
        <>
          <path d="M4 12 L21 5 M4 12 L22 9.5 M4 12 L22 14.5 M4 12 L21 19" {...ray('#60a5fa')} />
          <circle cx="4" cy="12" r="2.2" fill="#60a5fa" />
        </>
      );
      break;
    case 'mirror-flat':
      body = (
        <>
          <path d="M12 3 V21" {...mirror} />
          <path d="M13.5 5 l3 -2 M13.5 9 l3 -2 M13.5 13 l3 -2 M13.5 17 l3 -2 M13.5 21 l3 -2" stroke="#64748b" strokeWidth="1" />
        </>
      );
      break;
    case 'mirror-concave':
      body = <path d="M15 3 Q7 12 15 21" {...mirror} />;
      break;
    case 'mirror-convex':
      body = <path d="M9 3 Q17 12 9 21" {...mirror} />;
      break;
    case 'mirror-parabolic':
      body = (
        <>
          <path d="M17 3 Q3 12 17 21" {...mirror} />
          <circle cx="14" cy="12" r="1.3" fill="#f472b6" />
        </>
      );
      break;
    case 'mirror-arc':
      body = <path d="M18 5 A8 8 0 1 0 18 19" {...mirror} />;
      break;
    case 'mirror-two':
      body = <path d="M12 3 V21" stroke="#f8fafc" strokeWidth="3.2" strokeLinecap="round" />;
      break;
    case 'mirror-partial':
      body = (
        <>
          <path d="M5 19 L19 5" stroke="#93c5fd" strokeWidth="2.2" strokeDasharray="3 2" />
          <path d="M2 12 H12 V2 M12 12 H22" {...ray('#22c55e')} />
        </>
      );
      break;
    case 'lens-ideal-convex':
      body = <path d="M12 3 V21 M8.5 6.5 L12 3 L15.5 6.5 M8.5 17.5 L12 21 L15.5 17.5" stroke="#7dd3fc" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      break;
    case 'lens-ideal-concave':
      body = <path d="M12 3 V21 M8.5 1 L12 4.5 L15.5 1 M8.5 23 L12 19.5 L15.5 23" stroke="#7dd3fc" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      break;
    case 'lens-biconvex':
      body = <path d="M12 2 Q20 12 12 22 Q4 12 12 2 Z" {...glass} />;
      break;
    case 'lens-biconcave':
      body = <path d="M7 2 H17 Q12.5 12 17 22 H7 Q11.5 12 7 2 Z" {...glass} />;
      break;
    case 'lens-planoconvex':
      body = <path d="M9 2 Q19 12 9 22 Z" {...glass} />;
      break;
    case 'prism':
      body = (
        <>
          <path d="M12 3 L21 20 H3 Z" {...glass} />
          <path d="M1 13 L8.5 11" stroke="#fff" strokeWidth="1.2" />
          <path d="M15.5 11.5 L23 14" {...ray('#ef4444')} />
          <path d="M15.5 11.5 L23 17" {...ray('#3b82f6')} />
        </>
      );
      break;
    case 'block':
      body = <rect x="3" y="6" width="18" height="12" rx="1" {...glass} />;
      break;
    case 'circle':
      body = <circle cx="12" cy="12" r="8.5" {...glass} />;
      break;
    case 'fiber':
      body = <path d="M2 17 H9 A6 6 0 0 0 15 11 V3 M2 21 H9 A10 10 0 0 0 19 11 V3" stroke="#99f6e4" strokeWidth="1.5" fill="none" />;
      break;
    case 'material':
      body = <rect x="4" y="4" width="16" height="16" rx="3.5" fill={swatch} fillOpacity={0.55} stroke={swatch} strokeWidth="1.4" />;
      break;
    case 'ruler':
      body = (
        <>
          <rect x="2" y="8" width="20" height="8" rx="1" stroke="#facc15" strokeWidth="1.4" fill="rgba(250,204,21,0.12)" />
          <path d="M6 8 V11 M10 8 V12.5 M14 8 V11 M18 8 V12.5" stroke="#facc15" strokeWidth="1.1" />
        </>
      );
      break;
    case 'protractor':
      body = (
        <>
          <path d="M3 19 H21 M3 19 L16 6" stroke="#fbbf24" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M10 19 A7 7 0 0 0 8 14" stroke="#fbbf24" strokeWidth="1.2" fill="none" />
        </>
      );
      break;
    case 'detector':
      body = (
        <>
          <path d="M2 12 H14" {...ray('#22c55e')} />
          <path d="M16 3 V21" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    default:
      body = <circle cx="12" cy="12" r="6" {...s} />;
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-300" aria-hidden>
      {body}
    </svg>
  );
}
