import {
  archiveCreditCardAction,
  createCreditCardAction,
  payCardCycleAction,
  updateCreditCardAction,
} from "@/app/actions/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { openCardCycles } from "@/lib/money-service";
import { requireAdult } from "@/lib/session";

export default async function PlanCardsPage() {
  const { member } = await requireAdult();
  const currency = member.household.currency;

  const [cards, cycles] = await Promise.all([
    prisma.creditCard.findMany({
      where: { householdId: member.householdId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    openCardCycles(member.householdId),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Credit cards</h1>
        <p className="text-sm text-muted">Cards and open cycles waiting to be paid.</p>
      </header>

      <section className="space-y-3">
        {cards.map((card) => {
          const open = cycles.find((cycle) => cycle.creditCardId === card.id);
          return (
            <div key={card.id} className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{card.name}</p>
                  <p className="text-sm text-muted">
                    Payoff day {card.payoffDay}
                    {open ? ` · open ${formatMoney(open.total, currency)} due ${open.dueDate}` : ""}
                  </p>
                </div>
                {open && open.total > 0 && (
                  <form action={payCardCycleAction}>
                    <input type="hidden" name="cycleId" value={open.id} />
                    <Button size="sm" type="submit">
                      I paid the card
                    </Button>
                  </form>
                )}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Edit</summary>
                <form action={updateCreditCardAction} className="mt-2 grid gap-2">
                  <input type="hidden" name="cardId" value={card.id} />
                  <Input name="name" defaultValue={card.name} required />
                  <Input
                    name="payoffDay"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={card.payoffDay}
                    required
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
                <form action={archiveCreditCardAction} className="mt-2">
                  <input type="hidden" name="cardId" value={card.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Archive
                  </Button>
                </form>
              </details>
            </div>
          );
        })}
        {cards.length === 0 && <Empty hint="Add a credit card" />}
        <form action={createCreditCardAction} className="grid gap-2 rounded-2xl border border-dashed border-line p-4">
          <Label>New card</Label>
          <Input name="name" placeholder="Visa" required />
          <Input name="payoffDay" type="number" min={1} max={31} placeholder="Payoff day" required />
          <Button type="submit">Add card</Button>
        </form>
      </section>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-sm text-muted">
      {hint}
    </div>
  );
}
