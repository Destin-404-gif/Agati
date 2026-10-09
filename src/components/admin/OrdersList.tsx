"use client";

import { useEffect, useState } from "react";
import { DataTable, StatusBadge, type Column } from "./DataTable";
import { Icon } from "./icons";
import { Modal } from "./overlays";
import { useToast } from "./Toast";
import { useCrudList } from "./useCrudList";
import { Button, Field, Select, Spinner, Textarea, cx } from "./ui";
import { formatDateTime, formatMoney } from "@/lib/admin-format";
import { ORDER_STATUSES } from "@/lib/admin-nav";
import type { OrderRow } from "@/lib/admin-list";
import type { OrderDetail, OrderItemRow } from "@/app/api/admin/orders/_shared";

export function OrdersList() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const list = useCrudList<OrderRow>({
    endpoint: "/api/admin/orders",
    defaultSort: { key: "created_at", dir: "desc" },
  });

  const [openId, setOpenId] = useState<number | null>(null);

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  async function setStatus(ids: number[], value: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", ids, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update those orders.");

      const note = data.missing?.length
        ? ` ${data.missing.length} order${data.missing.length === 1 ? "" : "s"} no longer exist.`
        : "";
      toast.success(
        `Updated ${data.affected} order${data.affected === 1 ? "" : "s"}.${note}`,
      );
      list.clearSelection();
      list.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update those orders.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "id",
      header: "Order",
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id)}
          className="cursor-pointer text-left font-semibold text-fg hover:text-terracotta"
        >
          {/* Customers quote the AGT number, so it leads when it exists. */}
          {row.order_number ?? `#${row.id}`}
          {row.order_number && (
            <span className="ml-1.5 text-xs font-normal text-fg-faint">#{row.id}</span>
          )}
        </button>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.customer_name ?? "Guest"}</p>
          {/* Phone first - the workshop rings it. Email only when given. */}
          {row.customer_phone ? (
            <p className="truncate text-xs text-fg-muted">{row.customer_phone}</p>
          ) : row.customer_email ? (
            <p className="truncate text-xs text-fg-muted">{row.customer_email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "delivery",
      header: "Deliver to",
      sortable: false,
      hideBelow: "lg",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-fg-soft">
            {row.delivery_district ?? "-"}
            {row.delivery_sector ? ` · ${row.delivery_sector}` : ""}
          </p>
          {row.delivery_landmark && (
            <p className="truncate text-xs text-fg-faint">{row.delivery_landmark}</p>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Placed",
      sortable: true,
      hideBelow: "lg",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "item_count",
      header: "Items",
      sortable: false,
      hideBelow: "xl",
      className: "tabular-nums",
      render: (row) => row.item_count,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (row) => formatMoney(row.total),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
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
            placeholder="Search order number, phone, customer, status…"
            aria-label="Search orders"
            className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
        </div>

        <Select
          value={list.filters.status ?? ""}
          onChange={(e) => list.setFilter("status", e.target.value || undefined)}
          className="w-auto min-w-32"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          value={list.filters.open ?? ""}
          onChange={(e) => list.setFilter("open", e.target.value || undefined)}
          className="w-auto min-w-32"
          aria-label="Filter open orders"
        >
          <option value="">All orders</option>
          <option value="true">Needs action</option>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <a
          href={list.buildUrl("/api/admin/orders") + "&format=csv"}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 text-xs font-semibold transition-colors hover:border-outline-strong"
        >
          <Icon name="download" className="h-3.5 w-3.5" filled />
          CSV
        </a>
      </div>

      {list.selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-outline bg-fill-faint px-3 py-2">
          <span className="text-xs font-semibold text-fg">
            {list.selected.length} selected
          </span>
          <Select
            value=""
            disabled={busy}
            onChange={(e) => {
              if (!e.target.value) return;
              void setStatus(list.selected, e.target.value);
              e.target.value = "";
            }}
            className="w-auto min-w-36 py-1.5 text-xs"
            aria-label="Set status for selected orders"
          >
            <option value="">Set status…</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={list.clearSelection}
            className="ml-auto cursor-pointer text-xs text-fg-muted underline-offset-4 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      <DataTable
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        columns={columns}
        sort={list.sort}
        onSort={list.setSort}
        selectable
        selected={list.selected}
        onToggleRow={list.toggleRow}
        onToggleAll={list.toggleAll}
        allSelected={list.allSelected}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        perPage={list.perPage}
        onPage={list.setPage}
        onPerPage={list.setPerPage}
        emptyTitle={hasFilters ? "No orders match those filters" : "No orders yet"}
        emptyDescription={
          hasFilters
            ? "Try a different search or clear the filters."
            : "Orders placed in the shop will appear here."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" size="sm" onClick={list.clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        label="orders"
      />

      {openId && <OrderDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ drawer */

function OrderDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /** Fetches the order without touching state, so the caller decides when. */
  async function fetchOrder(): Promise<OrderDetail> {
    const res = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not load that order.");
    return data as OrderDetail;
  }

  function apply(loaded: OrderDetail) {
    setOrder(loaded);
    setStatus(loaded.status);
    setNotes(loaded.notes ?? "");
    setError(null);
  }

  // State is only set from the promise callbacks, never synchronously, so this
  // does not cause a cascading render.
  useEffect(() => {
    let cancelled = false;
    fetchOrder()
      .then((loaded) => {
        if (!cancelled) apply(loaded);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not save that order.");
        return;
      }
      toast.success("Order updated.");
      apply(await fetchOrder());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Network error. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={loading ? "Order" : (order?.order_number ?? `Order #${order?.id}`)}
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

      {order && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Order number">
              {order.order_number ?? `#${order.id}`}
            </Detail>
            <Detail label="Placed">{formatDateTime(order.created_at)}</Detail>
            <Detail label="Items">{order.item_count}</Detail>
            <Detail label="Total">
              <span className="font-semibold">{formatMoney(order.total)}</span>
            </Detail>
          </dl>

          {/* Checkout details: what to call, what to drive to, how they pay. */}
          {(order.customer_name || order.customer_phone || order.delivery_district) && (
            <dl className="grid grid-cols-1 gap-4 rounded-xl border border-outline bg-fill-faint px-4 py-4 sm:grid-cols-3">
              <Detail label="Customer">
                {order.customer_name ?? "Guest"}
                {order.customer_phone && (
                  <span className="block text-xs font-normal text-fg-muted">
                    {order.customer_phone}
                  </span>
                )}
                {order.customer_email && (
                  <span className="block text-xs font-normal text-fg-muted">
                    {order.customer_email}
                  </span>
                )}
              </Detail>
              <Detail label="Deliver to">
                {[
                  order.delivery_sector,
                  order.delivery_district,
                  order.delivery_landmark,
                ]
                  .filter(Boolean)
                  .join(", ") || "-"}
                {order.delivery_note && (
                  <span className="mt-1 block text-xs font-normal text-fg-muted">
                    Note: {order.delivery_note}
                  </span>
                )}
              </Detail>
              <Detail label="Payment">
                {order.payment_method === "pay_on_delivery"
                  ? "Pay on delivery"
                  : (order.payment_method ?? "-")}
              </Detail>
            </dl>
          )}

          {order.missing_items > 0 && (
            <p className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {order.missing_items} line item{order.missing_items === 1 ? "" : "s"}{" "}
              reference a product that has since been deleted. The order total is
              unchanged.
            </p>
          )}

          <div>
            <h3 className="mb-2 font-display text-sm font-semibold">Items</h3>
            <ul className="divide-y divide-outline-faint rounded-xl border border-outline">
              {order.items.map((item) => (
                <OrderItem key={item.id} item={item} />
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor={`status-${id}`}>
              <Select
                id={`status-${id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Internal notes"
            htmlFor={`notes-${id}`}
            hint="Only visible to staff. Not shown to the customer."
          >
            <Textarea
              id={`notes-${id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Booked the delivery for the 14th, paid by bank transfer…"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={save} loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OrderItem({ item }: { item: OrderItemRow }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            "truncate text-sm font-medium",
            !item.product_id && "text-fg-muted italic",
          )}
        >
          {item.product_name ?? "Deleted product"}
        </p>
        <p className="text-xs text-fg-muted">
          {item.variant_name ? `${item.variant_name} · ` : ""}
          {formatMoney(item.unit_price)} each
        </p>
      </div>
      <span className="shrink-0 text-sm text-fg-soft tabular-nums">
        ×{item.quantity}
      </span>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
        {formatMoney(item.line_total)}
      </span>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
