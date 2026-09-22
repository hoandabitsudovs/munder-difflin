// Integrations registry client — the renderer's single doorway to the
// integrations registry + secret broker.
//
// CONFORMED to Jim's spec v1 (hive/docs/integrations-spec.md): the types are the
// CANONICAL ones from `@shared/integrations` (Jim's src/shared/integrations.ts),
// and the client maps 1:1 to the §6 IPC surface — whose handlers already exist in
// src/main/index.ts (integrations:list / templates / upsert / setSecret / remove /
// test). The real path calls window.cth.* (Jim's preload bridge).
//
// ⚠️ The preload bridge is NOT landed yet (Jim owns it — god relays when it's in).
// Until then this falls back to an in-memory mock so the UI is fully usable in dev.
// The real path is FEATURE-DETECTED: the moment Jim's preload methods appear it
// activates with NO change here. Two coordination notes:
//   1. The bridge method NAMES below (integrationsList, …) follow the existing
//      preload camelCase→colon-channel convention (getConfig→'config:get', etc.).
//      Jim: expose exactly these (or tell me the names) so the detect matches.
//   2. The catalog served by `integrations:templates` is Jim's `INTEGRATION_TEMPLATES`
//      (the 2 v1 reference templates). Dwight's richer src/shared/integrationTemplates.ts
//      is a SEPARATE, currently-unwired file — reconciliation is a god/Jim/Dwight call.
//
// SECURITY INVARIANT (matches §2): a secret value flows ONE WAY — from the form
// into save()'s setSecret call and onward to the encrypted store. It is NEVER read
// back. list() returns records with secretRef redacted to hasSecret:boolean.

import {
  INTEGRATION_TEMPLATES,
  authTypeNeedsSecret,
  isOAuth,
  secretRefFor,
  validateIntegrationRecord,
  type IntegrationRecord,
  type IntegrationTemplate
} from '@shared/integrations';

export type { IntegrationRecord, IntegrationTemplate, OAuthConfig } from '@shared/integrations';
export type { IntegrationKind, IntegrationAuthType } from '@shared/integrations';

/** OAuth connection status for the UI (no token value ever crosses IPC). */
export interface OAuthStatus { connected: boolean; expiresAt?: number }

/** The renderer-visible record: secretRef is redacted to a presence boolean.
 *  Matches main `integrations.listRecordsRedacted()`. */
export type IntegrationRecordView = Omit<IntegrationRecord, 'secretRef'> & { hasSecret: boolean };

/** Result of a §6 `integrations:test` probe. */
export interface TestResult {
  ok: boolean;
  status?: number;
  error?: string;
}

type UpsertResult = { ok: true; record: IntegrationRecord } | { ok: false; error: string };

export interface IntegrationsClient {
  listTemplates(): Promise<IntegrationTemplate[]>;
  list(): Promise<IntegrationRecordView[]>;
  /** §6 upsert (metadata, no secret) + §6 setSecret when a new secret was typed. */
  save(record: IntegrationRecord, secret?: string): Promise<{ ok: boolean; error?: string }>;
  remove(id: string): Promise<{ ok: boolean }>;
  test(id: string): Promise<TestResult>;
  // OAuth (Fase 0.2)
  oauthRedirectUri(): Promise<string>;
  oauthSetClientSecret(id: string, secret: string): Promise<{ ok: boolean; error?: string }>;
  oauthHasClientSecret(id: string): Promise<boolean>;
  oauthStatus(id: string): Promise<OAuthStatus>;
  oauthBegin(id: string): Promise<{ ok: boolean; error?: string }>;
  oauthDisconnect(id: string): Promise<{ ok: boolean; error?: string }>;
}

// The preload bridge Jim exposes (Deliverable 2). Channels are fixed by §6;
// accessed via a tolerant cast so this compiles before the bridge exists.
interface IntegrationsBridge {
  integrationsList(): Promise<IntegrationRecordView[]>;
  integrationsTemplates(): Promise<IntegrationTemplate[]>;
  integrationsUpsert(record: IntegrationRecord): Promise<UpsertResult>;
  integrationsSetSecret(req: { id: string; secret: string }): Promise<{ ok: boolean; error?: string }>;
  integrationsRemove(req: { id: string }): Promise<{ ok: boolean }>;
  integrationsTest(req: { id: string; path?: string }): Promise<TestResult>;
  integrationsOAuthRedirectUri(): Promise<string>;
  integrationsOAuthSetClientSecret(req: { id: string; secret: string }): Promise<{ ok: boolean; error?: string }>;
  integrationsOAuthHasClientSecret(id: string): Promise<boolean>;
  integrationsOAuthStatus(id: string): Promise<OAuthStatus>;
  integrationsOAuthBegin(req: { id: string }): Promise<{ ok: boolean; error?: string }>;
  integrationsOAuthDisconnect(req: { id: string }): Promise<{ ok: boolean; error?: string }>;
}

function liveBridge(): IntegrationsBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const b = (window as unknown as { cth?: Partial<IntegrationsBridge> }).cth;
  return b && typeof b.integrationsList === 'function' ? (b as IntegrationsBridge) : undefined;
}

// ───────────────────────── PROVISIONAL mock (dev fallback only) ─────────────────────────
// Serves Jim's canonical INTEGRATION_TEMPLATES and validates upserts with Jim's
// real validateIntegrationRecord, so the mock behaves like the wired backend.

let mockRecords: IntegrationRecord[] = [];
const mockSecret = new Set<string>(); // secretRef membership only — never values
const mockClientSecret = new Set<string>(); // oauth client-secret presence (ids)
const mockConnected = new Set<string>(); // oauth "connected" (token bundle present) ids

