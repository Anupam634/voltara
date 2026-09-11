/**
 * Pure rules for the player-to-player part market.
 *
 * Kept free of Prisma so the fee split can be unit tested exactly: every
 * milli-point of a sale must land either with the seller or in the fee, and
 * the two must add back up to the price.
 */

/** Platform cut on every sale, basis points. 500 = 5%. */
export const MARKET_FEE_BP = 500;

/** A part must have at least this long left to be listed. */
export const MIN_DAYS_LEFT_TO_LIST = 3;

export const MIN_PRICE_VOLTS = 1;
export const MAX_PRICE_VOLTS = 100_000;

/** Split a sale price into what the seller receives and what the platform keeps. */
export function splitSale(priceMilli: bigint): {
  sellerMilli: bigint;
  feeMilli: bigint;
} {
  const feeMilli = (priceMilli * BigInt(MARKET_FEE_BP)) / 10_000n;
  return { sellerMilli: priceMilli - feeMilli, feeMilli };
}

/** Whole days until `expiresAt`, floored, never negative. */
export function daysLeft(expiresAt: Date, now = new Date()): number {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Whether a part has enough life left to be worth someone's VOLTS. */
export function listable(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() > MIN_DAYS_LEFT_TO_LIST * 86_400_000;
}
