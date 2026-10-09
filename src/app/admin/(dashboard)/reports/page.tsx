import type { Metadata } from "next";
import { ReportsPanel } from "@/components/admin/ReportsPanel";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requirePermission("reports.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Reports
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Sales performance over a rolling window. Cancelled orders are
          excluded from every figure.
        </p>
      </header>

      <ReportsPanel />
    </div>
  );
}
