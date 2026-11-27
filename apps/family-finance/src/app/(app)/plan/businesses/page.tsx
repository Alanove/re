import { createBusinessAction } from "@/app/actions/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { requireAdult } from "@/lib/session";

export default async function PlanBusinessesPage() {
  const { member } = await requireAdult();

  const businesses = await prisma.business.findMany({
    where: { householdId: member.householdId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Businesses</h1>
        <p className="text-sm text-muted">Side businesses used when logging income and spend.</p>
      </header>

      <section className="space-y-3">
        <ul className="space-y-1 text-sm">
          {businesses.map((business) => (
            <li key={business.id} className="rounded-xl border border-line bg-white px-3 py-2">
              {business.name}
            </li>
          ))}
        </ul>
        {businesses.length === 0 ? (
          <Empty hint="Add a business for work income and expenses" />
        ) : null}
        <form action={createBusinessAction} className="flex gap-2">
          <Input name="name" placeholder="Domain sales" required />
          <Button type="submit">Add</Button>
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
