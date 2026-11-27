"use client";

import { useRouter } from "next/navigation";
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
import type { ActivityDateRangeId } from "@/lib/utils";

const dateOptions: { id: ActivityDateRangeId; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "past_week", label: "Past week" },
  { id: "past_month", label: "Past month" },
  { id: "last_3_months", label: "Last 3 months" },
  { id: "this_year", label: "This year" },
  { id: "last_year", label: "Last year" },
  { id: "custom", label: "Custom range" },
];

const amountOptions = [
  { id: "", label: "Any amount" },
  { id: "100", label: "≥ 100" },
  { id: "500", label: "≥ 500" },
  { id: "1000", label: "≥ 1000" },
  { id: "custom", label: "Custom range" },
] as const;

export function ActivityFilters({
  filter,
  range,
  from,
  to,
  min,
  max,
  q,
  category,
  memberId,
  categories,
  members,
  exportHref,
}: {
  filter: string;
  range: ActivityDateRangeId;
  from: string;
  to: string;
  min: string;
  max: string;
  q: string;
  category: string;
  memberId: string;
  categories: { id: string; name: string }[];
  members: { id: string; displayName: string }[];
  exportHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nextRange, setNextRange] = useState<ActivityDateRangeId>(range);
  const [nextFrom, setNextFrom] = useState(from);
  const [nextTo, setNextTo] = useState(to);
  const [amountMode, setAmountMode] = useState(
    min && max ? "custom" : min && !max ? min : ""
  );
  const [nextMin, setNextMin] = useState(min);
  const [nextMax, setNextMax] = useState(max);
  const [nextQ, setNextQ] = useState(q);
  const [nextCategory, setNextCategory] = useState(category);
  const [nextMember, setNextMember] = useState(memberId);

  function buildParams() {
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("range", nextRange);
    if (nextRange === "custom") {
      if (nextFrom) params.set("from", nextFrom);
      if (nextTo) params.set("to", nextTo);
    }
    if (amountMode === "custom") {
      if (nextMin) params.set("min", nextMin);
      if (nextMax) params.set("max", nextMax);
    } else if (amountMode) {
      params.set("min", amountMode);
    }
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextCategory) params.set("category", nextCategory);
    if (nextMember) params.set("member", nextMember);
    return params;
  }

  function apply() {
    const params = buildParams();
    startTransition(() => {
      router.push(`/activity?${params.toString()}`);
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={exportHref}
        className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink"
      >
        CSV
      </a>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="secondary">
            Filters
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activity filters</DialogTitle>
            <DialogDescription>Narrow by search, date, person, and amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activity-q">Search</Label>
              <Input
                id="activity-q"
                value={nextQ}
                onChange={(e) => setNextQ(e.target.value)}
                placeholder="Description or category"
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="activity-category">Category</Label>
                <select
                  id="activity-category"
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  value={nextCategory}
                  onChange={(e) => setNextCategory(e.target.value)}
                >
                  <option value="">Any category</option>
                  {categories.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {members.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="activity-member">Who</Label>
                <select
                  id="activity-member"
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  value={nextMember}
                  onChange={(e) => setNextMember(e.target.value)}
                >
                  <option value="">Anyone</option>
                  {members.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>When</Label>
              <div className="flex flex-wrap gap-2">
                {dateOptions.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={nextRange === option.id ? "default" : "secondary"}
                    onClick={() => setNextRange(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {nextRange === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={nextFrom} onChange={(e) => setNextFrom(e.target.value)} />
                  <Input type="date" value={nextTo} onChange={(e) => setNextTo(e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="flex flex-wrap gap-2">
                {amountOptions.map((option) => (
                  <Button
                    key={option.id || "any"}
                    type="button"
                    size="sm"
                    variant={amountMode === option.id ? "default" : "secondary"}
                    onClick={() => setAmountMode(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {amountMode === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Min"
                    value={nextMin}
                    onChange={(e) => setNextMin(e.target.value)}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="Max"
                    value={nextMax}
                    onChange={(e) => setNextMax(e.target.value)}
                  />
                </div>
              )}
            </div>
            <Button type="button" className="w-full" disabled={pending} onClick={apply}>
              {pending ? "Applying…" : "Apply filters"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
