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

type Props = {
  currency: string;
  leftoverByMonth: { month: string; leftover: number; income: number; pocket: number }[];
  incomeSplit: { kind: string; filter: string; amount: number }[];
  fundingSplit: { name: string; amount: number; filter: string }[];
  familyByCategory: { name: string; amount: number; categoryId: string }[];
  businessByCategory: { name: string; amount: number; categoryId: string }[];
  businessByBusiness: { name: string; amount: number }[];
  byMember: { name: string; amount: number; memberId: string }[];
  rangeQuery: string;
};

export function ReportsCharts(props: Props) {
  const router = useRouter();
  const tick = moneyTick(props.currency);
  const tooltipFormatter = moneyTooltip(props.currency);

  function href(extra: Record<string, string>) {
    return activityHref(props.rangeQuery, extra);
  }

  function openMonth(month?: string) {
    if (!month) return;
    const bounds = monthBounds(month);
    router.push(
      href({
        filter: "all",
        range: "custom",
        from: bounds.from,
        to: bounds.to,
      })
    );
  }

  return (
    <div className="space-y-4">
      <ChartCard title="Leftover by month" empty={props.leftoverByMonth.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.leftoverByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="leftover"
              name="Leftover"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            >
              {props.leftoverByMonth.map((row) => (
                <Cell key={row.month} fill={row.leftover < 0 ? "#b42318" : "#0f6b4c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Income vs pocket spending" empty={props.leftoverByMonth.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.leftoverByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Legend />
            <Bar
              dataKey="income"
              fill="#0f6b4c"
              name="Income"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            />
            <Bar
              dataKey="pocket"
              fill="#14201b"
              name="Pocket"
              onClick={(data) => openMonth((data as { month?: string }).month)}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Income split" empty={props.incomeSplit.every((row) => row.amount === 0)}>
        <ResponsiveContainer>
          <BarChart data={props.incomeSplit}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="kind" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#0f6b4c"
              onClick={(data) => {
                const filter = (data as { filter?: string }).filter ?? "all";
                router.push(href({ filter }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Spending by funding"
        empty={props.fundingSplit.every((row) => row.amount === 0)}
      >
        <ResponsiveContainer>
          <BarChart data={props.fundingSplit}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#14201b"
              onClick={(data) => {
                const filter = (data as { filter?: string }).filter ?? "all";
                router.push(href({ filter }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Family spending by category" empty={props.familyByCategory.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.familyByCategory} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={88} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#14201b"
              onClick={(data) => {
                const categoryId = (data as { categoryId?: string }).categoryId;
                router.push(href({ filter: "all", category: categoryId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Business costs by category" empty={props.businessByCategory.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.businessByCategory} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tick} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={88} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#0f6b4c"
              onClick={(data) => {
                const categoryId = (data as { categoryId?: string }).categoryId;
                router.push(href({ filter: "business", category: categoryId ?? "" }));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Business costs by business" empty={props.businessByBusiness.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.businessByBusiness}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#14201b"
              onClick={() => router.push(href({ filter: "business" }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Who spent" empty={props.byMember.length === 0}>
        <ResponsiveContainer>
          <BarChart data={props.byMember}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={tick} width={72} />
            <Tooltip formatter={tooltipFormatter as never} />
            <Bar
              dataKey="amount"
              fill="#0f6b4c"
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
