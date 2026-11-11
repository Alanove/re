/**
 * Shared rules for transactions that are bookkeeping-only and therefore hidden
 * from the main transactions list and reports, while still affecting account balances.
 */

export const WALLET_ADJUSTMENT_CATEGORY_NAME = 'Wallet Adjustment';

export interface ReportFilterableTransaction {
    categoryName?: string | null;
    description?: string | null;
}

export function isTransferTransaction(transaction: ReportFilterableTransaction): boolean {
    const categoryName = (transaction.categoryName || '').toLowerCase();
    const description = (transaction.description || '').toLowerCase();
    return categoryName.includes('transfer') || description.includes('transfer');
}

export function isWalletAdjustmentTransaction(transaction: ReportFilterableTransaction): boolean {
    return (transaction.categoryName || '').toLowerCase() === WALLET_ADJUSTMENT_CATEGORY_NAME.toLowerCase();
}

export function isHiddenFromReports(transaction: ReportFilterableTransaction): boolean {
    return isTransferTransaction(transaction) || isWalletAdjustmentTransaction(transaction);
}
