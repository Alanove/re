import { computeLeft } from "@/lib/money";

export type ReportExpense = {
  amount: number;
  funding: "OWN" | "CARD" | "BORROWED";
  isCardPayoff: boolean;
  isLoanPayment: boolean;
  excludeFromSpending: boolean;
  categoryName: string;
  categoryKind: string;
  categoryId: string;
  memberId: string;
  memberName: string;
  businessName: string | null;
  date: string;
};

export type ReportIncome = {
  amount: number;
  kind: string;
  date: string;
  memberId?: string;
  memberName?: string;
};

export function incomeByKind(
  incomes: ReportIncome[]
): { kind: string; filter: string; amount: number }[] {
  const kinds = [
    { kind: "Salary", filter: "salary", match: "SALARY" },
    { kind: "Freelance", filter: "freelance", match: "FREELANCE" },
    { kind: "Other", filter: "other", match: "OTHER" },
  ] as const;
  return kinds.map((row) => ({
    kind: row.kind,
    filter: row.filter,
    amount: incomes
      .filter((income) => income.kind === row.match)
      .reduce((sum, income) => sum + income.amount, 0),
  }));
}

export function incomeByMember(
  incomes: ReportIncome[]
): { name: string; amount: number; memberId: string }[] {
  const map = new Map<string, { name: string; amount: number; memberId: string }>();
  for (const row of incomes) {
    const memberId = row.memberId ?? "";
    const name = row.memberName || "Unknown";
    const key = memberId || name;
    const existing = map.get(key);
    if (existing) {
      existing.amount += row.amount;
    } else {
      map.set(key, { name, amount: row.amount, memberId });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export function incomeByMonth(
  monthKeys: string[],
  incomes: ReportIncome[]
): { month: string; amount: number }[] {
  return monthKeys.map((month) => ({
    month,
    amount: incomes
      .filter((row) => row.date.startsWith(month))
      .reduce((sum, row) => sum + row.amount, 0),
  }));
}

export function invoiceMonthlyTotals(
  monthKeys: string[],
  invoices: {
    issueDate: string;
    total: number;
    paid: number;
  }[]
): { month: string; invoiced: number; collected: number }[] {
  return monthKeys.map((month) => {
    const rows = invoices.filter((invoice) => invoice.issueDate.startsWith(month));
    return {
      month,
      invoiced: rows.reduce((sum, row) => sum + row.total, 0),
      collected: rows.reduce((sum, row) => sum + row.paid, 0),
    };
  });
}

/** Expenses that count toward spending charts (not payoffs, not savings transfers). */
export function isChartSpending(expense: ReportExpense): boolean {
  if (expense.isCardPayoff) return false;
  if (expense.excludeFromSpending) return false;
  return true;
}

export function leftoverByMonth(
  monthKeys: string[],
  incomes: ReportIncome[],
  expenses: ReportExpense[]
): { month: string; leftover: number; income: number; pocket: number }[] {
  return monthKeys.map((month) => {
    const monthIncomes = incomes.filter((row) => row.date.startsWith(month));
    const monthExpenses = expenses.filter((row) => row.date.startsWith(month));
    const leftover = computeLeft({
      incomes: monthIncomes.map((row) => ({ amount: row.amount })),
      expenses: monthExpenses.map((row) => ({
        amount: row.amount,
        funding: row.funding,
        isCardPayoff: row.isCardPayoff,
        isLoanPayment: row.isLoanPayment,
      })),
    });
    const income = monthIncomes.reduce((sum, row) => sum + row.amount, 0);
    const pocket = monthExpenses
      .filter((row) => !row.excludeFromSpending)
      .filter(
        (row) => row.funding === "OWN" || row.isLoanPayment || row.isCardPayoff
      )
      .reduce((sum, row) => sum + row.amount, 0);
    return { month, leftover, income, pocket };
  });
}

export function sumBy<T>(
  rows: T[],
  keyFn: (row: T) => string,
  amountFn: (row: T) => number
): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, (map.get(key) ?? 0) + amountFn(row));
  }
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function fundingSplit(expenses: ReportExpense[]): {
  pocket: number;
  card: number;
  borrowed: number;
} {
  const spend = expenses.filter(isChartSpending);
  return {
    pocket: spend
      .filter((row) => row.funding === "OWN" || row.isLoanPayment)
      .reduce((sum, row) => sum + row.amount, 0),
    card: spend
      .filter((row) => row.funding === "CARD")
      .reduce((sum, row) => sum + row.amount, 0),
    borrowed: spend
      .filter((row) => row.funding === "BORROWED")
      .reduce((sum, row) => sum + row.amount, 0),
  };
}

export function rangeTotals(
  incomes: ReportIncome[],
  expenses: ReportExpense[]
): { income: number; pocket: number; leftover: number } {
  const leftover = computeLeft({
    incomes: incomes.map((row) => ({ amount: row.amount })),
    expenses: expenses.map((row) => ({
      amount: row.amount,
      funding: row.funding,
      isCardPayoff: row.isCardPayoff,
      isLoanPayment: row.isLoanPayment,
    })),
  });
  const income = incomes.reduce((sum, row) => sum + row.amount, 0);
  const pocket = expenses
    .filter((row) => !row.excludeFromSpending)
    .filter(
      (row) => row.funding === "OWN" || row.isLoanPayment || row.isCardPayoff
    )
    .reduce((sum, row) => sum + row.amount, 0);
  return { income, pocket, leftover };
}
