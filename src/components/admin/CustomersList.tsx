"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable, StatusBadge, type Column } from "./DataTable";
import { Icon } from "./icons";
import { Modal } from "./overlays";
import { useCrudList } from "./useCrudList";
import { Button, Spinner } from "./ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/admin-format";
import type { CustomerRow } from "@/lib/admin-list";
import type { CustomerDetail } from "@/app/api/admin/customers/_shared";

export function CustomersList() {
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useCrudList<CustomerRow>({
    endpoint: "/api/admin/customers",
    defaultSort: { key: "created_at", dir: "desc" },
  });

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  const columns: Column<CustomerRow>[] = [
    {
      key: "full_name",
      header: "Customer",
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id)}
          className="min-w-0 cursor-pointer text-left"
        >
          <p className="truncate font-medium hover:text-terracotta">
            {row.full_name || "Guest"}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {row.email}
          </p>
        </button>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      sortable: true,
      className: "tabular-nums",
      render: (row) => row.order_count,
    },
    {
      key: "lifetime_value",
      header: "Lifetime value",
      sortable: false,
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (row) => formatMoney(row.lifetime_value),
    },
    {
      key: "last_order_at",
      header: "Last order",
      sortable: false,
      hideBelow: "lg",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => (row.last_order_at ? formatDate(row.last_order_at) : "-"),
    },
    {
      key: "created_at",
      header: "Joined",
      sortable: true,
      hideBelow: "xl",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            value={list.searchInput}
            onChange={(e) => list.setQ(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search customers"
            className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <a
          href={list.buildUrl("/api/admin/customers") + "&format=csv"}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 text-xs font-semibold transition-colors hover:border-outline-strong"
        >
          <Icon name="download" className="h-3.5 w-3.5" filled />
          CSV
        </a>
      </div>

      <DataTable
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        columns={columns}
        sort={list.sort}
        onSort={list.setSort}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        perPage={list.perPage}
        onPage={list.setPage}
        onPerPage={list.setPerPage}
        emptyTitle={
          hasFilters ? "No customers match that search" : "No customers yet"
        }
        emptyDescription={
          hasFilters
            ? "Try a different name or email."
            : "Customers appear here once they place an order."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" size="sm" onClick={list.clearFilters}>
              Clear search
            </Button>
          ) : undefined
        }
        label="customers"
      />

      {openId && <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ drawer */

function CustomerDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/customers/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load that customer.");
        if (!cancelled) {
          setCustomer(data as CustomerDetail);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={loading ? "Customer" : (customer?.full_name ?? customer?.email ?? "Customer")}
      size="lg"
    >
      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </p>
      )}

      {customer && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
                Email
              </dt>
              <dd className="mt-0.5 text-sm break-words">
                <a
                  href={`mailto:${customer.email}`}
                  className="underline-offset-2 hover:underline"
                >
                  {customer.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
                Orders
              </dt>
              <dd className="mt-0.5 text-sm tabular-nums">{customer.order_count}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
                Lifetime value
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {formatMoney(customer.lifetime_value)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
                Joined
              </dt>
              <dd className="mt-0.5 text-sm">{formatDate(customer.created_at)}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 font-display text-sm font-semibold">Order history</h3>
            {customer.orders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline py-6 text-center text-sm text-fg-muted">
                No orders yet.
              </p>
            ) : (
              <ul className="divide-y divide-outline-faint rounded-xl border border-outline">
                {customer.orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/admin/orders?q=${o.id}`}
                      className="font-semibold hover:text-terracotta"
                    >
                      #{o.id}
                    </Link>
                    <span className="text-xs text-fg-muted">
                      {formatDateTime(o.created_at)} · {o.item_count} items
                    </span>
                    <StatusBadge status={o.status} />
                    <span className="ml-auto font-semibold tabular-nums">
                      {formatMoney(o.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
