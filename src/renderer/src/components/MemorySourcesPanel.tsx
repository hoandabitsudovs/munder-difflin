import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import {
  memorySourcesClient,
  slugifyOrFallback,
  type MemorySource,
  type MemorySourceStatus,
  type MemorySourceKind
} from '@/integrations/memorySourcesClient';
import { integrationsClient, type IntegrationRecordView } from '@/integrations/registryClient';

/**
 * Settings → Memory & Knowledge: memory sources (Fase 1).
 *
 * Register external knowledge (an Obsidian vault, a ChatGPT/Claude export, or a Notion
 * workspace via an OAuth connector) and ingest it into the shared MemPalace, where the
 * existing semantic search reaches it. Self-contained: talks to memorySourcesClient
 * (and integrationsClient for the Notion connector picker).
 */

const dispLabel: CSSProperties = { fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase' };
const fieldLabel: CSSProperties = { ...dispLabel, color: 'var(--cth-ink-700)' };
const hint: CSSProperties = { fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--cth-paper-100)', border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)', fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-900)', fontFamily: 'inherit' };

const KIND_GLYPH: Record<MemorySourceKind, string> = { obsidian: '📓', 'chat-export': '💬', notion: 'N' };

interface Draft {
  kind: MemorySourceKind;
  label: string;
  vaultPath: string;
  filePath: string;
  integrationId: string;
}

function emptyDraft(kind: MemorySourceKind): Draft {
  const label = kind === 'obsidian' ? 'Obsidian' : kind === 'chat-export' ? 'Chat export' : 'Notion';
  return { kind, label, vaultPath: '', filePath: '', integrationId: '' };
}

