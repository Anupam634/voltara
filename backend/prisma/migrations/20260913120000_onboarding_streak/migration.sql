-- Onboarding and retention: the free starter core, and the claim streak.
--
-- Additive. Existing miners get streakDays 0 and no loaner grant, which is
-- exactly right: they already have a rig, and their streak starts the next
-- time they tap.

ALTER TYPE "LedgerReason" ADD VALUE 'WELCOME';
ALTER TYPE "LedgerReason" ADD VALUE 'STREAK_BONUS';

ALTER TABLE "User"
  ADD COLUMN "streakDays"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bestStreakDays"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loanerGrantedAt" TIMESTAMP(3);
