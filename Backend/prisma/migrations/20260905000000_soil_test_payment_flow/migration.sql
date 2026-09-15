-- Soil test flow now runs through a payment step:
-- REQUESTED -> PERMIT_GRANTED -> PAYMENT_DONE -> COMPLETED (REJECTED can
-- follow REQUESTED or PERMIT_GRANTED).

-- Create SoilTestStatus if it does not exist yet (shadow DB path)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SoilTestStatus') THEN
    CREATE TYPE "SoilTestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'REJECTED');
  END IF;
END $$;

-- Create PaymentPurpose if it does not exist yet (shadow DB path)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentPurpose') THEN
    CREATE TYPE "PaymentPurpose" AS ENUM ('CONSULTATION_FEE', 'DEVELOPMENT_AGREEMENT');
  END IF;
END $$;

-- Reuse the old "SCHEDULED" value as "PERMIT_GRANTED" (same meaning: the
-- Authority has accepted the application), then add the new PAYMENT_DONE
-- state in between it and COMPLETED.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SoilTestStatus' AND e.enumlabel = 'SCHEDULED'
  ) THEN
    ALTER TYPE "SoilTestStatus" RENAME VALUE 'SCHEDULED' TO 'PERMIT_GRANTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SoilTestStatus' AND e.enumlabel = 'PAYMENT_DONE'
  ) THEN
    ALTER TYPE "SoilTestStatus" ADD VALUE 'PAYMENT_DONE';
  END IF;
END $$;

-- New payment purpose for the soil test fee raised once a permit is granted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PaymentPurpose' AND e.enumlabel = 'SOIL_TEST_FEE'
  ) THEN
    ALTER TYPE "PaymentPurpose" ADD VALUE 'SOIL_TEST_FEE';
  END IF;
END $$;

-- Link a soil test application to the PaymentRecord created for its fee.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SoilTestApplication' AND column_name = 'paymentId'
  ) THEN
    ALTER TABLE "SoilTestApplication" ADD COLUMN "paymentId" TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SoilTestApplication_paymentId_key" ON "SoilTestApplication"("paymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SoilTestApplication_paymentId_fkey'
  ) THEN
    ALTER TABLE "SoilTestApplication"
      ADD CONSTRAINT "SoilTestApplication_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;