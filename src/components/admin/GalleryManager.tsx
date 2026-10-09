"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { Icon } from "./icons";
import {
  localFileProblem,
  uploadWithProgress,
  ACCEPTED_IMAGE_TYPES,
} from "./ImageUploader";
import { Modal, submitFormById, useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Textarea,
  cx,
} from "./ui";

/**
 * Admin > Gallery.
 *
 * Drop a batch of photographs and each one is uploaded in turn with its own
 * progress bar; the grid then edits title, caption, alt text, order, published
 * state, and deletes. Every image goes through the same server handler as the
 * rest of the admin (`/api/admin/gallery` → `storeUpload`), so validation,
 * re-encoding, thumbnails and safe filenames are shared, not re-implemented.
 */

export interface GalleryItemRow {
  id: number;
  image_url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  alt_text: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

interface QueueEntry {
  key: string;
  name: string;
  percent: number;
  done: boolean;
  error: string | null;
}

let seq = 0;

export function GalleryManager({ initialItems }: { initialItems: GalleryItemRow[] }) {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();

  const [items, setItems] = useState(initialItems);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryItemRow | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Uploads are serialised: sharp is CPU-bound, and ten parallel re-encodes
  // would stall the admin UI and the storefront behind it.
  const uploading = useRef(false);

  async function refresh() {
    const res = await fetch("/api/admin/gallery", { cache: "no-store" });
    if (!res.ok) {
      setError("Could not reload the gallery. Refresh the page.");
      return;
    }
    const data = (await res.json()) as { rows: GalleryItemRow[] };
    setItems(data.rows ?? []);
  }

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || uploading.current) return;
      uploading.current = true;
      setError(null);

      const entries: QueueEntry[] = files.map((file) => ({
        key: `q${++seq}`,
        name: file.name,
        percent: 0,
        done: false,
        error: null,
      }));
      setQueue(entries);

      for (const [index, file] of files.entries()) {
        const key = entries[index]!.key;
        const patch = (next: Partial<QueueEntry>) =>
          setQueue((prev) => prev.map((e) => (e.key === key ? { ...e, ...next } : e)));

        const problem = localFileProblem(file);
        if (problem) {
          patch({ error: problem, done: true });
          continue;
        }

        try {
          const data = await uploadWithProgress(file, "/api/admin/gallery", {
            onProgress: (percent) => patch({ percent }),
          });
          if (data.item) {
            setItems((prev) => [...prev, data.item as GalleryItemRow]);
          }
          patch({ percent: 100, done: true });
        } catch (err) {
          patch({
            error: err instanceof Error ? err.message : "Upload failed.",
            done: true,
          });
        }
      }

