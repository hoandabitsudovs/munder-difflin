/**
 * User & business profile — the global "who you work for" context (Fase 0.1).
 *
 * A single, dependency-free record describing the human/organization running the
 * office. It mirrors the posture of `godIdentity.ts`: shared by main, preload and
 * renderer, no electron/node/UI imports, so the same type and helpers travel
 * everywhere the profile is read, edited, persisted, or injected.
 *
 * TWO injection surfaces, one source of truth (HarnessConfig.userProfile):
 *   1. AGENT PROMPTS — `profileToPromptBlock()` renders a compact context block
 *      baked into every spawn's `--append-system-prompt` (see hive.ts). It is
 *      resolved ONCE per spawn and is stable for the agent's lifetime, so it
 *      respects the prompt-cache invariant (no dates/counters/live state).
 *   2. UI STRINGS — `profileToInterpolationVars()` feeds i18next default variables
 *      (`{{userName}}`, `{{userBusiness}}`, …), the exact mechanism `setGodName`
 *      uses for `{{godName}}`, so a localized string can mention the user without
 *      its call site knowing any of these values.
 *
 * The values are the user's OWN text about themselves, injected into their OWN
 * agents — not third-party data — but the fields are still length-capped and
 * trimmed on the way in (`sanitizeUserProfile`) so a runaway paste can't bloat
 * every system prompt.
 */

export interface UserProfile {
  /** Identity — how the user is addressed. */
  name?: string;
  /** Identity — the user's role/title. */
  role?: string;
  /** Business — company / venture name. */
  business?: string;
  /** Business — what it does: industry, description, context. */
  businessContext?: string;
  /** Objectives / current priorities (freeform). Feeds later phases (Daily Brief). */
  goals?: string;
  /** Working-style preferences — tone, how agents should address the user, etc. */
  stylePreferences?: string;
}

/** The empty profile — a fresh install has nothing set. */
export const EMPTY_USER_PROFILE: UserProfile = {};

/** Per-field character caps. Short identity fields stay short; the freeform
 *  context fields are generous but bounded so they can't balloon a prompt. */
const FIELD_CAPS: Record<keyof UserProfile, number> = {
  name: 120,
  role: 120,
  business: 120,
  businessContext: 2000,
  goals: 2000,
  stylePreferences: 1000
};

const PROFILE_KEYS: (keyof UserProfile)[] = [
  'name',
  'role',
  'business',
  'businessContext',
  'goals',
  'stylePreferences'
];

/**
 * Normalize arbitrary input into a UserProfile: keep only known keys, coerce to
 * string, trim, cap length, and drop empties. Fail-soft — a non-object yields the
 * empty profile rather than throwing, so a corrupt config still boots.
 */
export function sanitizeUserProfile(input: unknown): UserProfile {
  if (!input || typeof input !== 'object') return {};
  const src = input as Record<string, unknown>;
  const out: UserProfile = {};
  for (const key of PROFILE_KEYS) {
    const raw = src[key];
    if (typeof raw !== 'string') continue;
    const value = raw.trim().slice(0, FIELD_CAPS[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}

/** Does the profile carry any content at all? */
export function profileHasContent(p: UserProfile | undefined | null): boolean {
  if (!p) return false;
  return PROFILE_KEYS.some((k) => typeof p[k] === 'string' && p[k]!.trim().length > 0);
}

/**
 * Render the profile as a compact context block for an agent's system prompt.
 *
 * Returns '' when nothing is set, so the caller can drop the line entirely (no
 * empty header baked into every spawn). Only fields with content appear.
 */
export function profileToPromptBlock(p: UserProfile | undefined | null): string {
  const profile = sanitizeUserProfile(p);
  if (!profileHasContent(profile)) return '';

  const lines: string[] = [];
  const who = [profile.name, profile.role ? `(${profile.role})` : ''].filter(Boolean).join(' ');
  if (who) lines.push(`- Person: ${who}`);
  const biz = [profile.business, profile.businessContext].filter(Boolean).join(' — ');
  if (biz) lines.push(`- Business: ${biz}`);
  if (profile.goals) lines.push(`- Current goals / priorities: ${profile.goals}`);
  if (profile.stylePreferences) lines.push(`- Working style / preferences: ${profile.stylePreferences}`);

  return [
    'USER & BUSINESS PROFILE — the human and organization you work for. Keep it in mind for tone, priorities, and decisions:',
    ...lines
  ].join('\n');
}

/**
 * The i18next default-variable map for the profile — the `{{userName}}` analog of
 * `{{godName}}`. Empty fields resolve to '' rather than undefined, so a string
 * that mentions a not-yet-set field renders blank instead of literally
 * "{{userBusiness}}".
 */
export function profileToInterpolationVars(
  p: UserProfile | undefined | null
): Record<string, string> {
  const profile = sanitizeUserProfile(p);
  return {
    userName: profile.name ?? '',
    userRole: profile.role ?? '',
    userBusiness: profile.business ?? '',
    userBusinessContext: profile.businessContext ?? '',
    userGoals: profile.goals ?? '',
    userStyle: profile.stylePreferences ?? ''
  };
}
