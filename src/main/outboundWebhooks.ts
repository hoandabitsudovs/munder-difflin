/**
 * Outbound webhooks manager (Fase 5, main process).
 *
 * Registry (config-backed) + the fire path. `fire(event, payload)` POSTs a JSON body
 * to every ENABLED webhook, best-effort and fire-and-forget: a slow or dead endpoint
 * never blocks or throws into the caller (an office event must not hang on Zapier).
 * `test` posts a sample payload to one webhook and reports the status.
 *
 * No secret is stored — a Zapier/n8n webhook is guarded by its unguessable URL.
 */
import { readConfig, writeConfig } from './config';
import { type OutboundWebhook, validateOutboundWebhook } from '../shared/outboundWebhooks';

const FIRE_TIMEOUT_MS = 10_000;
const USER_AGENT = 'agentic-os-imaju-outbound/1';

export class OutboundWebhooksManager {
  list(): OutboundWebhook[] {
    return readConfig().outboundWebhooks ?? [];
  }
  get(id: string): OutboundWebhook | undefined {
    return this.list().find((w) => w.id === id);
  }
  upsert(input: unknown): { ok: true; record: OutboundWebhook } | { ok: false; error: string } {
    const v = validateOutboundWebhook(input);
    if (!v.ok) return v;
    const now = Date.now();
    const existing = this.get(v.value.id);
    const record: OutboundWebhook = { ...v.value, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const next = this.list().filter((w) => w.id !== record.id);
    next.push(record);
    writeConfig({ outboundWebhooks: next });
    return { ok: true, record };
  }
  remove(id: string): { ok: boolean } {
    writeConfig({ outboundWebhooks: this.list().filter((w) => w.id !== id) });
    return { ok: true };
  }

  /** POST one payload to one URL. Never throws. */
  private async post(url: string, body: unknown): Promise<{ ok: boolean; status?: number; error?: string }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FIRE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
        body: JSON.stringify(body),
        signal: ac.signal
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Fire an event to every enabled webhook. Fire-and-forget; failures are swallowed
   *  (they never reach the office event that triggered them). */
  fire(event: string, payload: Record<string, unknown> = {}): void {
    const hooks = this.list().filter((w) => w.enabled);
    if (!hooks.length) return;
    const body = { event, at: new Date().toISOString(), ...payload };
    for (const w of hooks) {
      void this.post(w.url, body).then((r) => {
        if (!r.ok) console.warn(`[outbound-webhook] ${w.id} → ${event}: ${r.error ?? `HTTP ${r.status}`}`);
      });
    }
  }

  /** Test one webhook by posting a sample payload. Awaited (the UI shows the result). */
  async test(id: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    const w = this.get(id);
    if (!w) return { ok: false, error: 'unknown webhook' };
    return this.post(w.url, { event: 'test', at: new Date().toISOString(), message: 'Test event from the office.' });
  }
}
