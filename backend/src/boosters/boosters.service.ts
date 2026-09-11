import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma.service';
import { ChainReaderService } from './chain-reader.service';
import { RigService } from '../rig/rig.service';
import { RigContextService } from '../rig/rig-context.service';
import { slotCount } from '../mining/rig.engine';
import { verifyPayment, DEFAULT_POLICY, type Policy } from './payment.rules';
import { fitAll, type PartFit } from './fit.rules';

/** How long a quoted purchase stays payable before it must be re-quoted. */
const INTENT_TTL_MS = 60 * 60_000;

@Injectable()
export class BoostersService {
  private readonly logger = new Logger(BoostersService.name);
  private readonly policy: Policy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainReaderService,
    private readonly rig: RigService,
    private readonly rigContext: RigContextService,
    cfg: ConfigService,
  ) {
    this.policy = {
      ...DEFAULT_POLICY,
      minConfirmations: Number(
        cfg.get('BOOSTER_MIN_CONFIRMATIONS') ?? DEFAULT_POLICY.minConfirmations,
      ),
    };
  }

  /** Catalogue + this user's owned parts and open purchases. */
  async overview(userId: string) {
    const now = new Date();
    const [plans, boosters, purchases, fits] = await Promise.all([
      this.prisma.boosterPlan.findMany({
        where: { active: true },
        orderBy: { priceUsd: 'asc' },
      }),
      this.prisma.booster.findMany({
        where: { userId, expiresAt: { gt: now } },
        include: { plan: true, slot: true },
        orderBy: { expiresAt: 'asc' },
      }),
      this.prisma.boosterPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.fitsFor(userId, now),
    ]);
    const fitByCode = new Map(fits.map((f) => [f.code, f]));

    return {
      payment: {
        enabled: this.chain.config.enabled,
        disabledReason: this.chain.config.disabledReason,
        tokenSymbol: this.chain.config.tokenSymbol,
        payToAddress: this.chain.config.enabled
          ? this.chain.config.payToAddress
          : null,
        // BEP-20 contract the payment must be made in (null for native BNB),
        // so clients can build a token-transfer wallet link rather than a
        // native-coin one.
        tokenAddress: this.chain.config.enabled
          ? (this.chain.config.tokenAddress ?? null)
          : null,
        minConfirmations: this.policy.minConfirmations,
      },
      // The shop lists PARTS now, so every row carries what it costs to run
      // as well as what it gives: a core that cannot be cooled is a worse buy
      // than a cheaper one that can, and the miner has to be able to see that
      // before paying rather than after.
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name ?? `$${p.priceUsd} part`,
        kind: p.kind,
        tier: p.tier,
        priceUsd: p.priceUsd,
        rateBonusPerHour: p.rateBonusMilli / 1000,
        heat: p.heat,
        cooling: p.cooling,
        watts: p.watts,
        wattsSupplied: p.wattsSupplied,
        hashBoostPercent: p.hashBoostBp / 100,
        durationDays: p.durationDays,
        // What the hourly rate becomes with this one core on a stock chassis
        // at ×1 referral multiplier — the same figure the landing page
        // advertises. Only meaningful for cores; the rest read 0 hash.
        //
        // Kept for the logged-out landing copy, but `fit` below is what the
        // shop should show a miner who already owns a rig: this figure
        // ignores their parts, their modifiers and their multiplier, so for
        // them it is decoration, not a quote.
        resultingRatePerHour: (900 + p.rateBonusMilli) / 1000,
        /** This part simulated against the caller's own rig. */
        fit: fitByCode.get(p.code ?? '') ?? null,
      })),
      activeBoosters: boosters.map((b) => ({
        id: b.id,
        planId: b.planId,
        code: b.plan.code,
        name: b.plan.name ?? `$${b.plan.priceUsd} part`,
        kind: b.plan.kind,
        tier: b.plan.tier,
        priceUsd: b.plan.priceUsd,
        rateBonusPerHour: b.plan.rateBonusMilli / 1000,
        heat: b.plan.heat,
        cooling: b.plan.cooling,
        watts: b.plan.watts,
        wattsSupplied: b.plan.wattsSupplied,
        hashBoostPercent: b.plan.hashBoostBp / 100,
        startedAt: b.startedAt,
        expiresAt: b.expiresAt,
        installedSlot: b.slot ? b.slot.index : null,
      })),
      purchases: purchases.map((p) => this.toDto(p)),
    };
  }

  /**
   * Every catalogue part simulated against this miner's actual rig.
   *
   * Uses `RigContextService`, so the grid event, the weather, an engaged
   * overclock and a squad loan are all in the numbers — the shop and the
   * dashboard cannot disagree about what a rig makes, because they are
   * reading the same context through the same engine.
   *
   * A rig that cannot be read is not a reason to fail the shop: the
   * catalogue still renders, just without the personalised figures.
   */
  private async fitsFor(userId: string, now: Date): Promise<PartFit[]> {
    try {
      const [ctx, user, catalog] = await Promise.all([
        this.rigContext.load(userId, this.prisma, { now }),
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            rigSlots: true,
            rateAdjustMilli: true,
            streakDays: true,
            _count: { select: { referrals: true } },
          },
        }),
        this.prisma.boosterPlan.findMany({
          where: { active: true, code: { not: null } },
          orderBy: { priceUsd: 'asc' },
        }),
      ]);

      return fitAll({
        base: ctx.parts,
        chassis: { coolingBonus: ctx.coolingBonus, powerBonus: ctx.powerBonus },
        modifiers: ctx.modifiers,
        slots: slotCount(user.rigSlots),
        catalog: catalog.map((p) => ({
          code: p.code as string,
          name: p.name ?? `$${p.priceUsd} part`,
          kind: p.kind,
          priceUsd: p.priceUsd,
          hashMilli: p.rateBonusMilli,
          heat: p.heat,
          cooling: p.cooling,
          watts: p.watts,
          wattsSupplied: p.wattsSupplied,
          hashBoostBp: p.hashBoostBp,
          durationDays: p.durationDays,
        })),
        rate: {
          inviteCount: user._count.referrals,
          rateAdjustMilli: user.rateAdjustMilli,
          streakDays: user.streakDays,
        },
        now,
      });
    } catch (err) {
      this.logger.warn(`rig fit preview failed for ${userId}: ${err}`);
      return [];
    }
  }

  private toDto(p: {
    id: string;
    status: string;
    tokenSymbol: string;
    expectedUnits: string;
    expectedAmount: string;
    payToAddress: string;
    fromAddress: string;
    txHash: string | null;
    failureReason: string | null;
    createdAt: Date;
    expiresAt: Date;
  }) {
    return {
      id: p.id,
      status: p.status,
      tokenSymbol: p.tokenSymbol,
      amount: p.expectedAmount,
      /** Same amount in the token's smallest unit — what a wallet URI needs. */
      expectedUnits: p.expectedUnits,
      payToAddress: p.payToAddress,
      fromAddress: p.fromAddress,
      txHash: p.txHash,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    };
  }

  /**
   * Quote a purchase: pins the price, recipient and payer wallet so the
   * later verification has fixed values to check against.
   */
  async createIntent(userId: string, planId: string, fromAddress: string) {
    if (!this.chain.config.enabled) {
      throw new ServiceUnavailableException(
        `Booster payments are not configured. ${this.chain.config.disabledReason}`,
      );
    }
    if (!ethers.isAddress(fromAddress)) {
      throw new BadRequestException('That is not a valid BNB Chain address.');
    }

    const plan = await this.prisma.boosterPlan.findUniqueOrThrow({
      where: { id: planId },
    });
    if (!plan.active) {
      throw new BadRequestException('That plan is no longer available.');
    }

    const units = this.chain.expectedUnits(plan.priceUsd);
    const purchase = await this.prisma.boosterPurchase.create({
      data: {
        userId,
        planId,
        tokenSymbol: this.chain.config.tokenSymbol,
        expectedUnits: units.toString(),
        expectedAmount: this.chain.humanAmount(units),
        priceUsd: plan.priceUsd,
        payToAddress: this.chain.config.payToAddress,
        fromAddress: ethers.getAddress(fromAddress),
        expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      },
    });
    return this.toDto(purchase);
  }

  /**
   * Verify a submitted transaction and, if it checks out, activate the
   * booster. No admin step: acceptance is decided entirely by what the chain
   * reports against the values pinned at quote time.
   */
  async submitPayment(userId: string, purchaseId: string, txHash: string) {
    const purchase = await this.prisma.boosterPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { plan: true },
    });
    if (purchase.userId !== userId) {
      throw new BadRequestException('That purchase belongs to another account.');
    }
    if (purchase.status === 'CONFIRMED') {
      throw new BadRequestException('This purchase is already paid.');
    }
    if (purchase.expiresAt < new Date()) {
      await this.prisma.boosterPurchase.update({
        where: { id: purchaseId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException(
        'This quote expired. Start the purchase again.',
      );
    }

    // Reject a hash already spent on another purchase before touching the
    // chain; the unique index is the real guarantee, this is the clear error.
    const claimed = await this.prisma.boosterPurchase.findUnique({
      where: { txHash },
    });
    if (claimed && claimed.id !== purchaseId) {
      throw new BadRequestException(
        'That transaction has already been used for another purchase.',
      );
    }

    const observed = await this.chain.observe(txHash);
    if (!observed) {
      throw new BadRequestException(
        'That transaction could not be found on chain yet. Wait a moment and try again.',
      );
    }

    const verdict = verifyPayment(
      {
        payToAddress: purchase.payToAddress,
        fromAddress: purchase.fromAddress,
        expectedUnits: BigInt(purchase.expectedUnits),
        tokenAddress: this.chain.config.tokenAddress,
        intentCreatedAt: purchase.createdAt,
      },
      observed,
      this.policy,
    );

    if (!verdict.ok) {
      // A pending confirmation isn't a failure — the user should retry.
      const retryable = verdict.reason === 'NOT_ENOUGH_CONFIRMATIONS';
      if (!retryable) {
        // Record the attempt, but never in the unique `txHash` column: a
        // rejected submission must not burn a real payment the user can
        // still legitimately redeem against a corrected purchase.
        await this.prisma.boosterPurchase.update({
          where: { id: purchaseId },
          data: {
            status: 'FAILED',
            failureReason: verdict.detail,
            attemptedTxHash: txHash,
          },
        });
      }
      throw new BadRequestException(verdict.detail);
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + purchase.plan.durationDays * 24 * 3_600_000,
    );

    // Activate and mark paid together, so a booster can never exist without
    // its confirmed purchase (or vice versa).
    //
    // The CONFIRMED transition is a conditional update rather than a plain
    // one: the "already paid" check at the top of this method reads state
    // that two concurrent submissions of the same purchase both saw as
    // unpaid, and they would then each create a booster off one payment. The
    // unique index on `txHash` does not catch it — both writes target the
    // same purchase row.
    const booster = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.boosterPurchase.updateMany({
        where: { id: purchaseId, status: { not: 'CONFIRMED' } },
        data: { status: 'CONFIRMED', txHash, confirmedAt: now },
      });
      if (confirmed.count === 0) {
        throw new BadRequestException('This purchase is already paid.');
      }

      const created = await tx.booster.create({
        data: {
          userId,
          planId: purchase.planId,
          startedAt: now,
          expiresAt,
          txHash,
          purchaseId,
        },
      });
      // Socket it straight into the rig when there is room, so the ordinary
      // flow is buy → watch the gauge move. A full rig leaves the part in
      // inventory rather than evicting something the miner chose to run.
      const slot = await this.rig.autoInstall(tx, userId, created.id);

      await tx.ledgerEntry.create({
        data: {
          userId,
          reason: 'BOOSTER_PURCHASE',
          // Parts raise the mining rate; they do not move a point balance,
          // so this row is an audit trail rather than a balance change.
          deltaMilli: 0n,
          meta: {
            purchaseId,
            txHash,
            priceUsd: purchase.plan.priceUsd,
            partCode: purchase.plan.code,
            rateBonusMilli: purchase.plan.rateBonusMilli,
            installedSlot: slot,
          },
        },
      });
      return { ...created, installedSlot: slot };
    });

    this.logger.log(
      `part activated: user=${userId} part=${purchase.plan.code ?? purchase.plan.priceUsd} ` +
        `slot=${booster.installedSlot ?? 'inventory'} tx=${txHash}`,
    );
    return {
      activated: true,
      booster: {
        id: booster.id,
        code: purchase.plan.code,
        name: purchase.plan.name ?? `$${purchase.plan.priceUsd} part`,
        kind: purchase.plan.kind,
        rateBonusPerHour: purchase.plan.rateBonusMilli / 1000,
        expiresAt: booster.expiresAt,
        /** Slot it landed in, or null when the rig was full. */
        installedSlot: booster.installedSlot,
      },
    };
  }
}
