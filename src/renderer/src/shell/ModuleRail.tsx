import type { CSSProperties } from 'react';
import { OsIcon, type OsIconName } from './icons';
import type { AppThemeMode } from '@/design/theme';

export type ModuleId = 'inicio' | 'memoria' | 'conexiones' | 'objetivos' | 'creativo' | 'oficina';

interface Item { id: ModuleId; label: string; icon: OsIconName }
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Panel', items: [
    { id: 'inicio', label: 'Inicio', icon: 'inicio' },
    { id: 'memoria', label: 'Memoria', icon: 'memoria' },
    { id: 'conexiones', label: 'Conexiones', icon: 'conexiones' },
    { id: 'objetivos', label: 'Objetivos', icon: 'objetivos' }
  ]},
  { label: 'Estudios', items: [
    { id: 'creativo', label: 'Creativo', icon: 'creativo' },
    { id: 'oficina', label: 'Oficina iso', icon: 'oficina' }
  ]}
];

/** The Liquid Glass module rail — the new platform navigation. */
export function ModuleRail({ active, onSelect, onOpenSettings, userName, memoryDot, themeMode, onCycleTheme, focusOn, onToggleFocus }: {
  active: ModuleId;
  onSelect: (id: ModuleId) => void;
  onOpenSettings: () => void;
  userName?: string;
  memoryDot?: boolean;
  themeMode: AppThemeMode;
  onCycleTheme: () => void;
  focusOn: boolean;
  onToggleFocus: () => void;
}) {
  const themeGlyph = themeMode === 'light' ? '☀' : themeMode === 'dark' ? '☾' : '◐';
  const themeLabel = themeMode === 'light' ? 'Claro' : themeMode === 'dark' ? 'Oscuro' : 'Auto';
  const ctrlBtn: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 34, borderRadius: 12, border: '1px solid var(--g-stroke)',
    background: 'var(--g-chip)', cursor: 'pointer', color: 'var(--g-ink-2)', fontSize: 13, fontWeight: 500
  };
  return (
    <aside className="os-glass" style={{ width: 248, flex: '0 0 248px', borderRadius: 'var(--g-r-lg)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 3, boxSizing: 'border-box', margin: 16, marginRight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px' }}>
        <OsIcon name="brand" size={33} stroke={2.1} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>IMAJU</div>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--g-ink-3)', fontWeight: 600, marginTop: 2 }}>Agentic OS</div>
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="os-eyebrow" style={{ padding: '10px 12px 6px' }}>{group.label}</div>
          {group.items.map((it) => (
            <button key={it.id} className={`os-rail-item${active === it.id ? ' active' : ''}`} onClick={() => onSelect(it.id)}>
              <span className="ic"><OsIcon name={it.icon} size={24} stroke={it.id === 'oficina' || it.id === 'memoria' ? 2 : 2.1} /></span>
              {it.label}
              {it.id === 'memoria' && memoryDot && (
                <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#30d158', boxShadow: '0 0 8px rgba(48,209,88,.8)' }} />
              )}
            </button>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* Controls that used to live in the title bar — appearance + focus mode. */}
      <div style={{ display: 'flex', gap: 8, padding: '2px 4px 6px' }}>
        <button style={{ ...ctrlBtn, flex: 1 }} onClick={onCycleTheme}
          title={`Apariencia: ${themeLabel} (clic para cambiar)`} aria-label="Cambiar apariencia">
          <span style={{ fontSize: 14 }}>{themeGlyph}</span> {themeLabel}
        </button>
        <button style={{ ...ctrlBtn, width: 40, background: focusOn ? 'var(--g-accent)' : 'var(--g-chip)', color: focusOn ? '#fff' : 'var(--g-ink-2)' }}
          onClick={onToggleFocus} title={focusOn ? 'Salir de modo foco' : 'Modo foco'} aria-label="Modo foco">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {focusOn
              ? <><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></>
              : <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></>}
          </svg>
        </button>
      </div>

      <button className="os-rail-item" onClick={onOpenSettings}>
        <span className="ic"><OsIcon name="ajustes" size={24} stroke={2} /></span> Ajustes
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 16, marginTop: 6, background: 'var(--g-chip)', border: '1px solid var(--g-stroke)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 11, flex: '0 0 auto', background: 'linear-gradient(180deg,#ffd08a,#ff8f6b)' }} />
        <div><div style={{ fontSize: 13, fontWeight: 700 }}>{userName || 'Vos'}</div><div style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>IMAJU</div></div>
      </div>
    </aside>
  );
}
