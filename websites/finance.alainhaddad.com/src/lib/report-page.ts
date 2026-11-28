import { prisma } from "@/lib/db";
import {
  defaultReportMonthKeys,
  monthKeysFromDates,
  monthsForReportRange,
  parseReportDateRange,
  prismaDateFilter,
  previousReportWindow,
  reportRangeToActivityQuery,
  resolveReportDateRange,
  type ReportDateRangeId,
} from "@/lib/report-range";
import type { ReportExpense, ReportIncome } from "@/lib/reports";

export type ReportPageSearch = {
  range?: string;
  from?: string;
  to?: string;
};

export function resolveReportPageRange(params: ReportPageSearch): {
  range: ReportDateRangeId;
  from: string;
  to: string;
  start: string | null;
  end: string | null;
  prev: { start: string; end: string } | null;
  activityQuery: string;
  dateFilter: ReturnType<typeof prismaDateFilter>;
} {
  const range = parseReportDateRange(params.range);
  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : "";
  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : "";
  const { start, end } = resolveReportDateRange(range, { from: from || undefined, to: to || undefined });
  const prev = previousReportWindow(start, end);
  return {
    range,
    from,
    to,
    start,
    end,
    prev,
    activityQuery: reportRangeToActivityQuery(range, start, end),
    dateFilter: prismaDateFilter(start, end),
  };
}

export function mapReportIncome(row: {
  amount: number;
  kind: string;
  date: string;
  memberId: string;
  member?: { displayName: string } | null;
}): ReportIncome {
  return {
    amount: row.amount,
    kind: row.kind,
    date: row.date,
    memberId: row.memberId,
    memberName: row.member?.displayName ?? "",
  };
}

export function mapReportExpense(row: {
  amount: number;
  funding: string;
  isCardPayoff: boolean;
  loanPaymentId: string | null;
  categoryId: string;
  memberId: string;
  date: string;
  category: { name: string; kind: string; excludeFromSpending: boolean };
  member: { displayName: string };
  business: { name: string } | null;
}): ReportExpense {
  return {
    amount: row.amount,
    funding: row.funding as ReportExpense["funding"],
    isCardPayoff: row.isCardPayoff,
    isLoanPayment: Boolean(row.loanPaymentId),
    excludeFromSpending: row.category.excludeFromSpending,
    categoryName: row.category.name,
    categoryKind: row.category.kind,
    categoryId: row.categoryId,
    memberId: row.memberId,
    memberName: row.member.displayName,
    businessName: row.business?.name ?? null,
    date: row.date,
  };
}

export async function loadReportCashflow(householdId: string, params: ReportPageSearch) {
  const resolved = resolveReportPageRange(params);
  const [incomes, expenses, prevIncomes, prevExpenses] = await Promise.all([
    prisma.income.findMany({
      where: { householdId, ...resolved.dateFilter },
      include: { member: true },
    }),
    prisma.expense.findMany({
      where: { householdId, ...resolved.dateFilter },
      include: { category: true, business: true, member: true },
    }),
    resolved.prev
      ? prisma.income.findMany({
          where: {
            householdId,
            date: { gte: resolved.prev.start, lt: resolved.prev.end },
          },
          include: { member: true },
        })
      : Promise.resolve([]),
    resolved.prev
      ? prisma.expense.findMany({
          where: {
            householdId,
            date: { gte: resolved.prev.start, lt: resolved.prev.end },
          },
          include: { category: true, business: true, member: true },
        })
      : Promise.resolve([]),
  ]);

  const reportIncomes = incomes.map(mapReportIncome);
  const reportExpenses = expenses.map(mapReportExpense);
  const rangedMonths = monthsForReportRange(resolved.start, resolved.end);
  const monthKeys =
    rangedMonths.length > 0
      ? rangedMonths
      : monthKeysFromDates([
          ...reportIncomes.map((row) => row.date),
          ...reportExpenses.map((row) => row.date),
        ]);
  const keys = monthKeys.length > 0 ? monthKeys : defaultReportMonthKeys();

  return {
    ...resolved,
    reportIncomes,
    reportExpenses,
    prevIncomes: prevIncomes.map(mapReportIncome),
    prevExpenses: prevExpenses.map(mapReportExpense),
    monthKeys: keys,
  };
}
