import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import type { MediaItem } from '@shared/media';

/**
 * Command Center → Creativo (Fase 4).
 *
 * Generate images from a prompt (OpenAI Images, using the app's BYOK key) and browse
 * them in a gallery. The key never reaches the renderer — we send prompts and read
 * back image bytes over IPC, turned into data URLs for display.
 */

const dispLabel: CSSProperties = { fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase' };
const hint: CSSProperties = { fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' };
const inputStyle: CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--cth-paper-100)', border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)', fontSize: 13, lineHeight: '20px', color: 'var(--cth-ink-900)', fontFamily: 'inherit' };

const SIZES = ['1024x1024', '1536x1024', '1024x1536'];

export function MediaGalleryPanel() {
  const { t } = useTranslation();
  const [hasKey, setHasKey] = useState(true);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(SIZES[0]);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadUrls = async (list: MediaItem[]) => {
    const entries: [string, string][] = [];
    for (const it of list) {
      // Videos only have bytes once completed.
      if (it.kind === 'video' && it.status !== 'completed') continue;
      if (urls[it.id]) { entries.push([it.id, urls[it.id]]); continue; }
      try {
        const r = await window.cth.mediaRead(it.id);
        if (r.ok && r.b64) entries.push([it.id, `data:${r.contentType ?? 'image/png'};base64,${r.b64}`]);
      } catch { /* skip */ }
    }
    setUrls(Object.fromEntries(entries));
  };

  const refresh = async () => {
    const list = await window.cth.mediaList();
    setItems(list);
    await loadUrls(list);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const k = await window.cth.mediaHasKey(); if (alive) setHasKey(k); } catch { /* ignore */ }
      if (alive) await refresh();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGenerate = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setErr('');
    try {
      const res = mode === 'video'
        ? await window.cth.mediaGenerateVideo({ prompt: prompt.trim() })
        : await window.cth.mediaGenerate({ prompt: prompt.trim(), size });
      if (!res.ok) { setErr(res.error || t('media.failed')); return; }
      setPrompt('');
      await refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : t('media.failed')); }
    finally { setBusy(false); }
  };

  // Poll any in-flight video jobs until they complete.
  useEffect(() => {
    const pending = items.filter((it) => it.kind === 'video' && it.status !== 'completed' && it.status !== 'failed');
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const it of pending) { try { await window.cth.mediaPoll(it.id); } catch { /* skip */ } }
      await refresh();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const onDelete = async (id: string) => {
    try { await window.cth.mediaDelete({ id }); await refresh(); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={dispLabel}>{t('media.title')}</div>
        <span style={{ ...hint, maxWidth: 460 }}>{t('media.desc')}</span>
      </div>

      {!hasKey && (
        <div style={{ padding: 10, ...hint, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          ⚠ {t('media.noKey')}
        </div>
      )}

      {/* Generate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ ...dispLabel, color: 'var(--cth-ink-700)' }}>{t('media.prompt')}</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('media.promptPlaceholder')} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <PixelButton variant={mode === 'image' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('image')}>{t('media.image')}</PixelButton>
            <PixelButton variant={mode === 'video' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('video')}>{t('media.video')}</PixelButton>
          </div>
          {mode === 'image' && (
            <select value={size} onChange={(e) => setSize(e.target.value)} style={{ ...inputStyle, width: 'auto', fontFamily: 'var(--cth-font-mono)' }}>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <PixelButton variant="primary" size="sm" onClick={() => { void onGenerate(); }} disabled={busy || !prompt.trim() || !hasKey}>
            {busy ? t('media.generating') : mode === 'video' ? t('media.generateVideo') : t('media.generate')}
          </PixelButton>
          {err && <span style={{ fontSize: 12, color: 'var(--cth-danger, #6E1423)' }}>{err}</span>}
        </div>
      </div>

      {/* Gallery */}
      {items.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', ...hint, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          {t('media.empty')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', padding: 6 }}>
              <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--cth-cream-200)', overflow: 'hidden' }}>
                {it.kind === 'video' && it.status !== 'completed'
                  ? <div style={{ ...hint, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 6 }}>
                      {it.status === 'failed' ? `⚠ ${it.error ?? t('media.videoFailed')}` : `🎬 ${t('media.videoWorking')}`}
                    </div>
                  : urls[it.id]
                    ? (it.kind === 'video'
                        ? <video src={urls[it.id]} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={urls[it.id]} alt={it.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
                    : <div style={{ ...hint, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>…</div>}
              </div>
              <span style={{ ...hint, maxHeight: 32, overflow: 'hidden' }} title={it.prompt}>{it.prompt}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...hint, fontFamily: 'var(--cth-font-mono)' }}>{it.size}</span>
                <PixelButton variant="ghost" size="sm" onClick={() => { void onDelete(it.id); }}>✕</PixelButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
