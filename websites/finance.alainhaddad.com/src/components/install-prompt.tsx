"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissInstallPrompt,
  ensureInstallListener,
  getDeferredInstallPrompt,
  isInstallDismissed,
  isIosSafari,
  isStandaloneDisplay,
  subscribeInstallAvailability,
} from "@/lib/install-app";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(getDeferredInstallPrompt);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    ensureInstallListener();

    if (isStandaloneDisplay() || isInstallDismissed()) {
      setVisible(false);
      return;
    }

    setShowIos(isIosSafari());

    const sync = () => {
      if (isInstallDismissed() || isStandaloneDisplay()) {
        setVisible(false);
        setDeferred(null);
        return;
      }
      const next = getDeferredInstallPrompt();
      setDeferred(next);
      // Auto-banner only once: Chrome deferred prompt or iOS tip
      if (next || isIosSafari()) {
        setVisible(true);
      }
    };

    sync();
    return subscribeInstallAvailability(sync);
  }, []);

  function dismiss() {
    dismissInstallPrompt();
    setVisible(false);
  }

  async function install() {
    const promptEvent = deferred ?? getDeferredInstallPrompt();
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    dismissInstallPrompt();
    setVisible(false);
  }

  if (!visible || isInstallDismissed()) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 px-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ok text-sm font-bold text-on-ink">
          FF
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Install Family Finance</p>
          {showIos && !deferred ? (
            <p className="mt-1 text-sm text-muted">
              Tap Share <Share className="inline h-3.5 w-3.5" aria-hidden /> then{" "}
              <span className="font-medium text-ink">Add to Home Screen</span>. Opens like an app
              and stays signed in.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Add it to your home screen for a quick full-screen app that stays signed in.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred && (
              <Button type="button" size="sm" onClick={() => void install()}>
                <Download className="mr-1.5 h-4 w-4" />
                Install
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
