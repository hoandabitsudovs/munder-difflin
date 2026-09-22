import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '@shared/userProfile';

/**
 * Settings → General: the global user & business profile (Fase 0.1).
 *
 * Presentational + controlled: it holds no state of its own. The parent
 * (SettingsModal) owns the draft and stages `{ userProfile }` into the single
 * footer Save, so this section follows the same ONE-SAVE-BUTTON contract as the
 * rest of General. Every field is optional; blank fields are simply not injected.
 *
 * The profile is injected into every agent's system prompt (main: profileToPromptBlock)
 * and exposed as i18next {{userName}}/{{userBusiness}}/… variables — this form is
 * the single place a person edits it.
 */
export function UserProfileSection({
  value,
  onChange
}: {
  value: UserProfile;
  onChange: (next: UserProfile) => void;
}) {
  const { t } = useTranslation();

  const fieldLabel: CSSProperties = {
    fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px',
    color: 'var(--cth-ink-700)', textTransform: 'uppercase'
  };
  const hint: CSSProperties = { fontSize: 12, lineHeight: '16px', color: 'var(--cth-ink-500)' };
  const inputStyle: CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--cth-paper-100)', border: 'none',
    boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)', fontSize: 13, lineHeight: '20px',
    color: 'var(--cth-ink-900)', fontFamily: 'inherit'
  };
  const areaStyle: CSSProperties = { ...inputStyle, minHeight: 60, resize: 'vertical' };

  const set = (patch: Partial<UserProfile>) => onChange({ ...value, ...patch });

  const Field = ({
    label, placeholder, field, area, max
  }: { label: string; placeholder: string; field: keyof UserProfile; area?: boolean; max: number }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={fieldLabel}>{label}</span>
      {area ? (
        <textarea
          value={value[field] ?? ''}
          maxLength={max}
          onChange={(e) => set({ [field]: e.target.value } as Partial<UserProfile>)}
          placeholder={placeholder}
          style={areaStyle}
        />
      ) : (
        <input
          value={value[field] ?? ''}
          maxLength={max}
          onChange={(e) => set({ [field]: e.target.value } as Partial<UserProfile>)}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </label>
  );

  return (
    <div>
      <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px', color: 'var(--cth-ink-500)', textTransform: 'uppercase', marginBottom: 4 }}>
        {t('settings.profile.title')}
      </div>
      <p style={{ ...hint, margin: '0 0 12px' }}>{t('settings.profile.desc')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <Field label={t('settings.profile.name')} placeholder={t('settings.profile.namePlaceholder')} field="name" max={120} />
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <Field label={t('settings.profile.role')} placeholder={t('settings.profile.rolePlaceholder')} field="role" max={120} />
          </div>
        </div>

        <Field label={t('settings.profile.business')} placeholder={t('settings.profile.businessPlaceholder')} field="business" max={120} />
        <Field label={t('settings.profile.businessContext')} placeholder={t('settings.profile.businessContextPlaceholder')} field="businessContext" area max={2000} />
        <Field label={t('settings.profile.goals')} placeholder={t('settings.profile.goalsPlaceholder')} field="goals" area max={2000} />
        <Field label={t('settings.profile.style')} placeholder={t('settings.profile.stylePlaceholder')} field="stylePreferences" area max={1000} />

        <p style={{ ...hint, margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span aria-hidden>💡</span>
          <span>{t('settings.profile.injectionNote')}</span>
        </p>
      </div>
    </div>
  );
}
