/**
 * Drives the 17-agent Hermes department roster (src/data/hermesRoster.ts) as
 * synthetic, PTY-free office characters — the same "observed, not owned"
 * pattern mockEvents.ts already uses for demo agents, but fed by a real
 * external source instead of a random walk: a 5s poll of Hermes' own kanban
 * board (~/.hermes/kanban.db, read-only — see src/main/hermesKanban.ts).
 *
 * These agents never get a `ptyId` and are never registered with the hive —
 * both confirmed independent of PTY/hive participation for office rendering.
 * mockEvents.ts is taught to skip `hermes-*` ids so its random walk never
 * fights this hook's real status.
 */
import { useEffect } from 'react';
import { useStore } from '@/store/store';
import { HERMES_ROSTER, DEPARTMENT_ACCENT } from '@/data/hermesRoster';

const POLL_MS = 5000;

export function useHermesPoll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      // Two reads of the same read-only board: which profiles are running, and
      // the task rows themselves (so an agent can show its REAL task title, and
      // a blocked task can surface as "needs you" instead of a generic idle).
      const [running, tasks] = await Promise.all([
        window.cth.hermesPollRunningProfiles().catch(() => [] as string[]),
        window.cth.hermesListTasks().catch(() => [])
      ]);
      if (cancelled) return;

      const runningSet = new Set(running);
      // Per profile, the most relevant task: running beats blocked beats the rest.
      const rank = (s: string): number => (s === 'running' ? 3 : s === 'blocked' ? 2 : 1);
      const byProfile = new Map<string, { status: string; title: string }>();
      for (const t of tasks) {
        if (!t.assignee) continue;
        const cur = byProfile.get(t.assignee);
        if (!cur || rank(t.status) > rank(cur.status)) byProfile.set(t.assignee, { status: t.status, title: t.title });
      }

      // Resolve each roster agent's on-floor state from its real board rows.
      const resolve = (profile: string): { status: 'working' | 'blocked' | 'idle'; action: string; progress: number } => {
        const info = byProfile.get(profile);
        if (info?.status === 'running' || runningSet.has(profile)) {
          return { status: 'working', action: info?.title ?? 'trabajando en Hermes', progress: 1 };
        }
        if (info?.status === 'blocked') return { status: 'blocked', action: info.title, progress: 1 };
        return { status: 'idle', action: 'en espera', progress: 0 };
      };

      const { agents, addAgent, updateAgent } = useStore.getState();

      for (const entry of HERMES_ROSTER) {
        if (!entry.hermesProfile) continue; // e.g. Recepcionista — no bot behind it
        const next = resolve(entry.hermesProfile);
        const existing = agents.find((a) => a.id === entry.id);

        if (!existing) {
          addAgent({
            id: entry.id,
            name: `${entry.name} (${entry.department})`,
            character: entry.character,
            accent: DEPARTMENT_ACCENT[entry.department],
            description: entry.role,
            project: entry.department,
            department: entry.department,
            tmuxTarget: '',
            cwd: '',
            status: next.status,
            action: next.action,
            progress: next.progress,
            currentStation: 'desk',
            recentTextTs: Date.now()
          });
          continue;
        }

        // Update on any status OR action change, so a running agent's bubble
        // tracks its current task title as the board moves.
        if (existing.status !== next.status || existing.action !== next.action) {
          updateAgent(entry.id, { status: next.status, action: next.action, progress: next.progress });
        }
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [enabled]);
}
