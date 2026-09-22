/**
 * MemorySourcesManager — multi-source ingest into the shared MemPalace (Fase 1).
 *
 * Registry (config-backed, metadata only) + the ingest pipeline. Ingesting a source
 * NORMALIZES its content to markdown under `<home>/hive/sources/<id>/` and mines that
 * directory into the palace wing `src-<id>` (via the injected MemoryManager.mineDir),
 * so it is recallable through the existing `mempalace search` everywhere in the app.
 * Recall is untouched — this is the WRITE side only.
 *
 * Ingestors (one per kind, all here):
 *   - obsidian     : copy a local vault's .md notes (fully local, no credentials).
 *   - chat-export  : parse a ChatGPT/Claude conversations export file (local).
 *   - notion       : fetch pages through an OAuth connector (Fase 0.2), main-side, so
 *                    the access token never leaves the main process.
 *
 * Runs in the Electron main process. Never logs secrets; the Notion token is
 * materialized here only to call the API.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { readConfig, writeConfig } from './config';
import {
  type MemorySource,
  type MemorySourceStatus,
  validateMemorySource,
  memorySourceWing,
  safeDocName
} from '../shared/memorySources';

// Ingest caps — keep a runaway vault/export from flooding the palace or main process.
const MAX_DOCS = 5000;
const MAX_DOC_BYTES = 1_000_000; // per source doc
const NOTION_MAX_PAGES = 300;
const NOTION_VERSION = '2022-06-28';

export interface MemorySourcesDeps {
  getHome: () => string | null;
  mineDir: (dir: string, wing: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live OAuth access token for an integration id (Fase 0.2). Undefined ⇒ not connected. */
  getOAuthAccessToken: (integrationId: string) => Promise<string | undefined>;
}

export class MemorySourcesManager {
  /** ids currently mid-ingest — serialized per source, surfaced to the UI. */
  private readonly ingesting = new Set<string>();

  constructor(private readonly deps: MemorySourcesDeps) {}

  // ── Registry (config-backed) ──────────────────────────────────────────────
  list(): MemorySource[] {
    return readConfig().memorySources ?? [];
  }
  get(id: string): MemorySource | undefined {
    return this.list().find((s) => s.id === id);
  }
  upsert(input: unknown): { ok: true; record: MemorySource } | { ok: false; error: string } {
    const v = validateMemorySource(input);
    if (!v.ok) return v;
    const now = Date.now();
    const existing = this.get(v.value.id);
    // Preserve ingest stamps across a metadata edit unless explicitly provided.
    const record = {
      ...v.value,
      lastIngestedAt: v.value.lastIngestedAt ?? existing?.lastIngestedAt,
      docCount: v.value.docCount ?? existing?.docCount,
      lastError: v.value.lastError ?? existing?.lastError,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    } as MemorySource;
    const next = this.list().filter((s) => s.id !== record.id);
    next.push(record);
    writeConfig({ memorySources: next });
    return { ok: true, record };
  }
  remove(id: string): { ok: boolean } {
    const next = this.list().filter((s) => s.id !== id);
    writeConfig({ memorySources: next });
    // Best-effort: drop the normalized-doc directory (palace segments are left to the
    // reaper; mempalace has no per-wing delete we rely on here).
    const dir = this.sourceDir(id);
    if (dir) void rm(dir, { recursive: true, force: true }).catch(() => {});
    return { ok: true };
  }

  status(id: string): MemorySourceStatus {
    const rec = this.get(id);
    return {
      id,
      ingesting: this.ingesting.has(id),
      lastIngestedAt: rec?.lastIngestedAt,
      docCount: rec?.docCount,
      lastError: rec?.lastError
    };
  }
  allStatus(): MemorySourceStatus[] {
    return this.list().map((s) => this.status(s.id));
  }

  private sourceDir(id: string): string | null {
    const home = this.deps.getHome();
    return home ? join(home, 'hive', 'sources', id) : null;
  }

  private patchRecord(id: string, patch: Partial<MemorySource>): void {
    const next = this.list().map((s) => (s.id === id ? ({ ...s, ...patch, updatedAt: Date.now() } as MemorySource) : s));
    writeConfig({ memorySources: next });
  }

