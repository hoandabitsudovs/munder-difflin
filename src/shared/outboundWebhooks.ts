/**
 * Outbound webhooks — the Zapier/n8n bridge, OUTBOUND half (Fase 5).
 *
 * The app already ingests INBOUND webhooks (webhookTriggers). This is the reverse:
 * a registry of URLs the app POSTs events to (a Zapier catch hook, an n8n webhook
 * node, any HTTPS endpoint), so office events can drive anything downstream. Metadata
 * only — a URL is not a secret, and there is no auth token here (Zapier/n8n use an
 * unguessable URL). Dependency-free shared schema (main + preload + renderer).
 */

export interface OutboundWebhook {
  /** Stable lowercase slug, unique. */
  id: string;
  /** Human label for the UI. */
  label: string;
  /** Destination URL. https, or loopback http for a local n8n. */
  url: string;
  /** Gate — a disabled webhook never fires. */
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export const OUTBOUND_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Validate an outbound-webhook URL: https, or http only for loopback (local n8n). */
export function validateOutboundUrl(url: string): { ok: true; url: string } | { ok: false; error: string } {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, error: 'url is required' };
  let parsed: URL;
  try { parsed = new URL(u); } catch { return { ok: false, error: 'url must be a valid URL' }; }
  if (parsed.username || parsed.password) return { ok: false, error: 'url must not contain userinfo' };
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1' || parsed.hostname === '[::1]';
  if (parsed.protocol === 'https:') return { ok: true, url: u };
  if (parsed.protocol === 'http:' && loopback) return { ok: true, url: u };
  return { ok: false, error: 'url must be https (http allowed only for 127.0.0.1/localhost)' };
}

/** Validate an outbound-webhook record (the upsert gate). Fail-closed. */
export function validateOutboundWebhook(
  rec: unknown
): { ok: true; value: Omit<OutboundWebhook, 'createdAt' | 'updatedAt'> } | { ok: false; error: string } {
  if (!rec || typeof rec !== 'object') return { ok: false, error: 'record must be an object' };
  const r = rec as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!OUTBOUND_SLUG_RE.test(id)) return { ok: false, error: 'id must be a lowercase slug (2–40 chars)' };
  const label = typeof r.label === 'string' ? r.label.trim() : '';
  if (!label || label.length > 60) return { ok: false, error: 'label is required and must be <= 60 chars' };
  const urlCheck = validateOutboundUrl(typeof r.url === 'string' ? r.url : '');
  if (!urlCheck.ok) return { ok: false, error: urlCheck.error };
  return { ok: true, value: { id, label, url: urlCheck.url, enabled: r.enabled === true } };
}

/** Best-effort slug from a label. */
export function slugifyOutbound(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return base.length >= 2 ? base : `${base || 'hook'}-x`;
}
