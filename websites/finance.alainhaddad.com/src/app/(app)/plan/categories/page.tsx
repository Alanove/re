import { createCategoryAction } from "@/app/actions/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { requireAdult } from "@/lib/session";

export default async function PlanCategoriesPage() {
  const { member } = await requireAdult();

  const categories = await prisma.category.findMany({
    where: { householdId: member.householdId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted">Spending labels for family and business expenses.</p>
      </header>

      <section className="space-y-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          {categories.map((category) => (
            <li key={category.id} className="rounded-full border border-line bg-card px-3 py-1">
              {category.name}
              {category.excludeFromSpending ? " · transfer" : ""}
            </li>
          ))}
        </ul>
        <form
          action={createCategoryAction}
          className="grid max-w-lg gap-2 sm:grid-cols-[1fr_auto_auto]"
        >
          <Input name="name" placeholder="New category" required />
          <select name="kind" className="h-11 rounded-xl border border-line bg-card px-3">
            <option value="FAMILY">Family</option>
            <option value="BUSINESS">Business</option>
          </select>
          <Button type="submit">Add</Button>
        </form>
      </section>
    </div>
  );
}
