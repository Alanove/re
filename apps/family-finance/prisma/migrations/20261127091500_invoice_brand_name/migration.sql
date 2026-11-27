-- AlterTable
ALTER TABLE "Household" ADD COLUMN "invoiceBrandName" TEXT NOT NULL DEFAULT 'Liteweb';

-- Existing rows already get the DEFAULT; keep explicit for clarity
UPDATE "Household" SET "invoiceBrandName" = 'Liteweb' WHERE "invoiceBrandName" IS NULL OR "invoiceBrandName" = '';
