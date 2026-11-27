import { addMonths } from "@/lib/utils";

export type DebtChargeKind = "REPAY" | "INTEREST";

export type DebtLike = {
  amount: number;
  principal: number;
  feeFixed: number;
  monthlyInterestBps: number;
  lastInterestMonth: string | null;
  date: string;
  repayments: Array<{ amount: number; kind: string }>;
};

/** Cash received when borrowing: principal − one-time fee. */
export function netReceived(principal: number, feeFixed: number): number {
  return Math.max(0, principal - Math.max(0, feeFixed));
}

/** Remaining owed from current balance (amount is the live balance). */
export function debtBalance(debt: { amount: number }): number {
  return Math.max(0, debt.amount);
}

/** Interest for one month on remaining balance (minor units). */
export function monthInterest(remaining: number, monthlyInterestBps: number): number {
  if (remaining <= 0 || monthlyInterestBps <= 0) return 0;
  return Math.round((remaining * monthlyInterestBps) / 10_000);
}

/**
 * Pure accrual plan: months to charge from after `lastInterestMonth` (or borrow month)
 * through `asOfMonth` inclusive. Does not mutate.
 */
export function interestAccrualPlan(
  debt: Pick<DebtLike, "amount" | "monthlyInterestBps" | "lastInterestMonth" | "date">,
  asOfMonth: string
): Array<{ month: string; interest: number; balanceAfter: number }> {
  if (debt.monthlyInterestBps <= 0) return [];

  const borrowMonth = debt.date.slice(0, 7);
  let cursor = debt.lastInterestMonth
    ? addMonths(debt.lastInterestMonth, 1)
    : addMonths(borrowMonth, 1);

  let balance = debt.amount;
  const steps: Array<{ month: string; interest: number; balanceAfter: number }> = [];

  while (cursor <= asOfMonth) {
    const interest = monthInterest(balance, debt.monthlyInterestBps);
    if (interest > 0) {
      balance += interest;
      steps.push({ month: cursor, interest, balanceAfter: balance });
    } else {
      steps.push({ month: cursor, interest: 0, balanceAfter: balance });
    }
    cursor = addMonths(cursor, 1);
  }

  return steps;
}

export function percentFromBps(bps: number): string {
  const major = bps / 100;
  return String(Number(major.toFixed(4)));
}

export function bpsFromPercent(percent: string | number): number {
  const value = typeof percent === "number" ? percent : Number(String(percent).replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid interest percent");
  }
  return Math.round(value * 100);
}
