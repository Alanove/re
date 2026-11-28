import { addMonths } from "@/lib/utils";

export const PAYSLIP_SECTIONS = ["GROSS", "DEDUCTION", "ADDITION"] as const;
export type PayslipSection = (typeof PAYSLIP_SECTIONS)[number];

export type PayslipLineDef = {
  section: PayslipSection;
  code: string;
  label: string;
  sortOrder: number;
  /** Optional seasonal window YYYY-MM */
  startMonth?: string | null;
  endMonth?: string | null;
};

export const DEFAULT_PAYSLIP_LINES: PayslipLineDef[] = [
  { section: "GROSS", code: "BASIC", label: "Basic Salary", sortOrder: 10 },
  { section: "GROSS", code: "ADD_ON", label: "Add on Salary", sortOrder: 20 },
  { section: "GROSS", code: "HIGH_COL", label: "High Cost of Living", sortOrder: 30 },
  { section: "GROSS", code: "TRANSPORT_GROSS", label: "Transportation", sortOrder: 40 },
  { section: "DEDUCTION", code: "CNSS", label: "C.N.S.S", sortOrder: 110 },
  { section: "DEDUCTION", code: "INCOME_TAX", label: "Income Tax", sortOrder: 120 },
  { section: "DEDUCTION", code: "SCHOOL", label: "School Deduction", sortOrder: 130 },
  { section: "DEDUCTION", code: "SRSP", label: "SRSP", sortOrder: 140 },
  { section: "DEDUCTION", code: "INSURANCE", label: "Insurance Deduction", sortOrder: 150 },
  { section: "DEDUCTION", code: "OTHER_DED", label: "Other Deductions", sortOrder: 160 },
  { section: "ADDITION", code: "MOBILE", label: "Mobile Allowance", sortOrder: 210 },
  { section: "ADDITION", code: "REPRESENTATION", label: "Representation Fees", sortOrder: 220 },
  { section: "ADDITION", code: "FAMILY_ALLOWANCE", label: "Family Allowance", sortOrder: 230 },
  { section: "ADDITION", code: "OTHER_ADD", label: "Other Additions", sortOrder: 240 },
];

export type AmountLine = {
  section: string;
  code: string;
  amount: bigint | number;
  startMonth?: string | null;
  endMonth?: string | null;
  active?: boolean;
};

export function monthInRange(
  month: string,
  startMonth?: string | null,
  endMonth?: string | null
): boolean {
  if (startMonth && month < startMonth) return false;
  if (endMonth && month > endMonth) return false;
  return true;
}

export function effectiveAmount(line: AmountLine, month: string): bigint {
  if (line.active === false) return BigInt(0);
  if (!monthInRange(month, line.startMonth, line.endMonth)) return BigInt(0);
  return BigInt(line.amount);
}

export function sumSection(lines: AmountLine[], section: string, month: string): bigint {
  return lines
    .filter((line) => line.section === section)
    .reduce((sum, line) => sum + effectiveAmount(line, month), BigInt(0));
}

export function netPaid(lines: AmountLine[], month: string): bigint {
  return (
    sumSection(lines, "GROSS", month) -
    sumSection(lines, "DEDUCTION", month) +
    sumSection(lines, "ADDITION", month)
  );
}

export function lineAmount(lines: AmountLine[], code: string, month: string): bigint {
  const line = lines.find((row) => row.code === code);
  if (!line) return BigInt(0);
  return effectiveAmount(line, month);
}

export function companyMatchFromBasic(basic: bigint, companyBps: number): bigint {
  return (basic * BigInt(companyBps)) / BigInt(10000);
}

export function srspFromBasic(basic: bigint, srspBps: number): bigint {
  return (basic * BigInt(srspBps)) / BigInt(10000);
}

/**
 * Company match should track the confirmed employee SRSP deduction for the
 * month (which may be edited independently of the stored BASIC line).
 */
export function companyMatchFromSrsp(
  srsp: bigint,
  companyBps: number,
  srspBps: number
): bigint {
  if (srspBps > 0) {
    return (srsp * BigInt(companyBps)) / BigInt(srspBps);
  }
  return BigInt(0);
}

export function shouldShowPayslipPrompt(dayOfMonth: number, appearFromDay: number): boolean {
  return dayOfMonth >= appearFromDay;
}

/**
 * From appearFromDay onward, salary arrives early for the *next* month,
 * so Home focuses settlement on that upcoming month.
 */
export function upcomingSettlementMonth(
  asOfMonth: string,
  dayOfMonth: number,
  appearFromDay: number
): string {
  if (dayOfMonth >= appearFromDay) {
    return addMonths(asOfMonth, 1);
  }
  return asOfMonth;
}

/** Months to show on Home settle once the early-salary window opens. */
export function settlementMonthsToShow(
  asOfMonth: string,
  dayOfMonth: number,
  appearFromDay: number
): string[] {
  if (!shouldShowPayslipPrompt(dayOfMonth, appearFromDay)) {
    return [asOfMonth];
  }
  const upcoming = upcomingSettlementMonth(asOfMonth, dayOfMonth, appearFromDay);
  if (upcoming === asOfMonth) {
    return [asOfMonth];
  }
  return [asOfMonth, upcoming];
}
