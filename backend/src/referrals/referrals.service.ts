import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { REFERRAL_TIERS, referralTierFor } from '../mining/mining.engine';
import { slotCount } from '../mining/rig.engine';
import { maskIdentity } from '../common/mask-identity';
import { lockUserRow } from '../common/row-lock';
import { RigService } from '../rig/rig.service';
import {
  ACTIVE_WINDOW_MS,
  NUDGE_COOLDOWN_MS,
  ReminderBlock,
  idleDays,
  reminderState,
} from './referral-reminder';
import {
  REFERRAL_REWARD_TIERS,
  ReferralRewardTier,
  nextRewardTier,
  pendingRewards,
  rewardsFor,
  tierFromMeta,
} from './referral-rewards';

const WEB_URL = (process.env.WEB_URL || 'https://voltaragrid.com').replace(/\/$/, '');

/**
 * Inviters examined per reconciliation pass. Bounds the sweep on a large
 * grid; anything missed is picked up on the next run half an hour later.
 */
const RECONCILE_BATCH = 200;

const BLOCK_MESSAGES: Record<ReminderBlock, string> = {
  ACTIVE: 'That miner mined in the last 24 hours. There is nothing to remind them about.',
  NO_EMAIL: 'That miner signed up with a wallet only, so there is no inbox to reach.',
  BLOCKED: 'That account is suspended and cannot be reminded.',
  COOLDOWN: `You already reminded that miner recently. Each referral can be reminded once every ${NUDGE_COOLDOWN_MS / 86_400_000} days.`,
};

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly rig: RigService,
  ) {}

  /**
   * Complete referral overview for the authenticated miner:
   * - Total direct referrals and active mining count
   * - Current and next multiplier tier status
   * - Privacy-masked referrals roster, each with its reminder availability
   */
  async getReferralStats(userId: string) {
    // Hand over anything owed before reading, so a miner who just crossed a
    // rung sees the part on the same page load that tells them they earned
    // it. Cheap when nothing is owed, and never fatal to the read.
    await this.syncRewards(userId).catch((err) =>
      this.logger.warn(
        `reward sync failed for ${userId}: ${err instanceof Error ? err.message : err}`,
      ),
    );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        referralCode: true,
        referrals: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            createdAt: true,
            lastMineAt: true,
            lastReferralNudgeAt: true,
            isBlocked: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();

    const totalInvited = user.referrals.length;
    const activeMinersCount = user.referrals.filter(
      (r) =>
        r.lastMineAt &&
        now.getTime() - new Date(r.lastMineAt).getTime() <= ACTIVE_WINDOW_MS,
    ).length;

    const currentTier = referralTierFor(totalInvited);
    const nextTier =
      REFERRAL_TIERS.find((t) => t.level === currentTier.level + 1) || null;

    let progressToNextPercent = 100;
    let invitesNeededForNext = 0;

    if (nextTier) {
      const tierRange = nextTier.minInvites - currentTier.minInvites;
      const currentProgress = totalInvited - currentTier.minInvites;
      progressToNextPercent = Math.min(
        100,
        Math.max(0, Math.round((currentProgress / tierRange) * 100)),
      );
      invitesNeededForNext = Math.max(0, nextTier.minInvites - totalInvited);
    }

    const referralsList = user.referrals.map((r) => {
      const maskedEmail = maskIdentity({ id: r.id, email: r.email });
      const isMiningActive = !!(
        r.lastMineAt &&
        now.getTime() - new Date(r.lastMineAt).getTime() <= ACTIVE_WINDOW_MS
      );

      return {
        id: r.id,
        maskedEmail,
        countryCode: r.countryCode ?? 'GLOBAL',
        joinedAt: r.createdAt.toISOString(),
        lastMineAt: r.lastMineAt ? r.lastMineAt.toISOString() : null,
        isMiningActive,
        reminder: reminderState(r, now),
      };
    });

    const grantedTiers = await this.grantedTiers(userId);

    return {
      referralCode: user.referralCode,
      totalInvited,
      activeMinersCount,
      currentTier,
      nextTier,
      progressToNextPercent,
      invitesNeededForNext,
      allTiers: REFERRAL_TIERS,
      referralsList,
      // The hardware ladder, alongside the multiplier one above it.
      rewardTiers: REFERRAL_REWARD_TIERS.map((t) => ({
        tier: t.tier,
        invites: t.invites,
        kind: t.kind,
        reward: t.reward,
        label: t.label,
        partCode: t.partCode ?? null,
        durationDays: t.durationDays ?? null,
        unlocked: totalInvited >= t.invites,
        granted: grantedTiers.has(t.tier),
        invitesNeeded: Math.max(0, t.invites - totalInvited),
      })),
      nextRewardTier: nextRewardTier(totalInvited),
    };
  }

  /** Tier ids this miner has already been paid, read from their ledger. */
  private async grantedTiers(userId: string): Promise<Set<number>> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { userId, reason: 'REFERRAL_BONUS' },
      select: { meta: true },
    });
    const tiers = new Set<number>();
    for (const row of rows) {
      const tier = tierFromMeta(row.meta);
      if (tier !== null) tiers.add(tier);
    }
    return tiers;
  }

  /**
   * Public hook for the signup path: someone just joined on `referrerId`'s
   * code, so re-check what that inviter is owed.
   *
   * Deliberately never throws — a reward is not worth failing a signup over,
   * and `reconcile` picks up anything this misses.
   */
  async onReferralJoined(referrerId: string): Promise<void> {
    try {
      await this.syncRewards(referrerId);
    } catch (err) {
      this.logger.warn(
        `reward grant on join failed for ${referrerId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Grant every unlocked tier this miner has not been paid yet.
   *
   * **Idempotency marker:** a `LedgerEntry` with reason `REFERRAL_BONUS` and
   * `meta.tier === <tier>`. No schema column, and no second source of truth
   * — the row that records the grant *is* the proof of it. The read of those
   * rows and the write of the new one happen inside one transaction under
   * `lockUserRow`, so two invites landing together serialise and the second
   * sees the first's row.
   *
   * Returns the tiers actually granted by this call.
   */
  async syncRewards(userId: string): Promise<ReferralRewardTier[]> {
    // Fast path outside the transaction: most reads owe nothing, and there
    // is no reason to take a row lock to discover that.
    const [inviteCount, alreadyGranted] = await Promise.all([
      this.prisma.user.count({ where: { referredById: userId } }),
      this.grantedTiers(userId),
    ]);
    if (pendingRewards(inviteCount, alreadyGranted).length === 0) return [];

    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      // Re-read under the lock. The fast path above raced by definition.
      const [count, rows, user] = await Promise.all([
        tx.user.count({ where: { referredById: userId } }),
        tx.ledgerEntry.findMany({
          where: { userId, reason: 'REFERRAL_BONUS' },
          select: { meta: true },
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { rigSlots: true, isBlocked: true },
        }),
      ]);
      if (!user || user.isBlocked) return [];

      const granted = new Set<number>();
      for (const row of rows) {
        const tier = tierFromMeta(row.meta);
        if (tier !== null) granted.add(tier);
      }

      const owed = pendingRewards(count, granted);
      const paid: ReferralRewardTier[] = [];

      for (const tier of owed) {
        const meta = await this.payTier(tx, userId, tier, user.rigSlots);
        if (meta === null) continue;

        await tx.ledgerEntry.create({
          data: {
            userId,
            reason: 'REFERRAL_BONUS',
            // Zero-delta: the ladder pays hardware and standing, never
            // points, so invites can never be farmed into a withdrawal.
            deltaMilli: 0n,
            meta: { tier: tier.tier, reward: tier.reward, ...meta },
          },
        });
        paid.push(tier);
      }

      if (paid.length > 0) {
        this.logger.log(
          `[REFERRAL REWARD] ${userId} earned ${paid.map((t) => t.reward).join(', ')}`,
        );
      }
      return paid;
    });
  }

  /**
   * Hand over one tier. Returns extra ledger meta, or null to skip the tier
   * entirely (leaving it owed, so a later pass can retry).
   */
  private async payTier(
    tx: Prisma.TransactionClient,
    userId: string,
    tier: ReferralRewardTier,
    currentSlots: number,
  ): Promise<Prisma.JsonObject | null> {
    switch (tier.kind) {
      case 'PART': {
        const plan = await tx.boosterPlan.findUnique({
          where: { code: tier.partCode! },
          select: { id: true },
        });
        if (!plan) {
          // An unseeded catalogue is an operator problem, not a miner one.
          // Leave the tier owed so it lands once the seed is run.
          this.logger.warn(
            `no "${tier.partCode}" plan in the catalogue — referral tier ${tier.tier} deferred.`,
          );
          return null;
        }
        const expiresAt = new Date(
          Date.now() + tier.durationDays! * 86_400_000,
        );
        const booster = await tx.booster.create({
          data: { userId, planId: plan.id, source: 'REFERRAL', expiresAt },
          select: { id: true },
        });
        const slot = await this.rig.autoInstall(tx, userId, booster.id);
        return {
          boosterId: booster.id,
          partCode: tier.partCode!,
          expiresAt: expiresAt.toISOString(),
          slot,
        };
      }

      case 'SLOT': {
        // The only permanent grant in the game. Clamped through the same
        // helper the rig uses, so it can never widen past the chassis ceiling.
        const slots = slotCount(Math.max(currentSlots, tier.slots!));
        await tx.user.update({ where: { id: userId }, data: { rigSlots: slots } });
        return { slots };
      }

      case 'LOANER_EXTENSION': {
        // The one rung that pays the *invitee*: their starter core runs
        // longer, so the person who was just invited has a better first
        // week. Targets the most recent joiner whose loaner is still alive;
        // an expired one cannot be extended, and the tier stays owed for a
        // later invitee rather than being burnt on nobody.
        const loaner = await tx.booster.findFirst({
          where: {
            source: 'LOANER',
            expiresAt: { gt: new Date() },
            salvagedAt: null,
            user: { referredById: userId, isBlocked: false },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, userId: true, expiresAt: true },
        });
        if (!loaner) return null;

        const expiresAt = new Date(
          loaner.expiresAt.getTime() + tier.extendHours! * 3_600_000,
        );
        await tx.booster.update({
          where: { id: loaner.id },
          data: { expiresAt },
        });
        return {
          inviteeId: loaner.userId,
          boosterId: loaner.id,
          expiresAt: expiresAt.toISOString(),
        };
      }

      case 'BADGE':
        // Standing has no state of its own: the ledger row is the badge, and
        // `rewardTiers[].granted` is how the UI reads it.
        return {};
    }
  }

  /**
   * Self-healing sweep.
   *
   * The signup hook is best-effort and the lazy sync only fires when a miner
   * opens their referrals page, so neither is a guarantee. This walks miners
   * who have invitees but are missing a rung and pays what is owed. Idempotent
   * by construction — it grants through the same locked path as everything else.
   */
  @Cron('*/30 * * * *')
  async reconcile(): Promise<void> {
    const lowest = REFERRAL_REWARD_TIERS[0]?.invites ?? 1;

    const candidates = await this.prisma.user.findMany({
      where: { isBlocked: false, referrals: { some: {} } },
      select: { id: true, _count: { select: { referrals: true } } },
      take: RECONCILE_BATCH,
      orderBy: { createdAt: 'desc' },
    });

    let paid = 0;
    for (const candidate of candidates) {
      if (candidate._count.referrals < lowest) continue;
      try {
        const granted = await this.syncRewards(candidate.id);
        paid += granted.length;
      } catch (err) {
        this.logger.warn(
          `reconcile failed for ${candidate.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (paid > 0) {
      this.logger.log(`[REFERRAL RECONCILE] granted ${paid} outstanding reward(s)`);
    }
  }

  /**
   * Email one idle referral a nudge to come back and mine.
   *
   * The referral must belong to the caller — the lookup is keyed on both
   * ids, so a guessed id for someone else's referral is simply "not found".
   * The eligibility rules live in `reminderState` and are re-checked here
   * regardless of what the client showed, and the cooldown stamp is written
   * with a conditional update so two taps racing each other send one mail.
   */
  async remindReferral(userId: string, referralId: string) {
    const [inviter, referral] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, email: true },
      }),
      this.prisma.user.findFirst({
        where: { id: referralId, referredById: userId },
        select: {
          id: true,
          email: true,
          isBlocked: true,
          lastMineAt: true,
          lastReferralNudgeAt: true,
        },
      }),
    ]);

    if (!referral) {
      throw new NotFoundException('That miner is not in your referral network.');
    }

    const now = new Date();
    const state = reminderState(referral, now);
    if (!state.canSend) {
      throw new BadRequestException(BLOCK_MESSAGES[state.reason!]);
    }

    // Claim the cooldown slot before sending. `updateMany` with the previous
    // stamp in the filter makes this a compare-and-set: a concurrent second
    // tap sees zero rows updated and stops.
    const claimed = await this.prisma.user.updateMany({
      where: { id: referral.id, lastReferralNudgeAt: referral.lastReferralNudgeAt },
      data: { lastReferralNudgeAt: now },
    });
    if (claimed.count === 0) {
      throw new BadRequestException(BLOCK_MESSAGES.COOLDOWN);
    }

    const delivered = await this.email.sendReferralReminderEmail(referral.email!, {
      inviterLabel: maskIdentity({ id: inviter.id, email: inviter.email }),
      idleDays: idleDays(referral.lastMineAt, now),
      dashboardUrl: `${WEB_URL}/en/dashboard`,
    });

    if (!delivered) {
      // Give the slot back so the inviter can retry once mail is healthy.
      await this.prisma.user.updateMany({
        where: { id: referral.id, lastReferralNudgeAt: now },
        data: { lastReferralNudgeAt: referral.lastReferralNudgeAt },
      });
      throw new BadGatewayException(
        'We could not send the reminder right now. Please try again in a moment.',
      );
    }

    this.logger.log(`[REFERRAL NUDGE] ${userId} -> ${referral.id}`);

    return {
      sentAt: now.toISOString(),
      availableAt: new Date(now.getTime() + NUDGE_COOLDOWN_MS).toISOString(),
    };
  }
}
