import Link from "next/link";
import type { Metadata } from "next";
import { AreaTrend, BarList, Donut, Legend } from "@/components/admin/charts";
import { Icon } from "@/components/admin/icons";
import { Badge, Card, CardHeader, EmptyState } from "@/components/admin/ui";
import {
  chartColor,
  formatMoney,
  MONEY,
  MONEY_PENCE,
} from "@/lib/admin-format";
import { getDashboard, type AuditEntry } from "@/lib/admin-stats";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

/** Attach palette colours to a status breakdown for the donut. */
function withColors(rows: { label: string; value: number }[]) {
  return rows.map((r, i) => ({ ...r, color: chartColor(i) }));
}

export default async function DashboardPage() {
  const staff = await requirePermission("dashboard.view");
  const data = await getDashboard(30);
  const { kpis } = data;

  const firstName =
    staff.fullName?.trim().split(/\s+/)[0] ?? staff.email.split("@")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ head */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Good to see you, {firstName}
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            Here is how the workshop is doing over the last 30 days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction href="/admin/products/new" icon="plus" label="New product" />
          <QuickAction href="/admin/quotes" icon="quote" label="View quotes" />
          <QuickAction href="/admin/orders" icon="cart" label="View orders" />
        </div>
      </header>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue"
          value={MONEY.format(kpis.revenue)}
          hint={`${MONEY.format(kpis.revenueOpen)} not yet settled`}
          icon="chart"
          href="/admin/reports"
        />
        <Kpi
          label="Orders"
          value={String(kpis.orders)}
          hint={`${kpis.openOrders} awaiting action`}
          icon="cart"
          href="/admin/orders"
        />
        <Kpi
          label="Quotes"
          value={String(kpis.quotes)}
          hint={`${kpis.newQuotes} new`}
          icon="quote"
          href="/admin/quotes"
        />
        <Kpi
          label="Products"
          value={String(kpis.products)}
          hint={`${kpis.activeProducts} live · ${kpis.lowStock} low stock`}
          icon="box"
          href="/admin/products"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Customers" value={String(kpis.customers)} hint={`+${kpis.newCustomers} in 30 days`} />
        <MiniStat label="Average order" value={MONEY_PENCE.format(kpis.averageOrder)} hint="Excluding cancelled" />
        <MiniStat label="Active staff" value={String(kpis.staff)} hint="With admin access" />
        <MiniStat
          label="Needs attention"
          value={String(kpis.newQuotes + kpis.openOrders)}
          hint="Quotes and orders"
          tone={kpis.newQuotes + kpis.openOrders > 0 ? "warning" : "calm"}
        />
      </div>

      {/* ---------------------------------------------------------- charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Orders per day"
            description="Last 30 days, cancelled orders excluded."
            action={
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-fg-soft">
                  <span className="h-2 w-2 rounded-full bg-sage" /> Orders
                </span>
                <span className="flex items-center gap-1.5 text-fg-soft">
                  <span className="h-2 w-2 rounded-full bg-terracotta" /> Revenue
                </span>
              </div>
            }
          />
          <AreaTrend
            points={data.trend.map((t) => ({ label: t.label, value: t.value }))}
            format="plain"
            caption="Orders per day over the last 30 days"
          />
          <p className="mt-3 text-sm text-fg-soft">
            Revenue in that window:{" "}
            <span className="font-semibold">
              {formatMoney(
                data.revenueSeries.reduce((s, r) => s + r.value, 0),
              )}
            </span>
          </p>
        </Card>

        <Card>
          <CardHeader title="Order status" description="Where orders sit today." />
          {data.orderStatuses.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders will appear here." />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Donut segments={withColors(data.orderStatuses)} size={148} />
              <Legend segments={withColors(data.orderStatuses)} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Catalogue by category"
            description="Product counts per category."
            action={
              <Link
                href="/admin/products"
                className="text-xs font-semibold text-terracotta underline-offset-4 hover:underline"
              >
                Manage
              </Link>
            }
          />
          <BarList
            items={data.topCategories.map((c) => ({ label: c.name, value: c.products }))}
            format="plain"
          />
        </Card>

        <Card>
          <CardHeader title="Quote pipeline" description="Enquiries by status." />
          {data.quoteStatuses.length === 0 ? (
            <EmptyState
              title="No quote requests yet"
              description="Enquiries from the website land here."
              action={
                <Link
                  href="/"
                  className="text-xs font-semibold text-terracotta underline-offset-4 hover:underline"
                >
                  View the quote form
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Donut segments={withColors(data.quoteStatuses)} size={148} />
              <Legend segments={withColors(data.quoteStatuses)} />
            </div>
          )}
        </Card>
      </div>

      {/* -------------------------------------------------------- activity */}
      <Card>
        <CardHeader
          title="Recent activity"
          description="Everything staff have changed, newest first."
        />
        {data.activity.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Changes you make in the admin will be logged here."
          />
        ) : (
          <ul className="divide-y divide-outline-faint">
            {data.activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- fragments */

function Kpi({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-outline-strong">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            {label}
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fill text-fg-muted">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-1.5 text-xs text-fg-muted">{hint}</p>
      </Card>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = "calm",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "calm" | "warning";
}) {
  return (
    <Card className="py-4">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-lg font-semibold tabular-nums ${
          tone === "warning" ? "text-terracotta" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>
    </Card>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
        className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-outline-strong"
    >
      <Icon name={icon} className="h-4 w-4" filled={icon === "plus"} />
      {label}
    </Link>
  );
}

const ACTION_TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  status: "warning",
  export: "neutral",
  login: "neutral",
  login_failed: "danger",
  logout: "neutral",
  password_reset: "warning",
  settings: "info",
};

function ActivityRow({ entry }: { entry: AuditEntry }) {
  const when = new Date(entry.createdAt);
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill">
        <Icon name="edit" className="h-3.5 w-3.5 text-fg-muted" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{entry.staffEmail ?? "System"}</span>{" "}
          <span className="text-fg-soft">
            {describe(entry.action, entry.entity)}
          </span>
        </p>
        {entry.entityId && (
          <p className="truncate text-xs text-fg-faint">
            #{entry.entityId}
          </p>
        )}
      </div>
      <Badge tone={ACTION_TONE[entry.action] ?? "neutral"}>{entry.action}</Badge>
      <time
        dateTime={entry.createdAt}
        className="hidden shrink-0 text-xs text-fg-faint sm:block"
      >
        {when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
        {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </time>
    </li>
  );
}

function describe(action: string, entity: string | null): string {
  const target = entity ?? "record";
  const verbs: Record<string, string> = {
    create: "added",
    update: "updated",
    delete: "deleted",
    status: "changed status on",
    export: "exported",
    login: "signed in",
    login_failed: "failed to sign in",
    logout: "signed out",
    password_reset: "reset the password for",
    settings: "changed settings for",
  };
  return `${verbs[action] ?? action} ${target}`;
}
