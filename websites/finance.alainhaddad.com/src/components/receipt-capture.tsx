"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ReceiptCapture({
  existingUrl,
}: {
  existingUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearLocal() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const showExisting = Boolean(existingUrl) && !removeExisting && !preview;

  return (
    <div className="space-y-2">
      <Label>Receipt</Label>
      <input type="hidden" name="removeReceipt" value={removeExisting && !preview ? "1" : "0"} />
      <input
        ref={inputRef}
        type="file"
        name="receipt"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (preview) URL.revokeObjectURL(preview);
          if (!file) {
            setPreview(null);
            return;
          }
          setRemoveExisting(false);
          setPreview(URL.createObjectURL(file));
        }}
      />
      {(preview || showExisting) && (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
          <img
            src={preview || existingUrl || ""}
            alt="Receipt preview"
            className="max-h-48 w-full object-contain bg-surface"
          />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 text-muted shadow-card hover:text-ink"
            aria-label="Remove receipt"
            onClick={() => {
              clearLocal();
              if (existingUrl) setRemoveExisting(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {preview || showExisting ? "Replace photo" : "Scan receipt"}
        </Button>
        {removeExisting && !preview && existingUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRemoveExisting(false)}
          >
            Keep existing
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Opens the camera on your phone. OCR can fill details later.</p>
    </div>
  );
}
