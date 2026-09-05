/**
 * Read-only bridge to Hermes' kanban board (~/.hermes/kanban.db). Hermes'
 * own gateway is the sole writer — this file only ever opens the DB
 * `readonly: true` and re-opens it per call (never held open), the same
 * discipline the AgentOS nucleus bridge used for the same database.
 *
 * Never compute the path as a module-level constant — see AgentOS's
 * `os.homedir()` lesson (a path built at import time freezes before a
 * test's homedir mock is installed). Build it inside the function instead.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

function kanbanDbPath(): string {
  return join(homedir(), '.hermes', 'kanban.db');
}

export interface HermesTaskRow {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: number;
  createdAt: number;
}

/** Recent, non-archived tasks from Hermes' real kanban board — for display
 *  only, same read-only discipline as pollHermesRunningProfiles(). */
export function listHermesTasks(limit = 100): HermesTaskRow[] {
  const path = kanbanDbPath();
  if (!existsSync(path)) return [];
  let db: Database.Database | undefined;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(
        `SELECT id, title, assignee, status, priority, created_at
         FROM tasks WHERE status != 'archived'
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(limit) as Array<{ id: string; title: string; assignee: string | null; status: string; priority: number; created_at: number }>;
    return rows.map((r) => ({
      id: r.id, title: r.title, assignee: r.assignee, status: r.status,
      priority: r.priority, createdAt: r.created_at,
    }));
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** Hermes profile names (the `assignee` column) with at least one `running` task right now. */
export function pollHermesRunningProfiles(): string[] {
  const path = kanbanDbPath();
  if (!existsSync(path)) return [];
  let db: Database.Database | undefined;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(`SELECT DISTINCT assignee FROM tasks WHERE status = 'running' AND assignee IS NOT NULL`)
      .all() as Array<{ assignee: string }>;
    return rows.map((r) => r.assignee);
  } catch {
    // Gateway may be mid-write (WAL checkpoint) or the file may be transiently
    // locked — a poll failure should never crash the app, just skip this tick.
    return [];
  } finally {
    db?.close();
  }
}
