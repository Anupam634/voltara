import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RigContextService } from '../rig/rig-context.service';
import { TtlCache } from '../common/ttl-cache';
import { lockUserRow } from '../common/row-lock';
import { publicRigReadout } from '../common/rig-readout';

const MILLI = 1000;
const WEEK_MS = 7 * 24 * 3_600_000;
const LEADERBOARD_TTL_MS = 60_000;
const LEADERBOARD_SIZE = 20;

export interface SquadMemberDto {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: Date | null;
  ratePerHour: number;
  gridStability: number;
  coolingSurplus: number;
  powerSurplus: number;
  lent: { cooling: number; power: number };
}

export interface SquadDto {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  maxMembers: number;
  createdAt: Date;
  members: SquadMemberDto[];
  pool: {
    coolingSurplus: number;
    powerSurplus: number;
    coolingLent: number;
    powerLent: number;
  };
  earnedPoints7d: number;
}

export interface SquadLeaderboardRow {
  id: string;
  name: string;
  members: number;
  earnedPoints: number;
  rank: number;
}

/**
 * Squads: up to five miners pooling spare cooling and power.
 *
 * Membership lives on User.squadId, so a miner is in at most one squad and
 * the pool maths in RigContextService.squadLoan needs nothing but that
 * column. This service only moves people in and out and describes the
 * result; the physics stays in the rig engine.
 */
@Injectable()
export class SquadsService {
  private readonly cache = new TtlCache(LEADERBOARD_TTL_MS, 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigContextService,
  ) {}

  // ── Commands ──────────────────────────────────────────────────────────

