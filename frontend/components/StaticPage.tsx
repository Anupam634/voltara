import Link from 'next/link';
import { LogoMark } from './Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Icon } from './ui';

/** Frame for the legal pages and the long-form FAQ. */
export function StaticPage({
  locale,
  title,
  intro,
  backLabel,
  updated,
  children,
}: {
  locale: string;
  title: string;
  intro?: string;
  backLabel: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="v-glass sticky top-0 z-40 border-b" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="VOLTARA">
              <LogoMark size={30} />
              <span className="hidden font-display text-sm font-bold tracking-[0.18em] text-ink sm:inline">VOLTARA</span>
            </Link>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1 rounded-full border border-line/25 px-2.5 py-1 text-[11px] font-bold text-ink-2 transition hover:border-brand-hi/60 hover:text-ink"
            >
              <Icon name="chevron-left" size={12} />
              {backLabel}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14"
        style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="animate-rise">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
          {intro && <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">{intro}</p>}
          {updated && <p className="v-eyebrow mt-3">{updated}</p>}
        </div>
        <div className="v-panel v-hud mt-8 p-6 animate-rise sm:p-10" style={{ animationDelay: '120ms' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

/** One titled block of prose. Bodies may contain blank-line paragraphs. */
export function Article({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-t border-line/15 py-6 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="font-display text-lg font-bold text-brand-hi">{title}</h2>
      {body.split('\n\n').map((para, i) => (
        <p key={i} className="mt-2.5 text-sm leading-relaxed text-ink-2">
          {para}
        </p>
      ))}
    </section>
  );
}
