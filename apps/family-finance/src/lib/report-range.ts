import {
  addMonths,
  currentMonth,
  resolveActivityDateRange,
  todayIsoDate,
  type ActivityDateRangeId,
} from "@/lib/utils";

export type ReportDateRangeId =
  | "1w"
  | "1m"
  | "3m"
  | "1y"
  | "this_week"
  | "this_month"
  | "this_year"
  | "last_year"
  | "all"
  | "custom";

const QUICK_RANGES: ReportDateRangeId[] = ["1w", "1m", "3m", "1y"];

const MORE_RANGES: ReportDateRangeId[] = [
  "this_week",
  "this_month",
  "this_year",
  "last_year",
  "all",
  "custom",
];

export const REPORT_QUICK_RANGE_OPTIONS: { id: ReportDateRangeId; label: string }[] = [
  { id: "1w", label: "1 Week" },
  { id: "1m", label: "1 Month" },
  { id: "3m", label: "3 Months" },
  { id: "1y", label: "1 Year" },
];

export const REPORT_MORE_RANGE_OPTIONS: { id: ReportDateRangeId; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "this_year", label: "This year" },
  { id: "last_year", label: "Last year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
];

export function isReportDateRangeId(value: string | undefined | null): value is ReportDateRangeId {
  if (!value) return false;
  return (
    QUICK_RANGES.includes(value as ReportDateRangeId) ||
    MORE_RANGES.includes(value as ReportDateRangeId)
  );
}

export function parseReportDateRange(
  value: string | undefined | null
): ReportDateRangeId {
  return isReportDateRangeId(value) ? value : "1m";
}

function addDaysIsoString(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive start and exclusive end (YYYY-MM-DD). Null bounds mean no date filter. */
export function resolveReportDateRange(
  range: ReportDateRangeId,
  options: { from?: string; to?: string; now?: Date } = {}
): { start: string | null; end: string | null } {
  const now = options.now ?? new Date();
  const today = todayIsoDate(now);
  const tomorrow = addDaysIsoString(today, 1);

  if (range === "1w") {
    return { start: addDaysIsoString(today, -6), end: tomorrow };
  }
  if (range === "1m") {
    return { start: addDaysIsoString(today, -29), end: tomorrow };
  }
  if (range === "3m") {
    return { start: addDaysIsoString(today, -89), end: tomorrow };
  }
  if (range === "1y") {
    return { start: addDaysIsoString(today, -364), end: tomorrow };
  }
  if (range === "all") {
    return { start: null, end: null };
  }
  if (range === "custom") {
    return resolveActivityDateRange("custom", options);
  }

  return resolveActivityDateRange(range as ActivityDateRangeId, options);
}

/** YYYY-MM keys covering [start, endExclusive). */
export function monthsInDateRange(start: string, endExclusive: string): string[] {
  const startMonth = start.slice(0, 7);
  const lastIncluded = addDaysIsoString(endExclusive, -1);
  const endMonth = lastIncluded.slice(0, 7);
  const months: string[] = [];
  let cursor = startMonth;
  while (cursor <= endMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** Month keys for leftover charts; empty when unbounded (caller should derive from data). */
export function monthsForReportRange(
  start: string | null,
  end: string | null,
  fallbackMonths: string[] = []
): string[] {
  if (!start || !end) {
    return fallbackMonths;
  }
  return monthsInDateRange(start, end);
}

export function previousReportWindow(
  start: string | null,
  end: string | null
): { start: string; end: string } | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs <= 0) return null;
  const prevEnd = start;
  const prevStartDate = new Date(startDate.getTime() - durationMs);
  return { start: prevStartDate.toISOString().slice(0, 10), end: prevEnd };
}

/** Activity URL query (without leading ?) matching this report window. */
export function reportRangeToActivityQuery(
  range: ReportDateRangeId,
  start: string | null,
  end: string | null
): string {
  if (range === "all" || !start || !end) {
    return "range=this_year";
  }
  if (
    range === "this_week" ||
    range === "this_month" ||
    range === "this_year" ||
    range === "last_year"
  ) {
    return `range=${range}`;
  }
  const toInclusive = addDaysIsoString(end, -1);
  return `range=custom&from=${start}&to=${toInclusive}`;
}

export function prismaDateFilter(start: string | null, end: string | null) {
  if (!start && !end) return {};
  return {
    date: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {}),
    },
  };
}

export function prismaIssueDateFilter(start: string | null, end: string | null) {
  if (!start && !end) return {};
  return {
    issueDate: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {}),
    },
  };
}

export function monthKeysFromDates(dates: string[]): string[] {
  const set = new Set(dates.map((date) => date.slice(0, 7)));
  return Array.from(set).sort();
}

export function defaultReportMonthKeys(): string[] {
  const end = currentMonth();
  return [addMonths(end, -2), addMonths(end, -1), end];
}
