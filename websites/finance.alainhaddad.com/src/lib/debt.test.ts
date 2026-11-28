import assert from "node:assert/strict";
import test from "node:test";
import {
  bpsFromPercent,
  canRemoveDebtMove,
  debtLedgerTotals,
  debtPersonKey,
  interestAccrualPlan,
  monthInterest,
  netReceived,
  percentFromBps,
  rewriteDebtBalances,
} from "./debt.js";

test("net received is principal minus fee", () => {
  assert.equal(netReceived(1300_00, 25_00), 1275_00);
  assert.equal(netReceived(100_00, 100_00), 0);
});

test("month interest rounds bps of remaining", () => {
  assert.equal(monthInterest(1300_00, 150), Math.round((1300_00 * 150) / 10_000));
  assert.equal(monthInterest(100_00, 0), 0);
});

test("interest accrues months after borrow without double-counting last month", () => {
  const steps = interestAccrualPlan(
    {
      amount: 1000_00,
      monthlyInterestBps: 1000, // 10%/mo for easy math
      lastInterestMonth: null,
      date: "2026-01-15",
    },
    "2026-03"
  );
  // First accrual month is Feb, then Mar
  assert.equal(steps.length, 2);
  assert.equal(steps[0]?.month, "2026-02");
  assert.equal(steps[0]?.interest, 100_00);
  assert.equal(steps[1]?.month, "2026-03");
  assert.equal(steps[1]?.interest, 110_00);
  assert.equal(steps[1]?.balanceAfter, 1210_00);

  const again = interestAccrualPlan(
    {
      amount: 1210_00,
      monthlyInterestBps: 1000,
      lastInterestMonth: "2026-03",
      date: "2026-01-15",
    },
    "2026-03"
  );
  assert.equal(again.length, 0);
});

test("bps percent helpers", () => {
  assert.equal(bpsFromPercent("1.5"), 150);
  assert.equal(percentFromBps(150), "1.5");
});

test("one person balance keeps the original borrow after a settlement", () => {
  const moves = [
    { id: "a", kind: "BORROW", amount: 500_00, date: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", kind: "BORROW", amount: 200_00, date: "2026-02-01", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "c", kind: "REPAY", amount: 100_00, date: "2026-03-01", createdAt: "2026-03-01T00:00:00.000Z" },
  ];
  const chain = rewriteDebtBalances(moves);
  assert.equal(chain[0]?.balanceAfter, 500_00);
  assert.equal(chain[1]?.balanceAfter, 700_00);
  assert.equal(chain[2]?.balanceAfter, 600_00);
  const totals = debtLedgerTotals(moves);
  assert.equal(totals.borrowed, 700_00);
  assert.equal(totals.settled, 100_00);
  assert.equal(totals.left, 600_00);
});

test("deleting one borrow rewrites the later balance and keeps the other borrow", () => {
  const moves = [
    { id: "a", kind: "BORROW", amount: 500_00, date: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", kind: "BORROW", amount: 200_00, date: "2026-02-01", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "c", kind: "REPAY", amount: 100_00, date: "2026-03-01", createdAt: "2026-03-01T00:00:00.000Z" },
  ];
  assert.equal(canRemoveDebtMove(moves, "b").ok, true);
  const next = rewriteDebtBalances(moves.filter((move) => move.id !== "b"));
  const totals = debtLedgerTotals(next);
  assert.equal(totals.borrowed, 500_00);
  assert.equal(totals.left, 400_00);
});

test("a borrow cannot be deleted when a settlement would exceed what remains", () => {
  const moves = [
    { id: "a", kind: "BORROW", amount: 100_00, date: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", kind: "BORROW", amount: 200_00, date: "2026-02-01", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "c", kind: "REPAY", amount: 150_00, date: "2026-03-01", createdAt: "2026-03-01T00:00:00.000Z" },
  ];
  assert.equal(canRemoveDebtMove(moves, "a").ok, true);
  assert.equal(canRemoveDebtMove(moves, "b").ok, false);
});

test("person names match ignoring case and extra spaces", () => {
  assert.equal(debtPersonKey("  Santa   Maria "), debtPersonKey("santa maria"));
});
