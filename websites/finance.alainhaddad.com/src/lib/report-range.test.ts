import assert from "node:assert/strict";
import test from "node:test";
import {
  monthsInDateRange,
  parseReportDateRange,
  previousReportWindow,
  reportRangeToActivityQuery,
  resolveReportDateRange,
} from "./report-range.js";

test("defaults unknown range to this_month", () => {
  assert.equal(parseReportDateRange(undefined), "this_month");
  assert.equal(parseReportDateRange("nope"), "this_month");
  assert.equal(parseReportDateRange("1y"), "1y");
  assert.equal(parseReportDateRange("last_week"), "last_week");
  assert.equal(parseReportDateRange("3"), "3m");
  assert.equal(parseReportDateRange("12"), "1y");
});

test("resolves calendar quick ranges", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  assert.deepEqual(resolveReportDateRange("this_month", { now }), {
    start: "2026-11-01",
    end: "2026-11-28",
  });
  assert.deepEqual(resolveReportDateRange("last_month", { now }), {
    start: "2026-10-01",
    end: "2026-11-01",
  });
  assert.deepEqual(resolveReportDateRange("this_week", { now }), {
    start: "2026-11-23",
    end: "2026-11-28",
  });
  assert.deepEqual(resolveReportDateRange("last_week", { now }), {
    start: "2026-11-16",
    end: "2026-11-23",
  });
  assert.deepEqual(resolveReportDateRange("this_year", { now }), {
    start: "2026-01-01",
    end: "2026-11-28",
  });
  assert.deepEqual(resolveReportDateRange("last_year", { now }), {
    start: "2025-01-01",
    end: "2026-01-01",
  });
});

test("resolves rolling more ranges", () => {
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
    reportRangeToActivityQuery("last_week", "2026-11-16", "2026-11-23"),
    "range=past_week"
  );
  assert.equal(
    reportRangeToActivityQuery("last_month", "2026-10-01", "2026-11-01"),
    "range=past_month"
  );
  assert.equal(
    reportRangeToActivityQuery("1m", "2026-10-29", "2026-11-28"),
    "range=custom&from=2026-10-29&to=2026-11-27"
  );
});
