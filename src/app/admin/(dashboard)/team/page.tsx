import type { Metadata } from "next";
import { TeamManager } from "@/components/admin/TeamManager";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requirePermission("staff.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Team
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          The people behind Agati - owner, administrators and the workers in
          the workshop. The owner runs the show and can never be deleted.
        </p>
      </header>

      <TeamManager />
    </div>
  );
}