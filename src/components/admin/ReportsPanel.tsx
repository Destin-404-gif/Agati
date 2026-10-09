"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Select, Spinner } from "./ui";
import { formatDate, formatMoney } from "@/lib/admin-format";
import type { ReportsPayload } from "@/lib/admin-stats";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export function ReportsPanel() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (window: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?days=${window}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load reports.");
      setData(body as ReportsPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(days);
  }, [days, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-auto min-w-40"
          aria-label="Reporting window"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {data && (
          <p className="text-sm text-fg-muted">
            {formatDate(data.window.from)} - {formatDate(data.window.to)} · revenue
            excludes cancelled orders
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load(days)}
          disabled={loading}
          className="ml-auto"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue" value={formatMoney(data.totals.revenue)} />
            <Stat label="Orders" value={String(data.totals.orders)} />
            <Stat
              label="Average order"
              value={formatMoney(data.totals.average_order)}
            />
            <Stat label="Units sold" value={String(data.totals.units)} />
            <Stat label="Buying customers" value={String(data.totals.customers)} />
            <Stat label="New signups" value={String(data.totals.new_customers)} />
            <Stat label="Quote requests" value={String(data.totals.quotes)} />
            <Stat label="Quote win rate" value={`${data.totals.quote_conversion}%`} />
          </div>

          <RevenueBars data={data.revenueByDay} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Table
              title="Top products"
              headers={["Product", "Units", "Revenue", "Stock"]}
              rows={data.topProducts.map((p) => [
                p.name,
                String(p.units),
                formatMoney(p.revenue),
                p.stock === 0 ? "Out" : String(p.stock),
              ])}
              align={["left", "right", "right", "right"]}
              empty="No sales in this window."
            />
            <Table
              title="Revenue by category"
              headers={["Category", "Units", "Revenue"]}
              rows={data.revenueByCategory.map((c) => [
                c.name,
                String(c.units),
                formatMoney(c.revenue),
              ])}
              align={["left", "right", "right"]}
              empty="No sales in this window."
            />
            <Table
              title="Top customers"
              headers={["Customer", "Orders", "Revenue"]}
              rows={data.topCustomers.map((c) => [
                `${c.name} (${c.email})`,
                String(c.orders),
                formatMoney(c.revenue),
              ])}
              align={["left", "right", "right"]}
              empty="No orders in this window."
            />
            <Table
              title="Low stock"
              headers={["Product", "In stock"]}
              rows={data.lowStock.map((p) => [p.name, p.stock === 0 ? "Out of stock" : String(p.stock)])}
              align={["left", "right"]}
              empty="Everything is above the low-stock threshold."
            />
            <Table
              title="Quote pipeline"
              headers={["Status", "Requests"]}
              rows={data.quoteFunnel.map((q) => [q.label, String(q.value)])}
              align={["left", "right"]}
              empty="No quote requests yet."
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

/** Lightweight inline bar chart - avoids pulling in a charting dependency. */
function RevenueBars({ data }: { data: { label: string; value: number }[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const visible = data.slice(-45);

  if (visible.length === 0 || max === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-fg-soft">
          No revenue in this window.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Revenue by day</h2>
      <div className="flex h-32 items-end gap-[2px]">
        {visible.map((d) => (
          <div
            key={d.label}
            className="group relative flex-1 rounded-t bg-fill-strong transition-colors hover:bg-terracotta/70"
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%` }}
            title={`${d.label}: ${formatMoney(d.value)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-fg-muted">
        <span>{visible[0]?.label}</span>
        <span>{visible[visible.length - 1]?.label}</span>
      </div>
    </Card>
  );
}

function Table({
  title,
  headers,
  rows,
  align,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  align: ("left" | "right")[];
  empty: string;
}) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 font-display text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline">
              {headers.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`pb-1.5 text-[10px] font-semibold tracking-wide text-fg-muted uppercase ${
                    align[i] === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-outline-faint last:border-0"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`py-1.5 ${
                      align[ci] === "right"
                        ? "text-right tabular-nums"
                        : "truncate text-left"
                    } ${ci === 0 ? "max-w-40 pr-2" : "pl-2"}`}
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
