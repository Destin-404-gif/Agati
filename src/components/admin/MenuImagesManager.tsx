"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, uploadWithProgress } from "./ImageUploader";
import { Icon } from "./icons";
import { useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import { Alert, Badge, Button, Card, Field, Input, Spinner, cx } from "./ui";
import {
  MENU_IMAGES_PER_CATEGORY,
  linkUrlProblem,
  menuImageFileProblem,
  type AdminMenuCategory,
  type AdminMenuImage,
} from "@/lib/menu-image-rules";

/**
 * The admin half of the mega-menu pictures: one card per category, three slots
 * each.
 *
 * Every file goes up through the shared `uploadWithProgress` XHR helper to
 * `/api/admin/menu-images`, which is the same `storeUpload` pipeline the product,
 * category and gallery uploads use - magic-byte sniff, sharp re-encode into the
 * 400/1200/2560 family, generated filename, `media_uploads` row. Only the 3MB cap
 * and the caption/link are specific to a menu, and they are checked on both sides:
 * `menuImageFileProblem` here so a bad file never leaves the browser, and again in
 * the route, which is the check that actually counts.
 *
 * The preview at the top is a drawing of the storefront panel, not an iframe: it
 * reads the same draft state the slots write to, so it shows the panel's two
 * columns with no second code path to keep in sync.
 */

/** What the preview draws, and what the slots edit. */
interface Draft {
  id: number;
  imagePath: string;
  caption: string;
  linkUrl: string;
}

interface Slot {
  key: string;
  draft: Draft | null;
  /** Present for a slot already saved server-side. */
  saved: AdminMenuImage | null;
}

function toDraft(image: AdminMenuImage): Draft {
  return {
    id: image.id,
    imagePath: image.imagePath,
    caption: image.caption ?? "",
    linkUrl: image.linkUrl ?? "",
  };
}

export function MenuImagesManager({
  initialCategories,
}: {
  initialCategories: AdminMenuCategory[];
}) {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();

  const [categories, setCategories] = useState<AdminMenuCategory[]>(initialCategories);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(
    initialCategories[0]?.slug ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<Record<string, string>>({});

  /** Re-read the board after a change, so slots and order match the database. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/menu-images", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        categories?: AdminMenuCategory[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load the menu images.");
        return;
      }
      setCategories(data.categories ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Could not reach the server. Check your connection and reload.");
    }
  }, []);

  const setError = (key: string, message: string | null) =>
    setSlotError((prev) => {
      if (message !== null) return { ...prev, [key]: message };
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  /** Replace a category's rows after any change, so order and slots stay honest. */
  const patchCategory = useCallback(
    (categoryId: number, images: AdminMenuImage[]) => {
      setCategories((prev) =>
        prev.map((category) => (category.id === categoryId ? { ...category, images } : category)),
      );
    },
    [],
  );

  /* ------------------------------------------------------------- uploading */

  async function upload(category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) {
    const problem = menuImageFileProblem(file);
    if (problem) {
      setError(slotKey, problem);
      return;
    }

    const linkProblem = linkUrlProblem(slot.draft?.linkUrl);
    if (linkProblem) {
      setError(slotKey, linkProblem);
      return;
    }

    setBusy(slotKey);
    setError(slotKey, null);

    try {
      const res = await uploadWithProgress(file, "/api/admin/menu-images", {
        fields: {
          categoryId: String(category.id),
          caption: slot.draft?.caption ?? "",
          linkUrl: slot.draft?.linkUrl ?? "",
        },
      });
      if (res.error) {
        setError(slotKey, res.error);
        return;
      }

      toast.success(`Added to ${category.name}.`);
      await refresh();
    } catch (err) {
      setError(slotKey, err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  /** Replace the file in a saved slot: delete the old row, then upload. */
  async function replace(category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) {
    if (!slot.saved) return;

    // Everything that can reject the new file is checked before the old row goes
    // away, so a mistyped picture never costs the admin the one already there.
    const problem = menuImageFileProblem(file) ?? linkUrlProblem(slot.draft?.linkUrl);
    if (problem) {
      setError(slotKey, problem);
      return;
    }

    setBusy(slotKey);
    setError(slotKey, null);
    try {
      const res = await fetch(`/api/admin/menu-images/${slot.saved.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(slotKey, data.error ?? "Could not remove the old picture.");
        return;
      }
      await refresh();
      await upload(category, slotKey, file, slot);
    } catch {
      setError(slotKey, "Could not reach the server. Check your connection and retry.");
      setBusy(null);
    }
  }

  /* ------------------------------------------------------------ text fields */

  async function saveText(category: AdminMenuCategory, image: AdminMenuImage, patch: Partial<Draft>) {
    const key = `${category.id}:${image.id}`;
    if (patch.linkUrl !== undefined) {
      const problem = linkUrlProblem(patch.linkUrl);
      if (problem) {
        setError(key, problem);
        return;
      }
    }

    setBusy(key);
    setError(key, null);
    try {
      // Only the field that was edited is sent. Sending both would let a slow
      // re-render carry a stale value back over the field just saved - editing
      // the link would wipe the caption.
      const body: { caption?: string; linkUrl?: string } = {};
      if (patch.caption !== undefined) body.caption = patch.caption;
      if (patch.linkUrl !== undefined) body.linkUrl = patch.linkUrl;

      const res = await fetch(`/api/admin/menu-images/${image.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(key, data.error ?? "Could not save that image.");
        return;
      }
      toast.success("Saved.");
      await refresh();
    } catch {
      setError(key, "Could not reach the server. Check your connection and retry.");
    } finally {
      setBusy(null);
    }
  }

  /* ----------------------------------------------------------------- delete */

  function remove(category: AdminMenuCategory, image: AdminMenuImage) {
    confirmDialog({
      title: `Remove this ${category.name} picture?`,
      message:
        "It disappears from the website menu immediately. The stored file is deleted with it. This cannot be undone.",
      confirmLabel: "Remove picture",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/menu-images/${image.id}`, { method: "DELETE" });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            toast.error(data.error ?? "Could not remove that picture.");
            return;
          }
          patchCategory(
            category.id,
            category.images.filter((row) => row.id !== image.id),
          );
          toast.success("Picture removed.");
          await refresh();
        } catch {
          toast.error("Could not reach the server. Check your connection and retry.");
        }
      },
    });
  }

  /* ---------------------------------------------------------------- reorder */

  async function move(category: AdminMenuCategory, index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= category.images.length) return;

    const next = [...category.images];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    patchCategory(category.id, next);

    const key = `${category.id}:order`;
    setBusy(key);
    try {
      const res = await fetch("/api/admin/menu-images", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: category.id, ids: next.map((image) => image.id) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not save the new order.");
        await refresh();
      }
    } catch {
      toast.error("Could not save the new order. Check your connection and retry.");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------------------------------------------ render */

  const previewCategory =
    categories.find((category) => category.slug === previewSlug) ?? categories[0] ?? null;

  return (
    <div className="space-y-6">
      {loadError && <Alert tone="error">{loadError}</Alert>}

      {previewCategory && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Live preview</h2>
                <p className="text-xs text-fg-soft">
                  How the menu panel will look for the category you pick below.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg">
                Category
                <select
                  value={previewCategory.slug}
                  onChange={(event) => setPreviewSlug(event.target.value)}
                  className="cursor-pointer rounded-xl border border-outline bg-field px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-fg"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <PanelPreview category={previewCategory} />
          </div>
        </Card>
      )}

      {categories.length === 0 && !loadError && (
        <Card>
          <p className="py-8 text-center text-sm text-fg-soft">
            No active categories were found.
          </p>
        </Card>
      )}

      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          busy={busy}
          slotError={slotError}
          onUpload={upload}
          onReplace={replace}
          onSaveText={saveText}
          onRemove={remove}
          onMove={move}
          onPreview={() => setPreviewSlug(category.slug)}
        />
      ))}

      {dialog}
    </div>
  );
}

/* ------------------------------------------------------------- one category */

function CategoryCard({
  category,
  busy,
  slotError,
  onUpload,
  onReplace,
  onSaveText,
  onRemove,
  onMove,
  onPreview,
}: {
  category: AdminMenuCategory;
  busy: string | null;
  slotError: Record<string, string>;
  onUpload: (category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) => Promise<void>;
  onReplace: (category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) => Promise<void>;
  onSaveText: (category: AdminMenuCategory, image: AdminMenuImage, patch: Partial<Draft>) => Promise<void>;
  onRemove: (category: AdminMenuCategory, image: AdminMenuImage) => void;
  onMove: (category: AdminMenuCategory, index: number, delta: number) => Promise<void>;
  onPreview: () => void;
}) {
  const slots: Slot[] = Array.from({ length: MENU_IMAGES_PER_CATEGORY }, (_, index) => {
    const saved = category.images[index] ?? null;
    return {
      key: `${category.id}:${index}`,
      saved,
      draft: saved ? toDraft(saved) : null,
    };
  });

  return (
    <Card>
      <div className="space-y-4" data-menu-category={category.slug}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{category.name}</h2>
            <Badge tone={category.images.length ? "success" : "neutral"}>
              {category.images.length}/{MENU_IMAGES_PER_CATEGORY}
            </Badge>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onPreview}>
            <Icon name="image" className="h-3.5 w-3.5" />
            Preview this menu
          </Button>
        </div>

        {category.images.length === 0 ? (
          <p className="text-sm text-fg-soft">
            No pictures yet - the menu shows its section list across the full width.
          </p>
        ) : category.images.length >= MENU_IMAGES_PER_CATEGORY ? (
          <p className="text-sm text-fg-soft">
            All {MENU_IMAGES_PER_CATEGORY} slots are used. Remove one to add another.
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {slots.map((slot, index) => (
            <SlotCard
              key={slot.key}
              category={category}
              slot={slot}
              index={index}
              total={category.images.length}
              busy={busy === slot.key}
              orderBusy={busy === `${category.id}:order`}
              error={slotError[slot.key]}
              textBusy={busy === `${category.id}:${slot.saved?.id}`}
              textError={slot.saved ? slotError[`${category.id}:${slot.saved.id}`] : undefined}
              onUpload={onUpload}
              onReplace={onReplace}
              onSaveText={onSaveText}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- one slot */

function SlotCard({
  category,
  slot,
  index,
  total,
  busy,
  orderBusy,
  error,
  textBusy,
  textError,
  onUpload,
  onReplace,
  onSaveText,
  onRemove,
  onMove,
}: {
  category: AdminMenuCategory;
  slot: Slot;
  index: number;
  total: number;
  busy: boolean;
  orderBusy: boolean;
  error?: string;
  textBusy: boolean;
  textError?: string;
  onUpload: (category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) => Promise<void>;
  onReplace: (category: AdminMenuCategory, slotKey: string, file: File, slot: Slot) => Promise<void>;
  onSaveText: (category: AdminMenuCategory, image: AdminMenuImage, patch: Partial<Draft>) => Promise<void>;
  onRemove: (category: AdminMenuCategory, image: AdminMenuImage) => void;
  onMove: (category: AdminMenuCategory, index: number, delta: number) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const saved = slot.saved;
  const draft = slot.draft;
  const full = total >= MENU_IMAGES_PER_CATEGORY && !saved;

  return (
    <div className="space-y-3 rounded-xl border border-outline bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Image {index + 1}
        </span>
        {saved && (
          <div className="flex items-center gap-0.5">
            <IconButton
              label={`Move the ${category.name} picture ${index + 1} earlier`}
              name="chevron"
              className="-rotate-90"
              disabled={index === 0 || orderBusy}
              onClick={() => void onMove(category, index, -1)}
            />
            <IconButton
              label={`Move the ${category.name} picture ${index + 1} later`}
              name="chevron"
              className="rotate-90"
              disabled={index === total - 1 || orderBusy}
              onClick={() => void onMove(category, index, 1)}
            />
            <IconButton
              label={`Remove the ${category.name} picture ${index + 1}`}
              name="trash"
              filled
              danger
              onClick={() => saved && onRemove(category, saved)}
            />
          </div>
        )}
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (!file || full || busy) return;
          if (saved) void onReplace(category, slot.key, file, slot);
          else void onUpload(category, slot.key, file, slot);
        }}
        className={cx(
          "relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-field",
          full && "opacity-60",
        )}
      >
        {saved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={saved.imagePath} alt="" className="h-full w-full object-cover" />
        ) : full ? (
          <span className="px-4 text-center text-xs text-fg-muted">
            This slot is empty.
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-fg-faint">
            <Icon name="image" className="h-6 w-6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              Drop or choose
            </span>
          </span>
        )}

        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-bg/80">
            <Spinner className="h-5 w-5 text-fg-soft" />
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || full) return;
          if (saved) void onReplace(category, slot.key, file, slot);
          else void onUpload(category, slot.key, file, slot);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={full || (saved ? undefined : total >= MENU_IMAGES_PER_CATEGORY)}
          onClick={() => inputRef.current?.click()}
        >
          {saved ? "Replace" : "Choose file"}
        </Button>
        {saved && saved.originalName && (
          <span className="self-center truncate text-xs text-fg-muted" title={saved.originalName}>
            {saved.originalName}
          </span>
        )}
      </div>

      {!saved && !full && (
        <p className="text-xs text-fg-muted">JPG, PNG or WebP up to 3MB.</p>
      )}

      {(error || textError) && (
        <p className="text-xs font-medium text-terracotta">{error ?? textError}</p>
      )}

      {draft && saved && (
        <div className="space-y-3 border-t border-outline pt-3">
          <Field
            label="Caption"
            htmlFor={`${category.id}-${saved.id}-caption`}
            hint="Shown over the picture. Also used as the alt text."
          >
            <Input
              id={`${category.id}-${saved.id}-caption`}
              defaultValue={draft.caption}
              maxLength={200}
              placeholder="A walnut dining table in a panelled room"
              onBlur={(event) => {
                if (event.target.value !== (saved.caption ?? "")) {
                  void onSaveText(category, saved, { caption: event.target.value });
                }
              }}
            />
          </Field>

          <Field
            label="Link"
            htmlFor={`${category.id}-${saved.id}-link`}
            hint="Optional. Starts with /, or a full https:// address. Empty links to the category."
          >
            <Input
              id={`${category.id}-${saved.id}-link`}
              defaultValue={draft.linkUrl}
              maxLength={500}
              placeholder="/shop/living-room/sofas"
              onBlur={(event) => {
                if (event.target.value !== (saved.linkUrl ?? "")) {
                  void onSaveText(category, saved, { linkUrl: event.target.value });
                }
              }}
            />
          </Field>

          {textBusy && (
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <Spinner className="h-3 w-3" /> Saving…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- preview */

/**
 * A drawing of the storefront panel. Mirrors the storefront's rules - one picture
 * fills the column, two sit side by side, three are one large over two small -
 * so what the admin sees here is the arrangement the website will use.
 */
function PanelPreview({ category }: { category: AdminMenuCategory }) {
  const images = category.images;

  return (
    <div className="rounded-2xl border border-outline bg-[#f6f6f4] p-5">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-neutral-200 pb-3">
        <div>
          <p className="font-display text-base font-semibold text-neutral-900">{category.name}</p>
          <p className="text-xs text-neutral-500">Section list and pictures, side by side</p>
        </div>
        <span className="text-xs font-semibold text-neutral-700">View all</span>
      </div>

      <div
        className={
          images.length
            ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
            : "grid grid-cols-1"
        }
      >
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Shop by type
          </p>
          {["First item", "Second item", "Third item"].map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
            >
              <span className="size-8 shrink-0 rounded-md bg-neutral-100" />
              <span className="text-xs font-medium text-neutral-900">{label}</span>
            </div>
          ))}
        </div>

        {images.length > 0 ? (
          <div
            className={
              images.length === 3
                ? "grid h-52 grid-cols-2 grid-rows-[1.25fr_1fr] gap-2"
                : images.length === 2
                  ? "grid grid-cols-2 gap-2"
                  : undefined
            }
          >
            {images.map((image, index) => (
              <div
                key={image.id}
                className={cx(
                  "relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100",
                  images.length === 3 && index === 0 && "col-span-2",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.imagePath} alt="" className="h-full w-full object-cover" />
                {image.caption && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1 text-[10px] font-medium text-white">
                    {image.caption}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-400">
            No pictures - the list uses the full width
          </div>
        )}
      </div>
    </div>
  );
}

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
        className,
      )}
    >
      <Icon name={name} className="h-3.5 w-3.5" filled={filled} />
    </button>
  );
}