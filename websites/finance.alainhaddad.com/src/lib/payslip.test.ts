import assert from "node:assert/strict";
import test from "node:test";
import {
  companyMatchFromSrsp,
  settlementMonthsToShow,
  shouldShowPayslipPrompt,
  upcomingSettlementMonth,
} from "./payslip.js";

test("payslip prompt opens from appearFromDay", () => {
  assert.equal(shouldShowPayslipPrompt(23, 24), false);
  assert.equal(shouldShowPayslipPrompt(24, 24), true);
  assert.equal(shouldShowPayslipPrompt(27, 3), true);
});

test("upcoming settlement month is next month once the window opens", () => {
  assert.equal(upcomingSettlementMonth("2026-11", 27, 3), "2026-12");
  assert.equal(upcomingSettlementMonth("2026-11", 2, 3), "2026-11");
  assert.equal(upcomingSettlementMonth("2026-12", 24, 24), "2027-01");
});

test("settlement months keep the current month and add the next in-window", () => {
  assert.deepEqual(settlementMonthsToShow("2026-11", 2, 3), ["2026-11"]);
  assert.deepEqual(settlementMonthsToShow("2026-11", 27, 3), ["2026-11", "2026-12"]);
  assert.deepEqual(settlementMonthsToShow("2026-11", 24, 24), ["2026-11", "2026-12"]);
});

test("company match follows the confirmed employee SRSP amount", () => {
  assert.equal(companyMatchFromSrsp(BigInt(31900), 600, 600), BigInt(31900));
  assert.equal(companyMatchFromSrsp(BigInt(29700), 600, 600), BigInt(29700));
  assert.equal(companyMatchFromSrsp(BigInt(60000), 300, 600), BigInt(30000));
  assert.equal(companyMatchFromSrsp(BigInt(31900), 600, 0), BigInt(0));
});
