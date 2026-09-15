-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- AlterTable: add severity column to SecurityReport with default MODERATE
ALTER TABLE "SecurityReport" ADD COLUMN "severity" "IncidentSeverity" NOT NULL DEFAULT 'MODERATE';
