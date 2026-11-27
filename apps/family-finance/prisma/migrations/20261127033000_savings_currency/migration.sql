-- AlterTable
ALTER TABLE "SavingsAccount" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

-- Backfill from household books currency when available
UPDATE "SavingsAccount"
SET "currency" = (
  SELECT COALESCE(NULLIF("Household"."booksCurrency", ''), "Household"."currency", 'USD')
  FROM "Household"
  WHERE "Household"."id" = "SavingsAccount"."householdId"
);
