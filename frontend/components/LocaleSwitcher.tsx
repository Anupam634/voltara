'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { locales } from '../i18n';
import { Icon } from './ui';

interface LocaleOption {
  code: string;
  label: string;
  shortLabel: string;
}

const LOCALE_OPTIONS: Record<string, LocaleOption> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  zh: { code: 'zh', label: '简体中文', shortLabel: '中文' },
  ko: { code: 'ko', label: '한국어', shortLabel: 'KO' },
};

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALE_OPTIONS[locale] ?? {
    code: locale,
    label: locale.toUpperCase(),
    shortLabel: locale.toUpperCase(),
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function switchTo(next: string) {
    setOpen(false);
    if (next === locale) return;
    const rest = pathname.split('/').slice(2).join('/');
    const search = typeof window === 'undefined' ? '' : window.location.search;
    router.replace(`/${next}${rest ? `/${rest}` : ''}${search}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Language"
        className="flex h-8 items-center gap-1.5 rounded-full border border-line/30 bg-surface-2/70 px-2.5 text-[11px] font-extrabold text-ink-2 transition hover:border-brand-hi/70 hover:text-ink"
      >
        <Icon name="globe" size={13} />
        <span>{current.shortLabel}</span>
      </button>

      {open && (
        <div className="v-panel v-glass absolute right-0 top-full z-50 mt-2 w-40 animate-pop p-1.5">
          {locales.map((code) => {
            const opt = LOCALE_OPTIONS[code] ?? { code, label: code.toUpperCase(), shortLabel: code.toUpperCase() };
            const on = code === locale;
            return (
              <button
                key={code}
                type="button"
                onClick={() => switchTo(code)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition ${
                  on ? 'bg-brand/15 text-ink' : 'text-ink-2 hover:bg-surface-3/70 hover:text-ink'
                }`}
              >
                <span>{opt.label}</span>
                {on && <Icon name="check" size={12} className="text-charge" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
