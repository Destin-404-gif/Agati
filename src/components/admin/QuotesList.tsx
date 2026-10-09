"use client";

import { useEffect, useState } from "react";
import { DataTable, StatusBadge, type Column } from "./DataTable";
import { Icon } from "./icons";
import { Modal } from "./overlays";
import { useToast } from "./Toast";
import { useCrudList } from "./useCrudList";
import { Button, Field, Select, Spinner, Textarea } from "./ui";
import { formatDateTime } from "@/lib/admin-format";
import { QUOTE_STATUSES_ADMIN } from "@/lib/admin-nav";
import type { QuoteRow } from "@/lib/admin-list";
import type { QuoteDetail } from "@/app/api/admin/quotes/_shared";

export function QuotesList() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useCrudList<QuoteRow>({
    endpoint: "/api/admin/quotes",
    defaultSort: { key: "created_at", dir: "desc" },
  });

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  async function setStatus(ids: number[], value: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/quotes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", ids, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update those quotes.");
      toast.success(`Updated ${data.affected} quote${data.affected === 1 ? "" : "s"}.`);
      list.clearSelection();
      list.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update those quotes.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<QuoteRow>[] = [
    {
      key: "name",
      header: "Request",
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id)}
          className="min-w-0 cursor-pointer text-left"
        >
          <p className="truncate font-medium hover:text-terracotta">{row.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {row.email}
            {row.company && ` · ${row.company}`}
          </p>
        </button>
      ),
    },
    {
      key: "project_type",
      header: "Project",
      sortable: false,
      hideBelow: "lg",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-fg">
            {row.project_type ?? "-"}
          </p>
          {row.budget && (
            <p className="truncate text-xs text-fg-muted">
              {row.budget}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Received",
      sortable: true,
      hideBelow: "xl",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "note_count",
      header: "Notes",
      sortable: false,
      hideBelow: "xl",
      className: "tabular-nums",
      render: (row) =>
        row.note_count > 0 ? (
          <span className="rounded-full bg-fill-strong px-2 py-0.5 text-xs font-semibold">
            {row.note_count}
          </span>
        ) : (
          <span className="text-fg-faint">-</span>
        ),
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
            placeholder="Search name, email, company…"
            aria-label="Search quotes"
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
          {QUOTE_STATUSES_ADMIN.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <a
          href={list.buildUrl("/api/admin/quotes") + "&format=csv"}
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
            aria-label="Set status for selected quotes"
          >
            <option value="">Set status…</option>
            {QUOTE_STATUSES_ADMIN.map((s) => (
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
        emptyTitle={hasFilters ? "No quotes match those filters" : "No quote requests yet"}
        emptyDescription={
          hasFilters
            ? "Try a different search or clear the filters."
            : "Requests from the contact form will land here."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" size="sm" onClick={list.clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        label="quotes"
      />

      {openId && <QuoteDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ drawer */

function QuoteDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  async function fetchQuote(): Promise<QuoteDetail> {
    const res = await fetch(`/api/admin/quotes/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not load that quote.");
    return data as QuoteDetail;
  }

  function apply(loaded: QuoteDetail) {
    setQuote(loaded);
    setStatus(loaded.status);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetchQuote()
      .then((q) => {
        if (!cancelled) apply(q);
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

  async function saveStatus() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      toast.success("Quote updated.");
      apply(await fetchQuote());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/quotes/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add that note.");
      setNote("");
      apply({ ...(quote as QuoteDetail), notes: data.notes });
      toast.success("Note added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that note.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={loading ? "Quote" : `Quote #${quote?.id}`} size="lg">
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

      {quote && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Name">{quote.name}</Detail>
            <Detail label="Email">
              <a
                href={`mailto:${quote.email}`}
                className="underline-offset-2 hover:underline"
              >
                {quote.email}
              </a>
            </Detail>
            <Detail label="Phone">
              {quote.phone ? (
                <a href={`tel:${quote.phone}`} className="underline-offset-2 hover:underline">
                  {quote.phone}
                </a>
              ) : (
                "-"
              )}
            </Detail>
            <Detail label="Company">{quote.company ?? "-"}</Detail>
            <Detail label="Project type">{quote.project_type ?? "-"}</Detail>
            <Detail label="Budget">{quote.budget ?? "-"}</Detail>
            <Detail label="Timeline">{quote.timeline ?? "-"}</Detail>
            <Detail label="Received">{formatDateTime(quote.created_at)}</Detail>
            <Detail label="Status">
              <StatusBadge status={quote.status} />
            </Detail>
          </dl>

          {quote.product_slug && (
            <p className="rounded-xl border border-outline px-4 py-3 text-sm">
              About{" "}
              <span className="font-semibold">
                {quote.product_name ?? quote.product_slug}
              </span>
              {quote.product_price && (
                <span className="text-fg-soft">
                  {" "}
                  - {quote.product_price}
                </span>
              )}
            </p>
          )}

          {quote.message && (
            <div>
              <h3 className="mb-1.5 font-display text-sm font-semibold">Their message</h3>
              <p className="rounded-xl border border-outline px-4 py-3 text-sm whitespace-pre-wrap">
                {quote.message}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Set status" htmlFor={`q-status-${id}`}>
              <Select
                id={`q-status-${id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {QUOTE_STATUSES_ADMIN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={saveStatus} loading={saving}>
              {saving ? "Saving…" : "Save status"}
            </Button>
          </div>

          <div>
            <h3 className="mb-1.5 font-display text-sm font-semibold">
              Internal notes
              <span className="ml-2 text-xs font-normal text-fg-muted">
                staff only
              </span>
            </h3>

            {quote.notes.length > 0 && (
              <ul className="mb-3 space-y-2">
                {quote.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-outline px-4 py-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1.5 text-xs text-fg-muted">
                      {n.staff_name ?? n.staff_email ?? "System"} ·{" "}
                      {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Called them, sending a drawing on Friday…"
              aria-label="New internal note"
            />
            <div className="mt-2 flex justify-end">
              <Button
                onClick={addNote}
                loading={adding}
                disabled={!note.trim()}
              >
                {adding ? "Adding…" : "Add note"}
              </Button>
            </div>
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}
