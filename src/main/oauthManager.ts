/**
 * OAuth 2.0 token manager (Fase 0.2, main process).
 *
 * Owns the encrypted token bundle for an `authType: 'oauth'` integration and hands
 * the broker a LIVE access token on demand, refreshing it transparently when it has
 * expired. Deliberately electron-free: `getSecret`/`setSecret`/`getRecord` are
 * injected (from src/main/integrations.ts), so this module is unit-testable under
 * plain node and the secret is materialized only here, never logged, never returned
 * to a worker or the renderer.
 *
 * The token bundle lives ENCRYPTED under the record's secretRef (`int:<id>`) as a
 * JSON string; the optional client secret (confidential clients) lives under
 * `oauthClientSecretRefFor(id)`. Nothing plaintext is persisted.
 *
 * Contract mirror of integrations-spec.md §8 ("Pending: OAuth broker"), now real.
 */
import {
  type IntegrationRecord,
  type OAuthConfig,
  secretRefFor,
  oauthClientSecretRefFor
} from '../shared/integrations';

/** The persisted, refreshable token set. Serialized to JSON in the secret store. */
export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms when the access token expires; absent ⇒ treated as non-expiring. */
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthManagerDeps {
  getRecord: (id: string) => IntegrationRecord | undefined;
  getSecret: (secretRef: string | undefined) => string | undefined;
  setSecret: (secretRef: string, plaintext: string) => { ok: boolean; error?: string };
}

/** Refresh a token this many ms BEFORE its stated expiry (clock skew + request time). */
const EXPIRY_SKEW_MS = 60_000;
const TOKEN_REQUEST_TIMEOUT_MS = 20_000;

/** Read + parse the stored token bundle for an integration id (undefined if none). */
export function readBundle(deps: OAuthManagerDeps, id: string): TokenBundle | undefined {
  const raw = deps.getSecret(secretRefFor(id));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<TokenBundle>;
    if (parsed && typeof parsed.accessToken === 'string' && parsed.accessToken) {
      return parsed as TokenBundle;
    }
  } catch { /* corrupt bundle — treat as absent */ }
  return undefined;
}

/** Persist a token bundle (encrypted) under the integration's secretRef. */
export function writeBundle(deps: OAuthManagerDeps, id: string, bundle: TokenBundle): { ok: boolean; error?: string } {
  return deps.setSecret(secretRefFor(id), JSON.stringify(bundle));
}

/** Whether the app currently holds a token bundle for this OAuth integration. */
export function isConnected(deps: OAuthManagerDeps, id: string): boolean {
  return !!readBundle(deps, id);
}

/** Turn a raw token endpoint JSON response into a TokenBundle, preserving a prior
 *  refresh token when the provider omits one on refresh (common). */
export function bundleFromResponse(
  json: Record<string, unknown>,
  prior?: TokenBundle
): TokenBundle {
  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const refreshToken = typeof json.refresh_token === 'string' && json.refresh_token
    ? json.refresh_token
    : prior?.refreshToken;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn != null ? Date.now() + expiresIn * 1000 : undefined,
    tokenType: typeof json.token_type === 'string' ? json.token_type : prior?.tokenType,
    scope: typeof json.scope === 'string' ? json.scope : prior?.scope
  };
}

/**
 * POST to a provider token endpoint (code exchange OR refresh). Shared by the
 * authorization flow (oauth.ts) and the refresh path here.
 *
 * Auth model: PKCE always. For a CONFIDENTIAL client (usesClientSecret) the client
 * secret is sent via HTTP Basic (client_secret_basic) — accepted by Notion, Google,
 * and most providers — rather than in the body, so it never lands in a logged body.
 * The clientId always rides the body too (harmless, and some providers want it).
 */
export async function tokenRequest(
  oauth: OAuthConfig,
  clientSecret: string | undefined,
  params: Record<string, string>
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const body = new URLSearchParams({ client_id: oauth.clientId, ...params });
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json'
  };
  if (oauth.usesClientSecret && clientSecret) {
    headers.authorization = 'Basic ' + Buffer.from(`${oauth.clientId}:${clientSecret}`).toString('base64');
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(oauth.tokenUrl, { method: 'POST', headers, body, signal: ac.signal });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { /* non-JSON */ }
    if (!res.ok) {
      const desc = typeof json.error_description === 'string' ? json.error_description
        : typeof json.error === 'string' ? json.error : `HTTP ${res.status}`;
      return { ok: false, error: desc };
    }
    if (typeof json.access_token !== 'string' || !json.access_token) {
      return { ok: false, error: 'token endpoint returned no access_token' };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return a valid access token for an OAuth integration, refreshing it if needed.
 * Undefined ⇒ no bundle stored, or a refresh was needed but failed (the broker
 * maps that to 503 no_secret). Never throws.
 */
export async function getValidAccessToken(deps: OAuthManagerDeps, id: string): Promise<string | undefined> {
  const rec = deps.getRecord(id);
  if (!rec || rec.authType !== 'oauth' || !rec.oauth) return undefined;
  const bundle = readBundle(deps, id);
  if (!bundle) return undefined;

  const notExpired = bundle.expiresAt == null || Date.now() < bundle.expiresAt - EXPIRY_SKEW_MS;
  if (notExpired) return bundle.accessToken;

  // Expired (or within skew). Refresh if we can; otherwise hand back what we have
  // (a long-lived token with no expiry never reaches here; a truly dead one just
  // gets a 401 upstream, which is clearer than silently returning nothing).
  if (!bundle.refreshToken) return bundle.accessToken;

  const clientSecret = rec.oauth.usesClientSecret ? deps.getSecret(oauthClientSecretRefFor(id)) : undefined;
  const refreshed = await tokenRequest(rec.oauth, clientSecret, {
    grant_type: 'refresh_token',
    refresh_token: bundle.refreshToken
  });
  if (!refreshed.ok) return undefined;
  const next = bundleFromResponse(refreshed.json, bundle);
  writeBundle(deps, id, next);
  return next.accessToken;
}

/** Status for the UI: connected + when the access token expires (if known). */
export function oauthStatus(deps: OAuthManagerDeps, id: string): { connected: boolean; expiresAt?: number } {
  const b = readBundle(deps, id);
  return b ? { connected: true, expiresAt: b.expiresAt } : { connected: false };
}
