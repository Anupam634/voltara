-- Weekly leaderboard seasons, with a VOLTS prize pool.
--
-- Additive. Nothing existing changes: the leaderboard keeps computing its
-- rolling boards from the ledger, and a season is a separate record of one
-- fixed Monday-to-Monday window and what it paid.
--
-- Prizes are VOLTS, not $VLTR. The token is not on-chain until launch and
-- payouts are gated until then (SPEC §4), so a $VLTR pool would be an IOU.

ALTER TYPE "LedgerReason" ADD VALUE 'SEASON_REWARD';

CREATE TABLE "Season" (
  "id"        TEXT NOT NULL,
  "weekKey"   TEXT NOT NULL,
  "startsAt"  TIMESTAMP(3) NOT NULL,
  "endsAt"    TIMESTAMP(3) NOT NULL,
  "closedAt"  TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- The week key is the idempotency key for the close job: two instances that
-- both wake at 00:10 on Monday must not create two rows for one week, and a
-- retry must find the closed row rather than pay it again.
CREATE UNIQUE INDEX "Season_weekKey_key" ON "Season"("weekKey");
CREATE INDEX "Season_startsAt_endsAt_idx" ON "Season"("startsAt", "endsAt");

CREATE TABLE "SeasonAward" (
  "id"          TEXT NOT NULL,
  "seasonId"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "rank"        INTEGER NOT NULL,
  "earnedMilli" BIGINT NOT NULL,
  "prizeMilli"  BIGINT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonAward_pkey" PRIMARY KEY ("id")
);

-- One place per miner per season — the second half of the idempotency guard.
CREATE UNIQUE INDEX "SeasonAward_seasonId_userId_key" ON "SeasonAward"("seasonId", "userId");
CREATE INDEX "SeasonAward_userId_idx" ON "SeasonAward"("userId");
CREATE INDEX "SeasonAward_seasonId_rank_idx" ON "SeasonAward"("seasonId", "rank");

ALTER TABLE "SeasonAward" ADD CONSTRAINT "SeasonAward_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonAward" ADD CONSTRAINT "SeasonAward_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
