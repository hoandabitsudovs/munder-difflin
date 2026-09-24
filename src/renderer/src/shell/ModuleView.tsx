import type { ReactNode } from 'react';

/** A plain module content frame: title + scrollable body. Hosts the existing panels
 *  (Memory/Connections/Goals/Creativo) inside the Liquid Glass shell. Those panels
 *  keep their own styling for now; a later pass restyles them to glass. */
export function ModuleView({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', marginBottom: 14 }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--g-ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: 'var(--g-ink-2)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div className="os-card" style={{ flex: 1, minHeight: 0, borderRadius: 'var(--g-r-md)', overflow: 'auto', padding: 20 }}>
        {children}
      </div>
    </div>
  );
}
