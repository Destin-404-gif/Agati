import Image, { type ImageProps } from "next/image";
import type { MediaAsset } from "@/lib/media-slots";

/**
 * The neutral stand-in for a slot the admin has not filled yet.
 *
 * Deliberately quiet: a soft sage field, a thin timber glyph and the slot's
 * name, so an empty slot reads as "not set yet" rather than as a broken image.
 * It keeps the surrounding layout identical to a filled slot, which is what
 * stops the page from jumping when a picture is added later.
 */
export function MediaPlaceholder({
  className = "",
  label,
  compact = false,
}: {
  className?: string;
  label?: string;
  /** Single-line variant for small tiles such as thumbnails and mega-menu panels. */
  compact?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={label ? `${label} - no image uploaded yet` : "No image uploaded yet"}
      className={`flex size-full flex-col items-center justify-center gap-2 bg-sage/12 text-espresso/35 ${className}`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className={compact ? "size-6" : "size-10 sm:size-12"}
      >
        <rect
          x="6"
          y="14"
          width="36"
          height="24"
          rx="4"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M6 32l10-9 8 7 7-6 11 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="22" r="2.6" fill="currentColor" />
      </svg>
      {!compact && label && (
        <span className="px-4 text-center text-[10px] font-semibold uppercase tracking-[0.18em]">
          {label}
        </span>
      )}
    </div>
  );
}

type MediaImageProps = Omit<ImageProps, "src" | "alt"> & {
  asset: MediaAsset | null;
  /** Shown on the placeholder when the slot has no image. */
  placeholderLabel?: string;
  /** Required by next/image even when the asset turns out to be empty. */
  alt?: string;
};

/**
 * Renders a database-backed image, or the neutral placeholder when the slot is
 * empty. Same interface as `next/image` so call sites stay a one-word swap from
 * a hardcoded `src`.
 */
export default function MediaImage({
  asset,
  placeholderLabel,
  alt,
  fill,
  className = "",
  ...rest
}: MediaImageProps) {
  if (!asset?.url) {
    return (
      <MediaPlaceholder
        label={placeholderLabel}
        compact={!fill}
        className={fill ? "absolute inset-0" : className}
      />
    );
  }

  return (
    <Image
      src={asset.url}
      alt={alt ?? asset.alt}
      fill={fill}
      className={className}
      {...rest}
    />
  );
}