import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/Toast";
import { query } from "@/lib/db";
import { getMedia } from "@/lib/media";
import { LOGO } from "@/lib/images";
import { getCurrentStaff } from "@/lib/staff";
import type { ShellAlert } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Agati Admin", template: "%s · Agati Admin" },
  robots: { index: false, follow: false },
};

/** Counts surfaced in the top bar notification bell. */
async function loadAlerts(): Promise<ShellAlert[]> {
  try {
    const rows = await query<{
      new_quotes: string;
      open_orders: string;
      low_stock: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM quote_requests WHERE status = 'new')        AS new_quotes,
        (SELECT COUNT(*)::text FROM orders WHERE status IN ('pending','processing')) AS open_orders,
        (SELECT COUNT(*)::text FROM products WHERE stock_quantity <= 3 AND status = 'active') AS low_stock
    `);

    const r = rows[0];
    const alerts: ShellAlert[] = [];

    if (Number(r.new_quotes) > 0) {
      alerts.push({
        id: "quotes",
        label: "New quote requests",
        count: Number(r.new_quotes),
        href: "/admin/quotes?status=new",
      });
    }
    if (Number(r.open_orders) > 0) {
      alerts.push({
        id: "orders",
        label: "Orders to process",
        count: Number(r.open_orders),
        href: "/admin/orders?status=pending",
      });
    }
    if (Number(r.low_stock) > 0) {
      alerts.push({
        id: "stock",
        label: "Low or no stock",
        count: Number(r.low_stock),
        href: "/admin/products?stock=low",
      });
    }

    return alerts;
  } catch {
    return [];
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");

  const alerts = await loadAlerts();
  const media = await getMedia(["logo"]);

  return (
    <ToastProvider>
      <AdminShell
        staff={{
          id: staff.id,
          username: staff.username,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
          roleName: staff.roleName,
          permissions: staff.permissions,
        }}
        alerts={alerts}
        logo={media.logo?.url ?? LOGO}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
