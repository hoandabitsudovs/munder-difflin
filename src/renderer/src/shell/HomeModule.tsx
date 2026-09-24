import { useMemo, type CSSProperties } from 'react';
import { useStore } from '@/store/store';
import { OsIcon } from './icons';
import type { ModuleId } from './ModuleRail';

/** The Liquid Glass home dashboard — the platform's landing module. Live where it's
 *  cheap (greeting, roster counts, agent goals); the brief copy is illustrative until
 *  the god produces a real one. */
export function HomeModule({ userName, goals: userGoals, onOpenModule }: {
  userName?: string;
  goals?: string;
  onOpenModule: (id: ModuleId) => void;
}) {
  const agents = useStore((s) => s.agents);
  const accent = '#0a84ff';

  const counts = useMemo(() => {
    const live = agents.filter((a) => !a.archived);
    const working = live.filter((a) => /work|think|run|active|busy/i.test(a.status || '')).length;
    const needs = live.filter((a) => (a.status || '') === 'blocked').length;
    return { total: live.length, working, needs };
  }, [agents]);

  const rosterGoals = useMemo(
    () => agents.filter((a) => !a.archived && a.goal?.trim()).slice(0, 3),
    [agents]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    return userName ? `${g}, ${userName}` : g;
  })();

  const card: CSSProperties = { borderRadius: 'var(--g-r-md)', padding: 24, boxSizing: 'border-box' };
  const eyebrow = 'os-eyebrow';

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, padding: 16, overflow: 'auto' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 2px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1 }}>{greeting}</div>
          <div style={{ fontSize: 14, color: 'var(--g-ink-2)', marginTop: 4 }}>
            {counts.needs > 0 ? `Tu equipo tiene ${counts.needs} cosa${counts.needs > 1 ? 's' : ''} para vos` : 'Todo en marcha'}
          </div>
        </div>
        <div className="os-glass os-cap" style={{ marginLeft: 16, flex: 1, maxWidth: 440, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', fontSize: 14, color: 'var(--g-ink-3)' }}>
          <OsIcon name="search" size={17} stroke={1.9} color="currentColor" /> Preguntá o buscá en todo tu conocimiento…
        </div>
        <button className="os-cap" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, border: '1px solid rgba(255,255,255,.55)', color: '#fff', padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: `linear-gradient(180deg,${accent},#5a5cff)`, boxShadow: '0 10px 24px rgba(18,28,120,.28), inset 0 1px 0 rgba(255,255,255,.5)' }}>
          <OsIcon name="voice" size={17} stroke={1.9} color="currentColor" /> Hablar con el OS
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, alignContent: 'start' }}>
        {/* Daily brief */}
        <div className="os-card" style={{ ...card, gridColumn: 'span 2' }}>
          <div className={eyebrow}>Brief diario</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', margin: '10px 0 4px' }}>Tu mañana, en tres líneas</div>
          <div style={{ fontSize: 13, color: 'var(--g-ink-3)', marginBottom: 20 }}>Se genera cada mañana desde tu memoria, tus fuentes y tus objetivos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, color: 'var(--g-ink-2)', lineHeight: 1.4 }}>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30d158', marginTop: 7, flex: '0 0 auto' }} /> Prendé el Daily Brief en Ajustes → Schedules para que el orquestador lo arme.</div>
            <div style={{ display: 'flex', gap: 12 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, marginTop: 7, flex: '0 0 auto' }} /> Aparecerá acá cada mañana, con lo que necesita tu atención.</div>
          </div>
        </div>

        {/* Voice */}
        <div className="os-card" style={card}>
          <div className={eyebrow}>Voz que ejecuta</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', margin: '10px 0 4px' }}>Decilo y pasa</div>
          <div style={{ fontSize: 13, color: 'var(--g-ink-3)', marginBottom: 16 }}>Comando de voz → acción real</div>
          <div style={{ borderRadius: 13, padding: '11px 14px', fontSize: 13.5, color: 'var(--g-ink-2)', marginBottom: 10, background: 'var(--g-soft)' }}>“Agendá reunión mañana 3pm”</div>
          <div style={{ borderRadius: 13, padding: '11px 14px', fontSize: 13.5, color: 'var(--g-ink-2)', background: 'var(--g-soft)' }}>“Mandá a Jim a investigar el bug”</div>
        </div>

        {/* Module tiles */}
        <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Tile icon="memoria" title="Memoria" sub="ChatGPT, Claude, Notion, Obsidian, fotos" onClick={() => onOpenModule('memoria')} />
          <Tile icon="creativo" title="Creativo" sub="Imagen y video · galería" onClick={() => onOpenModule('creativo')} />
          <Tile icon="conexiones" title="Conexiones" sub="OAuth · Zapier · n8n" onClick={() => onOpenModule('conexiones')} />
          <div className="os-card os-tile" style={{ borderRadius: 'var(--g-r-md)', padding: 22, boxSizing: 'border-box', minHeight: 150, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={() => onOpenModule('oficina')}>
            <OsIcon name="oficina" size={40} stroke={1.7} />
            <div style={{ fontSize: 17, fontWeight: 600 }}>Oficina iso</div>
            <div style={{ marginTop: 'auto', height: 44, borderRadius: 12, position: 'relative', overflow: 'hidden', background: 'repeating-linear-gradient(60deg,#d3e2f6 0 12px,#e0ecfb 12px 24px)' }}>
              <span style={{ position: 'absolute', left: 9, bottom: 6, fontSize: 9, color: '#3f6aa6', letterSpacing: '.05em', fontWeight: 600 }}>UN MÓDULO MÁS</span>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="os-card" style={card}>
          <div className={eyebrow}>Objetivos</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '10px 0 16px' }}>En qué está el equipo</div>
          {userGoals?.trim() && (
            <div style={{ fontSize: 13.5, color: 'var(--g-ink-2)', lineHeight: 1.45, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--g-stroke)' }}>
              <span className={eyebrow} style={{ display: 'block', marginBottom: 5 }}>Tus objetivos</span>{userGoals}
            </div>
          )}
          {rosterGoals.length > 0 ? rosterGoals.map((a) => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}><span>{a.name}</span><span style={{ color: 'var(--g-ink-3)' }}>{Math.max(0, Math.min(100, Math.round(a.progress ?? 0)))}%</span></div>
              <div style={{ height: 6, borderRadius: 5, background: 'var(--g-soft)' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, Math.round(a.progress ?? 0)))}%`, borderRadius: 5, background: accent }} /></div>
            </div>
          )) : <div style={{ fontSize: 13, color: 'var(--g-ink-3)' }}>Ningún agente tiene objetivo asignado todavía.</div>}
        </div>

        {/* Activity */}
        <div className="os-card" style={card}>
          <div className={eyebrow}>Actividad</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '10px 0 20px' }}>Ahora</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Stat n={counts.total} label="Agentes" />
            <Stat n={counts.working} label="Trabajando" color="#248a45" />
            <Stat n={counts.needs} label="Te necesita" color="#c47a18" />
          </div>
        </div>

        {/* Sources */}
        <div className="os-card" style={card}>
          <div className={eyebrow}>Fuentes</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '10px 0 4px' }}>Conocimiento vivo</div>
          <div style={{ fontSize: 12.5, color: 'var(--g-ink-3)', marginBottom: 16 }}>Indexado y buscable por significado</div>
          <button className="os-cap" onClick={() => onOpenModule('memoria')} style={{ border: 'none', cursor: 'pointer', padding: '8px 15px', fontSize: 12.5, color: '#fff', background: `linear-gradient(180deg,${accent},#5a5cff)` }}>Agregar una fuente</button>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, title, sub, onClick }: { icon: 'memoria' | 'creativo' | 'conexiones'; title: string; sub: string; onClick: () => void }) {
  return (
    <div className="os-card os-tile" style={{ borderRadius: 'var(--g-r-md)', padding: 22, boxSizing: 'border-box', minHeight: 150, display: 'flex', flexDirection: 'column', gap: 14 }} onClick={onClick}>
      <OsIcon name={icon} size={40} stroke={1.7} />
      <div><div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 12.5, color: 'var(--g-ink-3)', lineHeight: 1.4, marginTop: 3 }}>{sub}</div></div>
    </div>
  );
}
function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div><div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: color || 'var(--g-ink)' }}>{n}</div><div style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>{label}</div></div>
  );
}
