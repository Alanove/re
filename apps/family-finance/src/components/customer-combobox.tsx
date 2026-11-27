"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CustomerCombobox({
  customers,
  valueId,
  valueName,
  onChange,
}: {
  customers: { id: string; name: string }[];
  valueId: string;
  valueName?: string;
  onChange: (next: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [query, setQuery] = useState(
    () => valueName || customers.find((row) => row.id === valueId)?.name || ""
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (valueName !== undefined) {
      setQuery(valueName);
    }
  }, [valueName, valueId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) => row.name.toLowerCase().includes(q));
  }, [customers, query]);

  const exact = customers.find(
    (row) => row.name.toLowerCase() === query.trim().toLowerCase()
  );

  function selectRow(row: { id: string; name: string }) {
    setQuery(row.name);
    onChange({ id: row.id, name: row.name });
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => {
        if (filtered.length === 0) return -1;
        const next = index < 0 ? 0 : Math.min(index + 1, filtered.length - 1);
        queueMicrotask(() => {
          listRef.current
            ?.querySelectorAll<HTMLElement>("[data-option]")
            [next]?.scrollIntoView({ block: "nearest" });
        });
        return next;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => {
        if (filtered.length === 0) return -1;
        const next = index <= 0 ? 0 : index - 1;
        queueMicrotask(() => {
          listRef.current
            ?.querySelectorAll<HTMLElement>("[data-option]")
            [next]?.scrollIntoView({ block: "nearest" });
        });
        return next;
      });
      return;
    }
    if (event.key === "Enter" && open && highlight >= 0 && filtered[highlight]) {
      event.preventDefault();
      selectRow(filtered[highlight]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  return (
    <div className="relative space-y-1">
      <Label htmlFor="customerName">Customer</Label>
      <input type="hidden" name="customerId" value={exact?.id ?? valueId} />
      <div className="flex gap-1">
        <Input
          id="customerName"
          name="customerName"
          value={query}
          autoComplete="off"
          placeholder="Type or pick"
          required
          onChange={(event) => {
            const name = event.target.value;
            setQuery(name);
            setOpen(true);
            setHighlight(-1);
            const match = customers.find(
              (row) => row.name.toLowerCase() === name.trim().toLowerCase()
            );
            onChange({ id: match?.id ?? "", name });
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setHighlight(-1);
            }, 150);
          }}
        />
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
          aria-label="Show customers"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen((value) => !value);
            setHighlight(-1);
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-white shadow-card"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">
              New customer “{query.trim() || "…"}”
            </p>
          ) : (
            filtered.map((row, index) => (
              <button
                key={row.id}
                type="button"
                data-option
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm hover:bg-surface",
                  highlight === index && "bg-surface",
                  row.id === valueId && highlight !== index && "bg-ink text-white hover:bg-ink"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectRow(row)}
              >
                {row.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
