"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, StatusBadge, Thumb, type Column } from "./DataTable";
import { Icon } from "./icons";
import { useConfirmState } from "./overlays";
import { ProductFormModal, type ProductFormValues } from "./ProductForm";
import { useToast } from "./Toast";
import { useCrudList } from "./useCrudList";
import { Button, Select, cx } from "./ui";
import { formatMoney, formatDate } from "@/lib/admin-format";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/admin-nav";
import type { ProductRow } from "@/lib/admin-list";

type CategoryOption = { id: number; name: string; slug: string };

/**
 * Products list. This is the template the Orders, Customers and Quotes screens
 * are cloned from.
 */
export function ProductsList({ categories }: { categories: CategoryOption[] }) {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();

  const list = useCrudList<ProductRow>({
    endpoint: "/api/admin/products",
    defaultSort: { key: "created_at", dir: "desc" },
  });

  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const [busy, setBusy] = useState(false);

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  async function runBulk(
    action: "delete" | "status",
    ids: number[],
    value?: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(list.buildUrl(), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ids, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That action failed.");
      toast.success(
        action === "delete"
          ? `Deleted ${ids.length} product${ids.length === 1 ? "" : "s"}.`
          : `Updated ${ids.length} product${ids.length === 1 ? "" : "s"}.`,
      );
      list.clearSelection();
      list.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openEditor(row: ProductRow) {
    try {
      const res = await fetch(`/api/admin/products/${row.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load that product.");

      setEditing({
        id: row.id,
        name: data.name ?? row.name,
        slug: data.slug ?? row.slug,
        description: data.description ?? "",
        price: String(data.price ?? row.price),
        categoryId: data.category_id ? String(data.category_id) : "",
        subcategoryId: data.subcategory_id ? String(data.subcategory_id) : "",
        stockQuantity: String(data.stock_quantity ?? row.stock_quantity),
        status: data.status ?? row.status,
        isNew: Boolean(data.is_new),
        isFeatured: Boolean(data.is_featured),
        // Keep the existing images; an empty list would delete them all.
        images: (data.images ?? []).map((i: { image_url: string }) => ({
          url: i.image_url,
        })),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load that product.");
    }
  }

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Thumb src={row.image_url} alt={row.name} />
          <div className="min-w-0">
            <Link
              href={`/furniture/${row.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 font-medium hover:text-terracotta"
            >
              <span className="truncate">{row.name}</span>
              <Icon name="external" className="h-3 w-3 shrink-0 opacity-40" />
            </Link>
            <p className="truncate text-xs text-fg-muted">
              {row.placement_summary ?? row.category_name ?? "No placement"}
              {row.image_count > 0 && ` · ${row.image_count} image${row.image_count === 1 ? "" : "s"}`}
              {row.variant_count > 0 && ` · ${row.variant_count} variant${row.variant_count === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      className: "font-semibold tabular-nums",
      render: (row) => formatMoney(row.price),
    },
    {
      key: "stock_quantity",
      header: "Stock",
      sortable: true,
      className: "tabular-nums",
      render: (row) => (
        <span
          className={cx(
            "font-medium tabular-nums",
            row.stock_quantity <= 0 && "text-terracotta",
            row.stock_quantity > 0 && row.stock_quantity <= 3 && "text-terracotta/80",
          )}
        >
          {row.stock_quantity}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      hideBelow: "lg",
      render: (row) => (
        <span className="text-fg">
          {row.category_name ?? "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      hideBelow: "md",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      hideBelow: "xl",
      className: "text-fg-soft",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void openEditor(row)}
        >
          <Icon name="edit" className="h-3.5 w-3.5" filled />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* ------------------------------------------------------------ tools */}
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
            placeholder="Search name, slug, description…"
            aria-label="Search products"
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
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          value={list.filters.category ?? ""}
          onChange={(e) => list.setFilter("category", e.target.value || undefined)}
          className="w-auto min-w-36"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select
          value={list.filters.stock ?? ""}
          onChange={(e) => list.setFilter("stock", e.target.value || undefined)}
          className="w-auto min-w-28"
          aria-label="Filter by stock level"
        >
          <option value="">Any stock</option>
          <option value="low">Low (≤3)</option>
          <option value="out">Out of stock</option>
          <option value="in">In stock</option>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <a
            href={list.buildUrl("/api/admin/products") + "&format=csv"}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 text-xs font-semibold transition-colors hover:border-outline-strong"
          >
            <Icon name="download" className="h-3.5 w-3.5" filled />
            CSV
          </a>
          <Button
            size="sm"
            onClick={() => setEditing({ ...emptyValues })}
            disabled={busy}
          >
            <Icon name="plus" className="h-3.5 w-3.5" filled />
            New product
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------ bulk toolbar */}
      {list.selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-outline bg-fill-faint px-3 py-2">
          <span className="text-xs font-semibold text-fg">
            {list.selected.length} selected
          </span>

          <Select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              void runBulk("status", list.selected, e.target.value);
              e.target.value = "";
            }}
            className="w-auto min-w-36 py-1.5 text-xs"
            aria-label="Set status for selected"
          >
            <option value="">Set status…</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() =>
              confirmDialog({
                title: `Delete ${list.selected.length} product${list.selected.length === 1 ? "" : "s"}?`,
                message:
                  "This removes the products and their images. Past orders keep their totals but lose the product link. This cannot be undone.",
                confirmLabel: "Delete",
                variant: "danger",
                onConfirm: () => runBulk("delete", list.selected),
              })
            }
          >
            <Icon name="trash" className="h-3.5 w-3.5" filled />
            Delete
          </Button>

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
        emptyTitle={hasFilters ? "No products match those filters" : "No products yet"}
        emptyDescription={
          hasFilters
            ? "Try a different search or clear the filters."
            : "Add your first piece to the catalogue."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" size="sm" onClick={list.clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEditing({ ...emptyValues })}>
              <Icon name="plus" className="h-3.5 w-3.5" filled />
              New product
            </Button>
          )
        }
        label="products"
      />

      {editing && (
        <ProductFormModal
          open
          onSaved={(saved, id, slug) => {
            const existing = list.rows.find((row) => row.id === id);
            const category = categories.find((entry) => String(entry.id) === saved.categoryId);
            const nextRow: ProductRow = {
              id,
              name: saved.name,
              slug,
              description: saved.description || null,
              price: saved.price,
              category_id: Number(saved.categoryId),
              subcategory_id: saved.subcategoryId ? Number(saved.subcategoryId) : null,
              category_name: category?.name ?? null,
              category_slug: category?.slug ?? null,
              placement_summary: category?.name ?? null,
              is_new: saved.isNew,
              is_featured: saved.isFeatured,
              is_custom: existing?.is_custom ?? false,
              stock_quantity: Number(saved.stockQuantity),
              status: saved.status,
              image_url: saved.images[0]?.url ?? null,
              image_count: saved.images.length,
              variant_count: existing?.variant_count ?? 0,
              created_at: existing?.created_at ?? new Date().toISOString(),
            };
            const rows = existing
              ? list.rows.map((row) => (row.id === id ? nextRow : row))
              : [nextRow, ...list.rows].slice(0, list.perPage);
            list.setRows(rows, list.total + (existing ? 0 : 1));
          }}
          onClose={() => {
            setEditing(null);
            list.refresh();
          }}
          initial={editing}
        />
      )}

      {dialog}
    </>
  );
}

const emptyValues: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  stockQuantity: "0",
  status: "active" as ProductStatus,
  isNew: false,
  isFeatured: false,
  images: [],
};
