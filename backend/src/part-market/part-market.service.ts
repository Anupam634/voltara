import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import { maskIdentity } from '../common/mask-identity';
import { RigService, installedDto } from '../rig/rig.service';
import { daysLeft, listable, MARKET_FEE_BP, MIN_DAYS_LEFT_TO_LIST, splitSale } from './market.rules';

/** Everything a listing row needs loaded to become a ListingDto. */
const listingInclude = {
  booster: { include: { plan: true } },
  seller: { select: { id: true, email: true } },
  buyer: { select: { id: true, email: true } },
} satisfies Prisma.PartListingInclude;

type ListingRow = Prisma.PartListingGetPayload<{ include: typeof listingInclude }>;

export interface ListingDto {
  id: string;
  status: string;
  priceVolts: number;
  createdAt: Date;
  soldAt: Date | null;
  seller: { id: string; name: string };
  buyer: { id: string; name: string } | null;
  part: ReturnType<typeof installedDto> & { daysLeft: number };
  mine: boolean;
}

/**
 * Player-to-player part trading.
 *
 * A miner sells an owned, idle part for VOLTS. The buyer's balance moves to
 * the seller minus a 5% cut, the Booster row changes hands, and the part
 * auto-installs on the buyer's rig if there is room — so a purchase here
 * behaves exactly like one from the shop.
 */
