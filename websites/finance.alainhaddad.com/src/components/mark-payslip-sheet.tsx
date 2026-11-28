"use client";

import { useMemo, useState, useTransition } from "react";
import { markPayslipReceivedAction } from "@/app/actions/savings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertMinor, roundMinorToWholeMajor } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import {
  companyMatchFromSrsp,
  lineAmount,
  netPaid,
  type AmountLine,
} from "@/lib/payslip";

type Line = {
  code: string;
  label: string;
  section: string;
  amount: string;
  startMonth: string | null;
  endMonth: string | null;
  active: boolean;
};

function stripAmount(value: string): string {
  return String(value).replace(/,/g, "").trim();
}

function formatAmountInput(value: string): string {
  const raw = stripAmount(value);
  if (!raw) return "";
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, fracPart] = unsigned.split(".");
  if (!/^\d*$/.test(intPart ?? "") || (fracPart !== undefined && !/^\d*$/.test(fracPart))) {
    return value;
  }
  const intFormatted = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withFrac = fracPart !== undefined ? `${intFormatted}.${fracPart}` : intFormatted;
  return negative ? `-${withFrac}` : withFrac;
}

export function MarkPayslipSheet({
  templateId,
  month,
  salaryCurrency,
  booksCurrency,
  fxRate,
  srspBps,
  companyBps,
  lines,
}: {
  templateId: string;
  month: string;
  salaryCurrency: string;
  booksCurrency: string;
  fxRate: string | null;
  srspBps: number;
  companyBps: number;
  lines: Line[];
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.code, formatAmountInput(line.amount)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const amountLines: AmountLine[] = lines.map((line) => ({
      section: line.section,
      code: line.code,
      amount: BigInt(Math.round(Number(stripAmount(values[line.code] ?? "0")) * 100) || 0),
      startMonth: line.startMonth,
      endMonth: line.endMonth,
      active: line.active,
    }));
    const net = netPaid(amountLines, month);
    const srsp = lineAmount(amountLines, "SRSP", month);
    const company = companyMatchFromSrsp(srsp, companyBps, srspBps);
    const toBooks = (salaryMinor: bigint) => {
      if (salaryCurrency.toUpperCase() === booksCurrency.toUpperCase()) {
        return Number(salaryMinor);
      }
      if (!fxRate) return 0;
      try {
        return roundMinorToWholeMajor(
          convertMinor(salaryMinor, salaryCurrency, booksCurrency, [
            { fromCurrency: salaryCurrency, toCurrency: booksCurrency, rate: fxRate },
          ])
        );
      } catch {
        return 0;
      }
    };
    return {
      net,
      books: toBooks(net),
      srspBooks: toBooks(srsp),
      companyBooks: toBooks(company),
    };
  }, [values, lines, month, salaryCurrency, booksCurrency, fxRate, srspBps, companyBps]);

  const sections = [
    { id: "GROSS", title: "Gross" },
    { id: "DEDUCTION", title: "Deductions" },
    { id: "ADDITION", title: "Additions" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Mark received</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Mark payslip received</DialogTitle>
          <DialogDescription>
            Amounts are in {salaryCurrency}. Edit add-ons if needed, then confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          action={(formData) => {
            for (const [code, value] of Object.entries(values)) {
              formData.set(`line_${code}`, stripAmount(value));
            }
            setError(null);
            startTransition(async () => {
              const result = await markPayslipReceivedAction(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
            });
          }}
        >
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="month" value={month} />
          {sections.map((section) => (
            <div key={section.id} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {section.title}
              </h3>
              {lines
                .filter((line) => line.section === section.id)
                .map((line) => (
                  <div key={line.code} className="space-y-1">
                    <Label htmlFor={`line_${line.code}`}>
                      {line.label} ({salaryCurrency})
                    </Label>
                    <Input
                      id={`line_${line.code}`}
                      name={`line_${line.code}`}
                      inputMode="decimal"
                      value={values[line.code] ?? ""}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [line.code]: event.target.value }))
                      }
                      onBlur={() =>
                        setValues((prev) => ({
                          ...prev,
                          [line.code]: formatAmountInput(prev[line.code] ?? ""),
                        }))
                      }
                    />
                  </div>
                ))}
            </div>
          ))}
          <div className="rounded-2xl border border-line bg-card p-3 text-sm space-y-1">
            <p>
              Net:{" "}
              <span className="tabular font-semibold">
                {formatMoney(Number(preview.net), salaryCurrency)}
              </span>
            </p>
            <p className="text-muted">
              ≈ {formatMoney(preview.books, booksCurrency)} ({booksCurrency}
              {fxRate ? ` @ ${Number(fxRate).toLocaleString("en-US")}` : ""})
            </p>
            <p className="text-muted">
              SRSP ≈ {formatMoney(preview.srspBooks, booksCurrency)} · company match ≈{" "}
              {formatMoney(preview.companyBooks, booksCurrency)}
            </p>
          </div>
          {error && <p className="text-sm text-short-text">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Confirm received"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