export function MemorySourcesPanel() {
  const { t: tr } = useTranslation();
  const [records, setRecords] = useState<MemorySource[]>([]);
  const [status, setStatus] = useState<Record<string, MemorySourceStatus>>({});
  const [oauthConns, setOauthConns] = useState<IntegrationRecordView[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft('obsidian'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 2600); };

  const refresh = async () => {
    const [recs, st] = await Promise.all([memorySourcesClient.list(), memorySourcesClient.status()]);
    setRecords(recs);
    setStatus(Object.fromEntries(st.map((s) => [s.id, s])));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await refresh();
      const conns = await integrationsClient.list();
      if (alive) setOauthConns(conns.filter((c) => c.authType === 'oauth'));
    })();
    return () => { alive = false; };
  }, []);

  // Poll status while anything is ingesting (spinner → done).
  useEffect(() => {
    const anyIngesting = Object.values(status).some((s) => s.ingesting);
    if (!anyIngesting) return;
    const t = setInterval(() => { void refresh(); }, 1500);
    return () => clearInterval(t);
  }, [status]);

  const startAdd = (kind: MemorySourceKind) => { setDraft(emptyDraft(kind)); setErr(''); setAdding(true); };

  const buildRecord = (d: Draft): MemorySource => {
    const id = slugifyOrFallback(d.label || d.kind);
    const now = Date.now();
    const base = { id, label: d.label.trim() || d.kind, enabled: true, createdAt: now, updatedAt: now };
    if (d.kind === 'obsidian') return { ...base, kind: 'obsidian', config: { vaultPath: d.vaultPath.trim() } };
    if (d.kind === 'chat-export') return { ...base, kind: 'chat-export', config: { filePath: d.filePath.trim(), format: 'auto' } };
    return { ...base, kind: 'notion', config: { integrationId: d.integrationId } };
  };

  const validateDraft = (d: Draft): string | null => {
    if (!d.label.trim()) return tr('memorySources.errLabel');
    if (d.kind === 'obsidian' && !d.vaultPath.trim()) return tr('memorySources.errVault');
    if (d.kind === 'chat-export' && !d.filePath.trim()) return tr('memorySources.errFile');
    if (d.kind === 'notion' && !d.integrationId) return tr('memorySources.errConnector');
    return null;
  };

  const onSave = async () => {
    const v = validateDraft(draft);
    if (v) { setErr(v); return; }
    setBusy(true); setErr('');
    try {
      const res = await memorySourcesClient.upsert(buildRecord(draft));
      if (!res.ok) { setErr(res.error || tr('memorySources.couldNotSave')); return; }
      await refresh();
      setAdding(false);
      flash(tr('memorySources.added'));
    } catch { setErr(tr('memorySources.couldNotSave')); }
    finally { setBusy(false); }
  };

  const onIngest = async (id: string) => {
    setStatus((m) => ({ ...m, [id]: { ...(m[id] ?? { id }), id, ingesting: true } }));
    setErr('');
    try {
      const res = await memorySourcesClient.ingest(id);
      await refresh();
      flash(res.ok ? tr('memorySources.ingested', { count: res.docCount ?? 0 }) : `${tr('memorySources.ingestFailed')}: ${res.error ?? ''}`);
    } catch { flash(tr('memorySources.ingestFailed')); await refresh(); }
  };

  const onToggle = async (r: MemorySource) => {
    setBusy(true);
    try { await memorySourcesClient.upsert({ ...r, enabled: !r.enabled }); await refresh(); }
    finally { setBusy(false); }
  };

  const onRemove = async (r: MemorySource) => {
    setBusy(true);
    try { await memorySourcesClient.remove(r.id); await refresh(); flash(tr('memorySources.removed', { label: r.label })); }
    finally { setBusy(false); }
  };

  const browseVault = async () => {
    const res = await memorySourcesClient.chooseFolder();
    if (res.ok) setDraft((d) => ({ ...d, vaultPath: res.path }));
  };
  const browseFile = async () => {
    const res = await memorySourcesClient.pickExportFile();
    if (res.ok) setDraft((d) => ({ ...d, filePath: res.path }));
  };

  const fmtWhen = (ts?: number) => (ts ? new Date(ts).toLocaleString() : tr('memorySources.never'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={dispLabel}>{tr('memorySources.title')}</div>
        <span style={{ ...hint, maxWidth: 460 }}>{tr('memorySources.desc')}</span>
      </div>

      {/* Existing sources */}
      {records.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map((r) => {
            const st = status[r.id];
            const ingesting = st?.ingesting;
            return (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, textAlign: 'center', fontSize: 16 }}>{KIND_GLYPH[r.kind]}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-900)', fontWeight: 600 }}>{r.label}</span>
                    <span style={{ ...hint, overflowWrap: 'anywhere' }}>{tr(`memorySources.kind.${r.kind}`)} · <code style={{ fontFamily: 'var(--cth-font-mono)' }}>
                      {r.kind === 'obsidian' ? r.config.vaultPath : r.kind === 'chat-export' ? r.config.filePath : r.config.integrationId}
                    </code></span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <PixelButton variant={r.enabled ? 'primary' : 'secondary'} size="sm" onClick={() => { void onToggle(r); }} disabled={busy}>{r.enabled ? tr('integrations.enabled') : tr('integrations.disabled')}</PixelButton>
                    <PixelButton variant="secondary" size="sm" onClick={() => { void onIngest(r.id); }} disabled={ingesting || !r.enabled}>{ingesting ? tr('memorySources.ingesting') : tr('memorySources.ingest')}</PixelButton>
                    <PixelButton variant="ghost" size="sm" onClick={() => { void onRemove(r); }} disabled={busy}>✕</PixelButton>
                  </div>
                </div>
                <span style={hint}>
                  {st?.lastError
                    ? <span style={{ color: 'var(--cth-danger, #6E1423)' }}>⚠ {st.lastError}</span>
                    : `${tr('memorySources.lastIngest')}: ${fmtWhen(st?.lastIngestedAt)}${st?.docCount != null ? ` · ${tr('memorySources.docs', { count: st.docCount })}` : ''}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Add flow */}
      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 260 }}>
            <span style={fieldLabel}>{tr('memorySources.kindLabel')}</span>
            <select value={draft.kind} onChange={(e) => setDraft(emptyDraft(e.target.value as MemorySourceKind))} style={{ ...inputStyle, fontFamily: 'var(--cth-font-mono)' }}>
              <option value="obsidian">{tr('memorySources.kind.obsidian')}</option>
              <option value="chat-export">{tr('memorySources.kind.chat-export')}</option>
              <option value="notion">{tr('memorySources.kind.notion')}</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={fieldLabel}>{tr('memorySources.label')}</span>
            <input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} style={inputStyle} />
          </label>

          {draft.kind === 'obsidian' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={fieldLabel}>{tr('memorySources.vaultPath')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={draft.vaultPath} onChange={(e) => setDraft((d) => ({ ...d, vaultPath: e.target.value }))} placeholder="/Users/you/Vault" style={{ ...inputStyle, fontFamily: 'var(--cth-font-mono)' }} />
                <PixelButton variant="secondary" size="sm" onClick={() => { void browseVault(); }}>{tr('memorySources.browse')}</PixelButton>
              </div>
            </label>
          )}
          {draft.kind === 'chat-export' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={fieldLabel}>{tr('memorySources.exportFile')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={draft.filePath} onChange={(e) => setDraft((d) => ({ ...d, filePath: e.target.value }))} placeholder="conversations.json" style={{ ...inputStyle, fontFamily: 'var(--cth-font-mono)' }} />
                <PixelButton variant="secondary" size="sm" onClick={() => { void browseFile(); }}>{tr('memorySources.browse')}</PixelButton>
              </div>
              <span style={hint}>{tr('memorySources.exportHint')}</span>
            </label>
          )}
          {draft.kind === 'notion' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={fieldLabel}>{tr('memorySources.connector')}</span>
              {oauthConns.length === 0 ? (
                <span style={hint}>{tr('memorySources.noConnectors')}</span>
              ) : (
                <select value={draft.integrationId} onChange={(e) => setDraft((d) => ({ ...d, integrationId: e.target.value }))} style={{ ...inputStyle, fontFamily: 'var(--cth-font-mono)' }}>
                  <option value="">{tr('memorySources.pickConnector')}</option>
                  {oauthConns.map((c) => <option key={c.id} value={c.id}>{c.label}{c.hasSecret ? ' ✓' : ''}</option>)}
                </select>
              )}
              <span style={hint}>{tr('memorySources.notionHint')}</span>
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {err && <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--cth-danger, #6E1423)' }}>{err}</span>}
            <PixelButton variant="secondary" size="sm" onClick={() => { setAdding(false); setErr(''); }} disabled={busy}>{tr('common.cancel')}</PixelButton>
            <PixelButton variant="primary" size="sm" onClick={() => { void onSave(); }} disabled={busy}>{busy ? '…' : tr('memorySources.addSource')}</PixelButton>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PixelButton variant="primary" size="sm" onClick={() => startAdd('obsidian')} disabled={busy}>+ {tr('memorySources.addSource')}</PixelButton>
          {note && <span style={hint}>{note}</span>}
        </div>
      )}
    </div>
  );
}
