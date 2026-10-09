import type { Metadata } from "next";
import { ContentList } from "@/components/admin/ContentList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  await requirePermission("content.edit");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Content
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Banners, static pages and site-wide announcements.
        </p>
      </header>

      <Card>
        <ContentList />
      </Card>
    </div>
  );
}
