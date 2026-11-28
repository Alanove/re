"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import {
  REPORT_MORE_RANGE_OPTIONS,
  REPORT_QUICK_RANGE_OPTIONS,
  type ReportDateRangeId,
} from "@/lib/report-range";
import { cn } from "@/lib/utils";

export function ReportRangeBar({
  range,
  from,
  to,
}: {
  range: ReportDateRangeId;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nextRange, setNextRange] = useState<ReportDateRangeId>(range);
  const [nextFrom, setNextFrom] = useState(from);
  const [nextTo, setNextTo] = useState(to);

  function navigate(next: ReportDateRangeId, customFrom = nextFrom, customTo = nextTo) {
    const params = new URLSearchParams();
    params.set("range", next);
    if (next === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function applyMore() {
    navigate(nextRange, nextFrom, nextTo);
    setOpen(false);
  }

  const quickActive = REPORT_QUICK_RANGE_OPTIONS.some((row) => row.id === range);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REPORT_QUICK_RANGE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={pending}
          onClick={() => navigate(option.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            range === option.id
              ? "bg-ink text-on-ink"
              : "border border-line bg-card text-ink"
          )}
        >
          {option.label}
        </button>
      ))}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setNextRange(range);
            setNextFrom(from);
            setNextTo(to);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={quickActive ? "secondary" : "default"}
            disabled={pending}
          >
            More
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Date range</DialogTitle>
            <DialogDescription>Pick a preset or enter custom dates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {REPORT_MORE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setNextRange(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium",
                    nextRange === option.id
                      ? "bg-ink text-on-ink"
                      : "border border-line bg-card text-ink"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {nextRange === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="report-from">From</Label>
                  <Input
                    id="report-from"
                    type="date"
                    value={nextFrom}
                    onChange={(event) => setNextFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-to">To</Label>
                  <Input
                    id="report-to"
                    type="date"
                    value={nextTo}
                    onChange={(event) => setNextTo(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <Button type="button" onClick={applyMore} disabled={pending}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
