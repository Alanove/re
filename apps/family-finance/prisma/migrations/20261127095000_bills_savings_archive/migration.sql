-- AlterTable
ALTER TABLE "Category" ADD COLUMN "excludeFromSpending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "archivedAt" DATETIME;

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN "archivedAt" DATETIME;

-- AlterTable
ALTER TABLE "Forecast" ADD COLUMN "savingsAccountId" TEXT;
ALTER TABLE "Forecast" ADD COLUMN "archivedAt" DATETIME;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "billPaymentId" TEXT;

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "categoryId" TEXT,
    "endMonth" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bill_householdId_idx" ON "Bill"("householdId");

-- CreateIndex
CREATE INDEX "Bill_categoryId_idx" ON "Bill"("categoryId");

-- CreateIndex
CREATE INDEX "BillPayment_billId_idx" ON "BillPayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_billId_month_key" ON "BillPayment"("billId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_billPaymentId_key" ON "Expense"("billPaymentId");

-- CreateIndex
CREATE INDEX "Forecast_savingsAccountId_idx" ON "Forecast"("savingsAccountId");
