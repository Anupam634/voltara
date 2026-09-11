import { Platform } from 'react-native';

/**
 * Design tokens — a native port of the web app's `globals.css`.
 *
 * Four themes, exactly the web's: Grid (the default dark), Substation
 * (light), Overdrive ("cyber") and Overheat ("red"). Every screen
 * reads semantic names (`c.textPrimary`, `c.primary`), never a raw hex, so
 * switching theme restyles the whole app the way it does on the site.
 *
 * The VOLTARA palette is three colours doing three jobs, and the app is only
 * coherent while they keep them:
 *
 *   obsidian  the ground everything sits on
 *   violet    structure — chrome, borders, primary actions
 *   lime      charge — rates, live figures, a rig at full stability
 *
 * Lime is the scarce one. If it starts appearing on ordinary furniture the
 * screens stop having a focal point.
 *
 * The key names are the ones the app was built against (`gold`, `sapphire`,
 * `cyan`), kept so a rebrand did not have to touch ninety screens. What they
 * hold is VOLTARA.
 */

export type ThemeName = 'dark' | 'light' | 'cyber' | 'red';

const brand = {
  /** Violet — structure. (Was the blue ramp.) */
  blue: '#6D28D9',
  sapphire: '#7C3AED',
  sapphireLight: '#A78BFA',
  indigo: '#7C3AED',
  indigoSoft: '#8B5CF6',
  violet: '#6D28D9',
  /** Token amounts, a lit violet rather than cyan. */
  cyan: '#9B7BFB',
  cyanBright: '#B49BFF',
  /** Lime — charge. (Was the amber ramp.) */
  gold: '#84CC16',
  goldSoft: '#A3E635',
  goldBright: '#BEF264',
  emerald: '#10B981',
  emeraldBright: '#34D399',
  rose: '#F43F5E',
  crimson: '#E11D48',
  crimsonDeep: '#BE123C',
  roseSoft: '#FB7185',
  amber: '#65A30D',
  /** True cyan, reserved for one thing: cooling parts on the rig screen. */
  coolant: '#22D3EE',
};

export interface Palette {
  /** Page background, behind everything. */
  bg: string;
  /** Slightly recessed ground for grouped lists. */
  bgSunken: string;
  /** Card / sheet surface (flat colour, used where a gradient cannot be). */
  surface: string;
  /** Gradient stops for glass panels — top-left to bottom-right. */
  surfaceGradient: readonly [string, string];
  /** A surface resting on a surface (inset rows, chips). */
  surfaceAlt: string;
  /** Translucent chrome — headers, tab bars. */
  chrome: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  primaryMuted: string;
  onPrimary: string;
  /** Gradient stops for primary buttons (the web's `.btn-gold`). */
  primaryGradient: readonly string[];
  /** Halo colour behind a primary button. */
  primaryGlow: string;
  /** Amber accent — numerals, prices, the "ready" state. */
  gold: string;
  goldMuted: string;
  onGold: string;
  goldGradient: readonly string[];
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  /** Cyan - token amounts. */
  info: string;
  infoMuted: string;
  /** Skeleton shimmer base. */
  skeleton: string;
  shadow: string;
  scrim: string;
  /** Dark wash for text laid over a photo, same in both schemes. */
  overlay: string;
  onOverlay: string;
  /** The three radial glows painted behind every screen (`.glow-field`). */
  glow: readonly [string, string, string];
  /** Hairline colour of the cyber grid (`.bg-cyber-grid`). */
  grid: string;
  /** Tab bar active tint (amber on the site's dark themes). */
  tabActive: string;
  tabActiveMuted: string;
  /** Whether the status bar should use light text. */
  dark: boolean;
}

/* ───────────── GRID — the site's default: obsidian, violet, lime ─────────────
   Values are the web's `html[data-theme='grid']` tokens, verbatim. */
