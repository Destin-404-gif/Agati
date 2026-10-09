import type { Metadata } from "next";
import { StaffList } from "@/components/admin/StaffList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const staff = await requirePermission("staff.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Staff &amp; roles
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Every admin account and the permissions each role grants. Role
          definitions live in the database.
        </p>
      </header>

      <Card>
        <StaffList currentStaffId={staff.id} />
      </Card>
    </div>
  );
}
