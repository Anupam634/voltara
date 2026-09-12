-- One row per browsing session on the public site. See schema.prisma for why
-- this is sessionStorage-scoped rather than a cookie.
CREATE TABLE "VisitSession" (
    "id" VARCHAR(40) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locale" VARCHAR(8),
    "path" VARCHAR(160),
    "referrer" VARCHAR(120),

    CONSTRAINT "VisitSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitSession_startedAt_idx" ON "VisitSession"("startedAt");
