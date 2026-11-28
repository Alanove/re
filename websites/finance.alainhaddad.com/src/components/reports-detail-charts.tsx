"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartCard,
  activityHref,
  moneyTick,
  moneyTooltip,
  monthBounds,
} from "@/components/report-charts-shared";
import { useChartColors } from "@/lib/chart-colors";

function useMoneyChart(currency: string, rangeQuery: string) {
  const router = useRouter();
  const colors = useChartColors();
  const tick = moneyTick(currency);
  const tooltipFormatter = moneyTooltip(currency);
  function href(extra: Record<string, string>) {
    return activityHref(rangeQuery, extra);
  }
  function openMonth(month?: string, filter = "all") {
    if (!month) return;
    const bounds = monthBounds(month);
    router.push(
      href({
        filter,
        range: "custom",
        from: bounds.from,
        to: bounds.to,
      })
    );
  }
  return { router, tick, tooltipFormatter, href, openMonth, colors };
}

export function CashflowCharts({
  currency,
  rangeQuery,
  byMonth,
}: {
  currency: string;
  rangeQuery: string;
  byMonth: { month: string; leftover: number; income: number; pocket: number }[];
}) {
  const { tick, tooltipFormatter, openMonth, colors } = useMoneyChart(currency, rangeQuery);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Leftover by month" empty={byMonth.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="leftover"
              name="Leftover"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            >
              {byMonth.map((row) => (
                <Cell key={row.month} fill={row.leftover < 0 ? colors.short : colors.ok} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Income vs pocket spending" empty={byMonth.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Legend />
            <Bar
              dataKey="income"
              fill={colors.ok}
              name="Income"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            />
            <Bar
              dataKey="pocket"
              fill={colors.ink}
              name="Pocket"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function IncomeCharts({
  currency,
  rangeQuery,
  byKind,
  byMonth,
  byMember,
}: {
  currency: string;
  rangeQuery: string;
  byKind: { kind: string; filter: string; amount: number }[];
  byMonth: { month: string; amount: number }[];
  byMember: { name: string; amount: number; memberId: string }[];
}) {
  const { router, tick, tooltipFormatter, href, openMonth, colors } = useMoneyChart(
    currency,
    rangeQuery
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Income by kind" empty={byKind.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={byKind}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="kind" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ok}
              onClick={(data) => {
                const filter = (data as { filter?: string }).filter ?? "all";
                router.push(href({ filter }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Income over time" empty={byMonth.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ok}
              name="Income"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Income by member" empty={byMember.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byMember}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ink}
              onClick={(data) => {
                const memberId = (data as { memberId?: string }).memberId;
                router.push(href({ filter: "all", member: memberId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function SpendingCharts({
  currency,
  rangeQuery,
  funding,
  familyByCategory,
  businessByCategory,
  businessByBusiness,
  byMember,
}: {
  currency: string;
  rangeQuery: string;
  funding: { name: string; amount: number; filter: string }[];
  familyByCategory: { name: string; amount: number; categoryId: string }[];
  businessByCategory: { name: string; amount: number; categoryId: string }[];
  businessByBusiness: { name: string; amount: number }[];
  byMember: { name: string; amount: number; memberId: string }[];
}) {
  const { router, tick, tooltipFormatter, href, colors } = useMoneyChart(currency, rangeQuery);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Spending by funding" empty={funding.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={funding}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ink}
              onClick={(data) => {
                const filter = (data as { filter?: string }).filter ?? "all";
                router.push(href({ filter }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Family by category" empty={familyByCategory.length === 0}>
        <ResponsiveContainer>
          <BarChart data={familyByCategory} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={88} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ink}
              onClick={(data) => {
                const categoryId = (data as { categoryId?: string }).categoryId;
                router.push(href({ filter: "all", category: categoryId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Business by category" empty={businessByCategory.length === 0}>
        <ResponsiveContainer>
          <BarChart data={businessByCategory} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={88} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ok}
              onClick={(data) => {
                const categoryId = (data as { categoryId?: string }).categoryId;
                router.push(href({ filter: "business", category: categoryId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Business by business" empty={businessByBusiness.length === 0}>
        <ResponsiveContainer>
          <BarChart data={businessByBusiness}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ink}
              onClick={() => router.push(href({ filter: "business" }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Who spent" empty={byMember.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byMember}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill={colors.ok}
              onClick={(data) => {
                const memberId = (data as { memberId?: string }).memberId;
                router.push(href({ filter: "all", member: memberId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function InvoiceCharts({
  currency,
  byCustomer,
  byMonth,
  byStatus,
}: {
  currency: string;
  byCustomer: { name: string; amount: number }[];
  byMonth: { month: string; invoiced: number; collected: number }[];
  byStatus: { name: string; amount: number }[];
}) {
  const colors = useChartColors();
  const tick = moneyTick(currency);
  const tooltipFormatter = moneyTooltip(currency);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Outstanding by customer" empty={byCustomer.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byCustomer} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.short} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard
        title="Invoiced vs collected by month"
        empty={byMonth.every((row) => row.invoiced === 0 && row.collected === 0)}
      >
        <ResponsiveContainer>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Legend />
            <Bar dataKey="invoiced" fill={colors.ink} name="Invoiced" />
            <Bar dataKey="collected" fill={colors.ok} name="Collected" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Invoice status mix" empty={byStatus.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={byStatus}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
            <Tooltip />
            <Bar dataKey="amount" fill={colors.ok} name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function SavingsCharts({
  currency,
  byPot,
  byMonth,
  byKind,
}: {
  currency: string;
  byPot: { name: string; amount: number }[];
  byMonth: { month: string; deposits: number; withdrawals: number; net: number }[];
  byKind: { name: string; amount: number }[];
}) {
  const colors = useChartColors();
  const tick = moneyTick(currency);
  const tooltipFormatter = moneyTooltip(currency);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Balance by pot" empty={byPot.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byPot} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.ok} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard
        title="Deposits vs withdrawals"
        empty={byMonth.every((row) => row.deposits === 0 && row.withdrawals === 0)}
      >
        <ResponsiveContainer>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Legend />
            <Bar dataKey="deposits" fill={colors.ok} name="Deposits" />
            <Bar dataKey="withdrawals" fill={colors.short} name="Withdrawals" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Cash vs metal" empty={byKind.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={byKind}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.ink} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function ObligationCharts({
  currency,
  cards,
  debts,
  loans,
  bills,
}: {
  currency: string;
  cards: { name: string; amount: number }[];
  debts: { name: string; amount: number }[];
  loans: { name: string; amount: number }[];
  bills: { name: string; amount: number }[];
}) {
  const colors = useChartColors();
  const tick = moneyTick(currency);
  const tooltipFormatter = moneyTooltip(currency);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Open card balances" empty={cards.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={cards}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.short} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Debts remaining" empty={debts.length === 0}>
        <ResponsiveContainer>
          <BarChart data={debts} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.ink} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Loan runway remaining" empty={loans.length === 0}>
        <ResponsiveContainer>
          <BarChart data={loans} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.ok} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Bills in range" empty={bills.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={bills}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar dataKey="amount" fill={colors.ink} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
