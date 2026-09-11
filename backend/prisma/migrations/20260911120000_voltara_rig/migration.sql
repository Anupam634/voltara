-- VOLTARA rigs: parts, slots, and the chassis every miner runs them on.
--
-- A booster used to be a number that was added to a rate and cost nothing to
-- run. It is now a PART with heat, draw and supply, and it only earns while
-- it is installed in a slot. Everything here is additive, so a database mid-
-- deploy keeps working: the new columns default to "free to run", and the
-- backfill below puts every booster a miner already owns into a slot with
-- enough chassis headroom that their rate does not move.

-- ── Part catalogue ──────────────────────────────────────────────────────
CREATE TYPE "RigPartKind" AS ENUM ('CORE', 'COOLER', 'PSU', 'MODULE');

ALTER TABLE "BoosterPlan"
  ADD COLUMN "code"          TEXT,
  ADD COLUMN "name"          TEXT,
  ADD COLUMN "kind"          "RigPartKind" NOT NULL DEFAULT 'CORE',
  ADD COLUMN "heat"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cooling"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "watts"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wattsSupplied" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "hashBoostBp"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tier"          INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "BoosterPlan_code_key" ON "BoosterPlan"("code");

-- Name and stamp the four plans that shipped before parts existed, so the
-- seed matches them on `code` instead of inserting a second $1 part. Their
-- running costs are set here too — the grandfathering below pays for them.
UPDATE "BoosterPlan" SET "code" = 'VC1',  "name" = 'VC-1 Volt Core',    "kind" = 'CORE', "tier" = 1, "heat" = 10,  "watts" = 45  WHERE "priceUsd" = 1  AND "code" IS NULL;
UPDATE "BoosterPlan" SET "code" = 'VC5',  "name" = 'VC-5 Arc Core',     "kind" = 'CORE', "tier" = 2, "heat" = 26,  "watts" = 110 WHERE "priceUsd" = 5  AND "code" IS NULL;
UPDATE "BoosterPlan" SET "code" = 'VC10', "name" = 'VC-10 Plasma Core', "kind" = 'CORE', "tier" = 3, "heat" = 48,  "watts" = 200 WHERE "priceUsd" = 10 AND "code" IS NULL;
UPDATE "BoosterPlan" SET "code" = 'VC50', "name" = 'VC-50 Fusion Core', "kind" = 'CORE', "tier" = 5, "heat" = 190, "watts" = 760 WHERE "priceUsd" = 50 AND "code" IS NULL;

-- ── Chassis ─────────────────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN "rigSlots"        INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "rigCoolingBonus" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rigPowerBonus"   INTEGER NOT NULL DEFAULT 0;

-- ── Slots ───────────────────────────────────────────────────────────────
CREATE TABLE "RigSlot" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "index"       INTEGER NOT NULL,
  "boosterId"   TEXT NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RigSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RigSlot_boosterId_key" ON "RigSlot"("boosterId");
CREATE UNIQUE INDEX "RigSlot_userId_index_key" ON "RigSlot"("userId", "index");
CREATE INDEX "RigSlot_userId_idx" ON "RigSlot"("userId");

ALTER TABLE "RigSlot" ADD CONSTRAINT "RigSlot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RigSlot" ADD CONSTRAINT "RigSlot_boosterId_fkey"
  FOREIGN KEY ("boosterId") REFERENCES "Booster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Grandfathering ──────────────────────────────────────────────────────
-- Install every unexpired booster a miner already owns, oldest first, and
-- widen their chassis to cover exactly what those parts now cost to run.
-- Someone who paid for a $50 booster under the old rules keeps the rate they
-- paid for; the cost of cooling and powering it only applies to what they
-- buy next. Miners over the six-slot limit keep their six oldest parts
-- earning and find the rest waiting in inventory.
WITH ranked AS (
  SELECT b."id",
         b."userId",
         ROW_NUMBER() OVER (PARTITION BY b."userId" ORDER BY b."startedAt", b."id") - 1 AS slot_index
  FROM "Booster" b
  WHERE b."expiresAt" > NOW()
)
INSERT INTO "RigSlot" ("id", "userId", "index", "boosterId", "installedAt")
SELECT md5(random()::text || clock_timestamp()::text), r."userId", r.slot_index, r."id", NOW()
FROM ranked r
WHERE r.slot_index < 6;

WITH installed AS (
  SELECT s."userId",
         COALESCE(SUM(p."heat"), 0)  AS heat,
         COALESCE(SUM(p."watts"), 0) AS watts
  FROM "RigSlot" s
  JOIN "Booster"     b ON b."id" = s."boosterId"
  JOIN "BoosterPlan" p ON p."id" = b."planId"
  GROUP BY s."userId"
)
UPDATE "User" u
SET "rigCoolingBonus" = GREATEST(0, i.heat  - 12),
    "rigPowerBonus"   = GREATEST(0, i.watts - 120)
FROM installed i
WHERE i."userId" = u."id";