function redact(r: IntegrationRecord): IntegrationRecordView {
  const { secretRef, ...rest } = r;
  // For OAuth, "hasSecret" means a stored token bundle == connected (mirrors main,
  // where secretRefFor(id) holds the bundle). Otherwise it is the raw credential.
  const hasSecret = isOAuth(r.authType)
    ? mockConnected.has(r.id)
    : !!secretRef && mockSecret.has(secretRef);
  return { ...rest, hasSecret };
}

const mockClient: IntegrationsClient = {
  listTemplates: () => Promise.resolve(INTEGRATION_TEMPLATES.map((t) => ({ ...t }))),
  list: () => Promise.resolve(mockRecords.map(redact)),
  save: (record, secret) => {
    const v = validateIntegrationRecord(record);
    if (!v.ok) return Promise.resolve({ ok: false, error: v.error });
    const now = Date.now();
    const prev = mockRecords.find((r) => r.id === v.value.id);
    const full: IntegrationRecord = { ...v.value, createdAt: prev?.createdAt ?? now, updatedAt: now };
    if (prev) mockRecords = mockRecords.map((r) => (r.id === full.id ? full : r));
    else mockRecords.push(full);
    // OAuth never routes a secret through here (client secret + connect are separate).
    if (secret && secret.length > 0 && full.secretRef && !isOAuth(full.authType)) mockSecret.add(full.secretRef);
    return Promise.resolve({ ok: true });
  },
  remove: (id) => {
    const r = mockRecords.find((x) => x.id === id);
    if (r?.secretRef) mockSecret.delete(r.secretRef);
    mockClientSecret.delete(id); mockConnected.delete(id);
    mockRecords = mockRecords.filter((x) => x.id !== id);
    return Promise.resolve({ ok: true });
  },
  test: (id) => {
    const r = mockRecords.find((x) => x.id === id);
    if (!r) return Promise.resolve({ ok: false, error: 'unknown integration' });
    if (!r.enabled) return Promise.resolve({ ok: false, error: 'integration is disabled' });
    if (isOAuth(r.authType) && !mockConnected.has(r.id)) {
      return Promise.resolve({ ok: false, status: 503, error: 'not connected (OAuth)' });
    }
    if (!isOAuth(r.authType) && authTypeNeedsSecret(r.authType) && !(r.secretRef && mockSecret.has(r.secretRef))) {
      return Promise.resolve({ ok: false, status: 503, error: 'no secret set' });
    }
    return Promise.resolve({ ok: true, status: 200 });
  },
  oauthRedirectUri: () => Promise.resolve('http://127.0.0.1:42813/oauth/callback'),
  oauthSetClientSecret: (id, secret) => { if (secret) mockClientSecret.add(id); return Promise.resolve({ ok: true }); },
  oauthHasClientSecret: (id) => Promise.resolve(mockClientSecret.has(id)),
  oauthStatus: (id) => Promise.resolve({ connected: mockConnected.has(id) }),
  // Dev fallback can't run a real browser flow — simulate a successful connect so the
  // UI is exercisable. The real path (below) runs the actual PKCE flow in main.
  oauthBegin: (id) => { mockConnected.add(id); return Promise.resolve({ ok: true }); },
  oauthDisconnect: (id) => { mockConnected.delete(id); return Promise.resolve({ ok: true }); }
};

// ───────────────────────── exported client (real → mock fallback) ─────────────────────────

export const integrationsClient: IntegrationsClient = {
  listTemplates: () => {
    const b = liveBridge();
    return b ? b.integrationsTemplates() : mockClient.listTemplates();
  },
  list: () => {
    const b = liveBridge();
    return b ? b.integrationsList() : mockClient.list();
  },
  save: async (record, secret) => {
    const b = liveBridge();
    if (!b) return mockClient.save(record, secret);
    const up = await b.integrationsUpsert(record);
    if (!up.ok) return { ok: false, error: up.error };
    // OAuth records never carry their secret through here — the client secret is set
    // via oauthSetClientSecret and the token bundle is minted by the connect flow.
    if (secret && secret.length > 0 && !isOAuth(record.authType)) {
      const ss = await b.integrationsSetSecret({ id: record.id, secret });
      if (!ss.ok) return { ok: false, error: ss.error };
    }
    return { ok: true };
  },
  remove: (id) => {
    const b = liveBridge();
    return b ? b.integrationsRemove({ id }) : mockClient.remove(id);
  },
  test: (id) => {
    const b = liveBridge();
    return b ? b.integrationsTest({ id }) : mockClient.test(id);
  },
  oauthRedirectUri: () => {
    const b = liveBridge();
    return b ? b.integrationsOAuthRedirectUri() : mockClient.oauthRedirectUri();
  },
  oauthSetClientSecret: (id, secret) => {
    const b = liveBridge();
    return b ? b.integrationsOAuthSetClientSecret({ id, secret }) : mockClient.oauthSetClientSecret(id, secret);
  },
  oauthHasClientSecret: (id) => {
    const b = liveBridge();
    return b ? b.integrationsOAuthHasClientSecret(id) : mockClient.oauthHasClientSecret(id);
  },
  oauthStatus: (id) => {
    const b = liveBridge();
    return b ? b.integrationsOAuthStatus(id) : mockClient.oauthStatus(id);
  },
  oauthBegin: (id) => {
    const b = liveBridge();
    return b ? b.integrationsOAuthBegin({ id }) : mockClient.oauthBegin(id);
  },
  oauthDisconnect: (id) => {
    const b = liveBridge();
    return b ? b.integrationsOAuthDisconnect({ id }) : mockClient.oauthDisconnect(id);
  }
};

// ───────────────────────── small UI helper ─────────────────────────

/** Best-effort slug from a label (server-side validateIntegrationRecord is authoritative). */
export function slugify(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return base.length >= 2 ? base : `${base || 'api'}-x`;
}
