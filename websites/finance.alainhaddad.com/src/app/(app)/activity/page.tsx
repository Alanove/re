import Link from "next/link";
import { ActivityFilters } from "@/components/activity-filters";
import { ActivityList, type ActivityListRow } from "@/components/activity-list";
import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";
import { isAdultRole } from "@/lib/roles";
import { requireMember } from "@/lib/session";
import {
  cn,
  resolveActivityDateRange,
  type ActivityDateRangeId,
} from "@/lib/utils";

const filters = [
  { id: "all", label: "All" },
  { id: "salary", label: "Salary" },
  { id: "freelance", label: "Freelance" },
  { id: "other", label: "Other income" },
  { id: "card", label: "Card" },
  { id: "business", label: "Business" },
] as const;

type Filter = (typeof filters)[number]["id"];

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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    range?: string;
    from?: string;
    to?: string;
    min?: string;
    max?: string;
    q?: string;
    category?: string;
    member?: string;
  }>;
}) {
  const { member } = await requireMember();
  const params = await searchParams;
  const filter = (filters.some((row) => row.id === params.filter)
    ? params.filter
    : "all") as Filter;
  const range = (rangeIds.includes(params.range as ActivityDateRangeId)
    ? params.range
    : "this_month") as ActivityDateRangeId;
  const from = params.from ?? "";
  const to = params.to ?? "";
  const min = params.min ?? "";
  const max = params.max ?? "";
  const q = (params.q ?? "").trim();
  const category = params.category ?? "";
  const memberFilter = params.member ?? "";
  const { start, end } = resolveActivityDateRange(range, { from, to });
  const currency = member.household.booksCurrency || member.household.currency;
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

  const [incomes, expenses, categories, businesses, customers, members] = await Promise.all([
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
          include: {
            member: true,
            customer: true,
            payslipReceipt: { select: { id: true } },
            invoicePayment: { select: { id: true } },
          },
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
      include: { category: true, member: true, business: true, creditCard: true },
      orderBy: { date: "desc" },
    }),
    prisma.category.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
    prisma.business.findMany({
      where: { householdId: member.householdId },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { householdId: member.householdId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
    childOnly
      ? Promise.resolve([])
      : prisma.member.findMany({
          where: { householdId: member.householdId },
          orderBy: { displayName: "asc" },
          select: { id: true, displayName: true },
        }),
  ]);

  const amountOk = (amount: number) => {
    if (minMinor !== null && amount < minMinor) return false;
    if (maxMinor !== null && amount > maxMinor) return false;
    return true;
  };

  const qLower = q.toLowerCase();
  const matchesQ = (...parts: Array<string | null | undefined>) => {
    if (!qLower) return true;
    return parts.some((part) => part?.toLowerCase().includes(qLower));
  };

  const query = new URLSearchParams();
  query.set("range", range);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (min) query.set("min", min);
  if (max) query.set("max", max);
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  if (memberFilter) query.set("member", memberFilter);
  const querySuffix = query.toString();

  const exportParams = new URLSearchParams(query);
  exportParams.set("filter", filter);
  const exportHref = `/activity/export?${exportParams.toString()}`;

  const rows: ActivityListRow[] = [
    ...incomes
      .filter((row) => amountOk(row.amount))
      .filter((row) =>
        matchesQ(row.description, row.kind, row.customer?.name, row.member.displayName)
      )
      .map((row) => {
        const customerLabel = row.customer?.name;
        const base = row.description || row.kind.toLowerCase();
        const label =
          customerLabel && row.description
            ? `${customerLabel} · ${row.description}`
            : customerLabel || base;
        const kind: "SALARY" | "FREELANCE" | "OTHER" =
          row.kind === "FREELANCE" || row.kind === "OTHER" ? row.kind : "SALARY";
        const locked = Boolean(row.invoiceId || row.payslipReceipt);
        const lockReason = row.invoiceId
          ? "This income came from an invoice payment. Edit amounts on Work, or delete it here to undo the payment."
          : row.payslipReceipt
            ? "Payslip income can’t be edited here."
            : null;
        return {
          type: "income" as const,
          id: row.id,
          date: row.date,
          label,
          meta: [row.member.displayName, customerLabel && !row.description ? "freelance" : null]
            .filter(Boolean)
            .join(" · "),
          amount: row.amount,
          positive: true,
          description: row.description,
          kind,
          customerId: row.customerId,
          customerName: row.customer?.name ?? "",
          locked,
          lockReason,
          canDelete: !row.payslipReceipt,
          paymentId: row.invoicePayment?.id ?? null,
        };
      }),
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
      .map((row) => {
        const locked = Boolean(
          row.isCardPayoff || row.loanPaymentId || row.debtId || row.billPaymentId
        );
        const lockReason = row.isCardPayoff
          ? "Card payoff can’t be edited here."
          : row.loanPaymentId
            ? "Loan payment can’t be edited here."
            : row.debtId
              ? "Borrowed spend can’t be edited here."
              : row.billPaymentId
                ? "Bill payment can’t be edited here. Archive the bill on Plan if needed."
                : null;
        return {
          type: "expense" as const,
          id: row.id,
          date: row.date,
          label: row.description || row.category.name,
          meta: [
            row.category.name,
            row.business?.name,
            row.creditCard?.name,
            row.funding !== "OWN" ? row.funding.toLowerCase() : null,
            row.isCardPayoff ? "payoff" : null,
            childOnly ? null : row.member.displayName,
          ]
            .filter(Boolean)
            .join(" · "),
          amount: row.amount,
          positive: false,
          description: row.description,
          categoryId: row.categoryId,
          categoryName: row.category.name,
          businessId: row.businessId,
          funding: row.funding,
          amountEditable: row.funding === "OWN" && !locked,
          hasReceipt: Boolean(row.receiptPath),
          locked,
          lockReason,
          canDelete: !locked,
        };
      }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activity</h1>
          <p className="text-sm text-muted">Tap a row to edit. One list for money in and out.</p>
        </div>
        <ActivityFilters
          filter={filter}
          range={range}
          from={from}
          to={to}
          min={min}
          max={max}
          q={q}
          category={category}
          memberId={memberFilter}
          categories={categories.map((row) => ({ id: row.id, name: row.name }))}
          members={members}
          exportHref={exportHref}
        />
      </header>

      <div className="flex flex-wrap gap-2">
        {filters
          .filter((row) => !childOnly || row.id === "all" || row.id === "card" || row.id === "business")
          .map((row) => (
            <Link
              key={row.id}
              href={`/activity?filter=${row.id}&${querySuffix}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                filter === row.id ? "bg-ink text-on-ink" : "bg-card text-ink border border-line"
              )}
            >
              {row.label}
            </Link>
          ))}
      </div>

      <ActivityList
        rows={rows}
        currency={currency}
        categories={categories.map((row) => ({
          id: row.id,
          name: row.name,
          requiresBusiness: row.requiresBusiness,
        }))}
        businesses={businesses.map((row) => ({ id: row.id, name: row.name }))}
        customers={customers}
      />
    </div>
  );
}
