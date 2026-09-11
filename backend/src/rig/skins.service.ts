import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import { findSkin, SKIN_CATALOG, STOCK_SKIN } from './skins.catalog';

export interface SkinDto {
  id: string;
  name: string;
  priceVolts: number;
  description: string;
  accent: string;
  owned: boolean;
  equipped: boolean;
}

/**
 * Chassis skins: a VOLTS sink that changes nothing about output. Bought
 * once, equipped freely afterwards.
 */
@Injectable()
export class SkinsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [user, owned] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rigSkin: true },
      }),
      this.prisma.userSkin.findMany({
        where: { userId },
        select: { skin: true },
      }),
    ]);
    const ownedSet = new Set([STOCK_SKIN, ...owned.map((o) => o.skin)]);
    const equipped = ownedSet.has(user.rigSkin) ? user.rigSkin : STOCK_SKIN;
    return {
      equipped,
      owned: SKIN_CATALOG.filter((s) => ownedSet.has(s.id)).map((s) => s.id),
      catalog: SKIN_CATALOG.map<SkinDto>((s) => ({
        ...s,
        owned: ownedSet.has(s.id),
        equipped: s.id === equipped,
      })),
    };
  }

  /** Buy a skin with VOLTS. Balance is checked under the user's row lock. */
  async buy(userId: string, skinId: string) {
    const skin = findSkin(skinId);
    if (!skin) throw new BadRequestException('Unknown skin.');
    if (skin.id === STOCK_SKIN) {
      throw new BadRequestException('The stock chassis is already yours.');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const already = await tx.userSkin.findUnique({
        where: { userId_skin: { userId, skin: skin.id } },
      });
      if (already) throw new BadRequestException('You already own that skin.');

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { pointsBalance: true },
      });
      const priceMilli = BigInt(skin.priceVolts) * 1000n;
      if (user.pointsBalance < priceMilli) {
        throw new BadRequestException(
          `That skin costs ${skin.priceVolts} VOLTS. Mine a little more first.`,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: { pointsBalance: { decrement: priceMilli } },
      });
      await tx.userSkin.create({ data: { userId, skin: skin.id } });
      await tx.ledgerEntry.create({
        data: {
          userId,
          reason: 'SKIN_PURCHASE',
          deltaMilli: -priceMilli,
          meta: { skin: skin.id, priceVolts: skin.priceVolts },
        },
      });
    });

    return this.list(userId);
  }

  /** Put an owned skin on the chassis. */
  async equip(userId: string, skinId: string) {
    const skin = findSkin(skinId);
    if (!skin) throw new BadRequestException('Unknown skin.');

    if (skin.id !== STOCK_SKIN) {
      const owned = await this.prisma.userSkin.findUnique({
        where: { userId_skin: { userId, skin: skin.id } },
      });
      if (!owned) throw new BadRequestException('You do not own that skin.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { rigSkin: skin.id },
    });
    return this.list(userId);
  }
}
