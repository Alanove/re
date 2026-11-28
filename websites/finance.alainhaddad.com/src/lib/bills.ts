import { clampPayoffDay } from "@/lib/utils";

export type BillLike = {
  amount: number;
  dueDay: number;
  endMonth: string | null;
  archivedAt: Date | null;
};

/** True when the bill is still active for the given YYYY-MM. */
export function billActiveInMonth(
  bill: Pick<BillLike, "endMonth" | "archivedAt">,
  month: string
): boolean {
  if (bill.archivedAt) return false;
  if (bill.endMonth && bill.endMonth < month) return false;
  return true;
}

/** Due date YYYY-MM-DD for a bill in a given month. */
export function billDueDate(month: string, dueDay: number): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const day = clampPayoffDay(year, monthNumber, dueDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}
