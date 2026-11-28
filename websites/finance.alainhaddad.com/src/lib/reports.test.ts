import assert from "node:assert/strict";
import test from "node:test";
import {
  fundingSplit,
  isChartSpending,
  leftoverByMonth,
  rangeTotals,
  type ReportExpense,
} from "./reports.js";

function expense(
  partial: Partial<ReportExpense> & Pick<ReportExpense, "amount" | "funding">
): ReportExpense {
  return {
    isCardPayoff: false,
    isLoanPayment: false,
    excludeFromSpending: false,
    categoryName: "Groceries",
    categoryKind: "FAMILY",
    categoryId: "c1",
    memberId: "m1",
    memberName: "Alex",
    businessName: null,
    date: "2026-11-10",
    ...partial,
  };
}

test("excludes transfers and payoffs from chart spending", () => {
  assert.equal(
    isChartSpending(expense({ amount: 100, funding: "OWN", excludeFromSpending: true })),
    false
  );
  assert.equal(
    isChartSpending(expense({ amount: 100, funding: "OWN", isCardPayoff: true })),
    false
  );
  assert.equal(isChartSpending(expense({ amount: 100, funding: "CARD" })), true);
});

test("splits funding and computes leftover with computeLeft rules", () => {
  const expenses = [
    expense({ amount: 2000, funding: "OWN" }),
    expense({ amount: 1500, funding: "CARD" }),
    expense({ amount: 500, funding: "OWN", excludeFromSpending: true }),
  ];
  assert.deepEqual(fundingSplit(expenses), {
    pocket: 2000,
    card: 1500,
    borrowed: 0,
  });
  const totals = rangeTotals(
    [{ amount: 10000, kind: "SALARY", date: "2026-11-01" }],
    expenses
  );
  assert.equal(totals.leftover, 7500);
  assert.equal(totals.pocket, 2000);
});

test("builds leftover by month", () => {
  const rows = leftoverByMonth(
    ["2026-11"],
    [{ amount: 5000, kind: "SALARY", date: "2026-11-01" }],
    [expense({ amount: 1000, funding: "OWN", date: "2026-11-05" })]
  );
  assert.equal(rows[0].leftover, 4000);
  assert.equal(rows[0].pocket, 1000);
});
