import { CashflowCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { formatMoney } from "@/lib/money";
import { loadReportCashflow, type ReportPageSearch } from "@/lib/report-page";
import { leftoverByMonth, rangeTotals } from "@/lib/reports";
import { requireAdult } from "@/lib/session";

export default async function CashflowReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const data = await loadReportCashflow(member.householdId, params);

  const current = rangeTotals(data.reportIncomes, data.reportExpenses);
  const previous = rangeTotals(data.prevIncomes, data.prevExpenses);
  const byMonth = leftoverByMonth(data.monthKeys, data.reportIncomes, data.reportExpenses).map(
    (row) => ({
      month: row.month,
      leftover: row.leftover / 100,
      income: row.income / 100,
      pocket: row.pocket / 100,
    })
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-muted">Income, pocket spending, and leftover over time.</p>
        </div>
        <ReportRangeBar range={data.range} from={data.from} to={data.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Income"
          value={formatMoney(current.income, currency)}
          previous={data.prev ? formatMoney(previous.income, currency) : null}
        />
        <SummaryCard
          label="Pocket spending"
          value={formatMoney(current.pocket, currency)}
          previous={data.prev ? formatMoney(previous.pocket, currency) : null}
        />
        <SummaryCard
          label="Leftover"
          value={formatMoney(current.leftover, currency)}
          previous={data.prev ? formatMoney(previous.leftover, currency) : null}
          emphasize
        />
      </section>

      <CashflowCharts currency={currency} rangeQuery={data.activityQuery} byMonth={byMonth} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  previous,
  emphasize,
}: {
  label: string;
  value: string;
  previous: string | null;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card p-4 shadow-card ${
        emphasize ? "ring-1 ring-ink/10" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {previous ? <p className="mt-1 text-xs text-muted">Prev window {previous}</p> : null}
    </div>
  );
}
