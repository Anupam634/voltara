import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { NetworkStatusBar } from '../../components/NetworkStatusBar';
import { InteractiveMinerVisualizer } from '../../components/InteractiveMinerVisualizer';
import { GridStatsBar } from '../../components/GridStatsBar';
import { MiningCalculator } from '../../components/MiningCalculator';
import { OnChainArchitecture } from '../../components/OnChainArchitecture';
import { BoosterGrid } from '../../components/BoosterGrid';
import { RigShowcase } from '../../components/RigShowcase';
import { ReferralTierMatrix } from '../../components/ReferralTierMatrix';
import { TasksBountySection } from '../../components/TasksBountySection';
import { FAQSection } from '../../components/FAQSection';
import { X_TAG, X_URL } from '../seo';
import { LogoMark } from '../../components/Logo';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { ThemeToggle } from '../../components/ThemeToggle';
import { NavAuth, AuthAwareCta, HideWhenAuthed } from '../../components/AuthAware';
import { Icon, Reveal, SectionHeading, Stat, type IconName } from '../../components/ui';
import { GridEventBanner } from '../../components/grid/GridEventBanner';
import { LiveGridMap } from '../../components/grid/LiveGridMap';
import { GridPulse } from '../../components/grid/GridPulse';
import { FeatureGrid } from '../../components/landing/FeatureGrid';
import { StructuredData } from '../../components/landing/StructuredData';
import { PayoutTerms } from '../../components/landing/PayoutTerms';

export default function LandingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <Landing locale={locale} />;
}

