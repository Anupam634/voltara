'use client';

import { useEffect, useRef, useState } from 'react';
import { applyTheme, readTheme, THEME_META, THEMES, type ThemeMode } from './theme';

export type { ThemeMode } from './theme';

/**
 * Theme picker. A single swatch button that opens a small palette; the
 * choice is written to <html data-theme> and localStorage. The layout's
 * boot script restores it before paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('grid');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
    setOpen(false);
  };

  if (!mounted) return <div className="v-skeleton h-8 w-8 rounded-full" />;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Theme"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full border border-line/30 bg-surface-2/70 transition hover:scale-105 hover:border-brand-hi/70"
      >
        <span
          className="block h-4 w-4 rounded-full ring-1 ring-white/20"
          style={{ background: THEME_META[theme].swatch }}
        />
      </button>

      {open && (
        <div className="v-panel v-glass absolute right-0 top-full z-50 mt-2 w-56 origin-top-right animate-pop p-1.5">
          <div className="v-eyebrow px-2.5 py-1.5">Theme</div>
          {THEMES.map((mode) => {
            const meta = THEME_META[mode];
            const on = mode === theme;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => select(mode)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                  on ? 'bg-brand/15 text-ink' : 'text-ink-2 hover:bg-surface-3/70 hover:text-ink'
                }`}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/15"
                  style={{ background: meta.swatch }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold">{meta.label}</span>
                  <span className="block truncate text-[10px] text-ink-3">{meta.hint}</span>
                </span>
                {on && <span className="text-charge">●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
