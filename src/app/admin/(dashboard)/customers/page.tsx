import type { Metadata } from "next";
import { CustomersList } from "@/components/admin/CustomersList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  await requirePermission("customers.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Customers
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Everyone who has registered or ordered. Lifetime value excludes
          cancelled orders.
        </p>
      </header>

      <Card>
        <CustomersList />
      </Card>
    </div>
  );
}
