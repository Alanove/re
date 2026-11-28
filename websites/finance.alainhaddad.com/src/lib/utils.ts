import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonth(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  const year = date.getUTCFullYear();
  const monthNumber = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${monthNumber}`;
}

export function clampPayoffDay(year: number, month: number, payoffDay: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(Math.max(1, payoffDay), lastDay);
}

export function dueDateForCycle(asOfDate: string, payoffDay: number): string {
  const [yearText, monthText, dayText] = asOfDate.split("-").map(Number);
  const day = dayText;
  let year = yearText;
  let month = monthText;
  const dueThisMonth = clampPayoffDay(year, month, payoffDay);
  if (day > dueThisMonth) {
    const next = addMonths(`${yearText}-${String(monthText).padStart(2, "0")}`, 1);
    const [nextYear, nextMonth] = next.split("-").map(Number);
    year = nextYear;
    month = nextMonth;
  }
  const dueDay = clampPayoffDay(year, month, payoffDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}

export function previousFullMonths(asOfMonth: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    months.push(addMonths(asOfMonth, -i));
  }
  return months;
}

function startOfIsoWeek(date: Date): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy;
}

function addDaysIso(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ActivityDateRangeId =
  | "this_week"
  | "this_month"
  | "past_week"
  | "past_month"
  | "last_3_months"
  | "this_year"
  | "last_year"
  | "custom";

/** Inclusive start date and exclusive end date (YYYY-MM-DD). */
export function resolveActivityDateRange(
  range: ActivityDateRangeId,
  options: { from?: string; to?: string; now?: Date } = {}
): { start: string; end: string } {
  const now = options.now ?? new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = addDaysIso(today, 1);

  if (range === "custom") {
    const from = options.from && /^\d{4}-\d{2}-\d{2}$/.test(options.from) ? options.from : toIsoDate(today);
    const to = options.to && /^\d{4}-\d{2}-\d{2}$/.test(options.to) ? options.to : toIsoDate(today);
    const endExclusive = addDaysIso(new Date(`${to}T00:00:00.000Z`), 1);
    return { start: from, end: toIsoDate(endExclusive) };
  }

  if (range === "this_week") {
    const start = startOfIsoWeek(today);
    return { start: toIsoDate(start), end: toIsoDate(tomorrow) };
  }
  if (range === "past_week") {
    const thisWeek = startOfIsoWeek(today);
    const start = addDaysIso(thisWeek, -7);
    return { start: toIsoDate(start), end: toIsoDate(thisWeek) };
  }
  if (range === "this_month") {
    const start = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { start, end: toIsoDate(tomorrow) };
  }
  if (range === "past_month") {
    const month = currentMonth(today);
    const prev = addMonths(month, -1);
    return { start: `${prev}-01`, end: `${month}-01` };
  }
  if (range === "last_3_months") {
    const month = currentMonth(today);
    const startMonth = addMonths(month, -2);
    return { start: `${startMonth}-01`, end: toIsoDate(tomorrow) };
  }
  if (range === "this_year") {
    return {
      start: `${today.getUTCFullYear()}-01-01`,
      end: toIsoDate(tomorrow),
    };
  }
  if (range === "last_year") {
    const year = today.getUTCFullYear() - 1;
    return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  }

  const month = currentMonth(today);
  return { start: `${month}-01`, end: toIsoDate(tomorrow) };
}