export const darkPalette: Palette = {
  bg: '#07060B',
  bgSunken: '#07060B',
  surface: '#100D18',
  // The web panel: surface-2 at the top fading to surface — flat, not glass.
  surfaceGradient: ['rgba(23,19,39,0.9)', 'rgba(16,13,24,0.96)'],
  surfaceAlt: '#1E1930',
  chrome: 'rgba(7,6,11,0.72)',
  border: 'rgba(167,139,250,0.14)',
  borderStrong: 'rgba(196,181,253,0.42)',
  textPrimary: '#F4F1FA',
  textSecondary: '#B7B0C9',
  textTertiary: '#7A7192',
  textInverse: '#07060B',
  primary: '#A78BFA',
  primaryPressed: '#7C3AED',
  primaryMuted: 'rgba(124,58,237,0.15)',
  onPrimary: '#FFFFFF',
  primaryGradient: ['#7C3AED', '#A78BFA'],
  primaryGlow: 'rgba(124,58,237,0.55)',
  gold: '#A3E635',
  goldMuted: 'rgba(163,230,53,0.1)',
  // Lime is bright: text on top of it has to be the obsidian, not white.
  onGold: '#0B1204',
  goldGradient: ['#A3E635', '#D9F99D'],
  success: '#34D399',
  successMuted: 'rgba(52,211,153,0.12)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251,191,36,0.12)',
  danger: '#F43F5E',
  dangerMuted: 'rgba(244,63,94,0.12)',
  info: '#A78BFA',
  infoMuted: 'rgba(167,139,250,0.12)',
  skeleton: '#171327',
  shadow: '#000000',
  scrim: 'rgba(7,6,11,0.7)',
  overlay: 'rgba(0,0,0,0.62)',
  onOverlay: '#FFFFFF',
  // The three aurora blobs (--aurora-1/2/3 at --aurora-a).
  glow: ['rgba(124,58,237,0.28)', 'rgba(76,29,149,0.28)', 'rgba(163,230,53,0.15)'],
  grid: 'rgba(167,139,250,0.045)',
  tabActive: '#A3E635',
  tabActiveMuted: 'rgba(163,230,53,0.14)',
  dark: true,
};

/* ───────────── SUBSTATION — daylight, high contrast ───────────── */
export const lightPalette: Palette = {
  bg: '#F6F4FB',
  bgSunken: '#F0ECF9',
  surface: '#FFFFFF',
  surfaceGradient: ['#FFFFFF', '#FFFFFF'],
  surfaceAlt: '#F0ECF9',
  chrome: 'rgba(246,244,251,0.9)',
  border: 'rgba(76,29,149,0.12)',
  borderStrong: 'rgba(109,40,217,0.4)',
  textPrimary: '#14101F',
  textSecondary: '#4A4360',
  textTertiary: '#7A7192',
  textInverse: '#FFFFFF',
  primary: '#6D28D9',
  primaryPressed: '#5B21B6',
  primaryMuted: '#EDE9FE',
  onPrimary: '#FFFFFF',
  primaryGradient: ['#6D28D9', '#7C3AED'],
  primaryGlow: 'rgba(109,40,217,0.35)',
  // Lime at 400 is illegible on white, so daylight drops to the deep end of
  // the ramp rather than dropping the colour — the accent stays VOLTARA's.
  gold: '#65A30D',
  goldMuted: '#F7FEE7',
  onGold: '#FFFFFF',
  goldGradient: ['#65A30D', '#4D7C0F'],
  success: '#059669',
  successMuted: '#D1FAE5',
  warning: '#D97706',
  warningMuted: '#FEF3C7',
  danger: '#E11D48',
  dangerMuted: '#FFE4E6',
  info: '#6D28D9',
  infoMuted: '#EDE9FE',
  skeleton: '#E7E2F4',
  shadow: '#14101F',
  scrim: 'rgba(20,16,31,0.45)',
  overlay: 'rgba(20,16,31,0.62)',
  onOverlay: '#FFFFFF',
  glow: ['rgba(124,58,237,0.12)', 'rgba(167,139,250,0.12)', 'rgba(132,204,22,0.07)'],
  grid: 'rgba(76,29,149,0.05)',
  tabActive: '#6D28D9',
  tabActiveMuted: '#EDE9FE',
  dark: false,
};

/* ───────────── OVERDRIVE — saturated violet, every glow up ───────────── */
export const cyberPalette: Palette = {
  ...darkPalette,
  bg: '#0B0618',
  bgSunken: '#0B0618',
  surface: '#150B2B',
  surfaceGradient: ['rgba(30,16,64,0.9)', 'rgba(21,11,43,0.96)'],
  surfaceAlt: '#281652',
  chrome: 'rgba(11,6,24,0.72)',
  border: 'rgba(196,181,253,0.26)',
  borderStrong: 'rgba(221,214,254,0.6)',
  textPrimary: '#FAF8FF',
  textSecondary: '#CDC4E8',
  textTertiary: '#9488BE',
  primary: '#C4B5FD',
  primaryPressed: '#8B5CF6',
  primaryMuted: 'rgba(139,92,246,0.18)',
  primaryGradient: ['#8B5CF6', '#C4B5FD'],
  primaryGlow: 'rgba(139,92,246,0.8)',
  gold: '#BEF264',
  goldMuted: 'rgba(190,242,100,0.12)',
  goldGradient: ['#BEF264', '#ECFCCB'],
  success: '#6EE7B7',
  warning: '#FCD34D',
  danger: '#FB7185',
  info: '#C4B5FD',
  infoMuted: 'rgba(196,181,253,0.14)',
  skeleton: '#1E1040',
  glow: ['rgba(139,92,246,0.42)', 'rgba(217,70,239,0.42)', 'rgba(190,242,100,0.23)'],
  grid: 'rgba(196,181,253,0.08)',
  tabActive: '#BEF264',
  tabActiveMuted: 'rgba(190,242,100,0.14)',
};

