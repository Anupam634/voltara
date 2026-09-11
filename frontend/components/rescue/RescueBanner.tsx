'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProfile, type RigTelemetryDto } from '../../lib/api';
import { applyThemeOverlay, clearThemeOverlay } from '../theme';
import { AnimatedNumber, Button, ButtonLink, Chip, Eyebrow, Icon, Panel } from '../ui';
import { fill, useRescue } from './strings';

/** Below this, a rig has stopped being a build and started being a problem. */
export const RESCUE_THRESHOLD = 60;

/**
 * The rescue moment.
 *
 * A throttled rig used to show a grey warning and nothing else. It is the
 * single clearest reason a miner has to buy a part, so it gets the loudest
 * panel on the page: what the throttle is costing per hour, which of the two
 * budgets actually broke, and the one part that fixes it.
 *
 * It also names the free fix. A miner with no money who pulls a core out of
 * a slot comes back tomorrow; one who is only sold to does not.
 */
export function RescueBanner({
  telemetry,
  lostPerHour,
  locale,
  referralCode,
  /** Paint the whole page in the thermal skin while this rig is in trouble. */
  themeOverlay = false,
  className = '',
}: {
  telemetry: RigTelemetryDto | null | undefined;
  /**
   * VOLTS/h the throttle is eating. The rig screen has this exactly, as
   * `rate.throttledAwayPerHour`; the dashboard derives it from the live rate
   * and the two efficiencies, which comes to the same number.
   */
  lostPerHour: number;
  locale: string;
  referralCode?: string | null;
  themeOverlay?: boolean;
  className?: string;
}) {
  const S = useRescue();
  const [shared, setShared] = useState(false);
  const overlaid = useRef(false);

  const t = telemetry;
  const critical = !!t && t.gridStability < RESCUE_THRESHOLD;

  // The overlay is raised once on the way down and dropped once on the way
  // back up, never re-applied on every poll — otherwise it would fight a
  // miner who deliberately picked a theme while their rig was cooking.
  useEffect(() => {
    if (!themeOverlay) return;
    if (critical && !overlaid.current) {
      overlaid.current = true;
      applyThemeOverlay('overheat');
    } else if (!critical && overlaid.current) {
      overlaid.current = false;
      clearThemeOverlay();
    }
  }, [critical, themeOverlay]);

  // Leaving the page counts as recovering: the thermal skin belongs to the
  // rig screen, not to the rest of the site.
  useEffect(() => {
    if (!themeOverlay) return;
    return () => {
      if (overlaid.current) {
        overlaid.current = false;
        clearThemeOverlay();
      }
    };
  }, [themeOverlay]);

  const onShare = useCallback(async () => {
    if (!t) return;
    let code = referralCode ?? null;
    if (!code) {
      // Only paid for when the miner actually reaches for the share button.
      try {
        code = (await getProfile()).referralCode;
      } catch {
        code = null;
      }
    }
    const url = code
      ? `${window.location.origin}/${locale}/r/${code}`
      : `${window.location.origin}/${locale}`;
    const text = fill(t.brownout && !t.overheating ? S.shareTextPower : S.shareTextHeat, {
      n: t.gridStability,
    });

    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  }, [t, referralCode, locale, S]);

  if (!critical || !t) return null;

  const coolingCoverage =
    t.heatLoad > 0 ? Math.round(Math.min(1, t.coolingCapacity / t.heatLoad) * 100) : 100;
  const powerCoverage =
    t.powerDraw > 0 ? Math.round(Math.min(1, t.powerSupply / t.powerDraw) * 100) : 100;

  const both = t.overheating && t.brownout;
  // Cheaper first when both budgets broke: $2 of cooling beats $3 of supply
  // as an opening move, and fixing either lifts the multiplied penalty.
  const fixCooler = t.overheating;

  const title = both ? S.titleBoth : t.brownout ? S.titlePower : S.titleHeat;
  const diagnosis = both
    ? fill(S.diagnosisBoth, { cool: coolingCoverage, pow: powerCoverage })
    : t.brownout
      ? fill(S.diagnosisPower, { n: powerCoverage })
      : fill(S.diagnosisHeat, { n: coolingCoverage });

  const lost = Math.max(0, lostPerHour);

  return (
    <Panel tone="heat" hud className={`v-scanlines p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>
            <span className="text-heat">{S.eyebrow}</span>
          </Eyebrow>
          <h2 className="mt-2 flex items-center gap-2 font-display text-lg font-bold text-ink sm:text-xl">
            <Icon name="flame" size={20} className="shrink-0 animate-breathe text-heat" />
            {title}
          </h2>
        </div>
        <Chip tone="heat" dot>
          {S.stabilityLabel} {t.gridStability}%
        </Chip>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="v-inset px-4 py-3">
          <div className="v-eyebrow">{S.losingLabel}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-heat sm:text-3xl">
              −<AnimatedNumber value={lost} decimals={2} />
            </span>
            <span className="font-mono text-[11px] font-bold text-ink-3">{S.losingUnit}</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-ink-2">{diagnosis}</p>
      </div>

      <div className="v-divider my-4" />

      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-charge/30 bg-charge/12 text-charge">
          <Icon name={fixCooler ? 'snow' : 'plug'} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="v-eyebrow">{S.fixLabel}</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            {fixCooler ? S.fixCooler : S.fixPsu}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ButtonLink
          href={`/${locale}/boosters?part=${fixCooler ? 'CX2' : 'PS3'}`}
          variant="charge"
          className="w-full sm:w-auto"
        >
          {fixCooler ? S.ctaCooler : S.ctaPsu}
          <Icon name="chevron-right" size={16} />
        </ButtonLink>
        <Button variant="ghost" onClick={onShare} className="w-full sm:w-auto">
          <Icon name={shared ? 'check' : 'share'} size={15} />
          {shared ? S.shareCopied : S.share}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-3">{S.freeFix}</p>
    </Panel>
  );
}
