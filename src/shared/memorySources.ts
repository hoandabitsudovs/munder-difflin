/**
 * Memory sources — the multi-source ingest registry (Fase 1, Memory Core).
 *
 * Dependency-free shared schema (main + preload + renderer), mirroring the posture of
 * `integrations.ts`. A *memory source* is an external body of knowledge the user
 * registers (an Obsidian vault, a ChatGPT/Claude export file, a Notion workspace via
 * an OAuth connector). Ingesting a source NORMALIZES it to markdown under
 * `<home>/hive/sources/<id>/` and mines it into a dedicated MemPalace wing (`src-<id>`),
 * so it becomes recallable through the SAME `mempalace search` the whole app already
 * uses (Command Center, MemoryPanel, the voice `get_memory` tool). Recall is unchanged;
 * this is purely the WRITE side.
 *
 * The record is metadata only — no secrets. A Notion source references an OAuth
 * `integrationId` (Fase 0.2); the token bundle stays in the encrypted secret store.
 */

export type MemorySourceKind = 'obsidian' | 'chat-export' | 'notion';

export const ALL_MEMORY_SOURCE_KINDS: readonly MemorySourceKind[] = ['obsidian', 'chat-export', 'notion'];

/** A local Obsidian vault (folder of .md notes). Fully local, no credentials. */
export interface ObsidianConfig { vaultPath: string }
/** A ChatGPT/Claude conversation export file (conversations.json). Local. */
export interface ChatExportConfig { filePath: string; format?: 'auto' | 'chatgpt' | 'claude' }
/** A Notion workspace reached through an OAuth integration (Fase 0.2). */
export interface NotionConfig { integrationId: string }

interface MemorySourceBase {
  /** Stable lowercase slug, unique. */
  id: string;
  /** Human label for the UI. */
  label: string;
  /** Ingest gate — a disabled source is never fetched or mined. */
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  /** Stamped after a successful ingest (epoch ms). */
  lastIngestedAt?: number;
  /** Normalized doc count from the last ingest. */
  docCount?: number;
  /** Last ingest error message (cleared on success). */
  lastError?: string;
}

export type MemorySource =
  | (MemorySourceBase & { kind: 'obsidian'; config: ObsidianConfig })
  | (MemorySourceBase & { kind: 'chat-export'; config: ChatExportConfig })
  | (MemorySourceBase & { kind: 'notion'; config: NotionConfig });

/** Runtime ingest status surfaced to the UI (merged with the persisted record). */
export interface MemorySourceStatus {
  id: string;
  ingesting: boolean;
  lastIngestedAt?: number;
  docCount?: number;
  lastError?: string;
}

/** Source id: lowercase slug, 2–40 chars, no leading/trailing hyphen. */
export const MEMORY_SOURCE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** The MemPalace wing an ingested source mines into (kept distinct from agent wings). */
export function memorySourceWing(id: string): string {
  return `src-${id}`;
}

/** Best-effort slug from a label (the validator is authoritative). */
export function slugifyMemorySource(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return base.length >= 2 ? base : `${base || 'src'}-x`;
}

/**
 * Validate a memory-source record (the upsert gate). Fail-closed. `createdAt`/
 * `updatedAt` are stamped by the registry, so they are not required on input.
 */
export function validateMemorySource(
  rec: unknown
): { ok: true; value: Omit<MemorySource, 'createdAt' | 'updatedAt'> } | { ok: false; error: string } {
  if (!rec || typeof rec !== 'object') return { ok: false, error: 'record must be an object' };
  const r = rec as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!MEMORY_SOURCE_SLUG_RE.test(id)) {
    return { ok: false, error: 'id must be a lowercase slug (2–40 chars, a–z 0–9 -, no leading/trailing hyphen)' };
  }
  const label = typeof r.label === 'string' ? r.label.trim() : '';
  if (!label || label.length > 60) return { ok: false, error: 'label is required and must be <= 60 chars' };

  const kind = r.kind as MemorySourceKind;
  if (!ALL_MEMORY_SOURCE_KINDS.includes(kind)) {
    return { ok: false, error: `kind must be one of ${ALL_MEMORY_SOURCE_KINDS.join(', ')}` };
  }
  const enabled = r.enabled === true;
  const cfg = (r.config && typeof r.config === 'object' ? r.config : {}) as Record<string, unknown>;

  const base = {
    id, label, enabled,
    lastIngestedAt: typeof r.lastIngestedAt === 'number' ? r.lastIngestedAt : undefined,
    docCount: typeof r.docCount === 'number' ? r.docCount : undefined,
    lastError: typeof r.lastError === 'string' ? r.lastError : undefined
  };

  switch (kind) {
    case 'obsidian': {
      const vaultPath = typeof cfg.vaultPath === 'string' ? cfg.vaultPath.trim() : '';
      if (!vaultPath) return { ok: false, error: 'obsidian: vaultPath is required' };
      return { ok: true, value: { ...base, kind, config: { vaultPath } } };
    }
    case 'chat-export': {
      const filePath = typeof cfg.filePath === 'string' ? cfg.filePath.trim() : '';
      if (!filePath) return { ok: false, error: 'chat-export: filePath is required' };
      const fmt = cfg.format;
      const format = fmt === 'chatgpt' || fmt === 'claude' ? fmt : 'auto';
      return { ok: true, value: { ...base, kind, config: { filePath, format } } };
    }
    case 'notion': {
      const integrationId = typeof cfg.integrationId === 'string' ? cfg.integrationId.trim() : '';
      if (!integrationId) return { ok: false, error: 'notion: integrationId (an OAuth connector) is required' };
      return { ok: true, value: { ...base, kind, config: { integrationId } } };
    }
    default:
      return { ok: false, error: 'unknown kind' };
  }
}

/** A safe markdown filename fragment from an arbitrary title (for normalized docs). */
export function safeDocName(title: string, fallback: string): string {
  const base = title.replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  return (base || fallback).replace(/\s/g, '_');
}
