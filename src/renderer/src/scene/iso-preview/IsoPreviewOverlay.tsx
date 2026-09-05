// In-app ISO PREVIEW — an isolated, dev-only showcase of the isometric pixel-art
// set (35 characters + 7 department rooms) rendered live to <canvas>, with the
// SAME technique as the standalone prototypes. It does NOT touch the production
// office renderer; it's a floating overlay you open from a small dev button, so
// the iso work is visible in the app before the (bigger) engine retrofit lands.
import { useEffect, useRef, useState } from 'react';
import {
  renderCharacter, renderRoom, paintBuf, CAST, CAST_ORDER, IMAJU_NAMES,
  DEPARTMENTS, ROOM_MEMBERS, type Buf,
} from './isoArt';

function BufCanvas({ make, scale, alt }: { make: () => Buf; scale: number; alt: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const b = make();
    paintBuf(c, b);
    c.style.width = `${b.w * scale}px`;
    c.style.height = `${b.h * scale}px`;
  }, [make, scale]);
  return <canvas ref={ref} aria-label={alt} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

export function IsoPreviewOverlay(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  // Dev-only affordance; import.meta.env.DEV is false in packaged builds.
  if (!import.meta.env.DEV) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Vista previa isométrica (dev)"
        style={{
          position: 'fixed', left: 12, bottom: 12, zIndex: 100000,
          font: '11px ui-monospace, monospace', padding: '6px 10px',
          background: '#2b2436', color: '#cfe5e9', border: '1px solid #4f6f9f',
          borderRadius: 8, cursor: 'pointer',
        }}
      >
        {open ? '✕ iso' : '◈ iso preview'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999, overflow: 'auto',
            background: '#201b28', color: '#e8e2f0',
            font: '14px -apple-system, system-ui, sans-serif', padding: '28px 32px 60px',
          }}
        >
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>IMAJU · arte isométrico pixel — vista previa</h1>
          <p style={{ color: '#9a8fb0', margin: '0 0 8px' }}>
            Aislado del render de producción · grilla nativa, sin anti-aliasing, nearest-neighbor. Esto es una muestra, no la oficina real (que sigue cenital).
          </p>

          <h2 style={{ fontSize: 15, margin: '28px 0 14px', color: '#b9a9e0', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            7 salas de departamento
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {DEPARTMENTS.map((dept) => (
              <figure key={dept} style={{ margin: 0, background: '#2b2436', border: '1px solid #3a3348', borderRadius: 10, padding: 0, overflow: 'hidden' }}>
                <BufCanvas make={() => renderRoom(dept)} scale={2} alt={dept} />
                <figcaption style={{ padding: '8px 10px 12px' }}>
                  <b>{dept}</b><br />
                  <span style={{ color: '#9a8fb0', fontSize: 11 }}>{(ROOM_MEMBERS[dept] || []).map((m) => m[1]).join(' · ')}</span>
                </figcaption>
              </figure>
            ))}
          </div>

          <h2 style={{ fontSize: 15, margin: '34px 0 14px', color: '#b9a9e0', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Elenco · {CAST_ORDER.length} personajes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 14 }}>
            {CAST_ORDER.map((name) => (
              <figure
                key={name}
                style={{
                  margin: 0, background: '#2b2436', textAlign: 'center', padding: '12px 8px 8px',
                  border: `1px solid ${IMAJU_NAMES.has(name) ? '#4f6f9f' : '#3a3348'}`, borderRadius: 10,
                  opacity: IMAJU_NAMES.has(name) ? 1 : 0.85,
                }}
              >
                <div style={{ height: 136, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 6 }}>
                  <BufCanvas make={() => renderCharacter(name)} scale={4} alt={CAST[name].display} />
                </div>
                <figcaption style={{ fontSize: 12, color: IMAJU_NAMES.has(name) ? '#cfe5e9' : '#d8d0e6' }}>{CAST[name].display}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
