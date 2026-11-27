/** Money math for Left, Owed, headline, and forecast advice. Amounts are integer minor units. */

export type Funding = "OWN" | "CARD" | "BORROWED";

export type MonthIncome = {
  amount: number;
};

export type MonthExpense = {
  amount: number;
  funding: Funding;
  isCardPayoff: boolean;
  /** True when this expense is a loan installment marked paid. */
  isLoanPayment: boolean;
};

export type OpenCardCycle = {
  total: number;
};

export type OpenDebt = {
  amount: number;
  repaid: number;
};

export type MonthSnapshot = {
  incomes: MonthIncome[];
  expenses: MonthExpense[];
};

export type ForecastInput = {
  name: string;
  amount: number;
  /** Target month as YYYY-MM */
  month: string;
  /** Current month as YYYY-MM */
  asOfMonth: string;
  /** Left values for the last three full months (oldest first). */
  recentLeft: number[];
};

export type ForecastAdvice = {
  monthsLeft: number;
  setAsidePerMonth: number;
  usualLeftover: number;
  shortfallPerMonth: number;
  fits: boolean;
  sentence: string;
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Own-pocket outflows: OWN expenses, loan installments, and card payoffs. */
export function ownPocketOutflow(expenses: MonthExpense[]): number {
  return sum(
    expenses
      .filter(
        (expense) =>
          expense.funding === "OWN" ||
          expense.isCardPayoff ||
          expense.isLoanPayment
      )
      .map((expense) => expense.amount)
  );
}

/** Left = income − money that actually left your pocket. */
export function computeLeft(snapshot: MonthSnapshot): number {
  const income = sum(snapshot.incomes.map((row) => row.amount));
  return income - ownPocketOutflow(snapshot.expenses);
}

/** Remaining balance on open personal debts. */
export function debtRemaining(debt: OpenDebt): number {
  return Math.max(0, debt.amount - debt.repaid);
}

/** Owed = open card-cycle totals + unpaid personal debt. */
export function computeOwed(cardCycles: OpenCardCycle[], debts: OpenDebt[]): number {
  const cards = sum(cardCycles.map((cycle) => cycle.total));
  const people = sum(debts.map(debtRemaining));
  return cards + people;
}

/** Headline = Left − Owed. */
export function computeHeadline(left: number, owed: number): number {
  return left - owed;
}

export function isShort(left: number, owed: number): boolean {
  return left < 0 || owed > 0;
}

function parseYearMonth(month: string): { year: number; month: number } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  return { year, month: monthNumber };
}

/** Whole months from asOfMonth to targetMonth (exclusive of asOf, inclusive of target). */
export function monthsUntil(asOfMonth: string, targetMonth: string): number {
  const asOf = parseYearMonth(asOfMonth);
  const target = parseYearMonth(targetMonth);
  return (target.year - asOf.year) * 12 + (target.month - asOf.month);
}

function formatMonthLabel(month: string): string {
  const { year, month: monthNumber } = parseYearMonth(month);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Format minor units as a whole major-unit number for concrete copy. */
function formatAmount(minorUnits: number): string {
  return String(Math.round(minorUnits / 100));
}

/**
 * Forecast advice. Does not create an expense.
 * Set-aside = amount ÷ months left (at least 1). Usual leftover = average of recent Left.
 */
export function forecastAdvice(input: ForecastInput): ForecastAdvice {
  const rawMonths = monthsUntil(input.asOfMonth, input.month);
  const monthsLeft = Math.max(1, rawMonths);
  const setAsidePerMonth = Math.ceil(input.amount / monthsLeft);
  const usualLeftover =
    input.recentLeft.length === 0
      ? 0
      : Math.round(sum(input.recentLeft) / input.recentLeft.length);
  const shortfallPerMonth = Math.max(0, setAsidePerMonth - usualLeftover);
  const fits = usualLeftover >= setAsidePerMonth;
  const monthLabel = formatMonthLabel(input.month);

  const sentence = fits
    ? `Set aside ${formatAmount(setAsidePerMonth)} a month until ${monthLabel}. You usually have ${formatAmount(usualLeftover)} left after bills, so this fits.`
    : `Set aside ${formatAmount(setAsidePerMonth)} a month until ${monthLabel}. You are ${formatAmount(shortfallPerMonth)} short each month.`;

  return {
    monthsLeft,
    setAsidePerMonth,
    usualLeftover,
    shortfallPerMonth,
    fits,
    sentence,
  };
}

export function formatMoney(amount: number, currency = "USD"): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** Convert a major-unit decimal string or number to minor units. */
export function toMinorUnits(value: string | number): number {
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    throw new Error("Invalid amount");
  }
  return Math.round(number * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}
