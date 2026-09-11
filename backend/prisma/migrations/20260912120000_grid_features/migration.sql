-- VOLTARA grid features: events, overclock, salvage, skins, squads, duels,
-- the part marketplace and the weekly blueprint challenge.
--
-- Everything is additive. New columns default to "off", so a database
-- mid-deploy keeps behaving exactly as before until a feature is used.

-- ── Enums ───────────────────────────────────────────────────────────────
CREATE TYPE "BoosterSource" AS ENUM ('PURCHASE', 'LOANER', 'REFERRAL', 'CRAFT', 'TRADE', 'CHALLENGE');
CREATE TYPE "DuelStatus" AS ENUM ('OPEN', 'ACTIVE', 'SETTLED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

ALTER TYPE "LedgerReason" ADD VALUE 'DUEL_WIN';
ALTER TYPE "LedgerReason" ADD VALUE 'DUEL_LOSS';
ALTER TYPE "LedgerReason" ADD VALUE 'PART_SALE';
ALTER TYPE "LedgerReason" ADD VALUE 'PART_BUY';
ALTER TYPE "LedgerReason" ADD VALUE 'MARKET_FEE';
ALTER TYPE "LedgerReason" ADD VALUE 'SKIN_PURCHASE';
ALTER TYPE "LedgerReason" ADD VALUE 'CHALLENGE_REWARD';

-- ── User ────────────────────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN "overclockUntil"      TIMESTAMP(3),
  ADD COLUMN "overclockNextRollAt" TIMESTAMP(3),
  ADD COLUMN "scrap"               INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rigSkin"             TEXT NOT NULL DEFAULT 'stock',
  ADD COLUMN "squadId"             TEXT,
  ADD COLUMN "squadJoinedAt"       TIMESTAMP(3);

CREATE INDEX "User_squadId_idx" ON "User"("squadId");

-- ── Booster ─────────────────────────────────────────────────────────────
ALTER TABLE "Booster"
  ADD COLUMN "source"        "BoosterSource" NOT NULL DEFAULT 'PURCHASE',
  ADD COLUMN "disabledUntil" TIMESTAMP(3),
  ADD COLUMN "salvagedAt"    TIMESTAMP(3);

-- ── GridEvent ───────────────────────────────────────────────────────────
CREATE TABLE "GridEvent" (
  "id"         TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "heatMultBp" INTEGER NOT NULL DEFAULT 10000,
  "drawMultBp" INTEGER NOT NULL DEFAULT 10000,
  "hashMultBp" INTEGER NOT NULL DEFAULT 10000,
  "startsAt"   TIMESTAMP(3) NOT NULL,
  "endsAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GridEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GridEvent_startsAt_endsAt_idx" ON "GridEvent"("startsAt", "endsAt");

-- ── Squad ───────────────────────────────────────────────────────────────
CREATE TABLE "Squad" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "ownerId"    TEXT NOT NULL,
  "maxMembers" INTEGER NOT NULL DEFAULT 5,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Squad_code_key" ON "Squad"("code");
CREATE INDEX "Squad_ownerId_idx" ON "Squad"("ownerId");
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_squadId_fkey"
  FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Duel ────────────────────────────────────────────────────────────────
CREATE TABLE "Duel" (
  "id"                   TEXT NOT NULL,
  "code"                 TEXT NOT NULL,
  "challengerId"         TEXT NOT NULL,
  "opponentId"           TEXT,
  "status"               "DuelStatus" NOT NULL DEFAULT 'OPEN',
  "stakeBp"              INTEGER NOT NULL DEFAULT 1000,
  "startsAt"             TIMESTAMP(3),
  "endsAt"               TIMESTAMP(3),
  "challengerScoreMilli" BIGINT,
  "opponentScoreMilli"   BIGINT,
  "winnerId"             TEXT,
  "transferMilli"        BIGINT,
  "settledAt"            TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Duel_code_key" ON "Duel"("code");
CREATE INDEX "Duel_challengerId_idx" ON "Duel"("challengerId");
CREATE INDEX "Duel_opponentId_idx" ON "Duel"("opponentId");
CREATE INDEX "Duel_status_endsAt_idx" ON "Duel"("status", "endsAt");
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey"
  FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey"
  FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_winnerId_fkey"
  FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PartListing ─────────────────────────────────────────────────────────
CREATE TABLE "PartListing" (
  "id"         TEXT NOT NULL,
  "boosterId"  TEXT NOT NULL,
  "sellerId"   TEXT NOT NULL,
  "buyerId"    TEXT,
  "priceMilli" BIGINT NOT NULL,
  "status"     "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "soldAt"     TIMESTAMP(3),
  CONSTRAINT "PartListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartListing_boosterId_key" ON "PartListing"("boosterId");
CREATE INDEX "PartListing_status_createdAt_idx" ON "PartListing"("status", "createdAt");
CREATE INDEX "PartListing_sellerId_idx" ON "PartListing"("sellerId");
ALTER TABLE "PartListing" ADD CONSTRAINT "PartListing_boosterId_fkey"
  FOREIGN KEY ("boosterId") REFERENCES "Booster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartListing" ADD CONSTRAINT "PartListing_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartListing" ADD CONSTRAINT "PartListing_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── UserSkin ────────────────────────────────────────────────────────────
CREATE TABLE "UserSkin" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "skin"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSkin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSkin_userId_skin_key" ON "UserSkin"("userId", "skin");
ALTER TABLE "UserSkin" ADD CONSTRAINT "UserSkin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Challenge ───────────────────────────────────────────────────────────
CREATE TABLE "Challenge" (
  "id"               TEXT NOT NULL,
  "weekKey"          TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "body"             TEXT NOT NULL,
  "targetHashMilli"  INTEGER NOT NULL,
  "startsAt"         TIMESTAMP(3) NOT NULL,
  "endsAt"           TIMESTAMP(3) NOT NULL,
  "rewardsGrantedAt" TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Challenge_weekKey_key" ON "Challenge"("weekKey");
CREATE INDEX "Challenge_startsAt_endsAt_idx" ON "Challenge"("startsAt", "endsAt");

CREATE TABLE "ChallengeSubmission" (
  "id"            TEXT NOT NULL,
  "challengeId"   TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "partCodes"     JSONB NOT NULL,
  "costUsd"       INTEGER NOT NULL,
  "hashMilli"     INTEGER NOT NULL,
  "gridStability" INTEGER NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChallengeSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeSubmission_challengeId_userId_key" ON "ChallengeSubmission"("challengeId", "userId");
CREATE INDEX "ChallengeSubmission_challengeId_costUsd_idx" ON "ChallengeSubmission"("challengeId", "costUsd");
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
