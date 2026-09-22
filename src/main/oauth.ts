/**
 * OAuth 2.0 authorization-code + PKCE flow (Fase 0.2, main process).
 *
 * Runs the interactive connect step: opens the provider's consent page in the user's
 * real browser (shell.openExternal), catches the redirect on a LOOPBACK server, then
 * exchanges the code for a token bundle via the OAuth token manager. The token bundle
 * is stored encrypted; nothing plaintext is persisted or logged.
 *
 * REDIRECT URI is a FIXED loopback URL (stable port) so it can be pre-registered with
 * providers that require an exact match (Notion). RFC 8252 loopback redirect. The user
 * registers `oauthRedirectUri()` with their OAuth app; the UI shows it.
 *
 * Only ONE authorization is in flight at a time (a module latch): the fixed port can
 * bind once, and two consent pages racing the same callback is a footgun.
 */
import { shell } from 'electron';
import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import {
  type IntegrationRecord,
  oauthClientSecretRefFor
} from '../shared/integrations';
import {
  type OAuthManagerDeps,
  tokenRequest,
  bundleFromResponse,
  writeBundle
} from './oauthManager';

/** Fixed loopback port for the OAuth redirect. Chosen high + uncommon; stable so the
 *  redirect URI can be registered once with the provider. */
export const OAUTH_REDIRECT_PORT = 42813;
const CALLBACK_PATH = '/oauth/callback';
/** How long to wait for the user to complete consent before giving up. */
const AUTH_TIMEOUT_MS = 5 * 60_000;

/** The exact redirect URI the user must register with their OAuth provider. */
export function oauthRedirectUri(): string {
  return `http://127.0.0.1:${OAUTH_REDIRECT_PORT}${CALLBACK_PATH}`;
}

let inFlight = false;

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function closingPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#1a1320;color:#f4efe9;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}
.card{max-width:420px;text-align:center;padding:32px}h1{font-size:18px;margin:0 0 8px}
p{font-size:14px;color:#c9bcd4;line-height:1.5}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

/**
 * Begin (and complete) an OAuth connection for an integration id. Resolves once the
 * token bundle is stored, or with an error. Opens the provider consent page in the
 * user's browser and waits for the loopback redirect.
 */
export async function beginAuthorization(
  deps: OAuthManagerDeps,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const rec: IntegrationRecord | undefined = deps.getRecord(id);
  if (!rec || rec.authType !== 'oauth' || !rec.oauth) {
    return { ok: false, error: 'not an OAuth integration' };
  }
  const oauth = rec.oauth;
  if (!oauth.clientId || !oauth.authorizationUrl || !oauth.tokenUrl) {
    return { ok: false, error: 'OAuth endpoints or client id are not configured' };
  }
  const clientSecret = oauth.usesClientSecret ? deps.getSecret(oauthClientSecretRefFor(id)) : undefined;
  if (oauth.usesClientSecret && !clientSecret) {
    return { ok: false, error: 'set the OAuth client secret first, then connect' };
  }
  if (inFlight) return { ok: false, error: 'another connection is already in progress' };
  inFlight = true;

  const { verifier, challenge } = pkcePair();
  const state = b64url(randomBytes(16));
  const redirectUri = oauthRedirectUri();

  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    let server: Server | null = null;
    let timer: NodeJS.Timeout | null = null;
    let settled = false;
    const finish = (result: { ok: boolean; error?: string }): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { server?.close(); } catch { /* noop */ }
      inFlight = false;
      resolve(result);
    };

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${OAUTH_REDIRECT_PORT}`);
      if (url.pathname !== CALLBACK_PATH) { res.writeHead(404).end(); return; }
      const err = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const gotState = url.searchParams.get('state');
      const respond = (title: string, body: string): void => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(closingPage(title, body));
      };
      if (err) { respond('Connection cancelled', `The provider returned: ${err}. You can close this tab.`); finish({ ok: false, error: err }); return; }
      if (!code || gotState !== state) {
        respond('Connection failed', 'The response could not be verified. You can close this tab and try again.');
        finish({ ok: false, error: 'invalid or missing authorization response' });
        return;
      }
      // Exchange the code for tokens, then acknowledge in the browser.
      void tokenRequest(oauth, clientSecret, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      }).then((r) => {
        if (!r.ok) {
          respond('Connection failed', `Could not exchange the code: ${r.error}. You can close this tab.`);
          finish({ ok: false, error: r.error });
          return;
        }
        const saved = writeBundle(deps, id, bundleFromResponse(r.json));
        if (!saved.ok) {
          respond('Connection failed', `Could not store the token: ${saved.error}. You can close this tab.`);
          finish({ ok: false, error: saved.error });
          return;
        }
        respond('Connected', `${rec.label} is now connected. You can close this tab and return to the app.`);
        finish({ ok: true });
      });
    });

    server.once('error', (e: Error) => {
      const msg = (e as NodeJS.ErrnoException).code === 'EADDRINUSE'
        ? `the loopback port ${OAUTH_REDIRECT_PORT} is busy — close any other connection and retry`
        : e.message;
      finish({ ok: false, error: msg });
    });

    server.listen(OAUTH_REDIRECT_PORT, '127.0.0.1', () => {
      const authUrl = new URL(oauth.authorizationUrl);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', oauth.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      if (oauth.scopes.length) authUrl.searchParams.set('scope', oauth.scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      for (const [k, v] of Object.entries(oauth.authParams ?? {})) authUrl.searchParams.set(k, v);
      timer = setTimeout(() => finish({ ok: false, error: 'timed out waiting for authorization' }), AUTH_TIMEOUT_MS);
      void shell.openExternal(authUrl.toString()).catch((e) => finish({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    });
  });
}
