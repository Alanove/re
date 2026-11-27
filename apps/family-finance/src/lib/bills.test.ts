import assert from "node:assert/strict";
import test from "node:test";
import { billActiveInMonth, billDueDate } from "./bills.js";

test("skips archived and ended bills", () => {
  assert.equal(
    billActiveInMonth({ endMonth: null, archivedAt: new Date() }, "2026-11"),
    false
  );
  assert.equal(
    billActiveInMonth({ endMonth: "2026-10", archivedAt: null }, "2026-11"),
    false
  );
  assert.equal(
    billActiveInMonth({ endMonth: "2026-12", archivedAt: null }, "2026-11"),
    true
  );
});

test("clamps due day to the month length", () => {
  assert.equal(billDueDate("2026-02", 31), "2026-02-28");
  assert.equal(billDueDate("2026-01", 15), "2026-01-15");
});
