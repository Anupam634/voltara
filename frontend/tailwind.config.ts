import type { Config } from 'tailwindcss';

/**
 * VOLTARA design tokens.
 *
 * Every semantic colour resolves to a CSS variable declared in
 * app/globals.css, so the four themes (grid / substation / overdrive /
 * overheat) swap by changing variables on <html data-theme> — no per-theme
 * class overrides, no `!important`.
 *
 * Semantic scale (use these in new code):
 *   bg, surface, surface-2, surface-3     grounds, from page to raised panel
 *   line, line-strong                     hairlines
 *   ink, ink-2, ink-3                     text, from headline to caption
 *   brand, brand-hi, brand-lo             violet — structure, buttons, links
 *   charge                                lime — the one thing that is live
 *   heat / warn / ok                      state
 *
 * The stock Tailwind scales below are kept only so the admin console keeps
 * rendering; do not use them in miner-facing screens.
 */

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const obsidian = {
  50: '#f8f7fb', 100: '#eeebf3', 200: '#ded9e7', 300: '#c3bed0', 400: '#9a93ac',
  500: '#6b6183', 600: '#453c5e', 700: '#2c2542', 800: '#1e1930', 850: '#171327',
  900: '#100d18', 950: '#07060b',
};
const violet = {
  50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
  500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
};
// --c-heat is rose-500 and --c-warn is amber-400, so the console's danger and
// caution states are aliased onto those two scales rather than stock `red` /
// `orange`, which sit a few degrees off and read as a second palette.
const rose = {
  50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
  500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
};
const caution = {
  50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
  500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
};
const lime = {
  50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635',
  500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05',
};

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('c-bg'),
        surface: { DEFAULT: v('c-surface'), 2: v('c-surface-2'), 3: v('c-surface-3') },
        line: { DEFAULT: v('c-line'), strong: v('c-line-strong') },
        ink: { DEFAULT: v('c-ink'), 2: v('c-ink-2'), 3: v('c-ink-3') },
        brand: { DEFAULT: v('c-brand'), hi: v('c-brand-hi'), lo: v('c-brand-lo') },
        charge: { DEFAULT: v('c-charge'), hi: v('c-charge-hi') },
        heat: v('c-heat'),
        warn: v('c-warn'),
        ok: v('c-ok'),
        // Legacy scales (admin console only).
        slate: obsidian, blue: violet, sky: violet, indigo: violet, violet, purple: violet,
        cyan: { ...violet, 300: '#cfc2ff', 400: '#b49bff' }, amber: lime, yellow: lime,
        rose, red: rose, orange: caution,
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      boxShadow: {
        volt: '0 0 40px -8px rgb(var(--c-brand) / 0.55)',
        charge: '0 0 32px -6px rgb(var(--c-charge) / 0.5)',
        heat: '0 0 32px -6px rgb(var(--c-heat) / 0.5)',
        panel: '0 24px 60px -24px rgb(0 0 0 / 0.6)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.92)', opacity: '0' }, '60%': { transform: 'scale(1.03)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        breathe: { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        trace: { from: { backgroundPosition: '0% 50%' }, to: { backgroundPosition: '200% 50%' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shock: { '0%': { transform: 'scale(0.6)', opacity: '0.9' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        floatUp: { '0%': { transform: 'translate(-50%, 0) scale(0.8)', opacity: '0' }, '15%': { opacity: '1' }, '100%': { transform: 'translate(-50%, -90px) scale(1.15)', opacity: '0' } },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.16,1,0.3,1) both',
        fade: 'fade 0.5s ease both',
        pop: 'pop 0.45s cubic-bezier(0.16,1,0.3,1) both',
        float: 'float 5s ease-in-out infinite',
        breathe: 'breathe 2.6s ease-in-out infinite',
        trace: 'trace 2.4s linear infinite',
        shimmer: 'shimmer 2.8s linear infinite',
        'spin-slow': 'spin 14s linear infinite',
        marquee: 'marquee 40s linear infinite',
        shock: 'shock 0.9s cubic-bezier(0.16,1,0.3,1) both',
        'float-up': 'floatUp 1.2s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
