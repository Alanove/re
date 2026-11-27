import assert from "node:assert/strict";
import test from "node:test";
import {
  monthsInDateRange,
  parseReportDateRange,
  previousReportWindow,
  reportRangeToActivityQuery,
  resolveReportDateRange,
} from "./report-range.js";

test("defaults unknown range to 1m", () => {
  assert.equal(parseReportDateRange(undefined), "1m");
  assert.equal(parseReportDateRange("nope"), "1m");
  assert.equal(parseReportDateRange("1y"), "1y");
});

test("resolves rolling quick ranges", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  assert.deepEqual(resolveReportDateRange("1w", { now }), {
    start: "2026-11-21",
    end: "2026-11-28",
  });
  assert.deepEqual(resolveReportDateRange("1m", { now }), {
    start: "2026-10-29",
    end: "2026-11-28",
  });
  assert.deepEqual(resolveReportDateRange("all", { now }), {
    start: null,
    end: null,
  });
});

test("lists months covering a date window", () => {
  assert.deepEqual(monthsInDateRange("2026-10-29", "2026-11-28"), [
    "2026-10",
    "2026-11",
  ]);
});

test("builds previous window of equal length", () => {
  assert.deepEqual(previousReportWindow("2026-11-01", "2026-12-01"), {
    start: "2026-10-02",
    end: "2026-11-01",
  });
  assert.equal(previousReportWindow(null, null), null);
});

test("maps report range to activity query", () => {
  assert.equal(
    reportRangeToActivityQuery("this_month", "2026-11-01", "2026-11-28"),
    "range=this_month"
  );
  assert.equal(
    reportRangeToActivityQuery("1m", "2026-10-29", "2026-11-28"),
    "range=custom&from=2026-10-29&to=2026-11-27"
  );
});
