import assert from "node:assert/strict";
import test from "node:test";
import {
  bpsFromPercent,
  interestAccrualPlan,
  monthInterest,
  netReceived,
  percentFromBps,
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
