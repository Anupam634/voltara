'use client';

import { Chip, Eyebrow, Icon, Panel, Progress, Reveal, Skeleton, type IconName } from '../ui';
import { useReferrals } from './strings';
import type { ReferralRewardTierDto } from '../../lib/api';

/**
 * The hardware half of the referral ladder.
 *
 * The multiplier ladder above it pays an abstract number. This one pays
 * parts, so each rung says what the part *does* — a cooler is only exciting
 * if you know it is the thing stopping your second core from throttling.
 */

const REWARD_ICON: Record<string, IconName> = {
  LOANER_24H: 'clock',
  CX2: 'snow',
  PS3: 'plug',
  SLOT_7: 'rig',
  GRID_OPERATOR: 'star',
};

export function RewardLadder({
  tiers,
  totalInvited,
  loading = false,
}: {
  tiers?: ReferralRewardTierDto[];
  totalInvited: number;
  loading?: boolean;
}) {
  const S = useReferrals();

  // An API that predates the ladder simply has nothing to show here.
  if (!loading && (!tiers || tiers.length === 0)) return null;

  return (
    <Reveal>
      <Panel hud className="space-y-6 p-5 sm:p-8">
        <div>
          <Eyebrow tone="charge">{S.eyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{S.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{S.subtitle}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && !tiers
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
            : (tiers ?? []).map((tier, i) => (
                <RewardCard key={tier.tier} tier={tier} index={i} totalInvited={totalInvited} />
              ))}
        </div>
      </Panel>
    </Reveal>
  );
}

function RewardCard({
  tier,
  index,
  totalInvited,
}: {
  tier: ReferralRewardTierDto;
  index: number;
  totalInvited: number;
}) {
  const S = useReferrals();
  const copy = S.rewards[tier.reward as keyof typeof S.rewards];
  const name = copy?.name ?? tier.label;
  const body = copy?.body ?? '';

  // Unlocked but not granted is a real state: the sweep runs on a timer, and
  // a part can be deferred when the catalogue is unseeded. Say so rather
  // than showing it as earned.
  const state = tier.granted ? 'earned' : tier.unlocked ? 'pending' : 'locked';
  const tone = state === 'earned' ? 'ok' : state === 'pending' ? 'charge' : 'default';
  const label = state === 'earned' ? S.earned : state === 'pending' ? S.pending : S.locked;
  const icon: IconName = state === 'earned' ? 'check' : state === 'pending' ? 'clock' : 'lock';

  const progress = tier.invites > 0 ? Math.min(100, (totalInvited / tier.invites) * 100) : 100;

  return (
    <div
      className={`v-panel relative flex flex-col p-4 transition ${
        tier.granted ? 'v-panel--charge' : tier.unlocked ? '' : 'opacity-70'
      }`}
      style={{ ['--i' as string]: index }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="v-num text-[11px] font-bold text-ink-3">
          {tier.invites === 1 ? S.oneInvite : `${tier.invites} ${S.invites}`}
        </span>
        <Chip tone={tone} className="text-[9px]">
          <Icon name={icon} size={10} />
          {label}
        </Chip>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
            tier.granted
              ? 'border-charge/35 bg-charge/12 text-charge'
              : 'border-brand/30 bg-brand/12 text-brand-hi'
          }`}
        >
          <Icon name={REWARD_ICON[tier.reward] ?? 'gift'} size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold leading-tight text-ink">{name}</h3>
          {body && <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{body}</p>}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <Progress value={progress} charge={tier.granted} />
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold">
          <span className="v-num text-ink-3">
            {tier.kind === 'SLOT'
              ? S.permanent
              : tier.durationDays
                ? `${tier.durationDays} ${S.days}`
                : ''}
          </span>
          {!tier.unlocked && (
            <span className="v-num text-ink-3">
              {tier.invitesNeeded} {S.invitesNeeded}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
