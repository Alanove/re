import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Future OCR can read Expense.receiptPath from this folder. */
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function receiptsRoot(): string {
  return path.join(process.cwd(), "data", "receipts");
}

export function absoluteReceiptPath(relativePath: string): string {
  const root = receiptsRoot();
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid receipt path");
  }
  return resolved;
}

export function validateReceiptFile(file: File): { ok: true; mime: string; ext: string } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: "No receipt image." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, error: "Receipt image is too large (max 8MB)." };
  }
  const mime = (file.type || "").toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP receipt photo." };
  }
  return { ok: true, mime: mime === "image/jpg" ? "image/jpeg" : mime, ext };
}

export async function saveExpenseReceipt(input: {
  householdId: string;
  expenseId: string;
  file: File;
}): Promise<{ relativePath: string; mime: string }> {
  const checked = validateReceiptFile(input.file);
  if (!checked.ok) {
    throw new Error(checked.error);
  }

  const relativePath = path.join(input.householdId, `${input.expenseId}.${checked.ext}`);
  const absolute = absoluteReceiptPath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await writeFile(absolute, buffer);
  // Store posix-style relative path for portability
  return {
    relativePath: relativePath.split(path.sep).join("/"),
    mime: checked.mime,
  };
}

export async function deleteReceiptFile(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  try {
    await unlink(absoluteReceiptPath(relativePath));
  } catch {
    // missing file is fine
  }
}

export function receiptFileFromFormData(formData: FormData): File | null {
  const value = formData.get("receipt");
  if (!value || !(value instanceof File) || value.size <= 0) {
    return null;
  }
  return value;
}
