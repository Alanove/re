import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { absoluteReceiptPath } from "@/lib/receipts";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ expenseId: string }> }
) {
  const session = await getSessionUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.member.findUnique({
    where: { userId: session.user.id },
  });
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { expenseId } = await context.params;
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
    select: { receiptPath: true, receiptMime: true },
  });

  if (!expense?.receiptPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await readFile(absoluteReceiptPath(expense.receiptPath));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": expense.receiptMime || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
