-- The daily rig puzzle: one build problem a day, the same for everyone.
--
-- Additive. Nothing here touches the reward economy — a puzzle pays no
-- points and grants no parts, so an operator can drop both tables and the
-- only thing lost is a leaderboard.

CREATE TABLE "DailyPuzzle" (
  "id"              TEXT NOT NULL,
  "dayKey"          TEXT NOT NULL,
  "budgetUsd"       INTEGER NOT NULL,
  "targetHashMilli" INTEGER NOT NULL,
  "seed"            INTEGER NOT NULL,
  "startsAt"        TIMESTAMP(3) NOT NULL,
  "endsAt"          TIMESTAMP(3) NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyPuzzle_dayKey_key" ON "DailyPuzzle"("dayKey");
CREATE INDEX "DailyPuzzle_startsAt_endsAt_idx" ON "DailyPuzzle"("startsAt", "endsAt");

CREATE TABLE "DailySubmission" (
  "id"            TEXT NOT NULL,
  "puzzleId"      TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "partCodes"     JSONB NOT NULL,
  "costUsd"       INTEGER NOT NULL,
  "hashMilli"     INTEGER NOT NULL,
  "gridStability" INTEGER NOT NULL,
  "attempts"      INTEGER NOT NULL DEFAULT 1,
  "solvedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailySubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailySubmission_puzzleId_userId_key" ON "DailySubmission"("puzzleId", "userId");
CREATE INDEX "DailySubmission_puzzleId_costUsd_idx" ON "DailySubmission"("puzzleId", "costUsd");
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_puzzleId_fkey"
  FOREIGN KEY ("puzzleId") REFERENCES "DailyPuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
