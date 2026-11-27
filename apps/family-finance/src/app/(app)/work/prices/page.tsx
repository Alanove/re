import {
  createBillableCategoryAction,
  updateBillableCategoryAction,
} from "@/app/actions/work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { fromMinorUnits } from "@/lib/money";
import { seedBillableCategories } from "@/lib/seed-billable";
import { requireAdult } from "@/lib/session";

export default async function WorkPricesPage() {
  const { member } = await requireAdult();
  await seedBillableCategories(member.householdId);

  const billableCategories = await prisma.billableCategory.findMany({
    where: { householdId: member.householdId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Price list</h1>
        <p className="text-sm text-muted">Default prices for invoice line categories.</p>
      </header>

      <section className="space-y-3">
        <div className="space-y-2">
          {billableCategories.map((category) => (
            <form
              key={category.id}
              action={updateBillableCategoryAction}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3 shadow-card"
            >
              <input type="hidden" name="id" value={category.id} />
              <p className="min-w-[8rem] flex-1 font-medium">{category.name}</p>
              <Input
                name="defaultPrice"
                className="w-28"
                defaultValue={fromMinorUnits(category.defaultPrice).toFixed(2)}
                required
              />
              <Button type="submit" size="sm" variant="secondary">
                Save
              </Button>
            </form>
          ))}
        </div>
        <form
          action={createBillableCategoryAction}
          className="grid gap-2 rounded-2xl border border-dashed border-line p-4"
        >
          <Label>Add category</Label>
          <Input name="name" placeholder="Category name" required />
          <Input name="defaultPrice" placeholder="Default price" required />
          <Button type="submit" size="sm">
            Add category
          </Button>
        </form>
      </section>
    </div>
  );
}
