import { Prisma } from '@prisma/client';
import { effectiveRateMilli } from '../mining/mining.engine';
import type { RigTelemetry } from '../mining/rig.engine';
import type { RigContextService } from '../rig/rig-context.service';
import type { PrismaService } from '../prisma.service';
import { maskIdentity } from './mask-identity';

/** What another miner is allowed to see about a rig. Never an email. */
export interface PublicRigReadout {
  id: string;
  name: string;
  countryCode: string | null;
  ratePerHour: number;
  gridStability: number;
  telemetry: RigTelemetry;
}

/**
 * One miner's public rig readout: masked name plus the live rate and
 * stability, with every modifier applied. Shared by duels and squads so a
 * rig reads the same number on both screens.
 */
export async function publicRigReadout(
  rig: RigContextService,
  client: Prisma.TransactionClient | PrismaService,
  userId: string,
  now = new Date(),
): Promise<PublicRigReadout> {
  const [user, { telemetry }] = await Promise.all([
    client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        countryCode: true,
        rateAdjustMilli: true,
        _count: { select: { referrals: true } },
      },
    }),
    rig.telemetryFor(userId, client, { now }),
  ]);
  const rateMilli = effectiveRateMilli({
    rig: telemetry,
    inviteCount: user._count.referrals,
    rateAdjustMilli: user.rateAdjustMilli,
  });
  return {
    id: user.id,
    name: maskIdentity({ id: user.id, email: user.email }),
    countryCode: user.countryCode,
    ratePerHour: rateMilli / 1000,
    gridStability: telemetry.gridStability,
    telemetry,
  };
}
