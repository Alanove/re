"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme,
  readThemePreference,
  storeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readThemePreference();
    setPreference(stored);
    applyTheme(stored);
    setReady(true);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePreference() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    storeThemePreference(next);
    applyTheme(next);
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-line bg-card p-0.5",
        className
      )}
      role="group"
      aria-label="Theme"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = ready && preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-ink text-on-ink" : "text-muted hover:text-ink"
            )}
            aria-pressed={active}
            title={option.label}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {compact ? <span className="sr-only">{option.label}</span> : option.label}
          </button>
        );
      })}
    </div>
  );
}
