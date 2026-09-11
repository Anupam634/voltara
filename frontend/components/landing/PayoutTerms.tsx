'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { getPayoutStatus, type PayoutStatusDto } from '../../lib/api-grid';
import { Icon } from '../ui';

/**
 * The one line the figures row above this was missing.
 *
 * "Min Withdrawal — 100 Points" and "3 Points = 1 $VLTR" are both true, and
 * side by side with nothing else they describe a cash-out path that does not
 * exist yet: payouts are hard-gated until $VLTR is on-chain (SPEC §4). A
 * visitor who mines to the threshold and only then discovers the window is
 * shut has been misled by omission, and they will say so publicly.
 *
 * So the terms carry their own status, read from the server rather than
 * hardcoded — when the window opens this line changes by itself.
 *
 * Renders nothing while the status is unknown or once payouts are open: this
 * exists to disclose a restriction, not to add furniture to the page.
 */
const COPY: Record<string, { closed: string; opensAt: (d: string) => string }> = {
  en: {
    closed:
      'Withdrawals are not open yet. VOLTS are mined and spendable on parts from day one; converting them to $VLTR begins at token launch.',
    opensAt: (d) => `Payouts open ${d}.`,
  },
  zh: {
    closed:
      '提现尚未开放。VOLTS 从第一天起即可挖取并用于购买部件；兑换为 $VLTR 将在代币上线后开始。',
    opensAt: (d) => `提现将于 ${d} 开放。`,
  },
  ko: {
    closed:
      '아직 출금이 열리지 않았습니다. VOLTS는 첫날부터 채굴해 부품 구매에 쓸 수 있으며, $VLTR 전환은 토큰 출시와 함께 시작됩니다.',
    opensAt: (d) => `${d}에 출금이 열립니다.`,
  },
};

export function PayoutTerms() {
  const locale = useLocale();
  const [status, setStatus] = useState<PayoutStatusDto | null>(null);

  useEffect(() => {
    let alive = true;
    getPayoutStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => {
        /* The API being down is not a reason to assert either way. */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Unknown, or genuinely open — either way there is nothing to disclose.
  if (!status || status.open) return null;

  const copy = COPY[locale] ?? COPY.en;
  const opensAt = status.opensAt
    ? new Date(status.opensAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line/20 bg-surface-2/40 p-3.5">
      <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-ink-3" />
      <p className="text-[11px] leading-relaxed text-ink-3">
        {copy.closed}
        {opensAt && <span className="ml-1 font-bold text-ink-2">{copy.opensAt(opensAt)}</span>}
      </p>
    </div>
  );
}
