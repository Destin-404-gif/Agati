"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icons";
import { ImageField, Modal, submitFormById, useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import { Button, Checkbox, Field, Input, Spinner, Textarea } from "./ui";
import { formatDate } from "@/lib/admin-format";
import type { ContentRow } from "@/app/api/admin/content/_shared";

type Kind = "banners" | "pages" | "announcements";

const TABS: { kind: Kind; label: string; blurb: string }[] = [
  { kind: "banners", label: "Banners", blurb: "Hero and promotional slides." },
  { kind: "pages", label: "Pages", blurb: "Static pages such as About or Delivery." },
  { kind: "announcements", label: "Announcements", blurb: "Short site-wide notices." },
];

interface Draft {
  id: number | null;
  title: string;
  slug: string;
  subtitle: string;
  body: string;
  image_url: string;
  link_url: string;
  position: number;
  is_active: boolean;
  is_published: boolean;
  starts_at: string;
  ends_at: string;
}

function emptyDraft(): Draft {
  return {
    id: null,
    title: "",
    slug: "",
    subtitle: "",
    body: "",
    image_url: "",
    link_url: "",
    position: 0,
    is_active: true,
    is_published: false,
    starts_at: "",
    ends_at: "",
  };
}

function draftFrom(kind: Kind, row: ContentRow): Draft {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? "",
    subtitle: row.subtitle ?? "",
    body: row.body ?? "",
    image_url: row.image_url ?? "",
    link_url: row.link_url ?? "",
    position: row.position ?? 0,
    is_active: row.is_active ?? true,
    is_published: row.is_published ?? false,
    starts_at: row.starts_at ? row.starts_at.slice(0, 16) : "",
    ends_at: row.ends_at ? row.ends_at.slice(0, 16) : "",
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

export function ContentList() {
  const [kind, setKind] = useState<Kind>("banners");
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content?type=${kind}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load that content.");
      setRows(data.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that content.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const active = TABS.find((t) => t.kind === kind)!;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Content type" className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            role="tab"
            type="button"
            aria-selected={kind === tab.kind}
            onClick={() => {
              setKind(tab.kind);
              setDraft(null);
            }}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              kind === tab.kind
                ? "bg-accent text-on-accent"
                : "text-fg-soft hover:bg-fill"
            }`}
          >
            {tab.label}
            {kind === tab.kind && (
              <span className="ml-2 text-xs opacity-70">{rows.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-fg-soft">{active.blurb}</p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())} className="ml-auto">
          <Icon name="plus" className="h-4 w-4" filled />
          New {kind === "pages" ? "page" : kind === "banners" ? "banner" : "announcement"}
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline py-10 text-center">
          <p className="font-display text-lg">Nothing here yet</p>
          <p className="mt-1 text-sm text-fg-soft">
            Add the first {active.label.toLowerCase().slice(0, -1)} to get started.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-faint rounded-xl border border-outline">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.title}</p>
                <p className="truncate text-xs text-fg-muted">
                  {kind === "banners" &&
                    `Position ${row.position ?? 0}${row.starts_at ? ` · from ${formatDate(row.starts_at)}` : ""}${row.ends_at ? ` to ${formatDate(row.ends_at)}` : ""}`}
                  {kind === "pages" && `/${row.slug} · ${formatDate(row.created_at)}`}
                  {kind === "announcements" && formatDate(row.created_at)}
                </p>
              </div>

              <Flag
                on={kind === "pages" ? Boolean(row.is_published) : Boolean(row.is_active)}
                label={
                  kind === "pages"
                    ? row.is_published
                      ? "Published"
                      : "Draft"
                    : row.is_active
                      ? "Active"
                      : "Hidden"
                }
              />

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDraft(draftFrom(kind, row))}
                  className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-fill"
                  aria-label={`Edit ${row.title}`}
                >
                  <Icon name="edit" className="h-4 w-4" filled />
                </button>
                <DeleteButton kind={kind} row={row} onDone={load} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <ContentDialog
          kind={kind}
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        on
          ? "bg-sage/20 text-sage"
          : "bg-fill-strong text-fg-soft"
      }`}
    >
      {label}
    </span>
  );
}

