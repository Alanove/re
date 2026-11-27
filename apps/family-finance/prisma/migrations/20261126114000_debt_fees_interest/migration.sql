-- AlterTable
ALTER TABLE "Debt" ADD COLUMN "principal" INTEGER;
ALTER TABLE "Debt" ADD COLUMN "feeFixed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Debt" ADD COLUMN "monthlyInterestBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Debt" ADD COLUMN "lastInterestMonth" TEXT;

-- Backfill principal from amount for existing rows
UPDATE "Debt" SET "principal" = "amount" WHERE "principal" IS NULL;

-- Make principal required
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "feeFixed" INTEGER NOT NULL DEFAULT 0,
    "monthlyInterestBps" INTEGER NOT NULL DEFAULT 0,
    "lastInterestMonth" TEXT,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Debt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Debt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("id", "householdId", "memberId", "person", "principal", "amount", "feeFixed", "monthlyInterestBps", "lastInterestMonth", "date", "note", "createdAt", "updatedAt")
SELECT "id", "householdId", "memberId", "person", COALESCE("principal", "amount"), "amount", "feeFixed", "monthlyInterestBps", "lastInterestMonth", "date", "note", "createdAt", "updatedAt" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE INDEX "Debt_householdId_idx" ON "Debt"("householdId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- AlterTable DebtRepayment.kind
ALTER TABLE "DebtRepayment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'REPAY';
