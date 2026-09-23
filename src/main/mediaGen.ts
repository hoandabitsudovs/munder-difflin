/**
 * Media generation (Fase 4 — the Creativo department).
 *
 * Image generation backed by the OpenAI Images API, reusing the BYOK OpenAI key the
 * app already stores WRITE-ONLY in the encrypted secret broker (`apikey:openai`, the
 * same slot the Realtime voice uses). Generated images are saved to `<home>/media/`
 * with a small JSON sidecar (prompt/model/size/createdAt), and the renderer's gallery
 * reads them back as bytes over IPC (the established local-image pattern).
 *
 * The API key is materialized ONLY here, main-side, to make the request — never
 * logged, never returned to the renderer. Degrades to a clear error when no key is set.
 *
 * Video is intentionally out of this first slice (async job + polling); the same
 * manager is where a `generateVideo` would later live.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaItem } from '../shared/media';

export type { MediaItem } from '../shared/media';

export interface MediaGenDeps {
  getHome: () => string | null;
  /** Decrypt the OpenAI BYOK key from the secret broker. Main-internal. */
  getOpenAiKey: () => string | undefined;
}

const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', '1792x1024', '1024x1792', '512x512', '256x256']);
const REQUEST_TIMEOUT_MS = 120_000; // image gen is slow
const VIDEO_JOB_MAX_MS = 20 * 60_000; // give a video job 20 min, then mark it failed

export class MediaGenManager {
  constructor(private readonly deps: MediaGenDeps) {}

  private mediaDir(): string | null {
    const home = this.deps.getHome();
    return home ? join(home, 'media') : null;
  }

  hasKey(): boolean {
    return !!this.deps.getOpenAiKey();
  }

