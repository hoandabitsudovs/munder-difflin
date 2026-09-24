/**
 * App-wide appearance (v0.5) — Light / Dark / Auto for the whole UI.
 *
 * The renderer is styled through the `--cth-*` tokens, so the theme is a token
 * swap: this module stamps `data-cth-theme` on <html> and tokens.css carries the
 * dark overrides. The xterm palette and per-agent Claude session theme follow the
 * same RESOLVED theme, so terminals and TUIs match the chrome.
 *
 * MODE vs THEME. The user picks a MODE (light | dark | auto). `auto` resolves to a
 * THEME (light | dark) from the local time — dark once the sun is down. Consumers
 * read the resolved theme with `useAppTheme()`; the title-bar control cycles the
 * mode with `cycleAppThemeMode()`.
 */
import { useSyncExternalStore } from 'react';

export type AppTheme = 'light' | 'dark';
export type AppThemeMode = 'light' | 'dark' | 'auto';

const MODE_KEY = 'cth.themeMode';
const LEGACY_KEY = 'cth.theme';            // pre-0.5: stored the resolved theme
const LEGACY_PTY_KEY = 'cth.ptyTheme';     // pre-0.3.4 terminal-only theme

/** After sunset / before sunrise → dark. Local-time approximation of "when the sun
 *  hides": night from 19:00 to 06:59. (No geolocation; this is the honest default.) */
const NIGHT_START_HOUR = 19;
const NIGHT_END_HOUR = 7;
export function isNightAt(d: Date = new Date()): boolean {
  const h = d.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

function loadMode(): AppThemeMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
    // Migrate a pre-0.5 resolved-theme choice into an explicit mode.
    const legacy = window.localStorage.getItem(LEGACY_KEY) ?? window.localStorage.getItem(LEGACY_PTY_KEY);
    if (legacy === 'dark' || legacy === 'light') return legacy;
  } catch { /* noop */ }
  return 'light';
}

function resolve(mode: AppThemeMode): AppTheme {
  return mode === 'auto' ? (isNightAt() ? 'dark' : 'light') : mode;
}

let mode: AppThemeMode = loadMode();
let theme: AppTheme = resolve(mode);
const subscribers = new Set<() => void>();
let autoTimer: ReturnType<typeof setInterval> | null = null;

function apply(): void {
  try { document.documentElement.dataset.cthTheme = theme; } catch { /* SSR/tests */ }
}

/** Recompute the resolved theme (used by the auto timer / visibility change). */
function reresolve(): void {
  const next = resolve(mode);
  if (next === theme) return;
  theme = next;
  apply();
  subscribers.forEach((fn) => fn());
}

function armAutoWatch(): void {
  if (mode === 'auto') {
    if (!autoTimer) {
      // Re-check every 5 min; also on tab focus so a laptop opened past sunset flips.
      autoTimer = setInterval(reresolve, 5 * 60_000);
      autoTimer.unref?.();
      try { document.addEventListener('visibilitychange', reresolve); } catch { /* noop */ }
    }
  } else if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    try { document.removeEventListener('visibilitychange', reresolve); } catch { /* noop */ }
  }
}

apply();
armAutoWatch();

/** The RESOLVED theme currently applied. */
export function appTheme(): AppTheme { return theme; }
/** The user's chosen MODE (light | dark | auto). */
export function appThemeMode(): AppThemeMode { return mode; }

export function setAppThemeMode(next: AppThemeMode): void {
  mode = next;
  try { window.localStorage.setItem(MODE_KEY, next); } catch { /* noop */ }
  armAutoWatch();
  const resolved = resolve(mode);
  if (resolved !== theme) { theme = resolved; apply(); }
  subscribers.forEach((fn) => fn());
}

/** Cycle Light → Dark → Auto → Light. Wired to the title-bar control. */
export function cycleAppThemeMode(): AppThemeMode {
  const order: AppThemeMode[] = ['light', 'dark', 'auto'];
  const next = order[(order.indexOf(mode) + 1) % order.length];
  setAppThemeMode(next);
  return next;
}

/** Back-compat: flip between light and dark (drops any auto). */
export function toggleAppTheme(): AppTheme {
  setAppThemeMode(theme === 'dark' ? 'light' : 'dark');
  return theme;
}

/** Subscribe to the RESOLVED theme. */
export function useAppTheme(): AppTheme {
  return useSyncExternalStore(
    (onChange) => { subscribers.add(onChange); return () => subscribers.delete(onChange); },
    () => theme
  );
}
/** Subscribe to the MODE (for the control's icon/label). */
export function useAppThemeMode(): AppThemeMode {
  return useSyncExternalStore(
    (onChange) => { subscribers.add(onChange); return () => subscribers.delete(onChange); },
    () => mode
  );
}
