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
      const running = await window.cth.hermesPollRunningProfiles().catch(() => [] as string[]);
      if (cancelled) return;

      const runningSet = new Set(running);
      const { agents, addAgent, updateAgent } = useStore.getState();

      for (const entry of HERMES_ROSTER) {
        if (!entry.hermesProfile) continue; // e.g. Recepcionista — no bot behind it
        const isWorking = runningSet.has(entry.hermesProfile);
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
            status: isWorking ? 'working' : 'idle',
            action: isWorking ? 'trabajando en Hermes' : 'en espera',
            progress: isWorking ? 1 : 0,
            currentStation: 'desk',
            recentTextTs: Date.now()
          });
          continue;
        }

        const wasWorking = existing.status === 'working';
        if (isWorking && !wasWorking) {
          updateAgent(entry.id, { status: 'working', action: 'trabajando en Hermes', progress: 1 });
        } else if (!isWorking && wasWorking) {
          updateAgent(entry.id, { status: 'idle', action: 'en espera', progress: 0 });
        }
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [enabled]);
}
