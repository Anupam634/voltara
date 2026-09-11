import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { pointsToToken } from '../mining/mining.engine';
import { lockUserRow } from '../common/row-lock';
import {
  PAYOUTS_CLOSED_MESSAGE,
  readPayoutWindow,
  type PayoutWindow,
} from './payout-window';

/** SPEC §4. Exported so the public status route quotes the same figure. */
export const WITHDRAWAL_MIN_POINTS = 100;
/** SPEC §3: 3 VOLTS = 1 $VLTR. */
export const POINTS_PER_TOKEN = 3;

const MIN_WITHDRAWAL_MILLI = WITHDRAWAL_MIN_POINTS * 1000;
const COOLDOWN_MS = 7 * 24 * 3_600_000; // 1 per week

/** Shape returned to clients — BigInt milli-points become decimal points. */
export interface WithdrawalDto {
  id: string;
  points: number;
  tokenAmount: string;
  toAddress: string;
  status: string;
  txHash: string | null;
  adminNote: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}

function toDto(w: {
  id: string;
  pointsAmount: bigint;
  tokenAmount: string;
  toAddress: string;
  status: string;
  txHash: string | null;
  adminNote: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}): WithdrawalDto {
  return {
    id: w.id,
    points: Number(w.pointsAmount) / 1000,
    tokenAmount: w.tokenAmount,
    toAddress: w.toAddress,
    status: w.status,
    txHash: w.txHash,
    adminNote: w.adminNote,
    requestedAt: w.requestedAt,
    resolvedAt: w.resolvedAt,
  };
}

/**
 * Withdrawal lifecycle: request -> (admin) approve/reject -> on-chain payout.
 * Points are debited on request (escrow) and refunded on rejection, so a
 * pending withdrawal can't be double-spent by mining more.
 */
@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Whether payouts are open, for the withdraw screen and for `request`.
   *
   * Read per call rather than resolved once at boot: opening the window is
   * the most time-sensitive switch this service has, and it should not need
   * a redeploy to take effect.
   */
  window(): PayoutWindow {
    return readPayoutWindow({
      PAYOUTS_OPEN: this.config.get<string>('PAYOUTS_OPEN'),
      PAYOUTS_OPEN_AT: this.config.get<string>('PAYOUTS_OPEN_AT'),
    });
  }

  /**
   * Escrow points and queue a payout for admin review.
   *
   * The eligibility checks and the debit run inside one transaction behind a
   * lock on the user's row. Read outside a transaction, as they were, five
   * concurrent requests on a 100-point balance all saw 100 points and all
   * passed both the balance check and the "one per week" check — leaving five
   * pending payouts and a balance of -400.
   */
  async request(userId: string, toAddress: string, pointsMilli: number) {
    // Before anything else, and outside the transaction: accepting a request
    // debits the miner's balance into escrow, and until $VLTR exists there is
    // no payout that can ever release it. A closed window is a refusal, not a
    // queue. Admin approve/reject stays open on purpose, so any request that
    // predates the gate can still be settled or refunded.
    if (!this.window().open) {
      throw new ServiceUnavailableException(PAYOUTS_CLOSED_MESSAGE);
    }

    if (pointsMilli < MIN_WITHDRAWAL_MILLI) {
      throw new BadRequestException('Minimum withdrawal is 100 points.');
    }

    const amount = BigInt(pointsMilli);
    const tokenAmount = pointsToToken(pointsMilli).toString();

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { kyc: true },
      });
      if (user.kyc?.status !== 'APPROVED') {
        throw new BadRequestException('KYC must be approved before withdrawal.');
      }

      const lastWeek = new Date(Date.now() - COOLDOWN_MS);
      const recent = await tx.withdrawal.count({
        where: { userId, requestedAt: { gte: lastWeek } },
      });
      if (recent > 0) {
        throw new BadRequestException('Only 1 withdrawal request per week.');
      }

      // Conditional debit. The lock already serialises callers; the `gte`
      // guard is the belt to that braces — the balance can never be driven
      // below zero even if this is ever called without one.
      const debited = await tx.user.updateMany({
        where: { id: userId, pointsBalance: { gte: amount } },
        data: { pointsBalance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new BadRequestException('Insufficient balance.');
      }

      const created = await tx.withdrawal.create({
        data: {
          userId,
          pointsAmount: amount,
          tokenAmount,
          toAddress,
          status: 'PENDING',
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          reason: 'WITHDRAWAL',
          deltaMilli: -amount,
          meta: { toAddress, tokenAmount },
        },
      });
      return created;
    });

    return toDto(withdrawal);
  }

  /**
   * Admin approves -> execute on-chain payout via the swappable wallet.
   *
   * The row is moved out of PENDING *before* the chain call, in a single
   * conditional update. Checking the status and then paying left a window
   * where two admins clicking approve at the same time — or one admin
   * double-clicking — both read PENDING and both sent real tokens.
   */
  async approve(withdrawalId: string, adminNote?: string) {
    const w = await this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
    });

    // Reserve it. Whoever wins this update owns the payout; everyone else
    // sees count 0 and stops here.
    const reserved = await this.prisma.withdrawal.updateMany({
      where: { id: withdrawalId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    if (reserved.count === 0) {
      const current = await this.prisma.withdrawal.findUniqueOrThrow({
        where: { id: withdrawalId },
        select: { status: true },
      });
      throw new BadRequestException(`Withdrawal is already ${current.status}.`);
    }

    let txHash: string;
    try {
      ({ txHash } = await this.wallet.payout(w.toAddress, w.tokenAmount));
    } catch (err) {
      // Nothing was sent, so hand the row back to the queue rather than
      // stranding it in APPROVED where no later attempt can pick it up.
      await this.prisma.withdrawal.updateMany({
        where: { id: withdrawalId, status: 'APPROVED' },
        data: { status: 'PENDING' },
      });
      throw err;
    }

    const paid = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'PAID', txHash, adminNote, resolvedAt: new Date() },
    });
    return toDto(paid);
  }

  /**
   * Admin rejects -> refund escrowed points.
   *
   * The status transition is the guard: if the conditional update inside the
   * transaction matches nothing, another call already resolved this row and
   * the refund must not be issued a second time.
   */
  async reject(withdrawalId: string, adminNote: string) {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUniqueOrThrow({
        where: { id: withdrawalId },
      });

      const resolved = await tx.withdrawal.updateMany({
        where: { id: withdrawalId, status: 'PENDING' },
        data: { status: 'REJECTED', adminNote, resolvedAt: new Date() },
      });
      if (resolved.count === 0) {
        throw new BadRequestException(`Withdrawal is already ${w.status}.`);
      }

      await tx.user.update({
        where: { id: w.userId },
        data: { pointsBalance: { increment: w.pointsAmount } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: w.userId,
          reason: 'WITHDRAWAL',
          deltaMilli: w.pointsAmount, // positive = refund
          meta: { refundOf: withdrawalId },
        },
      });
    });
    return { refunded: true };
  }

  /** The caller's own history, newest first. */
  async listForUser(userId: string): Promise<WithdrawalDto[]> {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map(toDto);
  }

  /** Admin approval queue, oldest first. */
  async listPending(): Promise<WithdrawalDto[]> {
    const rows = await this.prisma.withdrawal.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
    });
    return rows.map(toDto);
  }
}
