"use client";

import { useState } from "react";
import { DataTable, type Column } from "./DataTable";
import { Icon } from "./icons";
import { ImageField, Modal, submitFormById, useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import { useCrudList } from "./useCrudList";
import { Button, Field, Input } from "./ui";
import { formatDate } from "@/lib/admin-format";
import type { CategoryRow } from "@/lib/admin-list";

interface Draft {
  id: number | null;
  name: string;
  slug: string;
  image_url: string;
}

const EMPTY: Draft = { id: null, name: "", slug: "", image_url: "" };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function CategoriesList() {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useCrudList<CategoryRow>({
    endpoint: "/api/admin/categories",
    defaultSort: { key: "name", dir: "asc" },
  });

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  async function save() {
    if (!draft) return;
    const isEdit = draft.id !== null;

    const res = await fetch(
      isEdit ? `/api/admin/categories/${draft.id}` : "/api/admin/categories",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      },
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Could not save that category.");
      return;
    }

    toast.success(isEdit ? "Category updated." : "Category created.");
    setDraft(null);
    list.refresh();
  }

  async function remove(row: CategoryRow) {
    confirmDialog({
      title: `Delete “${row.name}”?`,
      message:
        row.product_count > 0
          ? `${row.product_count} product${row.product_count === 1 ? "" : "s"} will be kept but left uncategorised. This cannot be undone.`
          : "This cannot be undone.",
      confirmLabel: "Delete category",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/categories/${row.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(data.error ?? "Could not delete that category.");
          return;
        }

        toast.success("Category deleted.");
        list.refresh();
      },
    });
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: "name",
      header: "Category",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-fg-muted">
            /{row.slug}
          </p>
        </div>
      ),
    },
    {
      key: "products",
      header: "Products",
      sortable: true,
      className: "tabular-nums",
      render: (row) => row.product_count,
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      hideBelow: "lg",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() =>
              setDraft({
                id: row.id,
                name: row.name,
                slug: row.slug,
                image_url: row.image_url ?? "",
              })
            }
            className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-fill hover:text-fg"
            aria-label={`Edit ${row.name}`}
          >
            <Icon name="edit" className="h-4 w-4" filled />
          </button>
          <button
            type="button"
            onClick={() => void remove(row)}
            className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-terracotta/12 hover:text-terracotta"
            aria-label={`Delete ${row.name}`}
          >
            <Icon name="trash" className="h-4 w-4" filled />
          </button>
        </div>
      ),
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
            placeholder="Search categories…"
            aria-label="Search categories"
            className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <Button onClick={() => setDraft(EMPTY)} className="ml-auto">
          <Icon name="plus" className="h-4 w-4" filled />
          New category
        </Button>
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
        emptyTitle={hasFilters ? "No categories match" : "No categories yet"}
        emptyDescription={
          hasFilters
            ? "Try a different search."
            : "Categories group products in the storefront navigation."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" size="sm" onClick={list.clearFilters}>
              Clear search
            </Button>
          ) : (
            <Button size="sm" onClick={() => setDraft(EMPTY)}>
              Create the first category
            </Button>
          )
        }
        label="categories"
      />

      {draft && (
        <CategoryDialog
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
        />
      )}

      {dialog}
    </>
  );
}

function CategoryDialog({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = draft.id !== null;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit category" : "New category"}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {/* Submits the form in the body, so the buttons stay pinned to the
              bottom of the dialog. */}
          <Button
            type="button"
            onClick={() => submitFormById("category-form")}
            loading={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create category"}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          })();
        }}
        className="space-y-4"
      >
        <Field label="Name" htmlFor="cat-name" required>
          <Input
            id="cat-name"
            value={draft.name}
            required
            maxLength={100}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="cat-slug"
          hint="Used in storefront URLs. Lowercase, numbers and dashes."
          required
        >
          <Input
            id="cat-slug"
            value={draft.slug}
            required
            maxLength={100}
            onChange={(e) => onChange({ ...draft, slug: slugify(e.target.value) })}
          />
        </Field>

        <ImageField
          label="Category image"
          value={draft.image_url}
          onChange={(url) => onChange({ ...draft, image_url: url })}
hint="Optional. Upload the category photo. PNG, JPEG or WebP up to 5MB."
        />
      </form>
    </Modal>
  );
}
