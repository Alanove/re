import { IncomeCharts } from "@/components/reports-detail-charts";
import { ReportRangeBar } from "@/components/report-range-bar";
import { formatMoney } from "@/lib/money";
import { loadReportCashflow, type ReportPageSearch } from "@/lib/report-page";
import { incomeByKind, incomeByMember, incomeByMonth } from "@/lib/reports";
import { requireAdult } from "@/lib/session";

export default async function IncomeReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportPageSearch>;
}) {
  const { member } = await requireAdult();
  const params = await searchParams;
  const currency = member.household.booksCurrency || member.household.currency;
  const data = await loadReportCashflow(member.householdId, params);

  const total = data.reportIncomes.reduce((sum, row) => sum + row.amount, 0);
  const byKind = incomeByKind(data.reportIncomes);
  const byMember = incomeByMember(data.reportIncomes);
  const byMonth = incomeByMonth(data.monthKeys, data.reportIncomes).map((row) => ({
    month: row.month,
    amount: row.amount / 100,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Income</h1>
          <p className="text-sm text-muted">By kind, member, and month. Tap a bar to open Activity.</p>
        </div>
        <ReportRangeBar range={data.range} from={data.from} to={data.to} />
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={formatMoney(total, currency)} />
        {byKind.map((row) => (
          <SummaryCard
            key={row.kind}
            label={row.kind}
            value={formatMoney(row.amount, currency)}
          />
        ))}
      </section>

      <IncomeCharts
        currency={currency}
        rangeQuery={data.activityQuery}
        byKind={byKind.map((row) => ({ ...row, amount: row.amount / 100 }))}
        byMonth={byMonth}
        byMember={byMember.map((row) => ({ ...row, amount: row.amount / 100 }))}
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
