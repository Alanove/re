"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChartColumn,
  CalendarRange,
  Home,
  List,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import {
  canAccessPlan,
  canAccessReports,
  canAccessSavings,
  canAccessWork,
} from "@/lib/roles";
import { AddSheet } from "@/components/add-sheet";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const tabs = [
  { href: "/", label: "Home", icon: Home, show: () => true },
  { href: "/activity", label: "Activity", icon: List, show: () => true },
  { href: "/plan", label: "Plan", icon: CalendarRange, show: canAccessPlan },
  { href: "/savings", label: "Savings", icon: PiggyBank, show: canAccessSavings },
  { href: "/work", label: "Work", icon: BriefcaseBusiness, show: canAccessWork },
  { href: "/reports", label: "Reports", icon: ChartColumn, show: canAccessReports },
] as const;

export function AppShell({
  role,
  children,
  addContext,
}: {
  role: Role;
  children: React.ReactNode;
  addContext: {
    categories: { id: string; name: string; requiresBusiness: boolean }[];
    businesses: { id: string; name: string }[];
    cards: { id: string; name: string }[];
    members: { id: string; displayName: string }[];
    debts: { id: string; person: string; remaining: number }[];
    onlyAdult: boolean;
    currency: string;
    cashAvailable: number;
    customers: { id: string; name: string }[];
    openInvoices: {
      id: string;
      number: string;
      customerId: string;
      remainder: number;
    }[];
  };
}) {
  const pathname = usePathname();
  const visible = tabs.filter((tab) => tab.show(role));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-surface text-ink">
      <ServiceWorkerRegister />
      <InstallPrompt />
      <main className="flex-1 px-4 pb-28 pt-6 sm:px-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end justify-between gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {visible.map((tab) => {
            const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium",
                  active ? "text-ink" : "text-muted"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {tab.label}
              </Link>
            );
          })}
          <div className="flex flex-1 justify-center">
            <AddSheet role={role} {...addContext} />
          </div>
        </div>
      </nav>
    </div>
  );
}
