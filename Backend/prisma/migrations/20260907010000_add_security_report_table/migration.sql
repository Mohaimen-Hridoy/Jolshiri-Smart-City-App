-- The SecurityReport model (used by both the SOS button and "Report an
-- Incident") was added to schema.prisma at some point but no migration was
-- ever generated for it — the baseline migration is empty (it just marks
-- "whatever already exists in prod, from the pre-migrations db-push days,
-- counts as applied") and none of the later migrations touch
-- SecurityReport. So `prisma migrate deploy` alone was never going to
-- create this table in production, which is why POST /api/security-reports
-- (both the SOS flow and Report an Incident) was throwing a Prisma
-- "table does not exist" error that fell through to the generic 500
-- "Something went wrong" handler.
--
-- Written with IF NOT EXISTS / guarded ADD COLUMN so this is safe to run
-- whether the table is completely missing, or happens to already exist
-- (e.g. someone ran `prisma db push` by hand as a workaround) but is
-- missing the block/latitude/longitude columns.

CREATE TABLE IF NOT EXISTS "SecurityReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT,
    "block" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "SecurityReport_pkey" PRIMARY KEY ("id")
);

-- In case the table already existed (e.g. created ad-hoc) without these
-- location columns.
ALTER TABLE "SecurityReport" ADD COLUMN IF NOT EXISTS "block" TEXT;
ALTER TABLE "SecurityReport" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "SecurityReport" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SecurityReport_reporterId_fkey'
    ) THEN
        ALTER TABLE "SecurityReport"
          ADD CONSTRAINT "SecurityReport_reporterId_fkey"
          FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
