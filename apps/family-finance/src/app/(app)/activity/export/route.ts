import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";
import { isAdultRole } from "@/lib/roles";
import { requireMember } from "@/lib/session";
import {
  resolveActivityDateRange,
  type ActivityDateRangeId,
} from "@/lib/utils";

const filters = ["all", "salary", "freelance", "other", "card", "business"] as const;
type Filter = (typeof filters)[number];

const rangeIds: ActivityDateRangeId[] = [
  "this_week",
  "this_month",
  "past_week",
  "past_month",
  "last_3_months",
  "this_year",
  "last_year",
  "custom",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const { member } = await requireMember();
  const url = new URL(request.url);
  const filter = (filters.includes(url.searchParams.get("filter") as Filter)
    ? url.searchParams.get("filter")
    : "all") as Filter;
  const range = (rangeIds.includes(url.searchParams.get("range") as ActivityDateRangeId)
    ? url.searchParams.get("range")
    : "this_month") as ActivityDateRangeId;
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const min = url.searchParams.get("min") ?? "";
  const max = url.searchParams.get("max") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const category = url.searchParams.get("category") ?? "";
  const memberFilter = url.searchParams.get("member") ?? "";
  const { start, end } = resolveActivityDateRange(range, { from, to });
  const childOnly = !isAdultRole(member.role);

  let minMinor: number | null = null;
  let maxMinor: number | null = null;
  try {
    if (min) minMinor = toMinorUnits(min);
  } catch {
    minMinor = null;
  }
  try {
    if (max) maxMinor = toMinorUnits(max);
  } catch {
    maxMinor = null;
  }

  const incomeFilter =
    filter === "salary"
      ? { kind: "SALARY" as const }
      : filter === "freelance"
        ? { kind: "FREELANCE" as const }
        : filter === "other"
          ? { kind: "OTHER" as const }
          : filter === "card" || filter === "business"
            ? { id: "__none__" }
            : {};

  const [incomes, expenses] = await Promise.all([
    childOnly
      ? Promise.resolve([])
      : prisma.income.findMany({
          where: {
            householdId: member.householdId,
            date: { gte: start, lt: end },
            ...incomeFilter,
            ...(memberFilter ? { memberId: memberFilter } : {}),
            ...(minMinor !== null ? { amount: { gte: minMinor } } : {}),
          },
          include: { member: true, customer: true },
          orderBy: { date: "desc" },
        }),
    prisma.expense.findMany({
      where: {
        householdId: member.householdId,
        date: { gte: start, lt: end },
        ...(childOnly ? { memberId: member.id } : memberFilter ? { memberId: memberFilter } : {}),
        ...(category ? { categoryId: category } : {}),
        ...(filter === "card" ? { funding: "CARD" } : {}),
        ...(filter === "business"
          ? { OR: [{ businessId: { not: null } }, { category: { kind: "BUSINESS" } }] }
          : {}),
        ...(filter === "salary" || filter === "freelance" || filter === "other"
          ? { id: "__none__" }
          : {}),
        ...(minMinor !== null ? { amount: { gte: minMinor } } : {}),
      },
      include: { category: true, member: true, business: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const amountOk = (amount: number) => {
    if (minMinor !== null && amount < minMinor) return false;
    if (maxMinor !== null && amount > maxMinor) return false;
    return true;
  };

  const matchesQ = (...parts: Array<string | null | undefined>) => {
    if (!q) return true;
    return parts.some((part) => part?.toLowerCase().includes(q));
  };

  const lines = [
    "date,type,label,category,member,amount,funding",
    ...incomes
      .filter((row) => amountOk(row.amount))
      .filter((row) =>
        matchesQ(row.description, row.kind, row.customer?.name, row.member.displayName)
      )
      .map((row) =>
        [
          row.date,
          "income",
          csvEscape(row.description || row.kind.toLowerCase()),
          "",
          csvEscape(row.member.displayName),
          (row.amount / 100).toFixed(2),
          "",
        ].join(",")
      ),
    ...expenses
      .filter((row) => amountOk(row.amount))
      .filter((row) =>
        matchesQ(
          row.description,
          row.category.name,
          row.business?.name,
          row.member.displayName
        )
      )
      .map((row) =>
        [
          row.date,
          "expense",
          csvEscape(row.description || row.category.name),
          csvEscape(row.category.name),
          csvEscape(row.member.displayName),
          (row.amount / 100).toFixed(2),
          row.funding,
        ].join(",")
      ),
  ];

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-${start}.csv"`,
    },
  });
}
