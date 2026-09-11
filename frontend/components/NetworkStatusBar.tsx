'use client';

import { useTranslations } from 'next-intl';
import { Icon } from './ui';

/** The thin status strip above the header: chain, token, the three rules. */
export function NetworkStatusBar() {
  const t = useTranslations('landing.network');

  return (
    <div className="border-b border-line/15 bg-bg/60 px-4 py-1.5 text-[11px] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-ink-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink-2">
            <span className="v-dot v-dot--ok" />
            {t('mainnetStatus')}
          </span>
          <span className="hidden text-line/40 sm:inline">|</span>
          <span className="hidden font-medium sm:inline">{t('chain')}</span>
          <span className="hidden text-line/40 md:inline">|</span>
          <span className="hidden font-mono font-semibold text-brand-hi md:inline">{t('tokenStandard')}</span>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span className="hidden text-charge lg:inline">{t('baseRateSpec')}</span>
          <span className="hidden text-line/40 lg:inline">|</span>
          <span className="font-semibold text-ink-2">{t('conversionSpec')}</span>
          <span className="hidden items-center gap-1 rounded-full border border-line/25 bg-surface-2/60 px-2 py-0.5 font-bold text-ink-2 sm:inline-flex">
            <Icon name="wallet" size={11} />
            {t('minWithdrawalSpec')}
          </span>
        </div>
      </div>
    </div>
  );
}
