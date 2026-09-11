-- Apprenticeship: a veteran mentoring a newcomer.
--
-- Additive. No existing row changes, and the mentor's cut is newly minted
-- rather than deducted, so nothing about an existing miner's balance or
-- history is touched by this migration.

CREATE TYPE "ApprenticeshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

ALTER TYPE "LedgerReason" ADD VALUE 'MENTOR_CUT';

CREATE TABLE "Apprenticeship" (
  "id"           TEXT NOT NULL,
  "mentorId"     TEXT NOT NULL,
  "apprenticeId" TEXT NOT NULL,
  "status"       "ApprenticeshipStatus" NOT NULL DEFAULT 'PENDING',
  "mentorCutBp"  INTEGER NOT NULL DEFAULT 500,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"   TIMESTAMP(3),
  "endedAt"      TIMESTAMP(3),
  CONSTRAINT "Apprenticeship_pkey" PRIMARY KEY ("id")
);

-- One mentor per apprentice. The unique index is the rule, not a convention:
-- two mentors racing to adopt the same newcomer must lose in the database,
-- not only in the service.
CREATE UNIQUE INDEX "Apprenticeship_apprenticeId_key" ON "Apprenticeship"("apprenticeId");
CREATE INDEX "Apprenticeship_mentorId_status_idx" ON "Apprenticeship"("mentorId", "status");
CREATE INDEX "Apprenticeship_status_idx" ON "Apprenticeship"("status");

ALTER TABLE "Apprenticeship" ADD CONSTRAINT "Apprenticeship_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Apprenticeship" ADD CONSTRAINT "Apprenticeship_apprenticeId_fkey"
  FOREIGN KEY ("apprenticeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