/* ───────────── OVERHEAT — the thermal-warning skin ─────────────
   Named for what the rig does when the cooling stops covering the heat, and
   coloured to match that state. The one theme where lime steps aside for amber. */
export const redPalette: Palette = {
  ...darkPalette,
  bg: '#0E0408',
  bgSunken: '#0E0408',
  surface: '#1A0A10',
  surfaceGradient: ['rgba(36,16,26,0.9)', 'rgba(26,10,16,0.96)'],
  surfaceAlt: '#301622',
  chrome: 'rgba(14,4,8,0.75)',
  border: 'rgba(251,113,133,0.22)',
  borderStrong: 'rgba(253,164,175,0.55)',
  textPrimary: '#FFF6F8',
  textSecondary: '#E2C4CD',
  textTertiary: '#A07A86',
  primary: '#FB7185',
  primaryPressed: '#E11D48',
  primaryMuted: 'rgba(225,29,72,0.16)',
  primaryGradient: ['#E11D48', '#FB7185'],
  primaryGlow: 'rgba(225,29,72,0.6)',
  gold: '#FBBF24',
  goldMuted: 'rgba(251,191,36,0.12)',
  onGold: '#0B1204',
  goldGradient: ['#FBBF24', '#FDE047'],
  warning: '#FBBF24',
  danger: '#F97316',
  dangerMuted: 'rgba(249,115,22,0.14)',
  info: '#FB7185',
  infoMuted: 'rgba(251,113,133,0.14)',
  skeleton: '#24101A',
  glow: ['rgba(225,29,72,0.36)', 'rgba(136,19,55,0.36)', 'rgba(249,115,22,0.2)'],
  grid: 'rgba(251,113,133,0.07)',
  tabActive: '#FBBF24',
  tabActiveMuted: 'rgba(251,191,36,0.14)',
  scrim: 'rgba(0,0,0,0.7)',
};

export const palettes: Record<ThemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
  cyber: cyberPalette,
  red: redPalette,
};

/**
 * Spin-wheel segment colours. Deliberately identical in every theme — the
 * wheel is a game surface, not a document, and its hues are part of the brand.
 */
export const wheelPalette = [
  brand.sapphire,
  brand.goldSoft,
  brand.emerald,
  brand.indigoSoft,
  brand.rose,
  brand.coolant,
  brand.goldBright,
  brand.blue,
] as const;

/**
 * `color` at `alpha`. Handles 6-digit hex and rgb()/rgba() tokens, so callers
 * never need to know which form a palette entry takes in a given theme.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((v) => v.trim());
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

/** 4pt base scale — every gap in the app is one of these. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/**
 * Type ramp. Headings are heavier than iOS defaults on purpose — the site sets
 * its titles in black (900) weight with tight tracking.
 */
export const type = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontWeight: '900' },
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: '900' },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontWeight: '800' },
  title3: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, fontWeight: '800' },
  headline: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontWeight: '400' },
  callout: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '500' },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2, fontWeight: '800' },
} as const;

export type TypeVariant = keyof typeof type;

/** Numerals that don't jitter while a counter ticks. */
export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
})!;

/**
 * Elevation. On the dark themes the "shadow" is a coloured glow rather than a
 * drop shadow, which is what gives the site's panels their depth.
 */
export function shadow(level: 0 | 1 | 2 | 3, color: string) {
  if (level === 0) return {};
  const spec = {
    1: { radius: 10, offset: 4, opacity: 0.18, elevation: 2 },
    2: { radius: 22, offset: 8, opacity: 0.28, elevation: 5 },
    3: { radius: 36, offset: 14, opacity: 0.4, elevation: 10 },
  }[level];
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: spec.offset },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
    elevation: spec.elevation,
  };
}

/** Minimum comfortable touch target (Apple HIG: 44pt). */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const TOUCH_TARGET = 44;

export const timing = {
  fast: 150,
  base: 240,
  slow: 380,
} as const;