  /** Generate one image and persist it + its sidecar. Never throws. */
  async generateImage(args: { prompt: string; size?: string; model?: string }): Promise<
    { ok: true; item: MediaItem } | { ok: false; error: string }
  > {
    const prompt = (args.prompt ?? '').trim();
    if (!prompt) return { ok: false, error: 'a prompt is required' };
    const dir = this.mediaDir();
    if (!dir) return { ok: false, error: 'no hive home configured' };
    const key = this.deps.getOpenAiKey();
    if (!key) return { ok: false, error: 'No OpenAI key set. Add one under Settings → Agents & Models (or Voice) first.' };

    const model = (args.model ?? 'gpt-image-1').trim() || 'gpt-image-1';
    const size = ALLOWED_SIZES.has(args.size ?? '') ? args.size! : '1024x1024';

    const body: Record<string, unknown> = { model, prompt, size, n: 1 };
    // dall-e models need an explicit response_format to return base64; gpt-image-1
    // always returns b64_json and rejects the param, so only send it for dall-e.
    if (model.startsWith('dall-e')) body.response_format = 'b64_json';

    let b64: string | undefined;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal
      });
      clearTimeout(timer);
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* non-JSON */ }
      if (!res.ok) {
        const err = (json.error as Record<string, unknown>)?.message;
        return { ok: false, error: typeof err === 'string' ? err : `image API error (HTTP ${res.status})` };
      }
      const data = Array.isArray(json.data) ? json.data : [];
      const first = (data[0] ?? {}) as Record<string, unknown>;
      if (typeof first.b64_json === 'string') {
        b64 = first.b64_json;
      } else if (typeof first.url === 'string') {
        // Some models return a URL instead of bytes — fetch it main-side.
        const imgRes = await fetch(first.url);
        if (!imgRes.ok) return { ok: false, error: `could not download the generated image (HTTP ${imgRes.status})` };
        b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!b64) return { ok: false, error: 'the image API returned no image' };

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const file = `${id}.png`;
    const item: MediaItem = { id, prompt, model, size, createdAt: Date.now(), file };
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, file), Buffer.from(b64, 'base64'));
      await writeFile(join(dir, `${id}.json`), JSON.stringify(item, null, 2), 'utf8');
    } catch (e) {
      return { ok: false, error: `could not save the image: ${e instanceof Error ? e.message : String(e)}` };
    }
    return { ok: true, item };
  }

  /** List saved media, newest first. */
  async list(): Promise<MediaItem[]> {
    const dir = this.mediaDir();
    if (!dir || !existsSync(dir)) return [];
    let names: string[];
    try { names = await readdir(dir); } catch { return []; }
    const items: MediaItem[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const meta = JSON.parse(await readFile(join(dir, name), 'utf8')) as MediaItem;
        if (meta && typeof meta.id === 'string' && meta.file) items.push(meta);
      } catch { /* skip a corrupt sidecar */ }
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Read one item's bytes (image or video) as base64 for the renderer, plus the
   *  content type inferred from the saved file. */
  async read(id: string): Promise<{ ok: boolean; b64?: string; contentType?: string; error?: string }> {
    const dir = this.mediaDir();
    if (!dir) return { ok: false, error: 'no media dir' };
    if (!/^[a-z0-9-]+$/i.test(id)) return { ok: false, error: 'bad id' };
    let file = `${id}.png`;
    try {
      const meta = JSON.parse(await readFile(join(dir, `${id}.json`), 'utf8')) as MediaItem;
      if (meta?.file) file = meta.file;
    } catch { /* fall back to png */ }
    const contentType = file.endsWith('.mp4') ? 'video/mp4' : 'image/png';
    try {
      const buf = await readFile(join(dir, file));
      return { ok: true, b64: buf.toString('base64'), contentType };
    } catch { return { ok: false, error: 'not found' }; }
  }

  /** Delete one item + its sidecar (png or mp4). */
  async remove(id: string): Promise<{ ok: boolean }> {
    const dir = this.mediaDir();
    if (!dir || !/^[a-z0-9-]+$/i.test(id)) return { ok: false };
    await rm(join(dir, `${id}.png`), { force: true }).catch(() => {});
    await rm(join(dir, `${id}.mp4`), { force: true }).catch(() => {});
    await rm(join(dir, `${id}.json`), { force: true }).catch(() => {});
    return { ok: true };
  }

  /**
   * Start a VIDEO generation job (OpenAI Videos / Sora). Async: this creates the job
   * and persists a `queued` item; the gallery advances it with `pollVideo`. The mp4 is
   * downloaded on completion. Never throws.
   */
  async generateVideo(args: { prompt: string; seconds?: string; size?: string; model?: string }): Promise<
    { ok: true; item: MediaItem } | { ok: false; error: string }
  > {
    const prompt = (args.prompt ?? '').trim();
    if (!prompt) return { ok: false, error: 'a prompt is required' };
    const dir = this.mediaDir();
    if (!dir) return { ok: false, error: 'no hive home configured' };
    const key = this.deps.getOpenAiKey();
    if (!key) return { ok: false, error: 'No OpenAI key set. Add one under Settings first.' };

    const model = (args.model ?? 'sora-2').trim() || 'sora-2';
    const size = args.size ?? '720x1280';
    const seconds = args.seconds ?? '4';
    let job: { id?: string; status?: string } = {};
    try {
      const res = await fetch('https://api.openai.com/v1/videos', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, size, seconds })
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* non-JSON */ }
      if (!res.ok) {
        const err = (json.error as Record<string, unknown>)?.message;
        return { ok: false, error: typeof err === 'string' ? err : `video API error (HTTP ${res.status})` };
      }
      job = json as { id?: string; status?: string };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!job.id) return { ok: false, error: 'the video API returned no job id' };

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const item: MediaItem = {
      id, prompt, model, size, createdAt: Date.now(), file: '',
      kind: 'video', status: (job.status as MediaItem['status']) ?? 'queued', jobId: job.id
    };
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${id}.json`), JSON.stringify(item, null, 2), 'utf8');
    } catch (e) {
      return { ok: false, error: `could not save the job: ${e instanceof Error ? e.message : String(e)}` };
    }
    return { ok: true, item };
  }

  /** Poll a video job; on completion download the mp4 and mark the item ready. */
  async pollVideo(id: string): Promise<{ ok: boolean; item?: MediaItem; error?: string }> {
    const dir = this.mediaDir();
    if (!dir || !/^[a-z0-9-]+$/i.test(id)) return { ok: false, error: 'bad id' };
    let item: MediaItem;
    try { item = JSON.parse(await readFile(join(dir, `${id}.json`), 'utf8')) as MediaItem; }
    catch { return { ok: false, error: 'not found' }; }
    if (item.kind !== 'video' || !item.jobId) return { ok: true, item };
    if (item.status === 'completed' || item.status === 'failed') return { ok: true, item };
    // Terminal timeout: a job that never completes must not be polled forever. Mark it
    // failed after a generous window so the gallery reaches a terminal state.
    if (Date.now() - item.createdAt > VIDEO_JOB_MAX_MS) {
      item = { ...item, status: 'failed', error: 'video job timed out' };
      await writeFile(join(dir, `${id}.json`), JSON.stringify(item, null, 2), 'utf8').catch(() => {});
      return { ok: true, item };
    }
    const key = this.deps.getOpenAiKey();
    if (!key) return { ok: true, item };

    try {
      const res = await fetch(`https://api.openai.com/v1/videos/${item.jobId}`, { headers: { authorization: `Bearer ${key}` } });
      const json = await res.json() as { status?: string; error?: { message?: string } };
      const status = json.status as MediaItem['status'] | undefined;
      if (status === 'completed') {
        const c = await fetch(`https://api.openai.com/v1/videos/${item.jobId}/content`, { headers: { authorization: `Bearer ${key}` } });
        if (c.ok) {
          const file = `${id}.mp4`;
          await writeFile(join(dir, file), Buffer.from(await c.arrayBuffer()));
          item = { ...item, status: 'completed', file };
        } else {
          item = { ...item, status: 'failed', error: `could not download the video (HTTP ${c.status})` };
        }
      } else if (status === 'failed') {
        item = { ...item, status: 'failed', error: json.error?.message ?? 'the video job failed' };
      } else if (status) {
        item = { ...item, status };
      }
      await writeFile(join(dir, `${id}.json`), JSON.stringify(item, null, 2), 'utf8');
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    return { ok: true, item };
  }
}
