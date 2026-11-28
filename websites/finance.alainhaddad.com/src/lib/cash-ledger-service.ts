import { replayCashLedger, type CashEvent, type CashPlace } from "@/lib/cash-ledger";
import { prisma } from "@/lib/db";
import { ensureHouseholdMoneyPlaces } from "@/lib/money-places";

function stampTime(value: Date): string {
  return value.toISOString();
}

/** Write place and household cash-after on every activity. Skips rows that already match. */
export async function ensureHouseholdCashLedger(householdId: string) {
  await ensureHouseholdMoneyPlaces(householdId);

  const [places, incomes, expenses, transfers] = await Promise.all([
    prisma.moneyPlace.findMany({ where: { householdId } }),
    prisma.income.findMany({ where: { householdId } }),
    prisma.expense.findMany({ where: { householdId } }),
    prisma.moneyTransfer.findMany({ where: { householdId } }),
  ]);

  const cashPlaces: CashPlace[] = places.map((place) => ({
    id: place.id,
    openingBalance: place.openingBalance,
    archived: place.archivedAt != null,
  }));

  const events: CashEvent[] = [
    ...incomes.map((row) => ({
      id: row.id,
      kind: "income" as const,
      date: row.date,
      createdAt: stampTime(row.createdAt),
      amount: row.amount,
      placeId: row.moneyPlaceId,
    })),
    ...expenses.map((row) => ({
      id: row.id,
      kind: "expense" as const,
      date: row.date,
      createdAt: stampTime(row.createdAt),
      amount: row.amount,
      placeId: row.moneyPlaceId,
      funding: row.funding,
    })),
    ...transfers.map((row) => ({
      id: row.id,
      kind: "transfer" as const,
      date: row.date,
      createdAt: stampTime(row.createdAt),
      amount: row.amount,
      placeId: null,
      fromPlaceId: row.fromPlaceId,
      toPlaceId: row.toPlaceId,
    })),
  ];

  const stamps = replayCashLedger(cashPlaces, events);
  const incomeById = new Map(incomes.map((row) => [row.id, row]));
  const expenseById = new Map(expenses.map((row) => [row.id, row]));
  const transferById = new Map(transfers.map((row) => [row.id, row]));

  const writes: Array<Promise<unknown>> = [];
  for (const stamp of stamps) {
    if (stamp.kind === "income") {
      const row = incomeById.get(stamp.id);
      if (!row) continue;
      if (
        row.placeBalanceAfter === stamp.placeBalanceAfter &&
        row.householdCashAfter === stamp.householdCashAfter
      ) {
        continue;
      }
      writes.push(
        prisma.income.update({
          where: { id: row.id },
          data: {
            placeBalanceAfter: stamp.placeBalanceAfter,
            householdCashAfter: stamp.householdCashAfter,
          },
        })
      );
    } else if (stamp.kind === "expense") {
      const row = expenseById.get(stamp.id);
      if (!row) continue;
      if (
        row.placeBalanceAfter === stamp.placeBalanceAfter &&
        row.householdCashAfter === stamp.householdCashAfter
      ) {
        continue;
      }
      writes.push(
        prisma.expense.update({
          where: { id: row.id },
          data: {
            placeBalanceAfter: stamp.placeBalanceAfter,
            householdCashAfter: stamp.householdCashAfter,
          },
        })
      );
    } else {
      const row = transferById.get(stamp.id);
      if (!row) continue;
      if (
        row.fromPlaceBalanceAfter === stamp.fromPlaceBalanceAfter &&
        row.toPlaceBalanceAfter === stamp.toPlaceBalanceAfter &&
        row.householdCashAfter === stamp.householdCashAfter
      ) {
        continue;
      }
      writes.push(
        prisma.moneyTransfer.update({
          where: { id: row.id },
          data: {
            fromPlaceBalanceAfter: stamp.fromPlaceBalanceAfter,
            toPlaceBalanceAfter: stamp.toPlaceBalanceAfter,
            householdCashAfter: stamp.householdCashAfter,
          },
        })
      );
    }
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }

  return stamps;
}

/** Latest stored household cash, or the sum of opening balances when nothing has moved. */
export async function readHouseholdCash(householdId: string): Promise<number> {
  const stamps = await ensureHouseholdCashLedger(householdId);
  if (stamps.length > 0) {
    return stamps[stamps.length - 1]!.householdCashAfter;
  }
  const places = await prisma.moneyPlace.findMany({
    where: { householdId, archivedAt: null },
    select: { openingBalance: true },
  });
  return places.reduce((sum, place) => sum + place.openingBalance, 0);
}

/** Household cash after the last move on or before `end` (YYYY-MM-DD). Null end means the latest move. */
export async function householdCashAsOf(
  householdId: string,
  end: string | null
): Promise<number> {
  const stamps = await ensureHouseholdCashLedger(householdId);
  if (!end) {
    if (stamps.length === 0) return readOpening(householdId);
    return stamps[stamps.length - 1]!.householdCashAfter;
  }

  const [incomes, expenses, transfers] = await Promise.all([
    prisma.income.findMany({
      where: { householdId },
      select: { id: true, date: true },
    }),
    prisma.expense.findMany({
      where: { householdId },
      select: { id: true, date: true },
    }),
    prisma.moneyTransfer.findMany({
      where: { householdId },
      select: { id: true, date: true },
    }),
  ]);
  const dates = new Map<string, string>();
  for (const row of [...incomes, ...expenses, ...transfers]) {
    dates.set(row.id, row.date);
  }
  let latest: number | null = null;
  for (const stamp of stamps) {
    const date = dates.get(stamp.id);
    if (!date || date > end) continue;
    latest = stamp.householdCashAfter;
  }
  if (latest == null) return readOpening(householdId);
  return latest;
}

async function readOpening(householdId: string): Promise<number> {
  const places = await prisma.moneyPlace.findMany({
    where: { householdId, archivedAt: null },
    select: { openingBalance: true },
  });
  return places.reduce((sum, place) => sum + place.openingBalance, 0);
}
