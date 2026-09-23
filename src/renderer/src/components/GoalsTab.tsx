import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';

/**
 * Command Center → Goals (Fase 2).
 *
 * A roster view of every agent's goal and how it's progressing right now. Reads the
 * live store (agents already carry `goal`, `status`, `action`, `progress`,
 * `department`), so it needs no new plumbing. A header surfaces the human's own goals
 * from the user profile (Fase 0.1), tying the personal objectives to the team's.
 */

const dispLabel: CSSProperties = { fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase' };
const hint: CSSProperties = { fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' };

export function GoalsTab() {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const [myGoals, setMyGoals] = useState<string>('');

  useEffect(() => {
    let alive = true;
    void window.cth.getConfig().then((c) => { if (alive) setMyGoals(c.userProfile?.goals?.trim() ?? ''); });
    return () => { alive = false; };
  }, []);

  const roster = useMemo(
    () => agents.filter((a) => !a.archived).sort((a, b) => Number(!!b.goal) - Number(!!a.goal) || a.name.localeCompare(b.name)),
    [agents]
  );
  const withGoals = roster.filter((a) => a.goal?.trim()).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, overflowY: 'auto' }}>
      {/* The human's own goals (Fase 0.1 profile) */}
      {myGoals && (
        <div style={{ padding: 12, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          <div style={{ ...dispLabel, marginBottom: 4 }}>{t('goals.yourGoals')}</div>
          <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--cth-ink-900)', whiteSpace: 'pre-wrap' }}>{myGoals}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={dispLabel}>{t('goals.title')}</div>
        <span style={hint}>{t('goals.count', { withGoals, total: roster.length })}</span>
      </div>

      {roster.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', ...hint, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          {t('goals.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roster.map((a) => {
            const pct = Math.max(0, Math.min(100, Math.round(a.progress ?? 0)));
            return (
              <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: 'var(--cth-ink-900)' }}>{a.name}{a.isGod ? ' ★' : ''}</span>
                  <span style={hint}>{a.department || a.description || '—'}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: '19px', color: a.goal?.trim() ? 'var(--cth-ink-900)' : 'var(--cth-ink-500)' }}>
                  {a.goal?.trim() ? a.goal : t('goals.noGoal')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...hint, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.action ? `${t('goals.now')}: ${a.action}` : t(`goals.status.${a.status}`, { defaultValue: a.status })}
                  </span>
                  {pct > 0 && (
                    <div style={{ width: 96, height: 6, background: 'var(--cth-ink-100)', flexShrink: 0 }} title={`${pct}%`}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cth-mint-700, #1f7a4d)' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
