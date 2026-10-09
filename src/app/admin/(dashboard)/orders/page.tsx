import type { Metadata } from "next";
import { OrdersList } from "@/components/admin/OrdersList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  await requirePermission("orders.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Orders
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Move orders through the workshop and out for delivery. Line items are
          order history and cannot be edited.
        </p>
      </header>

      <Card>
        <OrdersList />
      </Card>
    </div>
  );
}
