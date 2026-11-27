-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FxRate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayslipTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Payslip',
    "salaryCurrency" TEXT NOT NULL DEFAULT 'LBP',
    "companyBps" INTEGER NOT NULL DEFAULT 600,
    "srspBps" INTEGER NOT NULL DEFAULT 600,
    "srspBase" TEXT NOT NULL DEFAULT 'BASIC',
    "appearFromDay" INTEGER NOT NULL DEFAULT 24,
    "savingsAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayslipTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayslipTemplate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayslipTemplate_savingsAccountId_fkey" FOREIGN KEY ("savingsAccountId") REFERENCES "SavingsAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startMonth" TEXT,
    "endMonth" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PayslipLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PayslipTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayslipReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "fxFromCurrency" TEXT NOT NULL,
    "fxToCurrency" TEXT NOT NULL,
    "fxRateUsed" TEXT NOT NULL,
    "netPaidSalary" BIGINT NOT NULL,
    "netPaidBooks" INTEGER NOT NULL,
    "srspSalary" BIGINT NOT NULL,
    "srspBooks" INTEGER NOT NULL,
    "companyBooks" INTEGER NOT NULL,
    "incomeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayslipReceipt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PayslipTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayslipReceipt_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayslipReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    CONSTRAINT "PayslipReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PayslipReceipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantityMg" BIGINT NOT NULL DEFAULT 0,
    "unitPricePerGram" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingsAccount_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingsTxn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "receiptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingsTxn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SavingsAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingsTxn_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PayslipReceipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "booksCurrency" TEXT NOT NULL DEFAULT 'USD',
    "displayCurrency" TEXT NOT NULL DEFAULT 'USD',
    "entryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "invoiceTaxBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Household" ("createdAt", "currency", "id", "invoiceTaxBps", "name", "updatedAt") SELECT "createdAt", "currency", "id", "invoiceTaxBps", "name", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FxRate_householdId_idx" ON "FxRate"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_householdId_fromCurrency_toCurrency_key" ON "FxRate"("householdId", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "PayslipTemplate_householdId_idx" ON "PayslipTemplate"("householdId");

-- CreateIndex
CREATE INDEX "PayslipTemplate_memberId_idx" ON "PayslipTemplate"("memberId");

-- CreateIndex
CREATE INDEX "PayslipLine_templateId_idx" ON "PayslipLine"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipLine_templateId_code_key" ON "PayslipLine"("templateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipReceipt_incomeId_key" ON "PayslipReceipt"("incomeId");

-- CreateIndex
CREATE INDEX "PayslipReceipt_templateId_idx" ON "PayslipReceipt"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipReceipt_templateId_month_key" ON "PayslipReceipt"("templateId", "month");

-- CreateIndex
CREATE INDEX "PayslipReceiptLine_receiptId_idx" ON "PayslipReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "SavingsAccount_householdId_idx" ON "SavingsAccount"("householdId");

-- CreateIndex
CREATE INDEX "SavingsTxn_accountId_idx" ON "SavingsTxn"("accountId");

-- CreateIndex
CREATE INDEX "SavingsTxn_receiptId_idx" ON "SavingsTxn"("receiptId");