      uploading.current = false;
      toast.success(
        `${files.length} ${files.length === 1 ? "image" : "images"} processed.`,
      );
      // The queue clears itself once every row has finished, so the grid is not
      // permanently pushed down by a stale list.
      window.setTimeout(() => setQueue([]), 2500);
      await refresh();
    },
    [toast],
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter(Boolean);
    void handleFiles(files);
  }

  /** Publish or hide one photo without opening the editor. */
  async function setPublished(item: GalleryItemRow, isPublished: boolean) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gallery/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      const data = (await res.json().catch(() => ({}))) as GalleryItemRow & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update that photo.");
        return;
      }
      setItems((prev) => prev.map((row) => (row.id === item.id ? data : row)));
      toast.success(isPublished ? "Photo published." : "Photo hidden.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Swap a photo with its neighbour. The grid reorders immediately and the whole
   * list is then sent in one call, because the endpoint reads array order as the
   * new `sort_order` - one round trip instead of one per row.
   */
  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    setItems(next);

    setReordering(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the new order.");
        await refresh();
      }
    } catch {
      setError("Could not save the new order. Check your connection and retry.");
      await refresh();
    } finally {
      setReordering(false);
    }
  }

  function remove(item: GalleryItemRow) {
    confirmDialog({
      title: `Delete “${item.title ?? "this photo"}”?`,
      message:
        "The stored image is deleted with it and the storefront gallery updates immediately. This cannot be undone.",
      confirmLabel: "Delete photo",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Could not delete that photo.");
          return;
        }
        setItems((prev) => prev.filter((row) => row.id !== item.id));
        toast.success("Photo deleted.");
      },
    });
  }

  /** False when the server rejects the edit, so the dialog stays open. */
  async function saveEdit(draft: GalleryItemRow): Promise<boolean> {
    const res = await fetch(`/api/admin/gallery/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        caption: draft.caption,
        altText: draft.alt_text,
        isPublished: draft.is_published,
        sortOrder: draft.sort_order,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as GalleryItemRow & {
      error?: string;
    };
    if (!res.ok) {
      toast.error(data.error ?? "Could not save that photo.");
      return false;
    }
    setItems((prev) => prev.map((row) => (row.id === draft.id ? data : row)));
    toast.success("Photo updated.");
    return true;
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {/* ------------------------------------------------ drop zone + queue */}
      <Card>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-accent bg-accent/5" : "border-outline",
          )}
        >
          <Icon name="image" className="h-7 w-7 text-fg-faint" />
          <div>
            <p className="font-display text-base font-semibold">
              Drop photographs here
            </p>
            <p className="mt-0.5 text-sm text-fg-soft">
              JPG, PNG or WebP, up to 5MB each · {items.length}{" "}
              {items.length === 1 ? "photo" : "photos"} in the gallery
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void handleFiles(files);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="plus" className="h-3.5 w-3.5" filled />
            Add photos
          </Button>
        </div>

        {queue.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {queue.map((entry) => (
              <li key={entry.key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-fg-soft">{entry.name}</span>
                  <span
                    className={cx(
                      "shrink-0 tabular-nums",
                      entry.error ? "font-medium text-terracotta" : "text-fg-muted",
                    )}
                  >
                    {entry.error ?? (entry.done ? "Done" : `${entry.percent}%`)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                  <div
                    className={cx(
                      "h-full rounded-full transition-[width] duration-200",
                      entry.error ? "bg-terracotta" : "bg-sage",
                    )}
                    style={{ width: `${entry.error ? 100 : entry.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------------------------------------- grid */}
      {items.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            title="No photos yet"
            description="The first upload publishes to the storefront gallery straight away. Captions, order and visibility are edited from this grid afterwards."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <Card padded={false} className="overflow-hidden">
                <div className="relative aspect-4/3 bg-surface-soft">
                  <Image
                    src={item.thumbnail_url ?? item.image_url}
                    alt={item.alt_text ?? ""}
                    fill
                    sizes="(max-width: 640px) 90vw, (max-width: 1280px) 45vw, 30vw"
                    className="object-cover"
                    unoptimized
                  />
                  {!item.is_published && (
                    <span className="absolute top-2 left-2 rounded-full bg-espresso/80 px-2.5 py-0.5 text-xs font-semibold text-cream">
                      Hidden
                    </span>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.title ?? "Untitled photo"}
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {item.caption ?? "No caption"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(item)}
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" filled />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyId === item.id}
                      onClick={() => void setPublished(item, !item.is_published)}
                    >
                      {item.is_published ? "Hide" : "Publish"}
                    </Button>

                    <div className="ml-auto flex items-center gap-0.5">
                      <IconButton
                        label={`Move ${item.title ?? "photo"} earlier`}
                        name="chevron"
                        className="-rotate-90"
                        disabled={index === 0 || reordering}
                        onClick={() => void move(index, -1)}
                      />
                      <IconButton
                        label={`Move ${item.title ?? "photo"} later`}
                        name="chevron"
                        className="rotate-90"
                        disabled={index === items.length - 1 || reordering}
                        onClick={() => void move(index, 1)}
                      />
                      <IconButton
                        label={`Delete ${item.title ?? "photo"}`}
                        name="trash"
                        filled
                        danger
                        onClick={() => remove(item)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditDialog item={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}

      {dialog}
    </>
  );
}

/** A small square icon button for the per-card controls. */
function IconButton({
  label,
  name,
  className,
  disabled = false,
  filled = false,
  danger = false,
  onClick,
}: {
  label: string;
  name: string;
  className?: string;
  disabled?: boolean;
  filled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "cursor-pointer rounded-lg p-1.5 text-fg-muted transition-colors",
        "hover:bg-fill-strong disabled:cursor-not-allowed disabled:opacity-40",
        danger && "hover:text-terracotta",
      )}
    >
      <Icon name={name} className={cx("h-4 w-4", className)} filled={filled} />
    </button>
  );
}

/**
 * Title, caption, alt text, position and visibility for one photo.
 *
 * The picture is shown at the top because alt text and captions are written
 * while looking at the image, and the footer keeps its buttons on screen however
 * long the caption runs.
 */
function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: GalleryItemRow;
  onClose: () => void;
  onSave: (draft: GalleryItemRow) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);

  const dirty =
    draft.title !== item.title ||
    draft.caption !== item.caption ||
    draft.alt_text !== item.alt_text ||
    draft.is_published !== item.is_published ||
    draft.sort_order !== item.sort_order;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit photo"
      description="Captions and alt text appear on the storefront gallery."
      size="lg"
      dirty={dirty}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => submitFormById("gallery-item-form")}
            loading={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        id="gallery-item-form"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            setSaving(true);
            try {
              if (await onSave(draft)) onClose();
            } finally {
              setSaving(false);
            }
          })();
        }}
        className="space-y-4"
      >
        <div className="relative aspect-16/10 overflow-hidden rounded-xl border border-outline bg-surface-soft">
          <Image
            src={draft.thumbnail_url ?? draft.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 32rem"
            className="object-cover"
            unoptimized
          />
        </div>

        <Field label="Title" htmlFor="gallery-title">
          <Input
            id="gallery-title"
            value={draft.title ?? ""}
            maxLength={150}
            placeholder="Oak dining table"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>

        <Field
          label="Caption"
          htmlFor="gallery-caption"
          hint="Shown under the photo on the storefront."
        >
          <Textarea
            id="gallery-caption"
            value={draft.caption ?? ""}
            maxLength={2000}
            placeholder="Fumed oak, hand-cut joinery, finished in the workshop."
            onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
          />
        </Field>

        <Field
          label="Alt text"
          htmlFor="gallery-alt"
          hint="Read aloud by screen readers. Describe the piece, not the file name."
        >
          <Input
            id="gallery-alt"
            value={draft.alt_text ?? ""}
            maxLength={300}
            placeholder="Solid oak table with a tapered leg"
            onChange={(event) => setDraft({ ...draft, alt_text: event.target.value })}
          />
        </Field>

        <Field label="Position" htmlFor="gallery-position" hint="Lower numbers come first.">
          <Input
            id="gallery-position"
            type="number"
            min={0}
            max={9999}
            value={draft.sort_order}
            onChange={(event) =>
              setDraft({ ...draft, sort_order: Number(event.target.value) || 0 })
            }
          />
        </Field>

        <Checkbox
          label="Show on the storefront"
          checked={draft.is_published}
          onChange={(event) =>
            setDraft({ ...draft, is_published: event.target.checked })
          }
        />
      </form>
    </Modal>
  );
}
