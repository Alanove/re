export const INSTALL_DISMISS_KEY = "ff-install-dismissed";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Survives AppShell remounts within the same JS realm. */
let dismissedMemory = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function isInstallDismissed(): boolean {
  if (dismissedMemory) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  dismissedMemory = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      // private mode — memory flag still holds for this tab
    }
  }
  notify();
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const other = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !other;
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  notify();
}

export function subscribeInstallAvailability(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function ensureInstallListener(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __ffInstallListening?: boolean };
  if (w.__ffInstallListening) return;
  w.__ffInstallListening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
  });
}
