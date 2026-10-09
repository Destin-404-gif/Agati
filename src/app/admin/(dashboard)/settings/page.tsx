import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.edit");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Store details and commerce defaults. Each field shows the key it
          writes to.
        </p>
      </header>

      <Card>
        <SettingsForm />
      </Card>
    </div>
  );
}
