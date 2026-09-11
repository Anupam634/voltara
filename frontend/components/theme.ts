export type ThemeMode = 'grid' | 'substation' | 'overdrive' | 'overheat';

export const THEMES: ThemeMode[] = ['grid', 'substation', 'overdrive', 'overheat'];
export const THEME_STORAGE_KEY = 'voltara_theme_v2';

export const THEME_META: Record<ThemeMode, { label: string; hint: string; swatch: string }> = {
  grid: {
    label: 'Grid',
    hint: 'Obsidian · violet · lime',
    swatch: 'linear-gradient(135deg,#07060b 0%,#7c3aed 60%,#a3e635 100%)',
  },
  substation: {
    label: 'Substation',
    hint: 'Daylight, high contrast',
    swatch: 'linear-gradient(135deg,#ffffff 0%,#ddd6fe 55%,#6d28d9 100%)',
  },
  overdrive: {
    label: 'Overdrive',
    hint: 'Every glow turned up',
    swatch: 'linear-gradient(135deg,#0b0618 0%,#c4b5fd 60%,#d946ef 100%)',
  },
  overheat: {
    label: 'Overheat',
    hint: 'Thermal-warning skin',
    swatch: 'linear-gradient(135deg,#0e0407 0%,#e11d48 60%,#f97316 100%)',
  },
};

export function readTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'grid';
  const t = document.documentElement.getAttribute('data-theme') as ThemeMode | null;
  return t && THEMES.includes(t) ? t : 'grid';
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  // A deliberate pick made while an overlay is showing becomes the theme the
  // overlay restores to, so clearing it never undoes the miner's choice.
  if (overlayBase !== null) overlayBase = mode;
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private mode: the choice lives for the session only.
  }
  window.dispatchEvent(new CustomEvent('voltara:theme', { detail: mode }));
}

/**
 * The theme to go back to once the overlay lifts, or null when none is up.
 *
 * Module-level rather than React state because the overlay is a property of
 * the document, not of whichever component happened to raise it.
 */
let overlayBase: ThemeMode | null = null;

/**
 * Force a theme for as long as a condition holds, without touching what the
 * miner chose.
 *
 * Used by the overheat rescue: a rig below 60% stability paints the whole
 * page in the thermal-warning skin, and gets the miner's own theme back the
 * moment it recovers. Nothing is written to localStorage, so a refresh
 * returns to their pick even if the overlay never got to clean up.
 */
export function applyThemeOverlay(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  if (overlayBase === null) overlayBase = readTheme();
  if (readTheme() === mode) return;
  document.documentElement.setAttribute('data-theme', mode);
  window.dispatchEvent(new CustomEvent('voltara:theme', { detail: mode }));
}

/** Put back whatever was showing before the overlay. A no-op if none is up. */
export function clearThemeOverlay() {
  if (typeof document === 'undefined') return;
  if (overlayBase === null) return;
  const base = overlayBase;
  overlayBase = null;
  document.documentElement.setAttribute('data-theme', base);
  window.dispatchEvent(new CustomEvent('voltara:theme', { detail: base }));
}
