"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";
import { Button, cx } from "./ui";
import {
  MAX_IMAGE_URL_LENGTH,
  NOT_A_DIRECT_IMAGE,
  imageUrlProblem,
  isPinterestLink,
  looksLikeDirectImage,
  normalizeImageUrl,
} from "@/lib/image-link";

/**
 * The one way an admin sets a picture.
 *
 * A link is the only method: paste an https address and it is previewed live and
 * stored as a string, so it survives a redeploy because it was never on this
 * server's disk. There is no device upload anywhere in the admin.
 *
 * Used by the media slots, menu images, categories, subcategories, gallery,
 * products, banners and the logo, so the validation, preview and remove
 * behaviour exist once.
 */

export interface ImageLinkInputProps {
  /** The stored URL, or "" when there is no picture. */
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Classes on the preview tile. */
  previewClassName?: string;
}

export function ImageLinkInput({
  value,
  onChange,
  label = "Image",
  hint,
  disabled = false,
  previewClassName,
}: ImageLinkInputProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const resolving = useRef(false);

  const normalized = normalizeImageUrl(value);
  const problem = imageUrlProblem(value);

  // Reset a failed live-preview when the URL changes. "Adjust state during
  // render" (the documented previous-value pattern) avoids a set-in-effect.
  const [prevValue, setPrevValue] = useState<string>(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLoadFailed(false);
    setPreviewSrc(null);
  }

  const src = previewSrc || (problem ? "" : normalized);
  const showImage = Boolean(src) && !loadFailed;
  const direct = looksLikeDirectImage(value);
  const message = problem ?? (loadFailed ? NOT_A_DIRECT_IMAGE : null);

  // A pasted page (Pinterest) does not render in an <img>. When the preview
  // fails and the link looks like a page host, ask the server for the direct
  // image address and preview that instead.
  function previewOnError() {
    if (loadFailed || resolving.current) return;
    setLoadFailed(true);
    if (!isPinterestLink(value)) return;
    void (async () => {
      resolving.current = true;
      try {
        const res = await fetch(
          `/api/admin/resolve-image?link=${encodeURIComponent(value)}`,
        );
        const data = (await res.json()) as { url?: string };
        if (data?.url && data.url !== normalized) {
          setPreviewSrc(data.url);
          setLoadFailed(false);
        }
      } catch {
        // A failed resolution never blocks editing - the link is kept as-is.
      } finally {
        resolving.current = false;
      }
    })();
  }

  return (
    <div className="space-y-2">
      {label && (
        <span className="block text-xs font-semibold tracking-wide text-fg uppercase">
          {label}
        </span>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cx(
            "relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline bg-field",
            previewClassName,
          )}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={previewOnError}
            />
          ) : (
            <Icon name="image" className="h-6 w-6 text-fg-faint" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="text"
            value={value}
            disabled={disabled}
            maxLength={MAX_IMAGE_URL_LENGTH}
            onChange={(event) => {
              setLoadFailed(false);
              setPreviewSrc(null);
              onChange(normalizeImageUrl(event.target.value));
            }}
            placeholder="Paste image link (https://...)"
            aria-label={`${label} link`}
            className="w-full rounded-xl border border-outline bg-field px-3 py-2 text-xs text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center gap-2">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setLoadFailed(false);
                  onChange("");
                }}
              >
                <Icon name="trash" className="h-3.5 w-3.5" filled />
                Remove
              </Button>
            )}

            {direct && (
              <span className="text-xs font-medium text-sage-dark dark:text-sage-light">
                Direct image
              </span>
            )}
          </div>

          {hint && !message && <p className="text-xs text-fg-muted">{hint}</p>}
          {message && <p className="text-xs font-medium text-terracotta">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default ImageLinkInput;
