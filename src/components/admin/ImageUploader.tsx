"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "./icons";
import { Button, Field, Input, Spinner, cx } from "./ui";

/**
 * The one image uploader for the admin catalogue.
 *
 * Used by the category form, the subcategory form and the gallery manager, so
 * "jpg, png or webp up to 5MB" and the preview/replace/remove behaviour exist in
 * exactly one place. It talks to whichever endpoint the caller names; every one
 * of those endpoints funnels into the same server handler (`storeUpload`), so
 * the real work - magic-byte sniffing, re-encode, thumbnail, safe filename,
 * `media_uploads` row - is shared too.
 *
 * Notes for the modal it lives in:
 *  - progress needs `XMLHttpRequest`; `fetch` cannot report upload progress, and
 *    a gallery drop of ten files with no feedback looks broken.
 *  - nothing here sets its own height or scroll, so the dialog's body stays the
 *    only scrolling region and the footer stays pinned.
 */

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface UploadResponse {
  ok?: boolean;
  id?: number;
  url?: string;
  thumbUrl?: string | null;
  error?: string;
  /** Gallery uploads return the row they created. */
  item?: unknown;
}

/** Rejects the wrong type or an oversized file before a byte leaves the browser. */
export function localFileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  const looksRight =
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    /\.(jpe?g|png|webp)$/.test(name);

  if (!looksRight) {
    return `${file.name}: only JPG, PNG or WebP files can be uploaded.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: that file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. The limit is 5MB.`;
  }
  return null;
}

/** POSTs one file with progress. A dropped session is reported as such. */
export function uploadWithProgress(
  file: File,
  url: string,
  options: {
    fields?: Record<string, string>;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(options.fields ?? {})) {
      form.append(key, value);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const data = (xhr.response ?? {}) as UploadResponse;
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!data.url) {
          reject(new Error("Upload failed: the server did not return a URL."));
          return;
        }
        resolve(data);
        return;
      }

      const fallback =
        xhr.status === 401
          ? "Your session has expired. Sign in again, then retry the upload."
          : xhr.status === 403
            ? "Cross-origin upload blocked. Reload the page and try again."
            : `Upload failed (${xhr.status}).`;

      reject(new Error(data.error || fallback));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Could not reach the server. Check your connection and that your session has not expired, then try again.",
        ),
      );

    xhr.send(form);
  });
}

export interface ImageUploaderProps {
  label: string;
  /** The stored URL, or "" when there is no picture. */
  value: string;
  alt?: string;
  showAlt?: boolean;
  /** Multipart POST target. */
  uploadUrl: string;
  /** DELETE target that clears the picture server-side. */
  removeUrl?: string;
  hint?: string;
  disabled?: boolean;
  /** The parent owns the URL; this only reports what changed. */
  onChange: (next: { url: string; alt?: string }) => void;
  /** Raw response, for callers that need the created row id. */
  onUploaded?: (data: UploadResponse) => void;
}

export function ImageUploader({
  label,
  value,
  alt = "",
  showAlt = true,
  uploadUrl,
  removeUrl,
  hint = "JPG, PNG or WebP up to 5MB.",
  disabled = false,
  onChange,
  onUploaded,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(file: File) {
    setError(null);

    const problem = localFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const data = await uploadWithProgress(file, uploadUrl, {
        onProgress: setProgress,
      });
      onChange({ url: data.url ?? "", alt });
      onUploaded?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function remove() {
    setError(null);

    // Without a server target the parent clears its own draft on save; with one,
    // the file and its row go too, which is what "remove" has to mean.
    if (!value || !removeUrl) {
      onChange({ url: "", alt });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(removeUrl, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not remove that image.");
        return;
      }
      onChange({ url: "", alt });
    } catch {
      setError(
        "Could not reach the server. Check your connection and that your session has not expired, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;

    const file = event.dataTransfer.files?.[0];
    if (file) void accept(file);
  }

  const working = uploading || busy;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold tracking-wide text-fg uppercase">
        {label}
      </span>

      <div className="flex flex-wrap items-start gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => {
            if (!disabled && !working) inputRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!disabled && !working) inputRef.current?.click();
            }
          }}
          aria-label={`Upload ${label}`}
          className={cx(
            "relative flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-field",
            dragging ? "border-dashed border-accent" : "border-outline",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-fg-faint">
              <Icon name="image" className="h-6 w-6" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                Drop or click
              </span>
            </span>
          )}

          {working && (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/80">
              <Spinner className="h-5 w-5 text-fg-soft" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void accept(file);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {value ? "Replace" : "Choose file"}
            </Button>

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || working}
                onClick={() => void remove()}
              >
                <Icon name="trash" className="h-3.5 w-3.5" filled />
                Remove
              </Button>
            )}
          </div>

          {uploading && progress > 0 && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-fill-strong"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {!uploading && !value && !disabled && (
            <p className="text-xs text-fg-muted">
              Drag a picture here, or choose a file. {hint}
            </p>
          )}
          {value && !uploading && (
            <p className="truncate text-xs text-fg-muted" title={value}>
              {value}
            </p>
          )}

          {error && <p className="text-xs font-medium text-terracotta">{error}</p>}
        </div>
      </div>

      {showAlt && (
        <Field
          label="Alt text"
          htmlFor={`uploader-alt`}
          hint="Read aloud by screen readers. Describe the picture, not the product."
        >
          <Input
            id="uploader-alt"
            value={alt}
            maxLength={300}
            disabled={disabled}
            placeholder="Solid oak dining table in a panelled room"
            onChange={(event) => onChange({ url: value, alt: event.target.value })}
          />
        </Field>
      )}
    </div>
  );
}