@Injectable()
export class PartMarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
  ) {}

  /** Open listings, newest first. */
  async browse(userId: string, kind?: string) {
    const rows = await this.prisma.partListing.findMany({
      where: {
        status: 'ACTIVE',
        ...(kind && { booster: { plan: { kind: kind as Prisma.EnumRigPartKindFilter['equals'] } } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: listingInclude,
    });
    return { listings: rows.map((r) => toDto(r, userId)), feeBp: MARKET_FEE_BP };
  }

  /** The caller's side of the market: what they are selling, sold, bought. */
  async mine(userId: string) {
    const [selling, sold, bought] = await Promise.all([
      this.prisma.partListing.findMany({
        where: { sellerId: userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: listingInclude,
      }),
      this.prisma.partListing.findMany({
        where: { sellerId: userId, status: 'SOLD' },
        orderBy: { soldAt: 'desc' },
        take: 50,
        include: listingInclude,
      }),
      this.prisma.partListing.findMany({
        where: { buyerId: userId, status: 'SOLD' },
        orderBy: { soldAt: 'desc' },
        take: 50,
        include: listingInclude,
      }),
    ]);
    return {
      selling: selling.map((r) => toDto(r, userId)),
      sold: sold.map((r) => toDto(r, userId)),
      bought: bought.map((r) => toDto(r, userId)),
    };
  }

  /** Put an idle part up for sale. */
  async list(userId: string, boosterId: string, priceVolts: number): Promise<ListingDto> {
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const part = await tx.booster.findUnique({
        where: { id: boosterId },
        include: { slot: true, listing: true },
      });
      if (!part || part.userId !== userId) {
        throw new BadRequestException('That part is not in your inventory.');
      }
      if (part.slot) {
        throw new BadRequestException('Remove the part from your rig before listing it.');
      }
      if (part.salvagedAt) {
        throw new BadRequestException('That part has been salvaged.');
      }
      if (part.disabledUntil && part.disabledUntil.getTime() > now.getTime()) {
        throw new BadRequestException('A burned part cannot be sold until it recovers.');
      }
      if (part.listing && part.listing.status === 'ACTIVE') {
        throw new BadRequestException('That part is already listed.');
      }
      if (!listable(part.expiresAt, now)) {
        throw new BadRequestException(
          `A part needs more than ${MIN_DAYS_LEFT_TO_LIST} days left to be listed.`,
        );
      }

      // A previous SOLD/CANCELLED listing row still holds the unique
      // boosterId; recycle it rather than fighting the constraint.
      const data = {
        sellerId: userId,
        buyerId: null,
        priceMilli: BigInt(priceVolts) * 1000n,
        status: 'ACTIVE' as const,
        soldAt: null,
        createdAt: now,
      };
      return part.listing
        ? tx.partListing.update({ where: { id: part.listing.id }, data, include: listingInclude })
        : tx.partListing.create({ data: { ...data, boosterId }, include: listingInclude });
    });
    return toDto(row, userId);
  }

  /** Take a listing down. Only the seller, only while it is still open. */
  async cancel(userId: string, listingId: string): Promise<ListingDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.partListing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found.');
      if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing.');
      if (listing.status !== 'ACTIVE') {
        throw new BadRequestException('That listing is no longer open.');
      }
      return tx.partListing.update({
        where: { id: listingId },
        data: { status: 'CANCELLED' },
        include: listingInclude,
      });
    });
    return toDto(row, userId);
  }

  /**
   * Buy a listed part.
   *
   * Both users' rows are locked (in id order so two crossed purchases cannot
   * deadlock) and the whole exchange — debit, credit, fee record, ownership
   * transfer, auto-install — commits or rolls back as one.
   */
  async buy(userId: string, listingId: string): Promise<{ listing: ListingDto; slot: number | null }> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const peek = await tx.partListing.findUnique({
        where: { id: listingId },
        select: { sellerId: true },
      });
      if (!peek) throw new NotFoundException('Listing not found.');
      if (peek.sellerId === userId) {
        throw new BadRequestException('You cannot buy your own listing.');
      }

      for (const id of [userId, peek.sellerId].sort()) {
        await lockUserRow(tx, id);
      }

      const listing = await tx.partListing.findUniqueOrThrow({
        where: { id: listingId },
        include: { booster: { include: { slot: true } } },
      });
      if (listing.status !== 'ACTIVE') {
        throw new BadRequestException('That part has already been sold.');
      }
      if (listing.booster.expiresAt.getTime() <= now.getTime()) {
        await tx.partListing.update({ where: { id: listingId }, data: { status: 'CANCELLED' } });
        throw new BadRequestException('That part burned out before it could be sold.');
      }
      if (listing.booster.slot) {
        // Should be impossible — listing requires an idle part — but a sale
        // must never evict something the seller has since installed.
        throw new BadRequestException('The seller is running that part; it cannot be sold.');
      }

      const buyer = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { pointsBalance: true },
      });
      if (buyer.pointsBalance < listing.priceMilli) {
        throw new BadRequestException(
          `You need ${Number(listing.priceMilli) / 1000} VOLTS for this part.`,
        );
      }

      const { sellerMilli, feeMilli } = splitSale(listing.priceMilli);

      await tx.user.update({
        where: { id: userId },
        data: { pointsBalance: { decrement: listing.priceMilli } },
      });
      await tx.user.update({
        where: { id: listing.sellerId },
        data: { pointsBalance: { increment: sellerMilli } },
      });
      await tx.ledgerEntry.createMany({
        data: [
          {
            userId,
            reason: 'PART_BUY',
            deltaMilli: -listing.priceMilli,
            meta: { listingId, boosterId: listing.boosterId, sellerId: listing.sellerId },
          },
          {
            userId: listing.sellerId,
            reason: 'PART_SALE',
            deltaMilli: sellerMilli,
            meta: { listingId, boosterId: listing.boosterId, buyerId: userId, feeMilli: Number(feeMilli) },
          },
          {
            // Balance-neutral: the fee is what the seller never received.
            userId: listing.sellerId,
            reason: 'MARKET_FEE',
            deltaMilli: 0n,
            meta: { listingId, feeMilli: Number(feeMilli), feeBp: MARKET_FEE_BP },
          },
        ],
      });

      await tx.booster.update({
        where: { id: listing.boosterId },
        data: { userId, source: 'TRADE' },
      });
      const updated = await tx.partListing.update({
        where: { id: listingId },
        data: { status: 'SOLD', buyerId: userId, soldAt: now },
        include: listingInclude,
      });

      const slot = await this.rig.autoInstall(tx, userId, listing.boosterId);
      return { row: updated, slot };
    });

    return { listing: toDto(result.row, userId), slot: result.slot };
  }
}

function toDto(row: ListingRow, viewerId: string): ListingDto {
  const part = installedDto(row.booster, row.booster.plan, null);
  return {
    id: row.id,
    status: row.status,
    priceVolts: Number(row.priceMilli) / 1000,
    createdAt: row.createdAt,
    soldAt: row.soldAt,
    seller: { id: row.seller.id, name: maskIdentity(row.seller) },
    buyer: row.buyer ? { id: row.buyer.id, name: maskIdentity(row.buyer) } : null,
    part: { ...part, daysLeft: daysLeft(row.booster.expiresAt) },
    mine: row.sellerId === viewerId,
  };
}
