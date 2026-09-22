// Memory sources client — the renderer's doorway to the Fase 1 ingest registry.
//
// Mirrors registryClient's posture: types are the canonical ones from
// @shared/memorySources, and the client maps 1:1 to the memorySources:* IPC surface
// exposed by the preload bridge. Falls back to an in-memory mock (dev / no bridge) so
// the UI is exercisable, feature-detected on window.cth exactly like registryClient.

import {
  validateMemorySource,
  slugifyMemorySource,
  type MemorySource,
  type MemorySourceStatus
} from '@shared/memorySources';

export type { MemorySource, MemorySourceStatus, MemorySourceKind } from '@shared/memorySources';
export { slugifyMemorySource } from '@shared/memorySources';

/** Best-effort slug for a new source id (server-side validate is authoritative). */
export const slugifyOrFallback = slugifyMemorySource;

type UpsertResult = { ok: true; record: MemorySource } | { ok: false; error: string };
type PickResult = { ok: true; path: string } | { ok: false; error: string };

interface MemorySourcesBridge {
  memorySourcesList(): Promise<MemorySource[]>;
  memorySourcesStatus(): Promise<MemorySourceStatus[]>;
  memorySourcesUpsert(record: MemorySource): Promise<UpsertResult>;
  memorySourcesRemove(req: { id: string }): Promise<{ ok: boolean }>;
  memorySourcesIngest(req: { id: string }): Promise<{ ok: boolean; docCount?: number; error?: string }>;
  memorySourcesPickExportFile(): Promise<PickResult>;
  chooseFolder(): Promise<PickResult>;
}

function liveBridge(): MemorySourcesBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const b = (window as unknown as { cth?: Partial<MemorySourcesBridge> }).cth;
  return b && typeof b.memorySourcesList === 'function' ? (b as MemorySourcesBridge) : undefined;
}

// ── Dev mock ──────────────────────────────────────────────────────────────────
let mockRecords: MemorySource[] = [];
const mockStatus = new Map<string, MemorySourceStatus>();

const mockClient = {
  list: () => Promise.resolve(mockRecords.map((r) => ({ ...r }))),
  status: () => Promise.resolve([...mockStatus.values()]),
  upsert: (record: MemorySource): Promise<UpsertResult> => {
    const v = validateMemorySource(record);
    if (!v.ok) return Promise.resolve({ ok: false, error: v.error });
    const now = Date.now();
    const prev = mockRecords.find((r) => r.id === v.value.id);
    const full = { ...v.value, createdAt: prev?.createdAt ?? now, updatedAt: now } as MemorySource;
    mockRecords = prev ? mockRecords.map((r) => (r.id === full.id ? full : r)) : [...mockRecords, full];
    return Promise.resolve({ ok: true, record: full });
  },
  remove: (id: string) => { mockRecords = mockRecords.filter((r) => r.id !== id); mockStatus.delete(id); return Promise.resolve({ ok: true }); },
  ingest: (id: string): Promise<{ ok: boolean; docCount?: number; error?: string }> => {
    const now = Date.now();
    mockStatus.set(id, { id, ingesting: false, lastIngestedAt: now, docCount: 3 });
    mockRecords = mockRecords.map((r) => (r.id === id ? { ...r, lastIngestedAt: now, docCount: 3 } as MemorySource : r));
    return Promise.resolve({ ok: true, docCount: 3 });
  },
  pickExportFile: (): Promise<PickResult> => Promise.resolve({ ok: false, error: 'no bridge' }),
  chooseFolder: (): Promise<PickResult> => Promise.resolve({ ok: false, error: 'no bridge' })
};

export const memorySourcesClient = {
  list: () => { const b = liveBridge(); return b ? b.memorySourcesList() : mockClient.list(); },
  status: () => { const b = liveBridge(); return b ? b.memorySourcesStatus() : mockClient.status(); },
  upsert: (record: MemorySource) => { const b = liveBridge(); return b ? b.memorySourcesUpsert(record) : mockClient.upsert(record); },
  remove: (id: string) => { const b = liveBridge(); return b ? b.memorySourcesRemove({ id }) : mockClient.remove(id); },
  ingest: (id: string) => { const b = liveBridge(); return b ? b.memorySourcesIngest({ id }) : mockClient.ingest(id); },
  pickExportFile: () => { const b = liveBridge(); return b ? b.memorySourcesPickExportFile() : mockClient.pickExportFile(); },
  chooseFolder: () => { const b = liveBridge(); return b ? b.chooseFolder() : mockClient.chooseFolder(); }
};
