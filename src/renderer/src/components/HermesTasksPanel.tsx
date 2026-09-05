import { useEffect, useState } from 'react';

/** Mirrors HermesTaskRow in src/main/hermesKanban.ts — re-declared locally,
 *  same convention TasksKanban.tsx uses for its own HiveTask. */
interface HermesTaskRow {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: number;
  createdAt: number;
}

type Col = 'todo' | 'running' | 'blocked' | 'done';

const COLUMNS: { key: Col; label: string; accent: string }[] = [
  { key: 'todo',    label: 'POR HACER', accent: 'var(--cth-sky)' },
  { key: 'running', label: 'EN CURSO',  accent: 'var(--cth-lemon)' },
  { key: 'blocked', label: 'BLOQUEADO', accent: 'var(--cth-coral)' },
  { key: 'done',    label: 'HECHO',     accent: 'var(--cth-mint)' },
];

/** Hermes' real statuses (todo/ready/running/blocked/done/archived, see
 *  ~/.hermes/kanban.db) collapsed onto the 4 columns above. Archived is
 *  already excluded server-side; anything unrecognized lands in 'todo'
 *  rather than silently vanishing. */
function columnFor(status: string): Col {
  if (status === 'running') return 'running';
  if (status === 'blocked') return 'blocked';
  if (status === 'done') return 'done';
  return 'todo'; // todo, ready, and anything else new
}

const POLL_MS = 5000;

/** Read-only view of Hermes' real kanban board (~/.hermes/kanban.db) — a
 *  window onto AOS/IMAJU's actual production task board, distinct from
 *  munder-difflin's own hive tasks (TasksKanban.tsx). No move/assign/delete
 *  here on purpose: this panel only ever reads, same discipline as
 *  useHermesPoll.ts and src/main/hermesKanban.ts. */
export function HermesTasksPanel() {
  const [tasks, setTasks] = useState<HermesTaskRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const rows = await window.cth.hermesListTasks().catch(() => [] as HermesTaskRow[]);
      if (!cancelled) setTasks(rows);
    };
    void tick();
    const interval = window.setInterval(() => void tick(), POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flexShrink: 0,
        borderBottom: '1px solid var(--cth-ink-300)'
      }}>
        <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
          {tasks.length} tareas de Hermes (solo lectura)
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, padding: 10, overflowX: 'auto' }}>
        {COLUMNS.map((col) => {
          const cards = tasks.filter((t) => columnFor(t.status) === col.key);
          return (
            <div key={col.key} style={{
              flex: '1 1 0', minWidth: 170, display: 'flex', flexDirection: 'column',
              background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 4px',
                background: col.accent, boxShadow: 'inset 0 -1px 0 var(--cth-ink-900)',
                fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-900)'
              }}>
                {col.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--cth-font-ui)' }}>{cards.length}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cards.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--cth-ink-300)', textAlign: 'center', padding: '8px 0' }}>—</div>
                )}
                {cards.map((t) => (
                  <div key={t.id} style={{
                    display: 'flex', borderLeft: `3px solid ${col.accent}`,
                    background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    padding: '6px 8px', flexDirection: 'column', gap: 3
                  }}>
                    <span style={{
                      fontFamily: 'var(--cth-font-ui)', fontSize: 12, lineHeight: '15px', color: 'var(--cth-ink-900)',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {t.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-display)' }}>
                      {t.assignee ?? 'sin asignar'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
