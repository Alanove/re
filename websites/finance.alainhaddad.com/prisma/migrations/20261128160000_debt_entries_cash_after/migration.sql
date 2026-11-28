-- AlterTable
ALTER TABLE `Income` ADD COLUMN `placeBalanceAfter` INTEGER NULL,
    ADD COLUMN `householdCashAfter` INTEGER NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `placeBalanceAfter` INTEGER NULL,
    ADD COLUMN `householdCashAfter` INTEGER NULL;

-- DropForeignKey
ALTER TABLE `Expense` DROP FOREIGN KEY `Expense_debtId_fkey`;

-- DropIndex
DROP INDEX `Expense_debtId_key` ON `Expense`;

-- CreateIndex
CREATE INDEX `Expense_debtId_idx` ON `Expense`(`debtId`);

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_debtId_fkey` FOREIGN KEY (`debtId`) REFERENCES `Debt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `MoneyTransfer` ADD COLUMN `fromPlaceBalanceAfter` INTEGER NULL,
    ADD COLUMN `toPlaceBalanceAfter` INTEGER NULL,
    ADD COLUMN `householdCashAfter` INTEGER NULL;

-- CreateTable
CREATE TABLE `DebtEntry` (
    `id` VARCHAR(191) NOT NULL,
    `debtId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `incomeId` VARCHAR(191) NULL,
    `expenseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DebtEntry_debtId_date_idx`(`debtId`, `date`),
    UNIQUE INDEX `DebtEntry_incomeId_key`(`incomeId`),
    UNIQUE INDEX `DebtEntry_expenseId_key`(`expenseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DebtEntry` ADD CONSTRAINT `DebtEntry_debtId_fkey` FOREIGN KEY (`debtId`) REFERENCES `Debt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebtEntry` ADD CONSTRAINT `DebtEntry_incomeId_fkey` FOREIGN KEY (`incomeId`) REFERENCES `Income`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebtEntry` ADD CONSTRAINT `DebtEntry_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
