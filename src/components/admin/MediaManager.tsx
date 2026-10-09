"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, EmptyState, Input, cx } from "./ui";
import { Icon } from "./icons";
import type { MediaSlotState } from "@/lib/media-slots";

type LibraryFile = {
  id: number;
  url: string;
  thumb_url: string | null;
  original_name: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

function kb(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Slot assignments and the media library share one page so the admin can see the
 * consequence of a choice: pick a slot on the left, then upload or pick a file.
 */
export function MediaManager({ initialSlots }: { initialSlots: MediaSlotState[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [activeKey, setActiveKey] = useState<string>(initialSlots[0]?.def.key ?? "");
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const active = slots.find((s) => s.def.key === activeKey) ?? slots[0] ?? null;

  const grouped = useMemo(() => {
    const out = new Map<string, MediaSlotState[]>();
    for (const s of slots) {
      const list = out.get(s.def.group) ?? [];
      list.push(s);
      out.set(s.def.group, list);
    }
    return [...out.entries()];
  }, [slots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) =>
      (f.original_name ?? "").toLowerCase().includes(q),
    );
  }, [files, search]);

  const flash = (msg: string) => {
    setSaved(msg);
    setError(null);
    window.setTimeout(() => setSaved(null), 2500);
  };

  const loadLibrary = useCallback(async () => {
    const res = await fetch("/api/admin/media", { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load the media library.");
      return;
    }
    const data = await res.json();
    setFiles(data.uploads ?? []);
  }, []);

  /** Write a slot assignment. `url: null` clears it back to the placeholder. */
  async function assign(url: string | null, altText?: string) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotKey: active.def.key,
          url,
          ...(altText === undefined ? {} : { altText }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update that slot.");
        return;
      }

      setSlots((prev) =>
        prev.map((s) =>
          s.def.key === active.def.key
            ? {
                ...s,
                current: url
                  ? {
                      url,
                      thumbUrl: data.slot.thumb_url ?? null,
                      variant400Url: data.slot.variant_400_url ?? null,
                      variant1200Url: data.slot.variant_1200_url ?? null,
                      variant2560Url: data.slot.variant_2560_url ?? null,
                      variant3840Url: data.slot.variant_3840_url ?? null,
                      variants: [],
                      alt: data.slot.alt_text || s.current?.alt || s.def.alt,
                      width: data.slot.width ?? null,
                      height: data.slot.height ?? null,
                      originalWidth: data.slot.original_width ?? null,
                      originalHeight: data.slot.original_height ?? null,
                      bytes: data.slot.bytes ?? null,
                    }
                  : null,
              }
            : s,
        ),
      );
      flash(url ? "Slot updated." : "Slot cleared.");
      setLibraryOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("slot", active.def.key);

      const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      await assign(data.url);
      await loadLibrary();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeFile(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete that file.");
        return;
      }
      await loadLibrary();
      flash("File deleted.");
    } finally {
      setBusy(false);
    }
  }

  const filled = slots.filter((s) => s.current).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">{saved}</Alert>}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Slots</h2>
              <p className="text-sm text-fg-soft">
                {filled} of {slots.length} filled. Click a slot to edit it.
              </p>
            </div>
            {active?.current && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => assign(null)}
              >
                Clear this slot
              </Button>
            )}
          </div>

          <div className="mt-5 space-y-6">
            {grouped.map(([group, items]) => (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-soft">
                  {group}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map(({ def, current }) => {
                    const isActive = def.key === active?.def.key;
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => setActiveKey(def.key)}
                        aria-pressed={isActive}
                        className={cx(
                          "group overflow-hidden rounded-lg border text-left transition",
                          isActive
                            ? "border-accent ring-2 ring-accent/30"
                            : "border-outline hover:border-accent/50",
                        )}
                      >
                        <div className="relative aspect-4/3 bg-surface-soft">
                          {current ? (
                            <Image
                              src={current.thumbUrl ?? current.url}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 50vw, 200px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-fg-soft">
                              Empty
                            </span>
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="truncate text-xs font-medium">{def.label}</p>
                          <p className="truncate text-[11px] text-fg-soft">
                            {def.kind === "vector" ? "Logo / SVG" : "Photo"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <h2 className="font-display text-base font-semibold">
            {active ? active.def.label : "Select a slot"}
          </h2>
          {active && (
            <p className="mt-1 font-mono text-[11px] text-fg-soft">{active.def.key}</p>
          )}

          <div className="mt-4 space-y-3">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={active?.def.kind === "vector" ? "image/svg+xml,image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <Button
              className="w-full"
              disabled={!active || busy}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="plus" className="h-4 w-4" />
              {busy ? "Working…" : "Upload & assign"}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!active || busy}
              onClick={async () => {
                setLibraryOpen((v) => !v);
                if (!libraryOpen) await loadLibrary();
              }}
            >
              <Icon name="image" className="h-4 w-4" />
              Choose from library
            </Button>
            <p className="text-xs text-fg-soft">
              JPG, PNG or WebP up to 5 MB.
              {active?.def.kind === "vector" ? " SVG is allowed for this slot." : ""}
            </p>
          </div>
        </Card>

        {libraryOpen && (
          <Card>
            <Input
              placeholder="Search library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search media library"
            />

            {filtered.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No files yet"
                  description="Upload an image to start the library."
                />
              </div>
            ) : (
              <ul className="mt-4 grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
                {filtered.map((f) => (
                  <li key={f.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => assign(f.url)}
                      className="block w-full overflow-hidden rounded border border-outline"
                      title={f.original_name ?? f.url}
                    >
                      <span className="relative block aspect-square bg-surface-soft">
                        <Image
                          src={f.thumb_url ?? f.url}
                          alt=""
                          fill
                          sizes="100px"
                          className="object-cover"
                          unoptimized
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      disabled={busy}
                      aria-label={`Delete ${f.original_name ?? "image"}`}
                      className="absolute right-1 top-1 hidden rounded bg-black/70 p-1 text-white group-hover:block"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                    <p className="mt-1 truncate text-[10px] text-fg-soft">
                      {kb(f.bytes)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </aside>
    </div>
  );
}