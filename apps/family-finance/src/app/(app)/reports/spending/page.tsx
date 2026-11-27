import { SpendingCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { formatMoney } from "@/lib/money";
import { loadReportCashflow, type ReportPageSearch } from "@/lib/report-page";
import { fundingSplit, isChartSpending, sumBy } from "@/lib/reports";
import { requireAdult } from "@/lib/session";

export default async function SpendingReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const data = await loadReportCashflow(member.householdId, params);

  const chartSpend = data.reportExpenses.filter(isChartSpending);
  const split = fundingSplit(data.reportExpenses);
  const familySpend = chartSpend.filter((row) => row.categoryKind === "FAMILY");
  const businessSpend = chartSpend.filter((row) => row.categoryKind === "BUSINESS");

  const familyByCategory = sumBy(
    familySpend,
    (row) => row.categoryName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    categoryId:
      familySpend.find((expense) => expense.categoryName === row.name)?.categoryId ?? "",
  }));

  const businessByCategory = sumBy(
    businessSpend,
    (row) => row.categoryName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    categoryId:
      businessSpend.find((expense) => expense.categoryName === row.name)?.categoryId ?? "",
  }));

  const businessByBusiness = sumBy(
    businessSpend,
    (row) => row.businessName ?? "Unassigned",
    (row) => row.amount
  ).map((row) => ({ name: row.name, amount: row.amount / 100 }));

  const byMember = sumBy(
    chartSpend,
    (row) => row.memberName,
    (row) => row.amount
  ).map((row) => ({
    name: row.name,
    amount: row.amount / 100,
    memberId: chartSpend.find((expense) => expense.memberName === row.name)?.memberId ?? "",
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Spending</h1>
          <p className="text-sm text-muted">
            Funding, categories, businesses, and who spent. Tap a bar for Activity.
          </p>
        </div>
        <ReportRangeBar range={data.range} from={data.from} to={data.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pocket" value={formatMoney(split.pocket, currency)} />
        <SummaryCard label="Card" value={formatMoney(split.card, currency)} />
        <SummaryCard label="Borrowed" value={formatMoney(split.borrowed, currency)} />
      </section>

      <SpendingCharts
        currency={currency}
        rangeQuery={data.activityQuery}
        funding={[
          { name: "Pocket", amount: split.pocket / 100, filter: "all" },
          { name: "Card", amount: split.card / 100, filter: "card" },
          { name: "Borrowed", amount: split.borrowed / 100, filter: "borrowed" },
        ]}
        familyByCategory={familyByCategory}
        businessByCategory={businessByCategory}
        businessByBusiness={businessByBusiness}
        byMember={byMember}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
