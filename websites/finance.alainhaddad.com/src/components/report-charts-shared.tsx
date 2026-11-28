"use client";

import { formatMoney } from "@/lib/money";

export function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

export function moneyTick(currency: string) {
  return (value: number) => formatMoney(Math.round(value * 100), currency);
}

export function moneyTooltip(currency: string) {
  return (value: unknown) =>
    formatMoney(Math.round(Number(Array.isArray(value) ? value[0] : value ?? 0) * 100), currency);
}

export function monthBounds(month: string): { from: string; to: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function activityHref(rangeQuery: string, extra: Record<string, string>) {
  const params = new URLSearchParams(rangeQuery);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/activity?${params.toString()}`;
}