  async create(userId: string, name: string): Promise<{ squad: SquadDto }> {
    const id = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { squadId: true },
      });
      if (me.squadId) throw new BadRequestException('Leave your current squad first.');

      const squad = await tx.squad.create({
        data: { name: name.trim(), ownerId: userId },
        select: { id: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { squadId: squad.id, squadJoinedAt: new Date() },
      });
      return squad.id;
    });
    this.cache.invalidate();
    return { squad: await this.describe(id, userId) };
  }

  async join(userId: string, code: string): Promise<{ squad: SquadDto }> {
    const id = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { squadId: true },
      });
      if (me.squadId) throw new BadRequestException('Leave your current squad first.');

      const squad = await tx.squad.findUnique({
        where: { code },
        select: { id: true, maxMembers: true, ownerId: true },
      });
      if (!squad) throw new NotFoundException('No squad has that code.');

      // Serialise joins on the owner's row so two miners racing for the
      // last seat cannot both read "room left".
      await lockUserRow(tx, squad.ownerId);
      const count = await tx.user.count({ where: { squadId: squad.id } });
      if (count >= squad.maxMembers) {
        throw new BadRequestException('That squad is full.');
      }
      await tx.user.update({
        where: { id: userId },
        data: { squadId: squad.id, squadJoinedAt: new Date() },
      });
      return squad.id;
    });
    this.cache.invalidate();
    return { squad: await this.describe(id, userId) };
  }

  async leave(userId: string): Promise<{ left: true }> {
    await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { squadId: true },
      });
      if (!me.squadId) throw new BadRequestException('You are not in a squad.');
      const squadId = me.squadId;

      const squad = await tx.squad.findUniqueOrThrow({
        where: { id: squadId },
        select: { ownerId: true },
      });
      if (squad.ownerId !== userId) await lockUserRow(tx, squad.ownerId);

      await tx.user.update({
        where: { id: userId },
        data: { squadId: null, squadJoinedAt: null },
      });

      if (squad.ownerId === userId) {
        const heir = await tx.user.findFirst({
          where: { squadId },
          orderBy: [{ squadJoinedAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        if (heir) {
          await tx.squad.update({ where: { id: squadId }, data: { ownerId: heir.id } });
        } else {
          await tx.squad.delete({ where: { id: squadId } });
        }
      }
    });
    this.cache.invalidate();
    return { left: true };
  }

  // ── Queries ───────────────────────────────────────────────────────────

  async mine(userId: string): Promise<{ squad: SquadDto | null }> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { squadId: true },
    });
    if (!me.squadId) return { squad: null };
    return { squad: await this.describe(me.squadId, userId) };
  }

  async leaderboard(): Promise<{ squads: SquadLeaderboardRow[] }> {
    return this.cache.wrap('leaderboard', async () => {
      const since = new Date(Date.now() - WEEK_MS);
      // Aggregate mining credits per squad over the last week. One grouped
      // query; the join to squads is done in memory since there are few.
      const rows = await this.prisma.$queryRaw<
        { squadId: string; earnedMilli: bigint; members: bigint }[]
      >(Prisma.sql`
        SELECT u."squadId" AS "squadId",
               COALESCE(SUM(l."deltaMilli"), 0)::bigint AS "earnedMilli",
               COUNT(DISTINCT u."id")::bigint AS "members"
        FROM "User" u
        LEFT JOIN "LedgerEntry" l
          ON l."userId" = u."id"
         AND l."reason" = 'MINING'
         AND l."createdAt" >= ${since}
        WHERE u."squadId" IS NOT NULL AND u."isBlocked" = false
        GROUP BY u."squadId"
        ORDER BY "earnedMilli" DESC, "squadId" ASC
        LIMIT ${LEADERBOARD_SIZE}
      `);
      const squads = await this.prisma.squad.findMany({
        where: { id: { in: rows.map((r) => r.squadId) } },
        select: { id: true, name: true },
      });
      const nameOf = new Map(squads.map((s) => [s.id, s.name]));
      return {
        squads: rows
          .filter((r) => nameOf.has(r.squadId))
          .map((r, i) => ({
            id: r.squadId,
            name: nameOf.get(r.squadId) ?? '',
            members: Number(r.members),
            earnedPoints: Number(r.earnedMilli) / MILLI,
            rank: i + 1,
          })),
      };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async describe(squadId: string, viewerId: string): Promise<SquadDto> {
    const now = new Date();
    const squad = await this.prisma.squad.findUniqueOrThrow({
      where: { id: squadId },
      include: {
        members: {
          orderBy: [{ squadJoinedAt: 'asc' }, { id: 'asc' }],
          select: { id: true, squadJoinedAt: true },
        },
      },
    });
    void viewerId;

    const event = await this.rig.activeEvent(now);
    const members = await Promise.all(
      squad.members.map(async (m) => {
        const [readout, lent] = await Promise.all([
          publicRigReadout(this.rig, this.prisma, m.id, now),
          this.rig.squadLoan(squadId, m.id, this.prisma, { now, event }),
        ]);
        return {
          id: m.id,
          name: readout.name,
          isOwner: m.id === squad.ownerId,
          joinedAt: m.squadJoinedAt,
          ratePerHour: readout.ratePerHour,
          gridStability: readout.gridStability,
          coolingSurplus: readout.telemetry.coolingSurplus,
          powerSurplus: readout.telemetry.powerSurplus,
          lent,
        };
      }),
    );

    const earned = await this.prisma.ledgerEntry.aggregate({
      where: {
        reason: 'MINING',
        createdAt: { gte: new Date(now.getTime() - WEEK_MS) },
        userId: { in: squad.members.map((m) => m.id) },
      },
      _sum: { deltaMilli: true },
    });

    return {
      id: squad.id,
      name: squad.name,
      code: squad.code,
      ownerId: squad.ownerId,
      maxMembers: squad.maxMembers,
      createdAt: squad.createdAt,
      members,
      pool: {
        coolingSurplus: members.reduce((s, m) => s + m.coolingSurplus, 0),
        powerSurplus: members.reduce((s, m) => s + m.powerSurplus, 0),
        coolingLent: members.reduce((s, m) => s + m.lent.cooling, 0),
        powerLent: members.reduce((s, m) => s + m.lent.power, 0),
      },
      earnedPoints7d: Number(earned._sum.deltaMilli ?? 0n) / MILLI,
    };
  }
}
