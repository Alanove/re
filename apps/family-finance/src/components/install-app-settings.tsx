"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ensureInstallListener,
  getDeferredInstallPrompt,
  isIosSafari,
  isStandaloneDisplay,
  subscribeInstallAvailability,
} from "@/lib/install-app";

export function InstallAppSettings() {
  const [deferred, setDeferred] = useState(getDeferredInstallPrompt);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureInstallListener();
    setStandalone(isStandaloneDisplay());
    setIos(isIosSafari());
    setDeferred(getDeferredInstallPrompt());
    return subscribeInstallAvailability(() => {
      setDeferred(getDeferredInstallPrompt());
      setStandalone(isStandaloneDisplay());
    });
  }, []);

  async function install() {
    const promptEvent = deferred ?? getDeferredInstallPrompt();
    if (!promptEvent) {
      setMessage(
        ios
          ? "Use Share → Add to Home Screen."
          : "Install isn’t available in this browser yet. Try Chrome or Edge on your phone."
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setStandalone(true);
        setMessage("Installed. You can open it from your home screen.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (standalone) {
    return (
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <p className="font-medium">App on this device</p>
        <p className="mt-1 text-sm text-muted">You’re using the installed Family Finance app.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card space-y-3">
      <div>
        <p className="font-medium">Install as app</p>
        <p className="mt-1 text-sm text-muted">
          {ios
            ? "Add Family Finance to your home screen for a full-screen app that stays signed in."
            : "Install on this device for a home-screen icon and a full-screen app that stays signed in."}
        </p>
      </div>
      {ios && !deferred ? (
        <p className="text-sm text-muted">
          Tap Share <Share className="inline h-3.5 w-3.5" aria-hidden /> then{" "}
          <span className="font-medium text-ink">Add to Home Screen</span>.
        </p>
      ) : (
        <Button type="button" onClick={() => void install()} disabled={busy}>
          <Download className="h-4 w-4" />
          {busy ? "Installing…" : "Install Family Finance"}
        </Button>
      )}
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
