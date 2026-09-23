import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import { slugifyOutbound, type OutboundWebhook } from '@shared/outboundWebhooks';

/**
 * Settings → Connections: outbound webhooks (Fase 5 — Zapier/n8n bridge).
 *
 * A registry of URLs the app POSTs office events to (currently agent lifecycle
 * notifications). Self-contained: talks to window.cth.outboundWebhooks*. The URL is
 * the only credential (Zapier/n8n use an unguessable catch URL), so there is no secret.
 */

const dispLabel: CSSProperties = { fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase' };
const hint: CSSProperties = { fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--cth-paper-100)', border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)', fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-900)', fontFamily: 'inherit' };

export function OutboundWebhooksSection() {
  const { t } = useTranslation();
  const [hooks, setHooks] = useState<OutboundWebhook[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 2400); };
  const refresh = async () => setHooks(await window.cth.outboundWebhooksList());

  useEffect(() => { void refresh(); }, []);

  const onAdd = async () => {
    if (!label.trim() || !url.trim()) { setErr(t('outbound.errFields')); return; }
    setBusy(true); setErr('');
    try {
      const now = Date.now();
      const rec: OutboundWebhook = { id: slugifyOutbound(label), label: label.trim(), url: url.trim(), enabled: true, createdAt: now, updatedAt: now };
      const res = await window.cth.outboundWebhooksUpsert(rec);
      if (!res.ok) { setErr(res.error || t('outbound.couldNotSave')); return; }
      setLabel(''); setUrl(''); setAdding(false); await refresh(); flash(t('outbound.added'));
    } catch { setErr(t('outbound.couldNotSave')); }
    finally { setBusy(false); }
  };

  const onToggle = async (w: OutboundWebhook) => {
    setBusy(true);
    try { await window.cth.outboundWebhooksUpsert({ ...w, enabled: !w.enabled }); await refresh(); }
    finally { setBusy(false); }
  };
  const onRemove = async (w: OutboundWebhook) => {
    setBusy(true);
    try { await window.cth.outboundWebhooksRemove({ id: w.id }); await refresh(); }
    finally { setBusy(false); }
  };
  const onTest = async (w: OutboundWebhook) => {
    setTestResult((m) => ({ ...m, [w.id]: '…' }));
    try {
      const r = await window.cth.outboundWebhooksTest({ id: w.id });
      setTestResult((m) => ({ ...m, [w.id]: r.ok ? t('outbound.testOk', { status: r.status ?? 200 }) : `${t('outbound.testFail')}: ${r.error ?? r.status ?? ''}` }));
    } catch { setTestResult((m) => ({ ...m, [w.id]: t('outbound.testFail') })); }
  };

  return (
    <div>
      <div style={{ ...dispLabel, marginBottom: 4 }}>{t('outbound.title')}</div>
      <p style={{ ...hint, margin: '0 0 10px', maxWidth: 460 }}>{t('outbound.desc')}</p>

      {hooks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {hooks.map((w) => (
            <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 10, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-900)', fontWeight: 600 }}>{w.label}</span>
                  <span style={{ ...hint, overflowWrap: 'anywhere' }}><code style={{ fontFamily: 'var(--cth-font-mono)' }}>{w.url}</code></span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <PixelButton variant={w.enabled ? 'primary' : 'secondary'} size="sm" onClick={() => { void onToggle(w); }} disabled={busy}>{w.enabled ? t('common.on') : t('common.off')}</PixelButton>
                  <PixelButton variant="secondary" size="sm" onClick={() => { void onTest(w); }}>{t('outbound.test')}</PixelButton>
                  <PixelButton variant="ghost" size="sm" onClick={() => { void onRemove(w); }} disabled={busy}>✕</PixelButton>
                </div>
              </div>
              {testResult[w.id] && <span style={hint}>{testResult[w.id]}</span>}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...dispLabel, color: 'var(--cth-ink-700)' }}>{t('outbound.label')}</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Zapier — new lead" style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...dispLabel, color: 'var(--cth-ink-700)' }}>{t('outbound.url')}</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" style={{ ...inputStyle, fontFamily: 'var(--cth-font-mono)' }} />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {err && <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--cth-danger, #6E1423)' }}>{err}</span>}
            <PixelButton variant="secondary" size="sm" onClick={() => { setAdding(false); setErr(''); }} disabled={busy}>{t('common.cancel')}</PixelButton>
            <PixelButton variant="primary" size="sm" onClick={() => { void onAdd(); }} disabled={busy}>{t('outbound.add')}</PixelButton>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PixelButton variant="secondary" size="sm" onClick={() => { setAdding(true); setErr(''); }} disabled={busy}>+ {t('outbound.add')}</PixelButton>
          {note && <span style={hint}>{note}</span>}
        </div>
      )}
    </div>
  );
}
