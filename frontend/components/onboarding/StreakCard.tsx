'use client';

import { useEffect, useState } from 'react';
import type { StreakDto } from '../../lib/api';
import { Chip, Eyebrow, Icon, Modal, Panel, Progress } from '../ui';
import { fill, useOnboarding } from './strings';

/** Below this many hours left, keeping the run becomes the headline. */
const URGENT_HOURS = 6;

/** "5h 12m" / "48m". Null once the deadline has passed. */
function remaining(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * The claim streak: how many days in a row, what it is worth, and how long
 * is left to keep it.
 *
 * Renders nothing when the API has not shipped the field, so an older
 * server just leaves the column as it was.
 */
export function StreakCard({ streak }: { streak: StreakDto | undefined }) {
  const S = useOnboarding();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!streak) return null;

  const left = streak.keepsUntil ? remaining(streak.keepsUntil, now) : null;
  const urgent =
    left !== null &&
    streak.days > 0 &&
    new Date(streak.keepsUntil as string).getTime() - now <= URGENT_HOURS * 3_600_000;

  // Nothing running yet: sell the idea rather than showing a zero.
  if (streak.days === 0) {
    return (
      <Panel className="p-5 animate-rise" style={{ animationDelay: '120ms' }}>
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line/25 bg-surface-2/60 text-ink-3">
            <Icon name="flame" size={18} />
          </span>
          <div className="min-w-0">
            <Eyebrow>{S.streak.eyebrow}</Eyebrow>
            <h3 className="mt-1 font-display text-base font-bold text-ink">
              {S.streak.noneTitle}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">{S.streak.noneBody}</p>
          </div>
        </div>
      </Panel>
    );
  }

  const target = streak.nextTier?.days ?? streak.days;
  const pct = target > 0 ? Math.min(100, (streak.days / target) * 100) : 100;

  return (
    <Panel
      tone={urgent ? 'heat' : 'default'}
      className="p-5 animate-rise"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${
              urgent
                ? 'border-heat/40 bg-heat/12 text-heat'
                : 'border-charge/40 bg-charge/12 text-charge'
            }`}
          >
            <Icon name="flame" size={20} />
          </span>
          <div className="min-w-0">
            <Eyebrow>{S.streak.eyebrow}</Eyebrow>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="v-num text-3xl font-extrabold text-ink">{streak.days}</span>
              <span className="text-xs font-bold text-ink-3">
                {streak.days === 1 ? S.streak.days : S.streak.daysPlural}
              </span>
            </div>
          </div>
        </div>

        {streak.bonusPercent > 0 && (
          <Chip tone="charge">{fill(S.streak.bonus, { percent: streak.bonusPercent })}</Chip>
        )}
      </div>

      {streak.nextTier ? (
        <>
          <Progress value={pct} charge={!urgent} className="mt-4" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-ink-2">
              {fill(S.streak.nextTier, {
                days: Math.max(0, streak.nextTier.days - streak.days),
                percent: streak.nextTier.bonusPercent,
              })}
            </span>
            <span className="v-num text-ink-3">
              {fill(S.streak.best, { days: streak.bestDays })}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Chip tone="charge">{S.streak.maxTier}</Chip>
          <span className="v-num text-ink-3">{fill(S.streak.best, { days: streak.bestDays })}</span>
        </div>
      )}

      {left && (
        <div
          className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${
            urgent ? 'text-heat' : 'text-ink-3'
          }`}
        >
          <Icon name="clock" size={12} />
          {urgent ? S.streak.keepToday : fill(S.streak.keepsUntil, { time: left })}
        </div>
      )}
    </Panel>
  );
}

/**
 * Fired once when a claim crosses a tier boundary. One modal, dismissible,
 * no confetti library — the shockwave on the button already did the noise.
 */
export function StreakTierModal({
  streak,
  open,
  onClose,
}: {
  streak: StreakDto | null;
  open: boolean;
  onClose: () => void;
}) {
  const S = useOnboarding();
  if (!streak) return null;

  return (
    <Modal open={open} onClose={onClose} title={S.streak.tierTitle}>
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-charge/40 bg-charge/12 text-charge">
          <Icon name="flame" size={30} />
        </span>

        <div className="mt-4 flex items-baseline justify-center gap-2">
          <span className="v-num text-5xl font-extrabold text-charge">{streak.days}</span>
          <span className="text-sm font-bold text-ink-2">
            {streak.days === 1 ? S.streak.days : S.streak.daysPlural}
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {fill(S.streak.tierBody, { days: streak.days, percent: streak.bonusPercent })}
        </p>

        <p className="mt-3 text-xs text-ink-3">
          {streak.nextTier
            ? fill(S.streak.tierNext, {
                days: streak.nextTier.days,
                percent: streak.nextTier.bonusPercent,
              })
            : S.streak.tierTop}
        </p>

        <button type="button" onClick={onClose} className="v-btn v-btn--charge mt-6 w-full">
          {S.streak.tierClose}
        </button>
      </div>
    </Modal>
  );
}
