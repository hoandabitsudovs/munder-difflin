import { useEffect } from 'react';
import type { UserProfile } from '@shared/userProfile';
import { setUserProfileVars } from './index';

/**
 * Keep i18n's user-profile variables ({{userName}}, {{userBusiness}}, …) pointed
 * at the live profile.
 *
 * Mounted once near the root, fed the profile from App's live config (seeded by
 * getConfig() and kept current by onConfigChanged). Pushes it into i18next's
 * default variables so every string that mentions the user follows an edit
 * immediately, in every locale, without any call site knowing the values —
 * the same contract as useGodNameSync for {{godName}}.
 */
export function useUserProfileSync(profile: UserProfile | undefined | null): void {
  // Serialize so the effect re-runs on a real field change, not on every
  // config object identity change (onConfigChanged hands a fresh object each time).
  const key = JSON.stringify(profile ?? {});
  useEffect(() => { setUserProfileVars(profile); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
