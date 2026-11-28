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

      <section className="space-y-4">
        {businesses.length === 0 ? (
          <Empty hint="Add a business for work income and expenses" />
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <li key={business.id} className="rounded-xl border border-line bg-card px-3 py-2">
                {business.name}
              </li>
            ))}
          </ul>
        )}
        <form action={createBusinessAction} className="flex max-w-lg gap-2">
          <Input name="name" placeholder="Domain sales" required />
          <Button type="submit">Add</Button>
        </form>
      </section>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 p-4 text-sm text-muted">
      {hint}
    </div>
  );
}