function Landing({ locale }: { locale: string }) {
  const t = useTranslations('landing');
  const register = `/${locale}/login?mode=register`;
  const signIn = `/${locale}/login`;

  const anchors: { href: string; label: string; charge?: boolean }[] = [
    { href: '#rig', label: t('nav.rig'), charge: true },
    { href: '#systems', label: 'Systems', charge: true },
    { href: '#how', label: t('nav.features') },
    { href: '#boosters', label: t('nav.boosters') },
    { href: '#calculator', label: t('nav.calculator') },
    { href: '#referrals', label: t('nav.referrals') },
    { href: '#tasks', label: t('nav.tasks') },
    { href: '#faq', label: t('nav.faq') },
  ];

  const rigPoints: { key: 'cores' | 'cooling' | 'power' | 'stability'; icon: IconName }[] = [
    { key: 'cores', icon: 'chip' },
    { key: 'cooling', icon: 'snow' },
    { key: 'power', icon: 'plug' },
    { key: 'stability', icon: 'gauge' },
  ];

  const ruleIcons: IconName[] = ['lock', 'clock', 'shield', 'check'];
  const stepIcons: IconName[] = ['user', 'bolt', 'rig', 'wallet'];

  return (
    <div className="min-h-dvh">
      <StructuredData locale={locale} />
      <NetworkStatusBar />

      {/* ─────────────────────────── Header ─────────────────────────── */}
      <header className="v-glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="VOLTARA">
            <LogoMark size={32} />
            <span className="leading-none">
              <span className="block font-display text-sm font-bold tracking-[0.18em] text-ink">VOLTARA</span>
              <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-charge">
                The Grid
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition hover:bg-surface-2/70 ${
                  a.charge ? 'text-charge' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {a.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher locale={locale} />
            <NavAuth
              locale={locale}
              signInLabel={t('nav.signIn')}
              getStartedLabel={t('nav.getStarted')}
              dashboardLabel={t('nav.dashboard')}
            />
          </div>
        </div>
      </header>

      {/* ──────────────────────────── Hero ─────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 md:pb-20 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal index={0}>
              <span className="v-chip v-chip--charge">
                <span className="v-dot" />
                {t('hero.badge')}
              </span>
            </Reveal>

            <Reveal index={1}>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                {t('hero.title')} <span className="v-text-brand">{t('hero.titleAccent')}</span>
              </h1>
            </Reveal>

            <Reveal index={2}>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">{t('hero.subtitle')}</p>
            </Reveal>

            <Reveal index={3}>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <AuthAwareCta
                  locale={locale}
                  href={register}
                  label={t('hero.ctaPrimary')}
                  dashboardLabel={t('nav.dashboard')}
                  className="v-btn v-btn--charge v-btn--lg w-full sm:w-auto"
                />
                <HideWhenAuthed>
                  <Link href={signIn} className="v-btn v-btn--ghost v-btn--lg w-full sm:w-auto">
                    {t('hero.ctaSecondary')}
                    <Icon name="chevron-right" size={14} />
                  </Link>
                </HideWhenAuthed>
              </div>
            </Reveal>

            <Reveal index={4}>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/15 pt-6 text-xs text-ink-2">
                <span className="inline-flex items-center gap-2">
                  <Icon name="shield" size={14} className="text-ok" />
                  {t('hero.verifiedNode')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Icon name="gauge" size={14} className="text-charge" />
                  {t('hero.activeMinersBadge')}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-ink-3">{t('hero.honesty')}</p>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal index={2} scale>
              <InteractiveMinerVisualizer />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──────────────────── Measured grid counters ─────────────────── */}
      <GridStatsBar />

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <GridEventBanner variant="compact" />
      </div>

      {/* ─────────────────────────── Figures ───────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              ['0.90 /h', 'baseRate', 'baseRateSub', 'bolt'],
              ['3 : 1', 'conversion', 'conversionSub', 'swap'],
              ['100 VOLTS', 'minWithdrawal', 'minWithdrawalSub', 'wallet'],
              ['30 days', 'boosterDuration', 'boosterDurationSub', 'clock'],
            ] as const
          ).map(([value, label, sub, icon], i) => (
            <Reveal key={label} index={i}>
              <Stat
                label={t(`figures.${label}`)}
                value={value}
                hint={t(`figures.${sub}`)}
                icon={<Icon name={icon} size={16} />}
                tone={i === 0 ? 'charge' : 'default'}
              />
            </Reveal>
          ))}
        </div>

        {/* The two figures above describe a cash-out path that is not open
            yet. Disclosed here rather than discovered after signup. */}
        <PayoutTerms />
      </section>

      {/* ─────────────────────── The grid, live ─────────────────────── */}
      <section id="grid" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Live" title="The grid, live" subtitle="One dot per country. Size is how many miners are there, colour is how many of their rigs hold 100% stability." />
        </Reveal>
        <Reveal index={1} className="mt-8">
          <LiveGridMap locale={locale} />
        </Reveal>
        <Reveal index={2} className="mt-4">
          <GridPulse />
        </Reveal>
      </section>

      {/* ──────────────────── THE RIG (the product) ────────────────── */}
      <section id="rig" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading eyebrow="The rig" title={t('rig.title')} subtitle={t('rig.subtitle')} />
        </Reveal>
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <ul className="space-y-4">
              {rigPoints.map((p, i) => (
                <Reveal key={p.key} index={i} as="li">
                  <div className="v-panel v-panel--lift flex gap-4 p-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/30 bg-brand/12 text-brand-hi">
                      <Icon name={p.icon} size={20} />
                    </span>
                    <div>
                      <p className="font-display font-bold text-ink">{t(`rig.points.${p.key}.title`)}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-2">{t(`rig.points.${p.key}.body`)}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
            <Reveal index={4}>
              <p className="mt-6 rounded-2xl border border-charge/30 bg-charge/[0.06] p-4 text-sm leading-relaxed text-ink">
                {t('rig.kicker')}
              </p>
            </Reveal>
          </div>
          <div className="order-1 lg:order-2">
            <Reveal scale>
              <RigShowcase />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──────────── Everything that sits on top of the rig ────────── */}
      <section id="systems" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <FeatureGrid register={register} />
      </section>

      {/* ────────────────────── Architecture ───────────────────────── */}
      <section id="architecture" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="On-chain" title={t('architecture.title')} subtitle={t('architecture.subtitle')} />
        </Reveal>
        <div className="mt-12">
          <OnChainArchitecture />
        </div>
      </section>

      {/* ────────────────────── How it works ───────────────────────── */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="How it works" title={t('how.title')} subtitle={t('how.subtitle')} />
        </Reveal>

        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connecting trace on wide screens. */}
          <div className="v-trace pointer-events-none absolute left-[12%] right-[12%] top-9 hidden lg:block" aria-hidden />
          {(['register', 'mine', 'boost', 'withdraw'] as const).map((step, i) => (
            <Reveal key={step} index={i}>
              <div className="v-panel v-panel--lift v-hud relative flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-2xl border font-mono text-lg font-extrabold ${
                      i === 2
                        ? 'border-charge/50 bg-charge/12 text-charge'
                        : 'border-brand/30 bg-brand/12 text-brand-hi'
                    }`}
                  >
                    0{i + 1}
                  </span>
                  <Icon name={stepIcons[i]} size={18} className="text-ink-3" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-ink">{t(`how.${step}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{t(`how.${step}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────────────────────── Cores ─────────────────────────── */}
      <section id="boosters" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Parts" title={t('boosters.title')} subtitle={t('boosters.subtitle')} />
        </Reveal>
        <div className="mt-12">
          <BoosterGrid locale={locale} />
        </div>
      </section>

      {/* ───────────────────────── Calculator ──────────────────────── */}
      <section id="calculator" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Calculator" title={t('calculator.title')} subtitle={t('calculator.subtitle')} />
        </Reveal>
        <Reveal className="mt-12" scale>
          <MiningCalculator locale={locale} />
        </Reveal>
      </section>

      {/* ───────────────────────── Referrals ───────────────────────── */}
      <section id="referrals" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <ReferralTierMatrix />
        </Reveal>
      </section>

      {/* ─────────────────────────── Tasks ─────────────────────────── */}
      <section id="tasks" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Bounties" title={t('tasksSection.title')} subtitle={t('tasksSection.subtitle')} />
        </Reveal>
        <div className="mt-12">
          <TasksBountySection locale={locale} />
        </div>
      </section>

      {/* ──────────────────────── Payout rules ─────────────────────── */}
      <section id="rules" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Payouts" title={t('withdrawals.title')} subtitle={t('withdrawals.subtitle')} />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(['minimum', 'frequency', 'kyc', 'approval'] as const).map((rule, i) => (
            <Reveal key={rule} index={i}>
              <div className="v-panel v-panel--lift v-hud h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line/20 bg-surface-2/60 text-brand-hi">
                  <Icon name={ruleIcons[i]} size={18} />
                </span>
                <h3 className="mt-5 font-display text-base font-bold text-ink">{t(`withdrawals.${rule}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{t(`withdrawals.${rule}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ──────────────────────────── FAQ ──────────────────────────── */}
      <section id="faq" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title={t('faq.title')} subtitle={t('faq.subtitle')} />
        </Reveal>
        <Reveal className="mt-12">
          <FAQSection />
        </Reveal>
      </section>

      {/* ─────────────────────────── Final CTA ─────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal scale>
          <div className="v-panel v-panel--charge v-hud relative overflow-hidden rounded-3xl p-8 text-center sm:p-16">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-charge/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 v-backdrop__grid opacity-60" />

            <div className="relative">
              <span className="v-chip v-chip--charge">
                <Icon name="bolt" size={12} />
                {t('cta.badge')}
              </span>
              <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">{t('cta.title')}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-ink-2 sm:text-lg">{t('cta.body')}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <AuthAwareCta
                  locale={locale}
                  href={register}
                  label={t('cta.buttonPrimary')}
                  dashboardLabel={t('nav.dashboard')}
                  className="v-btn v-btn--charge v-btn--lg"
                />
                <HideWhenAuthed>
                  <Link href={signIn} className="v-btn v-btn--ghost v-btn--lg">
                    {t('cta.buttonSecondary')}
                  </Link>
                </HideWhenAuthed>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ──────────────────────────── Footer ───────────────────────── */}
      <footer className="border-t border-line/15 bg-bg/60 px-4 pb-12 pt-14 text-ink-2 backdrop-blur-sm sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 border-b border-line/15 pb-12 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <LogoMark size={34} />
              <span className="font-display text-base font-bold tracking-[0.18em] text-ink">VOLTARA</span>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-ink-3">{t('footer.brandDesc')}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="v-chip v-chip--ok">
                <span className="v-dot v-dot--ok" />
                BNB Chain mainnet
              </span>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Voltara on X"
                className="v-chip transition hover:border-brand-hi/60 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                {X_TAG}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3 lg:col-span-7">
            <div>
              <h4 className="v-eyebrow mb-3">{t('footer.quickLinks')}</h4>
              <ul className="space-y-2 text-ink-2">
                <li><a href="#how" className="transition hover:text-charge">{t('nav.features')}</a></li>
                <li><Link href={`/${locale}/boosters`} className="transition hover:text-charge">{t('nav.boosters')}</Link></li>
                <li><a href="#calculator" className="transition hover:text-charge">{t('nav.calculator')}</a></li>
                <li><a href="#referrals" className="transition hover:text-charge">{t('nav.referrals')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="v-eyebrow mb-3">{t('footer.ecosystem')}</h4>
              <ul className="space-y-2 text-ink-2">
                <li><Link href={`/${locale}/dashboard`} className="font-mono font-bold text-brand-hi transition hover:text-charge">$VLTR BEP-20</Link></li>
                <li><Link href={`/${locale}/challenge`} className="transition hover:text-charge">Weekly blueprint</Link></li>
                <li><Link href={`/${locale}/withdraw`} className="transition hover:text-charge">BNB Chain withdrawals</Link></li>
                <li><Link href={`/${locale}/kyc`} className="transition hover:text-charge">KYC verification</Link></li>
                <li><Link href={`/${locale}/support`} className="transition hover:text-charge">Support desk</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="v-eyebrow mb-3">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-ink-2">
                <li><Link href={`/${locale}/faq`} className="transition hover:text-charge">{t('footer.faq')}</Link></li>
                <li><Link href={`/${locale}/terms`} className="transition hover:text-charge">{t('footer.terms')}</Link></li>
                <li><Link href={`/${locale}/privacy`} className="transition hover:text-charge">{t('footer.privacy')}</Link></li>
                <li><Link href={`/${locale}/support`} className="transition hover:text-charge">{t('footer.support')}</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl space-y-3 pt-8 text-center text-[11px] text-ink-3">
          <p className="mx-auto max-w-3xl leading-relaxed">{t('footer.disclaimer')}</p>
          <p className="font-medium text-ink-2">{t('footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}
