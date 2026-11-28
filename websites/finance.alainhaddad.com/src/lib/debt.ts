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

export type DebtMoveKind = "BORROW" | "REPAY" | "INTEREST";

export type DebtMove = {
  id: string;
  kind: string;
  amount: number;
  date: string;
  createdAt: string;
};

export function debtPersonKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function compareMoves(a: DebtMove, b: DebtMove): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byCreated = a.createdAt.localeCompare(b.createdAt);
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}

/** Replay a person's moves in date order and store the balance after each one. */
export function rewriteDebtBalances<T extends DebtMove>(
  moves: T[]
): Array<T & { balanceAfter: number }> {
  const sorted = [...moves].sort(compareMoves);
  let balance = 0;
  return sorted.map((move) => {
    balance += move.kind === "REPAY" ? -move.amount : move.amount;
    return { ...move, balanceAfter: balance };
  });
}

export function debtLedgerTotals(
  moves: DebtMove[]
): { borrowed: number; settled: number; interest: number; left: number } {
  const rewritten = rewriteDebtBalances(moves);
  let borrowed = 0;
  let settled = 0;
  let interest = 0;
  for (const move of rewritten) {
    if (move.kind === "BORROW") borrowed += move.amount;
    else if (move.kind === "REPAY") settled += move.amount;
    else if (move.kind === "INTEREST") interest += move.amount;
  }
  const left = rewritten.length > 0 ? rewritten[rewritten.length - 1]!.balanceAfter : 0;
  return { borrowed, settled, interest, left };
}

/** A borrow can be removed when later settlements still fit on what remains. */
export function canRemoveDebtMove(
  moves: DebtMove[],
  removeId: string
): { ok: true } | { ok: false; error: string } {
  if (!moves.some((move) => move.id === removeId)) {
    return { ok: false, error: "That debt line was not found." };
  }
  const rewritten = rewriteDebtBalances(moves.filter((move) => move.id !== removeId));
  if (rewritten.some((move) => move.balanceAfter < 0)) {
    return { ok: false, error: "Undo the settlement first, then delete this borrow." };
  }
  return { ok: true };
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
