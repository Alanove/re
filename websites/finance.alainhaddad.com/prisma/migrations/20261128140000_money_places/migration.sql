-- CreateTable
CREATE TABLE `MoneyPlace` (
    `id` VARCHAR(191) NOT NULL,
    `householdId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `openingBalance` INTEGER NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MoneyPlace_memberId_key`(`memberId`),
    INDEX `MoneyPlace_householdId_idx`(`householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoneyTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `householdId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `fromPlaceId` VARCHAR(191) NOT NULL,
    `toPlaceId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MoneyTransfer_householdId_date_idx`(`householdId`, `date`),
    INDEX `MoneyTransfer_fromPlaceId_idx`(`fromPlaceId`),
    INDEX `MoneyTransfer_toPlaceId_idx`(`toPlaceId`),
    INDEX `MoneyTransfer_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Income` ADD COLUMN `moneyPlaceId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `moneyPlaceId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Income` ADD CONSTRAINT `Income_moneyPlaceId_fkey` FOREIGN KEY (`moneyPlaceId`) REFERENCES `MoneyPlace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_moneyPlaceId_fkey` FOREIGN KEY (`moneyPlaceId`) REFERENCES `MoneyPlace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyPlace` ADD CONSTRAINT `MoneyPlace_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyPlace` ADD CONSTRAINT `MoneyPlace_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyTransfer` ADD CONSTRAINT `MoneyTransfer_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyTransfer` ADD CONSTRAINT `MoneyTransfer_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyTransfer` ADD CONSTRAINT `MoneyTransfer_fromPlaceId_fkey` FOREIGN KEY (`fromPlaceId`) REFERENCES `MoneyPlace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyTransfer` ADD CONSTRAINT `MoneyTransfer_toPlaceId_fkey` FOREIGN KEY (`toPlaceId`) REFERENCES `MoneyPlace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `Income_moneyPlaceId_idx` ON `Income`(`moneyPlaceId`);

-- CreateIndex
CREATE INDEX `Expense_moneyPlaceId_idx` ON `Expense`(`moneyPlaceId`);
