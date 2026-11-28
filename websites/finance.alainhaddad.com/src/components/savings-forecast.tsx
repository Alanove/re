"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { projectSavingsGrowth } from "@/lib/savings";

export function SavingsForecast({
  startMinor,
  monthlyContributionMinor,
  currency,
}: {
  startMinor: number;
  monthlyContributionMinor: number;
  currency: string;
}) {
  const [years, setYears] = useState("4");
  const [annualPercent, setAnnualPercent] = useState("5");

  const projected = useMemo(() => {
    const yearsNum = Number(years);
    const pct = Number(annualPercent);
    if (!Number.isFinite(yearsNum) || yearsNum < 0 || !Number.isFinite(pct) || pct < 0) {
      return null;
    }
    return projectSavingsGrowth({
      startMinor,
      monthlyContributionMinor,
      years: yearsNum,
      annualRate: pct / 100,
    });
  }, [years, annualPercent, startMinor, monthlyContributionMinor]);

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <h2 className="font-medium">Growth forecast</h2>
      <p className="text-sm text-muted">
        Starts from your current total
        {monthlyContributionMinor > 0
          ? ` and adds ${formatMoney(monthlyContributionMinor, currency)} from salary each month.`
          : ". Mark this month’s payslip to include the salary contribution."}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="forecastYears">Years</Label>
          <Input
            id="forecastYears"
            inputMode="decimal"
            value={years}
            onChange={(event) => setYears(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="forecastRate">Annual growth %</Label>
          <Input
            id="forecastRate"
            inputMode="decimal"
            value={annualPercent}
            onChange={(event) => setAnnualPercent(event.target.value)}
          />
        </div>
      </div>
      {projected !== null && (
        <p className="tabular text-lg font-semibold">
          ≈ {formatMoney(projected, currency)}
        </p>
      )}
    </div>
  );
}
