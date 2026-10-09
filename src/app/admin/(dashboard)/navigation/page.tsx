import type { Metadata } from "next";
import { NavigationManager } from "@/components/admin/NavigationManager";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Navigation" };

export default async function NavigationPage() {
  await requirePermission("products.edit");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Navigation</h1>
        <p className="mt-1 text-sm text-fg-soft">Manage the two navigation bars and each menu item&apos;s sections.</p>
      </header>
      <Card><NavigationManager /></Card>
    </div>
  );
}