  // ── Ingest ────────────────────────────────────────────────────────────────
  /**
   * Normalize a source to markdown and mine it into its palace wing. Returns the
   * doc count on success. Serialized per source; never throws.
   */
  async ingest(id: string): Promise<{ ok: boolean; docCount?: number; error?: string }> {
    const rec = this.get(id);
    if (!rec) return { ok: false, error: 'unknown source' };
    if (!rec.enabled) return { ok: false, error: 'source is disabled' };
    if (this.ingesting.has(id)) return { ok: false, error: 'already ingesting' };
    const dir = this.sourceDir(id);
    if (!dir) return { ok: false, error: 'no hive home' };

    this.ingesting.add(id);
    try {
      // Fresh dir each ingest so deletions upstream don't leave stale normalized docs.
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      await mkdir(dir, { recursive: true });

      let docCount = 0;
      if (rec.kind === 'obsidian') docCount = await ingestObsidian(rec.config.vaultPath, dir);
      else if (rec.kind === 'chat-export') docCount = await ingestChatExport(rec.config.filePath, rec.config.format ?? 'auto', dir);
      else if (rec.kind === 'notion') docCount = await ingestNotion(rec.config.integrationId, dir, this.deps.getOAuthAccessToken);

      if (docCount === 0) {
        this.patchRecord(id, { lastError: 'no documents found to ingest', docCount: 0 });
        return { ok: false, error: 'no documents found to ingest' };
      }

      const mined = await this.deps.mineDir(dir, memorySourceWing(id));
      if (!mined.ok) {
        this.patchRecord(id, { lastError: `mine failed: ${mined.error ?? 'unknown'}`, docCount });
        return { ok: false, error: mined.error };
      }
      this.patchRecord(id, { lastIngestedAt: Date.now(), docCount, lastError: undefined });
      return { ok: true, docCount };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.patchRecord(id, { lastError: error });
      return { ok: false, error };
    } finally {
      this.ingesting.delete(id);
    }
  }
}

// ─── Ingestors ─────────────────────────────────────────────────────────────

/** Obsidian: copy a vault's .md notes (skipping Obsidian metadata) into `outDir`,
 *  each prefixed with its vault-relative path for provenance. */
async function ingestObsidian(vaultPath: string, outDir: string): Promise<number> {
  if (!existsSync(vaultPath)) throw new Error(`vault not found: ${vaultPath}`);
  const files: string[] = [];
  const skipDirs = new Set(['.obsidian', '.trash', '.git', 'node_modules']);
  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_DOCS) return;
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (files.length >= MAX_DOCS) return;
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        await walk(join(dir, ent.name));
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
        files.push(join(dir, ent.name));
      }
    }
  }
  await walk(vaultPath);

  let count = 0;
  for (const file of files) {
    let content: string;
    try {
      const st = await stat(file);
      if (st.size > MAX_DOC_BYTES) continue;
      content = await readFile(file, 'utf8');
    } catch { continue; }
    const rel = relative(vaultPath, file);
    const name = `${safeDocName(rel.replace(/\.md$/i, '').split(sep).join(' / '), `note-${count}`)}.md`;
    const header = `# ${rel}\n\n_Source: Obsidian vault_\n\n`;
    try { await writeFile(join(outDir, `${count}-${name}`), header + content, 'utf8'); count += 1; } catch { /* skip */ }
  }
  return count;
}

/** ChatGPT/Claude export: parse a conversations JSON file into one markdown doc per
 *  conversation. Auto-detects the two common shapes; degrades gracefully. */
async function ingestChatExport(filePath: string, format: string, outDir: string): Promise<number> {
  if (!existsSync(filePath)) throw new Error(`export file not found: ${filePath}`);
  const raw = await readFile(filePath, 'utf8');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('export file is not valid JSON'); }
  const convos = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).conversations)
    ? (data as { conversations: unknown[] }).conversations : []);
  if (!convos.length) throw new Error('no conversations found in export');

  const detected = format !== 'auto' ? format : detectChatFormat(convos[0]);
  let count = 0;
  for (const c of convos) {
    if (count >= MAX_DOCS) break;
    const md = detected === 'claude' ? claudeConvoToMd(c) : chatgptConvoToMd(c);
    if (!md) continue;
    const title = (c && typeof c === 'object' && typeof (c as Record<string, unknown>).title === 'string' && (c as Record<string, string>).title)
      || (c && typeof c === 'object' && typeof (c as Record<string, unknown>).name === 'string' && (c as Record<string, string>).name)
      || `conversation-${count}`;
    const name = `${safeDocName(String(title), `conversation-${count}`)}.md`;
    try { await writeFile(join(outDir, `${count}-${name}`), md.slice(0, MAX_DOC_BYTES), 'utf8'); count += 1; } catch { /* skip */ }
  }
  return count;
}

function detectChatFormat(sample: unknown): 'chatgpt' | 'claude' {
  if (sample && typeof sample === 'object') {
    const o = sample as Record<string, unknown>;
    if ('mapping' in o) return 'chatgpt';
    if ('chat_messages' in o) return 'claude';
  }
  return 'chatgpt';
}

/** ChatGPT export: a conversation has `title` + `mapping` (a node tree, each node a
 *  message). Collect messages, order by create_time, render role: text. */
