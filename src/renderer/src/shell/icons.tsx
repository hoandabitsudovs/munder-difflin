/** SF-style line icons for the Liquid Glass shell — loose (box-less), tinted with
 *  a per-module vertical gradient. Mount <OsIconDefs/> once inside the shell. */
import type { CSSProperties } from 'react';

export type OsIconName =
  | 'brand' | 'inicio' | 'memoria' | 'conexiones' | 'objetivos'
  | 'creativo' | 'oficina' | 'ajustes' | 'search' | 'voice';

/** name → gradient id (declared in OsIconDefs). */
const GRAD: Record<OsIconName, string> = {
  brand: 'gBrand', inicio: 'gInicio', memoria: 'gMem', conexiones: 'gConex',
  objetivos: 'gObj', creativo: 'gCrea', oficina: 'gOfi', ajustes: 'gSet',
  search: '', voice: ''
};

const PATHS: Record<OsIconName, JSX.Element> = {
  brand: <><path d="M12 3l7.5 4.3v8.4L12 21l-7.5-4.3V7.3z"/><path d="M12 12l7.5-4.2M12 12v9M12 12L4.5 7.8"/></>,
  inicio: <><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/></>,
  memoria: <><path d="M12 3.5l1.9 5L19 10l-5.1 1.5L12 16.5l-1.9-5L5 10l5.1-1.5z"/><path d="M18.7 4.2l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6L16.6 6.3l1.6-.5z"/></>,
  conexiones: <><path d="M9.5 14.5l5-5"/><path d="M11 7.5l1.6-1.6a3.4 3.4 0 0 1 4.8 4.8L15.8 12"/><path d="M13 16.5l-1.6 1.6a3.4 3.4 0 0 1-4.8-4.8L8.2 12"/></>,
  objetivos: <><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.4"/></>,
  creativo: <><path d="M5 19l8.5-8.5"/><path d="M15 6.5l2.5 2.5"/><path d="M17.6 3.8l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/></>,
  oficina: <><rect x="5" y="4.5" width="14" height="15" rx="1.6"/><path d="M9 8.5h1.5M13.5 8.5H15M9 12h1.5M13.5 12H15M9 15.5h1.5M13.5 15.5H15"/></>,
  ajustes: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></>,
  voice: <><rect x="9.5" y="3.5" width="5" height="10" rx="2.5"/><path d="M6.5 11a5.5 5.5 0 0 0 11 0"/><path d="M12 16.5V20"/></>
};

/** The shared gradient defs — render ONCE inside the shell root. */
export function OsIconDefs() {
  const g = (id: string, a: string, b: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a}/><stop offset="1" stopColor={b}/></linearGradient>
  );
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      {g('gBrand', '#78b6ff', '#7c5cff')}
      {g('gInicio', '#66aaff', '#0a84ff')}
      {g('gMem', '#c39bff', '#7c3aed')}
      {g('gConex', '#63e3e9', '#0a9fd0')}
      {g('gObj', '#69e879', '#16a34a')}
      {g('gCrea', '#ff9ec8', '#ff5f3c')}
      {g('gOfi', '#78b6ff', '#0a68e0')}
      {g('gSet', '#c2cad6', '#7b8494')}
    </defs></svg>
  );
}

export function OsIcon({ name, size = 24, stroke = 2, color, style }: {
  name: OsIconName; size?: number; stroke?: number; color?: string; style?: CSSProperties;
}) {
  const strokeColor = color ?? (GRAD[name] ? `url(#${GRAD[name]})` : 'currentColor');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {PATHS[name]}
    </svg>
  );
}
