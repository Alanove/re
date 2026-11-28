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
  Settings,
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
import { ThemeToggle } from "@/components/theme-toggle";

const tabs = [
  { href: "/", label: "Home", icon: Home, show: () => true },
  { href: "/activity", label: "Activity", icon: List, show: () => true },
  { href: "/plan", label: "Plan", icon: CalendarRange, show: canAccessPlan },
  { href: "/savings", label: "Savings", icon: PiggyBank, show: canAccessSavings },
  { href: "/work", label: "Work", icon: BriefcaseBusiness, show: canAccessWork },
  { href: "/reports", label: "Reports", icon: ChartColumn, show: canAccessReports },
] as const;

type AddContext = {
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

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  layout,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  layout: "side" | "bottom";
}) {
  if (layout === "side") {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active ? "bg-ink text-on-ink" : "text-muted hover:bg-card hover:text-ink"
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium",
        active ? "text-ink" : "text-muted"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
      {label}
    </Link>
  );
}

export function AppShell({
  role,
  children,
  addContext,
}: {
  role: Role;
  children: React.ReactNode;
  addContext: AddContext;
}) {
  const pathname = usePathname();
  const visible = tabs.filter((tab) => tab.show(role));
  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <ServiceWorkerRegister />
      <InstallPrompt />

      <div className="mx-auto flex min-h-dvh w-full">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
          <div className="mb-6 px-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Family Finance
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {visible.map((tab) => {
              const active =
                pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
              return (
                <NavLink
                  key={tab.href}
                  href={tab.href}
                  label={tab.label}
                  icon={tab.icon}
                  active={active}
                  layout="side"
                />
              );
            })}
            <div className="mt-3 px-0">
              <AddSheet role={role} {...addContext} trigger="sidebar" />
            </div>
          </nav>
          <div className="mt-auto space-y-3 border-t border-line pt-4">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                settingsActive
                  ? "bg-ink text-on-ink"
                  : "text-muted hover:bg-card hover:text-ink"
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              Settings
            </Link>
            <div className="px-1">
              <ThemeToggle className="w-full justify-between" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
            <div className="mx-auto flex w-full items-end justify-between gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
              {visible.map((tab) => {
                const active =
                  pathname === tab.href ||
                  (tab.href !== "/" && pathname.startsWith(tab.href));
                return (
                  <NavLink
                    key={tab.href}
                    href={tab.href}
                    label={tab.label}
                    icon={tab.icon}
                    active={active}
                    layout="bottom"
                  />
                );
              })}
              <div className="flex flex-1 justify-center">
                <AddSheet role={role} {...addContext} trigger="fab" />
              </div>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