function DeleteButton({
  kind,
  row,
  onDone,
}: {
  kind: Kind;
  row: ContentRow;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          confirmDialog({
            title: `Delete “${row.title}”?`,
            message: "This cannot be undone.",
            confirmLabel: "Delete",
            variant: "danger",
            onConfirm: async () => {
              const res = await fetch(`/api/admin/content/${kind}/${row.id}`, {
                method: "DELETE",
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                toast.error(data.error ?? "Could not delete that.");
                return;
              }
              toast.success("Deleted.");
              await onDone();
            },
          })
        }
        className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-terracotta/12 hover:text-terracotta"
        aria-label={`Delete ${row.title}`}
      >
        <Icon name="trash" className="h-4 w-4" filled />
      </button>
      {dialog}
    </>
  );
}

function ContentDialog({
  kind,
  draft,
  onChange,
  onClose,
  onSaved,
}: {
  kind: Kind;
  draft: Draft;
  onChange: (next: Draft) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = draft.id !== null;

  async function save() {
    setSaving(true);
    try {
      const payload = { type: kind, body: buildBody(kind, draft) };
      const res = await fetch(
        isEdit ? `/api/admin/content/${kind}/${draft.id}` : "/api/admin/content",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Could not save.");
        return;
      }

      toast.success(isEdit ? "Saved." : "Created.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isEdit ? "Edit" : "New"} ${kind === "pages" ? "page" : kind.slice(0, -1)}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {/* Submits the form in the body, so the buttons stay pinned to the
              bottom of the dialog. */}
          <Button
            type="button"
            onClick={() => submitFormById("content-form")}
            loading={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="content-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="Title" htmlFor="c-title" required>
          <Input
            id="c-title"
            value={draft.title}
            required
            maxLength={150}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        {kind === "banners" && (
          <>
            <Field label="Subtitle" htmlFor="c-subtitle">
              <Textarea
                id="c-subtitle"
                rows={2}
                value={draft.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </Field>

            <div className="grid gap-4">
              <ImageField
                label="Banner image"
                value={draft.image_url}
                onChange={(url) => set("image_url", url)}
                hint="Upload the banner artwork. PNG, JPEG or WebP up to 5MB."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link URL" htmlFor="c-link">
                <Input
                  id="c-link"
                  value={draft.link_url}
                  onChange={(e) => set("link_url", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Position" htmlFor="c-pos" hint="Lower shows first.">
                <Input
                  id="c-pos"
                  type="number"
                  min={0}
                  max={9999}
                  value={draft.position}
                  onChange={(e) => set("position", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Starts" htmlFor="c-start">
                <Input
                  id="c-start"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                />
              </Field>
              <Field label="Ends" htmlFor="c-end">
                <Input
                  id="c-end"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => set("ends_at", e.target.value)}
                />
              </Field>
            </div>

            <Checkbox
              checked={draft.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              label="Show this banner"
            />
          </>
        )}

        {kind === "pages" && (
          <>
            <Field label="Slug" htmlFor="c-slug" required>
              <Input
                id="c-slug"
                value={draft.slug}
                required
                maxLength={150}
                onChange={(e) => set("slug", slugify(e.target.value))}
              />
            </Field>

            <Field label="Body" htmlFor="c-body" hint="Plain text or simple HTML.">
              <Textarea
                id="c-body"
                rows={10}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>

            <Checkbox
              checked={draft.is_published}
              onChange={(e) => set("is_published", e.target.checked)}
              label="Published"
            />
          </>
        )}

        {kind === "announcements" && (
          <>
            <Field label="Message" htmlFor="c-body">
              <Textarea
                id="c-body"
                rows={4}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>

            <Field label="Link URL" htmlFor="c-link">
              <Input
                id="c-link"
                value={draft.link_url}
                onChange={(e) => set("link_url", e.target.value)}
              />
            </Field>

            <Checkbox
              checked={draft.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              label="Show this announcement"
            />
          </>
        )}
      </form>
    </Modal>
  );
}

/** Send only the fields that belong to the selected table. */
function buildBody(kind: Kind, draft: Draft): Record<string, unknown> {
  if (kind === "banners") {
    return {
      title: draft.title,
      subtitle: draft.subtitle,
      image_url: draft.image_url,
      link_url: draft.link_url,
      position: draft.position,
      is_active: draft.is_active,
      starts_at: draft.starts_at,
      ends_at: draft.ends_at,
    };
  }
  if (kind === "pages") {
    return {
      title: draft.title,
      slug: draft.slug,
      body: draft.body,
      is_published: draft.is_published,
    };
  }
  return {
    title: draft.title,
    body: draft.body,
    link_url: draft.link_url,
    is_active: draft.is_active,
  };
}
