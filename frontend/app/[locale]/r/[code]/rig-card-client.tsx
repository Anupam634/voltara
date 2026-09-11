'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, getRigCard, getToken, type RigCardDto } from '../../../../lib/api';
import { fill, useShare } from '../../../../components/share/strings';
import { LogoMark } from '../../../../components/Logo';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import { ThemeToggle } from '../../../../components/ThemeToggle';
import {
  Button,
  ButtonLink,
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Notice,
  Panel,
  Skeleton,
  type IconName,
} from '../../../../components/ui';

/** Kind → the stripe class the rig grid already uses, so builds read alike. */
const KIND_STRIPE: Record<string, string> = {
  CORE: 'rig-slot__kind--core',
  COOLER: 'rig-slot__kind--cooler',
  PSU: 'rig-slot__kind--psu',
  MODULE: 'rig-slot__kind--module',
};

const KIND_ICON: Record<string, IconName> = {
  CORE: 'chip',
  COOLER: 'snow',
  PSU: 'plug',
  MODULE: 'sparkle',
};

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Where a shared rig link lands.
 *
 * Public by design: the visitor has no account yet, and the whole point is
 * that they can see the build before deciding. The referral is registered
 * the usual way — `?ref=` on the sign-up link — so nothing about the
 * existing referral rules changes.
 */
export default function RigCardClient({
  locale,
  code,
}: {
  locale: string;
  code: string;
}) {
  const { landing: S } = useShare();

  const [card, setCard] = useState<RigCardDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    try {
      setCard(await getRigCard(code));
      setMissing(false);
    } catch (err) {
      // Anything that is not a live rig reads the same to a visitor: the
      // link is dead, and the useful thing to offer is their own rig.
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setMissing(true);
    }
  }, [code]);

  useEffect(() => {
    setAuthed(!!getToken());
    load();
  }, [load]);

  const signUpHref = `/${locale}/login?mode=register&ref=${encodeURIComponent(code)}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="v-glass sticky top-0 z-40 border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="VOLTARA">
            <LogoMark size={30} />
            <span className="font-display text-sm font-bold tracking-[0.18em] text-ink">VOLTARA</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {missing ? (
          <Panel hud className="p-6 text-center sm:p-10">
            <Icon name="x" size={28} className="mx-auto text-heat" />
            <h1 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">
              {S.missingTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-2">{S.missingBody}</p>
            <ButtonLink href={signUpHref} variant="charge" size="lg" className="mt-7">
              {S.missingCta}
              <Icon name="chevron-right" size={16} />
            </ButtonLink>
          </Panel>
        ) : !card ? (
          <Skeleton className="h-[28rem] w-full rounded-3xl" />
        ) : (
          <>
            <Panel hud className="relative overflow-hidden p-5 animate-pop sm:p-10">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-charge/15 blur-3xl" />

              <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
                {/* Left: who, and the two numbers that make it a flex. */}
                <div className="lg:col-span-7">
                  <Eyebrow tone="charge">{S.eyebrow}</Eyebrow>
                  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                    {fill(S.titleOwned, { name: card.name })}
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">
                    {S.subtitle}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Chip tone="charge" dot>
                      <span className="v-num">{fmt(card.ratePerHour)}</span> VOLTS/h
                    </Chip>
                    <Chip tone="brand">
                      <Icon name="rig" size={12} />
                      {card.partCount} {S.parts}
                    </Chip>
                    {card.streakDays >= 3 && (
                      <Chip tone="warn">
                        <Icon name="flame" size={12} />
                        {card.streakDays} {S.streak}
                      </Chip>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {authed ? (
                      <>
                        <ButtonLink href={`/${locale}/rig`} variant="primary" size="lg">
                          {S.toDashboard}
                          <Icon name="chevron-right" size={16} />
                        </ButtonLink>
                        <p className="text-xs text-ink-3">{S.signedIn}</p>
                      </>
                    ) : (
                      <>
                        <ButtonLink href={signUpHref} variant="charge" size="lg">
                          {S.cta}
                          <Icon name="chevron-right" size={16} />
                        </ButtonLink>
                        <p className="max-w-xs text-xs leading-relaxed text-ink-3">{S.ctaNote}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: the gauge, the one figure that says whether this
                    build actually works. */}
                <div className="flex justify-center lg:col-span-5">
                  <Gauge
                    value={card.gridStability}
                    size={200}
                    label={S.stability}
                    sub={`${fmt(card.ratePerHour)} VOLTS/h`}
                  />
                </div>
              </div>
            </Panel>

            {/* The build itself, in the same sockets the app uses. */}
            <section className="mt-8">
              <Eyebrow tone="brand">{S.slotsTitle}</Eyebrow>
              <div className="rig-grid mt-4">
                {card.slots.map((slot, i) => (
                  <div
                    key={i}
                    className={`rig-slot ${slot ? 'rig-slot--filled' : 'rig-slot--empty'}`}
                  >
                    {slot ? (
                      <>
                        <span className={`rig-slot__kind ${KIND_STRIPE[slot.kind] ?? ''}`} />
                        <div className="flex items-start justify-between gap-2">
                          <span className="v-eyebrow">{slot.kind}</span>
                          <Icon name={KIND_ICON[slot.kind] ?? 'chip'} size={14} className="text-ink-3" />
                        </div>
                        <div>
                          <p className="font-display text-sm font-bold text-ink">{slot.code ?? slot.name}</p>
                          <p className="mt-0.5 truncate text-[11px] text-ink-3">{slot.name}</p>
                        </div>
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center">
                        <span className="v-eyebrow">{S.empty}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Why any of this matters, for someone who has never seen the
                product before. */}
            <section className="mt-10">
              <Eyebrow tone="charge">{S.howTitle}</Eyebrow>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: 'rig' as IconName, body: S.how1 },
                  { icon: 'flame' as IconName, body: S.how2 },
                  { icon: 'wallet' as IconName, body: S.how3 },
                ].map((row, i) => (
                  <div key={i} className="v-panel flex gap-3 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10 text-brand-hi">
                      <Icon name={row.icon} size={16} />
                    </span>
                    <p className="text-sm leading-relaxed text-ink-2">{row.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {!authed && (
              <div className="mt-10 text-center">
                <ButtonLink href={signUpHref} variant="charge" size="lg">
                  {S.cta}
                  <Icon name="chevron-right" size={16} />
                </ButtonLink>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