function chatgptConvoToMd(convo: unknown): string | null {
  if (!convo || typeof convo !== 'object') return null;
  const o = convo as Record<string, unknown>;
  const mapping = o.mapping;
  if (!mapping || typeof mapping !== 'object') return null;
  const nodes = Object.values(mapping as Record<string, unknown>);
  const msgs: { role: string; text: string; t: number }[] = [];
  for (const n of nodes) {
    const msg = (n as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    if (!msg) continue;
    const role = ((msg.author as Record<string, unknown>)?.role as string) ?? 'unknown';
    const content = msg.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content!.parts : [];
    const text = parts.filter((p): p is string => typeof p === 'string').join('\n').trim();
    if (!text) continue;
    msgs.push({ role, text, t: typeof msg.create_time === 'number' ? msg.create_time : 0 });
  }
  if (!msgs.length) return null;
  msgs.sort((a, b) => a.t - b.t);
  const title = typeof o.title === 'string' ? o.title : 'Conversation';
  return `# ${title}\n\n_Source: ChatGPT export_\n\n` +
    msgs.map((m) => `**${m.role}:** ${m.text}`).join('\n\n');
}

/** Claude export: a conversation has `name` + `chat_messages` (each with `sender`
 *  and `text` or `content` parts). */
function claudeConvoToMd(convo: unknown): string | null {
  if (!convo || typeof convo !== 'object') return null;
  const o = convo as Record<string, unknown>;
  const list = Array.isArray(o.chat_messages) ? o.chat_messages : [];
  const msgs: string[] = [];
  for (const m of list) {
    const mo = m as Record<string, unknown>;
    const sender = typeof mo.sender === 'string' ? mo.sender : 'unknown';
    let text = typeof mo.text === 'string' ? mo.text : '';
    if (!text && Array.isArray(mo.content)) {
      text = (mo.content as Record<string, unknown>[])
        .map((p) => (typeof p.text === 'string' ? p.text : ''))
        .filter(Boolean).join('\n');
    }
    text = text.trim();
    if (text) msgs.push(`**${sender}:** ${text}`);
  }
  if (!msgs.length) return null;
  const title = typeof o.name === 'string' ? o.name : 'Conversation';
  return `# ${title}\n\n_Source: Claude export_\n\n` + msgs.join('\n\n');
}

/** Notion: fetch pages via the OAuth token (main-side) and render each to markdown.
 *  Uses the search + block-children endpoints; renders the common text block types. */
async function ingestNotion(
  integrationId: string,
  outDir: string,
  getToken: (id: string) => Promise<string | undefined>
): Promise<number> {
  const token = await getToken(integrationId);
  if (!token) throw new Error('Notion connector is not connected (OAuth)');
  const headers = {
    authorization: `Bearer ${token}`,
    'notion-version': NOTION_VERSION,
    'content-type': 'application/json'
  };

  // 1) Enumerate pages (paginated search).
  const pages: { id: string; title: string }[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100, filter: { property: 'object', value: 'page' } };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch('https://api.notion.com/v1/search', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Notion search failed (${res.status})`);
    const json = await res.json() as { results?: unknown[]; has_more?: boolean; next_cursor?: string };
    for (const r of json.results ?? []) {
      const ro = r as Record<string, unknown>;
      if (ro.object !== 'page') continue;
      pages.push({ id: String(ro.id), title: notionPageTitle(ro) });
      if (pages.length >= NOTION_MAX_PAGES) break;
    }
    cursor = json.has_more && pages.length < NOTION_MAX_PAGES ? json.next_cursor : undefined;
  } while (cursor);

  // 2) Fetch each page's top-level blocks and render.
  let count = 0;
  for (const page of pages) {
    let md = `# ${page.title}\n\n_Source: Notion_\n\n`;
    try {
      const res = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`, { headers });
      if (res.ok) {
        const json = await res.json() as { results?: unknown[] };
        md += (json.results ?? []).map(notionBlockToMd).filter(Boolean).join('\n\n');
      }
    } catch { /* keep the title-only doc */ }
    const name = `${safeDocName(page.title, `page-${count}`)}.md`;
    try { await writeFile(join(outDir, `${count}-${name}`), md.slice(0, MAX_DOC_BYTES), 'utf8'); count += 1; } catch { /* skip */ }
  }
  return count;
}

function notionRichText(arr: unknown): string {
  if (!Array.isArray(arr)) return '';
  return arr.map((t) => (typeof (t as Record<string, unknown>)?.plain_text === 'string' ? (t as Record<string, string>).plain_text : '')).join('');
}

function notionPageTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined;
  if (props) {
    for (const val of Object.values(props)) {
      const vo = val as Record<string, unknown>;
      if (vo?.type === 'title') return notionRichText(vo.title) || 'Untitled';
    }
  }
  return 'Untitled';
}

function notionBlockToMd(block: unknown): string {
  const b = block as Record<string, unknown>;
  const type = typeof b?.type === 'string' ? b.type : '';
  const data = b[type] as Record<string, unknown> | undefined;
  const text = data ? notionRichText(data.rich_text) : '';
  switch (type) {
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `- [${(data?.checked === true) ? 'x' : ' '}] ${text}`;
    case 'quote': return `> ${text}`;
    case 'code': return `\`\`\`\n${text}\n\`\`\``;
    case 'paragraph': return text;
    default: return text;
  }
}
