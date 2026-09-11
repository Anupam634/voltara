import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { RigService } from './rig.service';

/** Catalogue code of the part every new miner is lent. */
export const LOANER_PART_CODE = 'VC1';

/** How long the free core runs before it burns out. */
export const LOANER_HOURS = 72;

/** How far ahead of expiry the miner is warned, in hours. */
export const LOANER_WARN_HOURS = 12;

/** Users warned per cron pass. Bounds the mail burst on a busy grid. */
export const LOANER_WARN_BATCH = 200;

const WEB_URL = (process.env.WEB_URL || 'https://voltaragrid.com').replace(/\/$/, '');

/**
 * The starter core.
 *
 * A brand-new account used to land on an empty chassis and a 24h wait — the
 * single worst moment in the funnel, because there is nothing to look at and
 * nothing to do. Every new miner is now lent a VC-1 for 72 hours: the rig
 * screen shows a lit part from the first second, and the rate reads 2.9/hr
 * instead of 0.9.
 *
 * The loan is also the first purchase moment. It expires, the miner is
 * warned twelve hours out, and replacing it costs one dollar.
 */
@Injectable()
export class LoanerService {
  private readonly logger = new Logger(LoanerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
    private readonly email: EmailService,
  ) {}

  /**
   * Lend a new miner their first core.
   *
   * Idempotent on `loanerGrantedAt`, so a retried signup cannot hand out a
   * second one, and deliberately silent on failure: an account must not fail
   * to be created because the catalogue was empty or a slot write lost a
   * race. A miner without a loaner is merely back to the old experience.
   */
  async grant(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
    try {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { loanerGrantedAt: true },
      });
      if (!user || user.loanerGrantedAt) return false;

      const plan = await tx.boosterPlan.findUnique({
        where: { code: LOANER_PART_CODE },
        select: { id: true },
      });
      if (!plan) {
        this.logger.warn(
          `no "${LOANER_PART_CODE}" plan in the catalogue — new miners get a bare chassis. Run the seed.`,
        );
        return false;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LOANER_HOURS * 3_600_000);

      const booster = await tx.booster.create({
        data: { userId, planId: plan.id, source: 'LOANER', expiresAt },
        select: { id: true },
      });

      const slot = await this.rig.autoInstall(tx, userId, booster.id);

      // Stamped last: whatever else happened, this is what makes the grant
      // unrepeatable, and it must not be set for a grant that threw.
      await tx.user.update({
        where: { id: userId },
        data: { loanerGrantedAt: now },
      });

      // Zero-delta: the loan is a part, not points. The first tap pays the
      // welcome amount on its own (see WELCOME_CLAIM_MILLI). This row exists
      // so the dashboard can tell a new miner what they were given, and so
      // the expiry nudge has somewhere to record that it fired.
      await tx.ledgerEntry.create({
        data: {
          userId,
          reason: 'WELCOME',
          deltaMilli: 0n,
          meta: {
            loaner: LOANER_PART_CODE,
            expiresAt: expiresAt.toISOString(),
            slot,
          },
        },
      });

      return true;
    } catch (err) {
      this.logger.warn(
        `loaner grant failed for ${userId}: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  /**
   * Warn miners whose loaner is about to burn out.
   *
   * Hourly rather than by the minute: the window is twelve hours wide, so an
   * hour of jitter costs nothing and the mail goes out in one predictable
   * burst instead of a trickle.
   *
   * "Already warned" is recorded on the miner's WELCOME ledger row rather
   * than in a column of its own — the row is written by `grant` and exists
   * for exactly the population this cron walks.
   */
  @Cron('0 * * * *')
  async warnExpiring(): Promise<void> {
    const now = new Date();
    const deadline = new Date(now.getTime() + LOANER_WARN_HOURS * 3_600_000);

    const expiring = await this.prisma.booster.findMany({
      where: {
        source: 'LOANER',
        expiresAt: { gt: now, lte: deadline },
        salvagedAt: null,
        user: { isBlocked: false, email: { not: null } },
      },
      orderBy: { expiresAt: 'asc' },
      take: LOANER_WARN_BATCH,
      select: {
        id: true,
        expiresAt: true,
        userId: true,
        user: { select: { email: true } },
      },
    });
    if (expiring.length === 0) return;

    let sent = 0;
    for (const part of expiring) {
      const email = part.user.email;
      if (!email) continue;

      // Compare-and-set on the ledger row: the update only matches a row
      // that has not been flagged, so a second instance running the same
      // pass sends nothing.
      const claimed = await this.prisma.ledgerEntry.updateMany({
        where: {
          userId: part.userId,
          reason: 'WELCOME',
          NOT: { meta: { path: ['loanerWarned'], equals: true } },
        },
        data: { meta: { loanerWarned: true, warnedAt: now.toISOString() } },
      });
      if (claimed.count === 0) continue;

      const delivered = await this.email.sendLoanerExpiryEmail(email, {
        hoursLeft: Math.max(
          1,
          Math.round((part.expiresAt.getTime() - now.getTime()) / 3_600_000),
        ),
        shopUrl: `${WEB_URL}/en/boosters`,
      });
      if (delivered) sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`[LOANER NUDGE] warned ${sent} miner(s) of ${expiring.length} expiring`);
    }
  }
}
