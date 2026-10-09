import type { Metadata } from "next";
import { QuotesList } from "@/components/admin/QuotesList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage() {
  await requirePermission("quotes.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Quote requests
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Enquiries from the contact form. Notes are internal and never sent to
          the customer.
        </p>
      </header>

      <Card>
        <QuotesList />
      </Card>
    </div>
  );
}
