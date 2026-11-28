"use client";

import { useSyncExternalStore } from "react";

export type ChartColors = {
  line: string;
  ink: string;
  ok: string;
  short: string;
  muted: string;
};

const lightFallback: ChartColors = {
  line: "#d4d4d4",
  ink: "#0a0a0a",
  ok: "#0f6b4c",
  short: "#9b1c1c",
  muted: "#525252",
};

let cached: ChartColors = lightFallback;

function readChartColors(): ChartColors {
  if (typeof window === "undefined") return lightFallback;
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  const next: ChartColors = {
    line: get("--line", lightFallback.line),
    ink: get("--ink", lightFallback.ink),
    ok: get("--ok", lightFallback.ok),
    short: get("--short", lightFallback.short),
    muted: get("--muted", lightFallback.muted),
  };
  if (
    next.line === cached.line &&
    next.ink === cached.ink &&
    next.ok === cached.ok &&
    next.short === cached.short &&
    next.muted === cached.muted
  ) {
    return cached;
  }
  cached = next;
  return cached;
}

function getServerSnapshot(): ChartColors {
  return lightFallback;
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onStoreChange);
  };
}

export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, readChartColors, getServerSnapshot);
}
